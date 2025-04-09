import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { JSONRPCMessage, JSONRPCRequest } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import winston from 'winston';
import { methods } from './methods.js';

export interface SseToStdioArgs {
    sseUrl: string;
    logger: winston.Logger;
    headers?: string[];
}

// JSON-RPC message schemas
const jsonRpcRequestSchema = z.object({
    jsonrpc: z.literal('2.0'),
    method: z.string(),
    params: z.any().optional(),
    id: z.union([z.string(), z.number()])
});

const jsonRpcResponseSchema = z.object({
    jsonrpc: z.literal('2.0'),
    id: z.union([z.string(), z.number()]),
    result: z.any().optional(),
    error: z.object({
        code: z.number(),
        message: z.string()
    }).optional()
});

const jsonRpcNotificationSchema = z.object({
    jsonrpc: z.literal('2.0'),
    method: z.string(),
    params: z.any().optional()
});

// Log message schema
const logMessageSchema = z.object({
    level: z.string(),
    message: z.string(),
    timestamp: z.string()
});

// Helper function to extract JSON-RPC message from log message
function extractJsonRpcMessage(logMessage: string): JSONRPCMessage | null {
    try {
        // Look for JSON-RPC message in the log message
        const match = logMessage.match(/\{.*\}/);
        if (match) {
            const jsonStr = match[0];
            const jsonRpcMessage = JSON.parse(jsonStr);
            if (jsonRpcMessage.jsonrpc === '2.0') {
                return jsonRpcMessage;
            }
        }
    } catch (err) {
        // If parsing fails, return null
    }
    return null;
}

export async function sseToStdio(args: SseToStdioArgs) {
    const { sseUrl, logger, headers: cliHeaders = [] } = args;
    
    // Log initial setup
    logger.info('[INIT] Starting sseToStdio with config:', {
        sseUrl,
        headers: cliHeaders,
        logLevel: logger.level
    });
    
    // Parse headers from CLI format to object
    const headers: Record<string, string> = {};
    cliHeaders.forEach(header => {
        const [key, value] = header.split(':').map(s => s.trim());
        if (key && value) {
            headers[key] = value;
        }
    });

    logger.info(`[SSE-CONN] Connecting to SSE server at ${sseUrl}`);
    logger.info(`[SSE-CONN] Headers: ${cliHeaders.length ? JSON.stringify(cliHeaders) : '(none)'}`);

    // Create SSE client transport with detailed logging
    const sseTransport = new SSEClientTransport(new URL(sseUrl), {
        eventSourceInit: {
            fetch: (...props: Parameters<typeof fetch>) => {
                const [url, init = {}] = props;
                logger.info('[SSE-REQ] Fetch request:', { url, init });
                return fetch(url, { 
                    ...init, 
                    headers: { ...init.headers, ...headers },
                }).then(response => {
                    logger.info('[SSE-RES] Fetch response:', {
                        status: response.status,
                        statusText: response.statusText,
                        headers: Object.fromEntries(response.headers.entries())
                    });
                    return response;
                }).catch(err => {
                    logger.error('[SSE-ERR] Fetch error:', err);
                    throw err;
                });
            },
        },
        requestInit: {
            headers,
        },
    });

    // Handle SSE connection errors
    sseTransport.onerror = (err) => {
        logger.error('[SSE-ERR] Connection error:', err);
        process.exit(1);
    };

    // Create MCP client
    const sseClient = new Client(
        { name: 'cloudmcp-connect', version: '1.0.0' },
        { capabilities: {} }
    );

    // Connect to SSE server
    try {
        logger.info('[SSE-CONN] Attempting to connect to SSE server...');
        await sseClient.connect(sseTransport);
        logger.info('[SSE-CONN] Connected successfully');
    } catch (err) {
        logger.error('[SSE-ERR] Failed to connect to SSE server:', err);
        throw err;
    }

    // Create stdio server
    const stdioServer = new Server(
        sseClient.getServerVersion() ?? {
            name: 'cloudmcp-connect',
            version: '1.0.0',
        },
        { 
            capabilities: {
                ...sseClient.getServerCapabilities(),
                methods: Object.keys(methods)
            }
        }
    );

    // Create stdio transport
    const stdioTransport = new StdioServerTransport();
    await stdioServer.connect(stdioTransport);

    // Handle messages from stdio
    stdioServer.transport!.onmessage = async (message: JSONRPCMessage) => {
        try {
            // Parse the message
            const parsedMessage = JSON.parse(JSON.stringify(message));
            
            // Skip if it's a log message
            if (parsedMessage.level && parsedMessage.message && parsedMessage.timestamp) {
                logger.info('[STDIO-IN] Ignoring log message');
                return;
            }

            // First try to parse as a JSON-RPC request
            try {
                const validatedMessage = jsonRpcRequestSchema.parse(parsedMessage);
                
                // Check if this is a local method
                if (methods[validatedMessage.method]) {
                    const method = methods[validatedMessage.method];
                    try {
                        // Validate params
                        const params = method.params.parse(validatedMessage.params);
                        // Call handler
                        const result = await method.handler(params);
                        // Validate result
                        const validatedResult = method.result.parse(result);
                        // Send response
                        const response = {
                            jsonrpc: '2.0',
                            id: validatedMessage.id,
                            result: validatedResult
                        };
                        // Write a single clean JSON message
                        const message = JSON.stringify(response);
                        process.stdout.write(message + '\n');
                        return;
                    } catch (err) {
                        logger.error('[LOCAL-ERR] Method error:', err);
                        const errorResp = {
                            jsonrpc: '2.0',
                            id: validatedMessage.id,
                            error: {
                                code: -32603,
                                message: err instanceof Error ? err.message : 'Internal error'
                            }
                        };
                        // Write a single clean JSON message
                        const message = JSON.stringify(errorResp);
                        process.stdout.write(message + '\n');
                        return;
                    }
                }
                
                try {
                    // Handle initialization messages specially
                    if (validatedMessage.method === 'initialize') {
                        const result = await sseClient.request(validatedMessage, z.any());
                        const response = {
                            jsonrpc: '2.0',
                            id: validatedMessage.id,
                            result: typeof result === 'string' ? JSON.parse(result) : result
                        };
                        process.stdout.write(JSON.stringify(response) + '\n');
                        return;
                    }
                    
                    const result = await sseClient.request(validatedMessage, z.any());
                    // Ensure we're passing an object, not a string
                    const responseObj = {
                        jsonrpc: '2.0',
                        id: validatedMessage.id,
                        result: typeof result === 'string' ? JSON.parse(result) : result
                    };
                    // Write a single clean JSON message
                    const message = JSON.stringify(responseObj);
                    process.stdout.write(message + '\n');
                } catch (err) {
                    logger.error('[SSE-ERR] Request error:', err);
                    const errorCode = err && typeof err === 'object' && 'code' in err
                        ? (err as any).code
                        : -32000;
                    const errorMsg = err && typeof err === 'object' && 'message' in err
                        ? (err as any).message
                        : 'Internal error';
                    
                    // Remove MCP error prefix if present
                    const prefix = `MCP error ${errorCode}:`;
                    const finalErrorMsg = errorMsg.startsWith(prefix) 
                        ? errorMsg.slice(prefix.length).trim()
                        : errorMsg;
                    
                    // Create a clean error object
                    const errorObj = {
                        jsonrpc: '2.0',
                        id: validatedMessage.id,
                        error: {
                            code: errorCode,
                            message: finalErrorMsg
                        }
                    };
                    
                    // Ensure we're not double-stringifying
                    const message = typeof errorObj === 'string' ? errorObj : JSON.stringify(errorObj);
                    process.stdout.write(message + '\n');
                }
                return;
            } catch (err) {
                logger.info('[STDIO-IN] Failed to parse as JSON-RPC request:', err);
                // Not a request, continue to try notification
            }

            // Try to parse as a JSON-RPC notification
            try {
                const validatedMessage = jsonRpcNotificationSchema.parse(parsedMessage);
                await sseTransport.send(validatedMessage);
                return;
            } catch (err) {
                logger.info('[STDIO-IN] Failed to parse as JSON-RPC notification:', err);
                // Not a notification, log and ignore
                logger.info('[STDIO-IGNORE] Non-JSON-RPC message:', parsedMessage);
            }
        } catch (err) {
            logger.error('[STDIO-ERR] Invalid message format:', err);
            // Don't send invalid messages to stdout
        }
    };

    logger.info('[STDIO] Server listening');
} 
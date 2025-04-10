import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { JSONRPCMessage, JSONRPCRequest } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import winston from 'winston';
import { methods } from './methods.js';

export interface Logger {
    info: (message: string, data?: any) => void;
    error: (message: string, data?: any) => void;
    warn: (message: string, data?: any) => void;
    debug: (message: string, data?: any) => void;
}

export interface SseToStdioArgs {
    sseUrl: string;
    logger: Logger;
    headers?: string[];
}

// JSON-RPC message schemas
const jsonRpcRequestSchema = z.object({
    jsonrpc: z.literal('2.0'),
    method: z.string(),
    params: z.any().optional(),
    id: z.union([z.string(), z.number()]).optional()
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

// Helper function to send JSON-RPC notifications for logs
function sendLogNotification(level: string, message: string, data?: any) {
    const notification = {
        jsonrpc: '2.0',
        method: 'log',
        params: {
            level,
            message,
            data,
            timestamp: new Date().toISOString()
        }
    };
    process.stdout.write(JSON.stringify(notification) + '\n');
}

// Create a minimal logger that only outputs JSON-RPC messages
const logger = {
    info: (message: string, data?: any) => sendLogNotification('info', message, data),
    error: (message: string, data?: any) => sendLogNotification('error', message, data),
    warn: (message: string, data?: any) => sendLogNotification('warn', message, data),
    debug: (message: string, data?: any) => sendLogNotification('debug', message, data)
};

// Send initialization message as JSON-RPC
logger.info('Logger initialized');

export async function sseToStdio(args: SseToStdioArgs) {
    const { sseUrl, headers: cliHeaders = [] } = args;
    
    // IMPORTANT: Only write JSON-RPC messages to stdout
    // All other output (logs, debug info) must go to stderr
    // The logger is configured to use stderr for all output
    logger.info('[INIT] Starting sseToStdio with config:', {
        sseUrl,
        headers: cliHeaders,
        logLevel: 'info'  // Hardcode the log level since we removed Winston
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
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        // Send error as JSON-RPC notification
        const errorNotification = {
            jsonrpc: '2.0',
            method: 'error',
            params: {
                level: 'error',
                message: 'Connection error: ' + errorMessage,
                timestamp: new Date().toISOString()
            }
        };
        process.stdout.write(JSON.stringify(errorNotification) + '\n');
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
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        // Send error as JSON-RPC notification
        const errorNotification = {
            jsonrpc: '2.0',
            method: 'error',
            params: {
                level: 'error',
                message: 'Failed to connect to SSE server: ' + errorMessage,
                timestamp: new Date().toISOString()
            }
        };
        process.stdout.write(JSON.stringify(errorNotification) + '\n');
        process.exit(1);
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

    // Handle stdio server errors
    stdioServer.onerror = (err) => {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        // Send error as JSON-RPC notification
        const errorNotification = {
            jsonrpc: '2.0',
            method: 'error',
            params: {
                level: 'error',
                message: 'Stdio server error: ' + errorMessage,
                timestamp: new Date().toISOString()
            }
        };
        process.stdout.write(JSON.stringify(errorNotification) + '\n');
        process.exit(1);
    };

    // Create stdio transport
    const stdioTransport = new StdioServerTransport();
    await stdioServer.connect(stdioTransport);

    // Handle messages from stdio
    stdioServer.transport!.onmessage = async (message: any) => {
        try {
            // Parse the message
            let parsedMessage;
            try {
                parsedMessage = JSON.parse(JSON.stringify(message));
            } catch (parseErr) {
                logger.error('[STDIO-IN] Failed to parse message as JSON:', parseErr);
                return;
            }
            
            // Skip if it's a log message
            if (parsedMessage.level && parsedMessage.message && parsedMessage.timestamp) {
                logger.info('[STDIO-IN] Ignoring log message');
                return;
            }

            // First check if it's a notification message
            if (parsedMessage.method?.startsWith('notifications/')) {
                const validatedMessage = jsonRpcNotificationSchema.parse(parsedMessage);
                await sseTransport.send(validatedMessage);
                return;
            }

            // Then try to parse as a JSON-RPC request
            const validatedMessage = jsonRpcRequestSchema.parse(parsedMessage);
            
            // Check if this is a local method
            if (methods[validatedMessage.method]) {
                const method = methods[validatedMessage.method];
                try {
                    // Validate params
                    const params = method.params.parse(validatedMessage.params);
                    // Call handler with SSE client
                    const result = await method.handler(params, sseClient);
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
            
            // Handle other messages
            const result = await sseClient.request(validatedMessage, z.any());
            const response = {
                jsonrpc: '2.0',
                id: validatedMessage.id,
                result: typeof result === 'string' ? JSON.parse(result) : result
            };
            process.stdout.write(JSON.stringify(response) + '\n');
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
                error: {
                    code: errorCode,
                    message: finalErrorMsg
                }
            };
            
            // Ensure we're not double-stringifying
            const message = typeof errorObj === 'string' ? errorObj : JSON.stringify(errorObj);
            process.stdout.write(message + '\n');
        }
    };

    logger.info('[STDIO] Server listening');
} 
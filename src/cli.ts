#!/usr/bin/env node

import { program } from 'commander';
import { sseToStdio, Logger } from './index.js';

interface CliOptions {
    url: string;
    logLevel: string;
    header: string[];
    clientId?: string;
    clientSecret?: string;
}

program
    .name('cloudmcp-connect')
    .description('Connect to MCP SSE servers and proxy them to stdio')
    .requiredOption('--url <url>', 'SSE server URL to connect to')
    .option('--logLevel <level>', 'Controls logging level', 'info')
    .option('--header <header>', 'Add a header to all responses (format: "Header-Name: value")', (value: string, previous: string[]) => {
        return previous ? [...previous, value] : [value];
    }, [])
    .option('--clientId <id>', 'Client ID for authentication')
    .option('--clientSecret <secret>', 'Client secret for authentication');

program.parse();

const options = program.opts() as CliOptions;

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
const logger: Logger = {
    info: (message: string, data?: any) => sendLogNotification('info', message, data),
    error: (message: string, data?: any) => sendLogNotification('error', message, data),
    warn: (message: string, data?: any) => sendLogNotification('warn', message, data),
    debug: (message: string, data?: any) => sendLogNotification('debug', message, data)
};

// Add a test log to verify logging is working
logger.info('Logger initialized with level:', options.logLevel);

// Add authentication headers if provided
if (options.clientId && options.clientSecret) {
    options.header = options.header || [];
    options.header.push(`Authorization: Basic ${Buffer.from(`${options.clientId}:${options.clientSecret}`).toString('base64')}`);
}

// Run in SSE to stdio mode
sseToStdio({
    sseUrl: options.url,
    logger,
    headers: options.header
}).catch((err: Error) => {
    logger.error('Failed to start SSE to stdio:', err);
    process.exit(1);
}); 
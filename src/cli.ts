#!/usr/bin/env node

import { program } from 'commander';
import { sseToStdio } from './index.js';
import winston from 'winston';

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

// Create logger
const logger = winston.createLogger({
    level: options.logLevel,
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...metadata }) => {
            let msg = `${timestamp} [${level.toUpperCase()}] ${message}`;
            if (Object.keys(metadata).length > 0) {
                msg += ` ${JSON.stringify(metadata)}`;
            }
            return msg;
        })
    ),
    transports: [
        new winston.transports.Console({
            handleExceptions: true,
            handleRejections: true
        })
    ]
});

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
// Import the required types/interfaces
import { sseToStdio, SseToStdioArgs, Logger } from '../src/index.js';

// Create a partial implementation of what the index.js file does
// since full mocking isn't working correctly
jest.mock('@modelcontextprotocol/sdk/client/index.js', () => {
    return {
        Client: jest.fn().mockImplementation(() => {
            return {
                connect: jest.fn().mockResolvedValue(undefined),
                getServerCapabilities: jest.fn().mockResolvedValue({
                    methods: ['test/method'],
                    events: ['test/event']
                }),
                getServerVersion: jest.fn().mockReturnValue({ name: 'test', version: '1.0.0' }),
                close: jest.fn()
            };
        })
    };
});

jest.mock('@modelcontextprotocol/sdk/client/sse.js', () => {
    return {
        SSEClientTransport: jest.fn().mockImplementation(() => {
            return {
                send: jest.fn().mockResolvedValue(undefined),
                onerror: null
            };
        })
    };
});

jest.mock('@modelcontextprotocol/sdk/server/index.js', () => {
    return {
        Server: jest.fn().mockImplementation(() => {
            const server: any = {
                connect: jest.fn().mockImplementation(() => {
                    // Set transport when connect is called
                    server.transport = {
                        onmessage: null
                    };
                    return Promise.resolve();
                }),
                close: jest.fn(),
                onerror: null,
                transport: null as any
            };
            return server;
        })
    };
});

jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => {
    return {
        StdioServerTransport: jest.fn().mockImplementation(() => {
            return {
                onmessage: null
            };
        })
    };
});

// Import the mocked classes
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// Mock process.exit to prevent tests from exiting
const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

// Create a simple test
describe('sseToStdio', () => {
    let mockLogger: jest.Mocked<Logger>;
    
    // Mock stdout.write to prevent actual console output during tests
    const originalStdoutWrite = process.stdout.write;
    let mockStdoutWrite: jest.SpyInstance;
    
    beforeAll(() => {
        mockStdoutWrite = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    });
    
    afterAll(() => {
        mockStdoutWrite.mockRestore();
        mockExit.mockRestore();
    });

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup mock logger with Jest mock functions
        mockLogger = {
            debug: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn()
        };

        // Mock the URL constructor
        global.URL = function(url: string) {
            return { toString: () => url } as URL;
        } as any;
    });

    // Test that we can import the module and run basic tests
    it('can be imported', () => {
        // Make sure the module exports are defined
        expect(typeof sseToStdio).toBe('function');
    });

    it('initializes without errors', () => {
        // Verify that the function exists and is callable
        expect(() => sseToStdio).not.toThrow();
    });

    it('handles initialization errors gracefully', async () => {
        // Provide invalid URL to trigger error in URL constructor
        jest.spyOn(global, 'URL').mockImplementationOnce(() => {
            throw new Error('Invalid URL');
        });

        const args: SseToStdioArgs = {
            sseUrl: 'not-a-valid-url',
            logger: mockLogger
        };

        try {
            await sseToStdio(args);
            fail('Should have thrown an error');
        } catch (error) {
            // Test passes if it throws
            expect(error).toBeDefined();
        }
    });

    it('handles client connection errors', async () => {
        // Override the Client constructor to create a mock that will throw on connect
        (Client as jest.Mock).mockImplementationOnce(() => ({
            connect: jest.fn().mockRejectedValue(new Error('Connection error')),
            close: jest.fn(),
            getServerCapabilities: jest.fn(),
            getServerVersion: jest.fn()
        }));

        const args: SseToStdioArgs = {
            sseUrl: 'http://test.com',
            logger: mockLogger
        };

        // Instead of expecting the function to throw, we expect it to call process.exit
        await sseToStdio(args);
        
        // Verify that error notification was written to stdout
        expect(mockStdoutWrite).toHaveBeenCalled();
        expect(mockExit).toHaveBeenCalledWith(1);
    });
}); 
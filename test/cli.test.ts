import { program } from 'commander';
import { SseToStdioArgs } from '../src/index.js';

// Mock the sseToStdio function
jest.mock('../src/index.js', () => ({
    sseToStdio: jest.fn().mockImplementation((args: SseToStdioArgs) => {
        // Just log the args for testing
        console.log('sseToStdio called with:', JSON.stringify(args));
        return Promise.resolve();
    })
}));

// Tests for CLI functionality
describe('CLI', () => {
    let originalArgv: string[];
    let mockExit: jest.SpyInstance;
    let mockConsoleError: jest.SpyInstance;
    let mockConsoleLog: jest.SpyInstance;

    beforeEach(() => {
        // Store original process.argv
        originalArgv = process.argv;
        // Mock process.exit and console methods
        mockExit = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
        mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
        mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
        // Clear all mocks
        jest.clearAllMocks();
        // Reset module cache to reload CLI
        jest.resetModules();
    });

    afterEach(() => {
        // Restore original process.argv
        process.argv = originalArgv;
        // Restore mocked functions
        mockExit.mockRestore();
        mockConsoleError.mockRestore();
        mockConsoleLog.mockRestore();
    });

    it('should parse required URL option', async () => {
        process.argv = ['node', 'cli.js', '--url', 'http://test-url.com'];
        
        // Import CLI module
        await import('../src/cli.js');
        
        // Verify that console.log was called with the expected args
        expect(mockConsoleLog).toHaveBeenCalledWith(
            'sseToStdio called with:',
            expect.stringContaining('http://test-url.com')
        );
    });

    it('should parse all options correctly', async () => {
        process.argv = [
            'node', 'cli.js',
            '--url', 'http://test-url.com',
            '--logLevel', 'debug',
            '--header', 'Authorization: Bearer token'
        ];
        
        // Import CLI module
        await import('../src/cli.js');
        
        // Verify that console.log was called with the expected args
        expect(mockConsoleLog).toHaveBeenCalledWith(
            'sseToStdio called with:',
            expect.stringContaining('Authorization: Bearer token')
        );
    });

    it('should handle multiple headers', async () => {
        process.argv = [
            'node', 'cli.js',
            '--url', 'http://test-url.com',
            '--header', 'Authorization: Bearer token',
            '--header', 'X-Custom-Header: value'
        ];
        
        // Import CLI module
        await import('../src/cli.js');
        
        // Verify that console.log was called with the expected args
        expect(mockConsoleLog).toHaveBeenCalledWith(
            'sseToStdio called with:',
            expect.stringContaining('X-Custom-Header: value')
        );
    });

    it('should handle sseToStdio errors', async () => {
        // Force an error to be thrown from sseToStdio
        const mockSseToStdio = jest.requireMock('../src/index.js').sseToStdio;
        mockSseToStdio.mockRejectedValueOnce(new Error('Connection failed'));

        process.argv = ['node', 'cli.js', '--url', 'http://test-url.com'];
        
        // Import CLI module
        await import('../src/cli.js');
        
        // Verify that exit was called with code 1
        expect(mockExit).toHaveBeenCalledWith(1);
    });
}); 
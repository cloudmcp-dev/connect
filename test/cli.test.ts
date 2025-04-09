import { program } from 'commander';
import { MCPServer } from '../src/index.js';

// Mock console.error to avoid polluting test output
const originalConsoleError = console.error;
console.error = jest.fn();

// Mock MCPServer
const mockServer = {
  start: jest.fn().mockResolvedValue(undefined),
  stop: jest.fn(),
};

const mockMCPServer = jest.fn().mockImplementation(() => mockServer);

jest.mock('../src/index.js', () => ({
  MCPServer: mockMCPServer,
}));

describe('CLI', () => {
  let mockProcess: any;
  let originalProcessExit: any;
  let mockExit: jest.Mock;

  beforeEach(() => {
    // Save original process.exit
    originalProcessExit = process.exit;
    mockExit = jest.fn();
    process.exit = mockExit as any;

    // Mock process.argv
    mockProcess = {
      argv: ['node', 'cli.js'],
      exit: mockExit,
      on: jest.fn(),
    };
    global.process = mockProcess as any;

    // Reset module cache
    jest.resetModules();

    // Reset mocks
    jest.clearAllMocks();
    mockServer.start.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Restore original process.exit
    process.exit = originalProcessExit;
  });

  afterAll(() => {
    // Restore console.error
    console.error = originalConsoleError;
  });

  it('should create server with correct options', async () => {
    // Simulate command line arguments
    process.argv = [
      'node',
      'cli.js',
      '--stdio', 'test-command',
      '--port', '3000',
      '--ssePath', '/custom-sse',
      '--messagePath', '/custom-message',
      '--logLevel', 'debug',
      '--cors',
      '--healthEndpoint', '/health1',
      '--healthEndpoint', '/health2',
      '--header', 'X-Test: test-value'
    ];

    // Import CLI module
    await import('../src/cli.js');

    expect(mockMCPServer).toHaveBeenCalledWith({
      port: 3000,
      baseUrl: 'http://localhost:3000',
      ssePath: '/custom-sse',
      messagePath: '/custom-message',
      logLevel: 'debug',
      cors: true,
      healthEndpoints: ['/health1', '/health2'],
      stdioCmd: 'test-command',
      headers: ['X-Test: test-value'],
    });
  });

  it('should handle missing stdio command', async () => {
    // Simulate command line without required stdio command
    process.argv = ['node', 'cli.js', '--port', '3000'];

    // Import CLI module
    await import('../src/cli.js');

    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should handle server start failure', async () => {
    // Setup server start failure
    mockServer.start.mockRejectedValue(new Error('Start failed'));

    // Simulate command line arguments
    process.argv = ['node', 'cli.js', '--stdio', 'test-command'];

    // Import CLI module
    await import('../src/cli.js');

    // Wait for the promise rejection to be handled
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should handle process termination signals', async () => {
    // Simulate command line arguments
    process.argv = ['node', 'cli.js', '--stdio', 'test-command'];

    // Import CLI module
    await import('../src/cli.js');

    // Get and call the signal handlers
    const handlers = mockProcess.on.mock.calls.reduce((acc: any, [event, handler]: [string, Function]) => {
      acc[event] = handler;
      return acc;
    }, {});

    // Simulate SIGINT
    handlers.SIGINT();
    expect(mockServer.stop).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(0);

    jest.clearAllMocks();

    // Simulate SIGTERM
    handlers.SIGTERM();
    expect(mockServer.stop).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(0);
  });
}); 
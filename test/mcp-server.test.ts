import { MCPServer } from '../src/index.js';
import express from 'express';
import { Server } from 'http';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse';
import winston from 'winston';

jest.mock('express');
jest.mock('child_process');
jest.mock('@modelcontextprotocol/sdk/server/sse');

// Mock winston
jest.mock('winston', () => {
  const mockFormat = {
    combine: jest.fn().mockReturnValue({}),
    timestamp: jest.fn().mockReturnValue({}),
    json: jest.fn().mockReturnValue({}),
  };

  return {
    createLogger: jest.fn().mockReturnValue({
      info: jest.fn(),
      error: jest.fn(),
    }),
    format: mockFormat,
    transports: {
      Console: jest.fn(),
    },
  };
});

describe('MCPServer', () => {
  let server: MCPServer;
  let mockApp: jest.Mocked<express.Application>;
  let mockServer: jest.Mocked<Server>;
  let mockChildProcess: jest.Mocked<ChildProcessWithoutNullStreams>;

  beforeEach(() => {
    mockApp = {
      use: jest.fn(),
      get: jest.fn(),
      post: jest.fn(),
      listen: jest.fn(),
    } as unknown as jest.Mocked<express.Application>;

    mockServer = {
      close: jest.fn(),
      on: jest.fn(),
    } as unknown as jest.Mocked<Server>;

    mockChildProcess = {
      stdin: { write: jest.fn() } as any,
      stdout: { on: jest.fn() } as any,
      stderr: { on: jest.fn() } as any,
      on: jest.fn(),
      kill: jest.fn(),
    } as unknown as jest.Mocked<ChildProcessWithoutNullStreams>;

    (express as unknown as jest.Mock).mockReturnValue(mockApp);
    (spawn as jest.Mock).mockReturnValue(mockChildProcess);
    mockApp.listen.mockReturnValue(mockServer);

    server = new MCPServer({
      port: 3000,
      baseUrl: 'http://localhost:3000',
      ssePath: '/sse',
      messagePath: '/message',
      logLevel: 'debug',
      cors: true,
      healthEndpoints: ['/health'],
      stdioCmd: 'echo test',
      headers: ['X-Test: test-value'],
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const defaultServer = new MCPServer();
      expect(defaultServer).toBeInstanceOf(MCPServer);
    });

    it('should initialize with custom options', () => {
      expect(server).toBeInstanceOf(MCPServer);
      expect(mockApp.use).toHaveBeenCalled();
    });
  });

  describe('start', () => {
    it('should start the server and child process', async () => {
      // Mock successful server start
      mockApp.listen.mockImplementationOnce((port: number, callback?: () => void) => {
        if (callback) {
          callback();
        }
        return mockServer;
      });

      await server.start();
      expect(mockApp.listen).toHaveBeenCalledWith(3000, expect.any(Function));
      expect(spawn).toHaveBeenCalledWith('echo test', { shell: true });
    }, 10000);

    it('should handle server start errors', async () => {
      // Mock server error event
      const error = new Error('Start failed');
      let errorHandler: ((err: Error) => void) | undefined;

      mockServer.on.mockImplementation((event: string, handler: any) => {
        if (event === 'error') {
          errorHandler = handler;
        }
        return mockServer;
      });

      // Start the server (this will set up the error handler)
      const startPromise = server.start();

      // Trigger the error handler
      if (errorHandler) {
        errorHandler(error);
      }

      await expect(startPromise).rejects.toThrow('Start failed');
    }, 10000);
  });

  describe('stop', () => {
    it('should stop the server and child process', async () => {
      // Mock successful server start
      mockApp.listen.mockImplementationOnce((port: number, callback?: () => void) => {
        if (callback) {
          callback();
        }
        return mockServer;
      });

      // Start the server
      await server.start();

      // Set the server instance
      (server as any).server = mockServer;

      // Stop the server
      server.stop();

      expect(mockServer.close).toHaveBeenCalled();
      expect(mockChildProcess.kill).toHaveBeenCalled();
    }, 10000);
  });

  describe('SSE endpoint', () => {
    it('should handle SSE connections', async () => {
      const mockReq = {
        ip: '127.0.0.1',
        on: jest.fn(),
      } as any;

      const mockRes = {
        setHeader: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
      } as any;

      const mockTransport = {
        sessionId: 'test-session',
        onmessage: jest.fn(),
        onclose: jest.fn(),
        onerror: jest.fn(),
        send: jest.fn(),
        start: jest.fn(),
      };

      (SSEServerTransport as unknown as jest.Mock).mockReturnValue(mockTransport);

      // Get the SSE route handler
      const sseHandler = mockApp.get.mock.calls.find(
        call => call[0] === '/sse'
      )?.[1];

      if (!sseHandler) {
        throw new Error('SSE handler not found');
      }

      await sseHandler(mockReq, mockRes);

      expect(mockTransport.onmessage).toBeDefined();
      expect(mockTransport.onclose).toBeDefined();
      expect(mockTransport.onerror).toBeDefined();
    });
  });

  describe('Message endpoint', () => {
    it('should handle message posts', async () => {
      const mockReq = {
        query: { sessionId: 'test-session' },
      } as any;

      const mockRes = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      } as any;

      // Get the message route handler
      const messageHandler = mockApp.post.mock.calls.find(
        call => call[0] === '/message'
      )?.[1];

      if (!messageHandler) {
        throw new Error('Message handler not found');
      }

      await messageHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(503);
    });
  });

  describe('Health endpoints', () => {
    it('should handle health check requests', async () => {
      const mockReq = {} as any;
      const mockRes = {
        setHeader: jest.fn(),
        send: jest.fn(),
      } as any;

      // Get the health route handler
      const healthHandler = mockApp.get.mock.calls.find(
        call => call[0] === '/health'
      )?.[1];

      if (!healthHandler) {
        throw new Error('Health handler not found');
      }

      await healthHandler(mockReq, mockRes);

      expect(mockRes.send).toHaveBeenCalledWith('ok');
    });
  });
}); 
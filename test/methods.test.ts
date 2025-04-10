import { methods } from '../src/methods.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { z } from 'zod';

// Mock the Client
jest.mock('@modelcontextprotocol/sdk/client/index.js');

describe('methods', () => {
    let mockClient: jest.Mocked<Client>;

    beforeEach(() => {
        jest.clearAllMocks();
        mockClient = {
            request: jest.fn(),
            close: jest.fn()
        } as any;
    });

    describe('prompts/list', () => {
        it('should forward the request to the SSE server', async () => {
            const mockResponse = {
                prompts: [
                    {
                        id: 'test-id',
                        name: 'Test Prompt',
                        description: 'Test Description',
                        content: 'Test Content'
                    }
                ]
            };

            mockClient.request.mockResolvedValue(mockResponse);

            const result = await methods['prompts/list'].handler({}, mockClient);

            expect(mockClient.request).toHaveBeenCalledWith({
                method: 'prompts/list',
                params: {}
            }, expect.any(z.ZodType));
            expect(result).toEqual(mockResponse);
        });

        it('should accept valid response schema', () => {
            const validResponse = {
                prompts: [
                    {
                        id: 'test-id',
                        name: 'Test Prompt',
                        content: 'Test Content'
                    }
                ]
            };

            const schema = methods['prompts/list'].result;
            const result = schema.safeParse(validResponse);
            expect(result.success).toBe(true);
        });

        it('should reject invalid response schema', () => {
            const invalidResponse = {
                prompts: [
                    {
                        id: 123, // Should be string
                        name: 'Test Prompt'
                        // Missing required content field
                    }
                ]
            };

            const schema = methods['prompts/list'].result;
            const result = schema.safeParse(invalidResponse);
            expect(result.success).toBe(false);
        });
    });

    describe('resources/list', () => {
        it('should forward the request to the SSE server', async () => {
            const mockResponse = {
                resources: [
                    {
                        id: 'test-id',
                        name: 'Test Resource',
                        type: 'test-type',
                        description: 'Test Description'
                    }
                ]
            };

            mockClient.request.mockResolvedValue(mockResponse);

            const result = await methods['resources/list'].handler({}, mockClient);

            expect(mockClient.request).toHaveBeenCalledWith({
                method: 'resources/list',
                params: {}
            }, expect.any(z.ZodType));
            expect(result).toEqual(mockResponse);
        });

        it('should accept valid response schema', () => {
            const validResponse = {
                resources: [
                    {
                        id: 'test-id',
                        name: 'Test Resource',
                        type: 'test-type'
                    }
                ]
            };

            const schema = methods['resources/list'].result;
            const result = schema.safeParse(validResponse);
            expect(result.success).toBe(true);
        });

        it('should reject invalid response schema', () => {
            const invalidResponse = {
                resources: [
                    {
                        id: 123, // Should be string
                        name: 'Test Resource'
                        // Missing required type field
                    }
                ]
            };

            const schema = methods['resources/list'].result;
            const result = schema.safeParse(invalidResponse);
            expect(result.success).toBe(false);
        });
    });

    describe('tools/list', () => {
        it('should forward the request to the SSE server', async () => {
            const mockResponse = {
                tools: [
                    {
                        name: 'test-tool',
                        description: 'Test Description',
                        inputSchema: {}
                    }
                ]
            };

            mockClient.request.mockResolvedValue(mockResponse);

            const result = await methods['tools/list'].handler({}, mockClient);

            expect(mockClient.request).toHaveBeenCalledWith({
                method: 'tools/list',
                params: {}
            }, expect.any(z.ZodType));
            expect(result).toEqual(mockResponse);
        });

        it('should accept valid response schema', () => {
            const validResponse = {
                tools: [
                    {
                        name: 'test-tool',
                        description: 'Test Description',
                        inputSchema: {}
                    }
                ]
            };

            const schema = methods['tools/list'].result;
            const result = schema.safeParse(validResponse);
            expect(result.success).toBe(true);
        });

        it('should reject invalid response schema', () => {
            const invalidResponse = {
                tools: [
                    {
                        // Missing required name field
                        description: 'Test Description',
                        inputSchema: {}
                    }
                ]
            };

            const schema = methods['tools/list'].result;
            const result = schema.safeParse(invalidResponse);
            expect(result.success).toBe(false);
        });
    });
}); 
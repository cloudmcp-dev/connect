import { z } from 'zod';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

// Define the response schemas
const promptSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    content: z.string(),
});

const resourceSchema = z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    description: z.string().optional(),
});

const toolSchema = z.object({
    name: z.string(),
    description: z.string(),
    inputSchema: z.any()
});

// Define method types
type Method<TParams extends z.ZodTypeAny, TResult extends z.ZodTypeAny> = {
    params: TParams;
    result: TResult;
    handler: (params: z.infer<TParams>, sseClient: Client) => Promise<z.infer<TResult>>;
};

// Define the method implementations
export const methods: Record<string, Method<any, any>> = {
    'prompts/list': {
        params: z.object({}),
        result: z.object({
            prompts: z.array(promptSchema)
        }),
        handler: async (params, sseClient) => {
            // Forward to SSE server
            const result = await sseClient.request({
                method: 'prompts/list',
                params
            }, z.any());
            return result;
        }
    },
    'resources/list': {
        params: z.object({}),
        result: z.object({
            resources: z.array(resourceSchema)
        }),
        handler: async (params, sseClient) => {
            // Forward to SSE server
            const result = await sseClient.request({
                method: 'resources/list',
                params
            }, z.any());
            return result;
        }
    },
    'tools/list': {
        params: z.object({}),
        result: z.object({
            tools: z.array(toolSchema)
        }),
        handler: async (params, sseClient) => {
            // Forward to SSE server
            const result = await sseClient.request({
                method: 'tools/list',
                params
            }, z.any());
            return result;
        }
    }
}; 
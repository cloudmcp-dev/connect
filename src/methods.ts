import { z } from 'zod';

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

// Define method types
type Method<TParams extends z.ZodTypeAny, TResult extends z.ZodTypeAny> = {
    params: TParams;
    result: TResult;
    handler: (params: z.infer<TParams>) => Promise<z.infer<TResult>>;
};

// Define the method implementations
export const methods: Record<string, Method<any, any>> = {
    'prompts/list': {
        params: z.object({}),
        result: z.array(promptSchema),
        handler: async () => {
            // Return an empty array for now
            return [];
        }
    },
    'resources/list': {
        params: z.object({}),
        result: z.array(resourceSchema),
        handler: async () => {
            // Return an empty array for now
            return [];
        }
    }
}; 
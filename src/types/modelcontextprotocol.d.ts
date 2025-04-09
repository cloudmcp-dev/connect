declare module '@modelcontextprotocol/sdk/server/sse' {
  export class SSEServerTransport {
    constructor(messagePath: string, response: any);
    sessionId: string;
    onmessage: (msg: any) => void;
    onclose: () => void;
    onerror: (err: Error) => void;
    send: (msg: any) => void;
    handlePostMessage: (req: any, res: any) => Promise<void>;
    start: () => void;
  }
}

declare module '@modelcontextprotocol/sdk/server/index' {
  export class Server {
    constructor(info: { name: string; version: string }, options: { capabilities: any });
    connect(transport: any): Promise<void>;
  }
}

declare module '@modelcontextprotocol/sdk/types' {
  export interface JSONRPCMessage {
    jsonrpc: string;
    id?: string | number;
    method?: string;
    params?: any;
    result?: any;
    error?: any;
  }
} 
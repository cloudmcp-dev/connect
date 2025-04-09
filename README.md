# Connect for CloudMCP

**@cloudmcp/connect** helps connect to **MCP SSE servers** and proxy them to **stdio**

This is useful to connect to **@cloudmcp/gateway**

## Installation & Usage

Run @cloudmcp/connect via `npx`:

```bash
npx -y @cloudmcp/connect --url "https://gateway.cloudmcp.dev/<organization>/<service>" --clientId "<client_id>" --clientSecret "<client_secret>"
```

## Options

- **`--url <url>`**: The CloudMCP Gateway URL in the format `https://gateway.cloudmcp.dev/<organization>/<service>`
- **`--clientId <client_id>`**: Your CloudMCP client ID for authentication
- **`--clientSecret <client_secret>`**: Your CloudMCP client secret for authentication
- **`--logLevel debug | info | warn | error | none`**: Controls logging level (default: `info`). Use `none` to suppress all logs.
- **`--header <header>`**: Add a header to all responses (format: "Header-Name: value"). Can be used multiple times.

## Using with Claude Desktop

Claude Desktop can use @cloudmcp/connect to connect to CloudMCP Gateway.

### NPX-based MCP Server Example

```json
{
  "mcpServers": {
    "cloudmcpNpx": {
      "command": "npx",
      "args": [
        "-y",
        "@cloudmcp/connect",
        "--url",
        "https://gateway.cloudmcp.dev/<organization>/<service>",
        "--clientId",
        "<client_id>",
        "--clientSecret",
        "<client_secret>"
      ]
    }
  }
}
```

### Docker-based MCP Server Example

```json
{
  "mcpServers": {
    "cloudmcpDocker": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "cloudmcp/connect",
        "--url",
        "https://gateway.cloudmcp.dev/<organization>/<service>",
        "--clientId",
        "<client_id>",
        "--clientSecret",
        "<client_secret>"
      ]
    }
  }
}
```

## Contributing

TODO: Write a short contribution note

## License

[Commercial License](./LICENSE)

This software is licensed under a commercial license agreement. All rights reserved. Unauthorized copying, modification, distribution, or use of this software is strictly prohibited. For licensing inquiries, please contact CloudMCP.

# Connect for CloudMCP

**@cloudmcp/connect** helps connect to **MCP SSE servers** and proxy them to **stdio**

This is useful to connect to **@cloudmcp/gateway**

## Features

- Connect to Model Context Protocol (MCP) SSE servers
- Proxy server responses to standard input/output
- Configurable logging levels
- Custom header support
- Support for authentication via client credentials
- Works with Claude Desktop

## Installation

### Using npm/npx

```bash
npx -y @cloudmcp/connect --url "https://gateway.cloudmcp.dev/<id>/sse" --clientId "<client_id>" --clientSecret "<client_secret>"
```

## Options

- **`--url <url>`**: The CloudMCP Gateway URL in the format `https://gateway.cloudmcp.dev/<id>/sse`
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
        "https://gateway.cloudmcp.dev/<id>/sse",
        "--clientId",
        "<client_id>",
        "--clientSecret",
        "<client_secret>"
      ]
    }
  }
}
```

## Development

### Prerequisites

- Node.js 18 or later
- pnpm 8.x

### Setup

```bash
# Clone the repository
git clone https://github.com/cloudmcp/cloudmcp-connect.git
cd cloudmcp-connect

# Install dependencies
pnpm install

# Build the project
pnpm build

# Run tests
pnpm test
```

### Available Scripts

- `pnpm start` - Run the built application
- `pnpm build` - Build the TypeScript project
- `pnpm dev` - Run the application in development mode with hot reloading
- `pnpm clean` - Clean the build directory
- `pnpm test` - Run tests
- `pnpm test:watch` - Run tests in watch mode
- `pnpm test:coverage` - Run tests with coverage reporting

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-new-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin feature/my-new-feature`
5. Submit a pull request

Make sure your code passes all tests and follows the project's coding style.

## License

[MIT License](./LICENSE)

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

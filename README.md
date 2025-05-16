# n8n-nodes-mcp-client

Built by **4Runr**, this is a custom n8n node that connects to a self-hosted MCP Server via Server-Sent Events (SSE). It streams tool definitions to n8n AI Agents in real time, enabling flexible, dynamic automation at scale.

## Features

- Listens to an `sseUrl` endpoint for incoming `tools` events.
- Emits tool definitions for use in the n8n AI Agent ecosystem.
- Allows dynamic tool selection and parameter input.
- Executes tools by POSTing to `/mcp/message` with the correct payload and headers.
- Logs events, handles errors, and filters events automatically.
- Optimized for 4Runr's AI automation infrastructure and MCP server systems.

## Usage

1. **Configure Credentials**
   - Set up a credential of type `4Runr MCP Access` with:
     - `SSE URL` (required): Your MCP server's SSE endpoint (e.g., `https://mcp-server/mcp-events`)
     - `SSE Connection Timeout` (optional): Timeout in ms (default: 60000)
     - `Messages POST Endpoint` (required): Your MCP server's message endpoint (e.g., `https://mcp-server/mcp/message`)
     - `Additional Headers` (optional): JSON for API keys, etc. (e.g., `{ "X-API-Key": "Test12345" }`)

2. **Add the Node to Your Workflow**
   - Use the "4Runr MCP Client" node as a tool source in your AI Agent configuration.
   - The node will dynamically display available tools as they arrive from the SSE stream.
   - You can select a tool and input parameters (as JSON) to execute it.

3. **Tool Execution**
   - When a tool is executed, the node will POST to the configured message endpoint with the payload:
     ```json
     {
       "toolCall": {
         "toolName": "check_availability",
         "parameters": { ... }
       }
     }
     ```
   - The `X-API-Key` header (if provided) will be included in all POST requests.

4. **Error Handling**
   - The node provides robust error handling for SSE, JSON parsing, and HTTP errors.
   - Errors are logged and displayed in the n8n UI.

## Assumptions
- Tool names are accepted as sent by the server (namespacing/aliasing is optional).
- All tool parameters and required/optional flags are respected as sent by the server.
- The node expects the MCP server to emit a `tools` event with a `tools` array in the data payload.

## Advanced/Optional
- Tool name mapping/aliasing is supported via the `Tool Name Mapping (Optional)` property.
- Future enhancements may include caching, custom parameter UI, and more.

## Maintainer
Developed and maintained by [4Runr](https://www.4runr.com) — Montreal's AI infrastructure company transforming how businesses run with intelligent systems. 
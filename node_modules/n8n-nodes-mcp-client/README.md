# n8n-nodes-mcp-client

Built by **4Runr**, this is a custom n8n node that connects to a self-hosted MCP Server via Server-Sent Events (SSE). It streams tool definitions to n8n AI Agents in real time, enabling flexible, dynamic automation at scale.

## Features

- Listens to an `sseUrl` endpoint for incoming `tools` events.
- Emits tool definitions for use in the n8n AI Agent ecosystem.
- Logs events, handles errors, and filters events automatically.
- Optimized for 4Runr's AI automation infrastructure and MCP server systems.

## Usage

1. Add your custom MCP server's SSE URL as a credential.
2. Use this node as a tool source in your AI Agent configuration.
3. Tools will auto-populate based on live MCP events.

## Maintainer

Developed and maintained by [4Runr](https://www.4runr.com) — Montreal's AI infrastructure company transforming how businesses run with intelligent systems. 
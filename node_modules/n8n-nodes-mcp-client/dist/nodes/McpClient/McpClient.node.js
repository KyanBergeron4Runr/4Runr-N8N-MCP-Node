"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.McpClient = void 0;
// Use require for EventSource for compatibility
const EventSource = require('eventsource');
class McpClient {
    constructor() {
        this.description = {
            displayName: 'McpClient',
            name: 'mcpClient',
            group: ['input'],
            version: 1,
            description: 'Streams tools from an MCP server via SSE',
            defaults: {
                name: 'McpClient',
                color: '#00b894',
            },
            inputs: [],
            outputs: ['main'],
            icon: 'fa:plug',
            isTool: true,
            usableAsTool: true,
            credentials: [],
            properties: [
                {
                    displayName: 'SSE URL',
                    name: 'sseUrl',
                    type: 'string',
                    default: '',
                    description: 'The URL of the MCP SSE endpoint (e.g., http://localhost:3000/mcp-events)',
                    required: true,
                },
            ],
        };
    }
    async execute() {
        const sseUrl = this.getNodeParameter('sseUrl', 0);
        console.log(`[McpClient] Connecting to SSE: ${sseUrl}`);
        return new Promise((resolve, reject) => {
            const eventSource = new EventSource(sseUrl);
            eventSource.onopen = () => {
                console.log('[McpClient] SSE connection opened');
            };
            eventSource.onerror = (err) => {
                console.error('[McpClient] SSE connection error', err);
                eventSource.close();
                // @ts-ignore: NodeOperationError will resolve in n8n runtime
                reject(new NodeOperationError(this.getNode(), 'Failed to connect to SSE endpoint'));
            };
            eventSource.addEventListener('tools', (event) => {
                console.log('[McpClient] Received tools event:', event.data);
                try {
                    const parsed = JSON.parse(event.data);
                    if (parsed.tools && Array.isArray(parsed.tools)) {
                        const tools = parsed.tools.map((tool) => ({
                            name: tool.name,
                            description: tool.description,
                            parameters: tool.parameters || {},
                        }));
                        console.log(`[McpClient] Emitting ${tools.length} tools`);
                        eventSource.close();
                        resolve([this.helpers.returnJsonArray(tools)]);
                    }
                    else {
                        console.warn('[McpClient] No tools array in event data');
                    }
                }
                catch (err) {
                    console.error('[McpClient] Failed to parse tools event', err);
                }
            });
            // Ignore all other event types (e.g., ping)
        });
    }
}
exports.McpClient = McpClient;

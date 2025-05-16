"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.McpClient = void 0;
// n8n types are resolved at runtime in the n8n environment
const n8n_workflow_1 = require("n8n-workflow");
const axios_1 = __importDefault(require("axios"));
// Use require for EventSource for compatibility
const EventSource = require('eventsource');
class McpClient {
    constructor() {
        this.description = {
            displayName: '4Runr MCP Client',
            name: 'mcpClient',
            group: ['input'],
            version: 1,
            description: 'Streams tool definitions from a 4Runr MCP Server via SSE. Built to power dynamic AI agents using the MCP protocol.',
            defaults: {
                name: '4Runr MCP Client',
                color: '#00b894',
            },
            inputs: [],
            outputs: ["main" /* NodeConnectionType.Main */],
            icon: 'fa:plug',
            usableAsTool: true,
            credentials: [
                {
                    name: 'McpClientApi',
                    required: true,
                    displayName: '4Runr MCP Access',
                },
            ],
            properties: [
                {
                    displayName: 'Tool Type Filter',
                    name: 'toolType',
                    type: 'options',
                    options: [
                        {
                            name: 'All Tools',
                            value: 'all',
                        },
                        {
                            name: 'Search Tools',
                            value: 'search_tool',
                        },
                        {
                            name: 'Update Tools',
                            value: 'update_tool',
                        },
                        {
                            name: 'Report Tools',
                            value: 'report_tool',
                        },
                    ],
                    default: 'all',
                    description: 'Filter tools by their type',
                },
            ],
        };
    }
    async execute() {
        const credentials = await this.getCredentials('McpClientApi');
        const { sseUrl, sseTimeout, headers, messageEndpoint } = credentials;
        const toolType = this.getNodeParameter('toolType', 0);
        console.log(`[McpClient] Connecting to SSE: ${sseUrl}`);
        return new Promise((resolve, reject) => {
            const eventSourceOptions = {};
            // Add headers if provided
            if (headers) {
                try {
                    const parsedHeaders = typeof headers === 'string' ? JSON.parse(headers) : headers;
                    eventSourceOptions.headers = parsedHeaders;
                }
                catch (err) {
                    console.error('[McpClient] Failed to parse headers:', err);
                }
            }
            const eventSource = new EventSource(sseUrl, eventSourceOptions);
            let timeoutId;
            if (sseTimeout) {
                timeoutId = setTimeout(() => {
                    eventSource.close();
                    reject(new n8n_workflow_1.NodeOperationError(this.getNode(), 'SSE connection timed out'));
                }, sseTimeout);
            }
            eventSource.onopen = () => {
                if (timeoutId)
                    clearTimeout(timeoutId);
                console.log('[McpClient] SSE connection opened');
            };
            eventSource.onerror = (err) => {
                console.error('[McpClient] SSE connection error', err);
                eventSource.close();
                reject(new n8n_workflow_1.NodeOperationError(this.getNode(), 'Failed to connect to SSE endpoint'));
            };
            eventSource.addEventListener('tools', (event) => {
                console.log('[McpClient] Received tools event:', event.data);
                try {
                    const parsed = JSON.parse(event.data);
                    if (parsed.tools && Array.isArray(parsed.tools)) {
                        let tools = parsed.tools.map((tool) => ({
                            name: tool.name,
                            description: tool.description,
                            parameters: tool.parameters || {},
                        }));
                        // Filter tools by type if specified
                        if (toolType !== 'all') {
                            tools = tools.filter(tool => tool.name.includes(toolType));
                        }
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
                    reject(new n8n_workflow_1.NodeOperationError(this.getNode(), 'Failed to parse tools event: ' + err.message));
                }
            });
        });
    }
    // --- Tool Execution Logic ---
    async executeToolCall(context, toolName, parameters, credentials) {
        const { messageEndpoint, headers } = credentials;
        const payload = {
            toolCall: {
                toolName,
                parameters,
            },
        };
        const axiosConfig = {
            headers: {
                'Content-Type': 'application/json',
                ...(headers ? (typeof headers === 'string' ? JSON.parse(headers) : headers) : {}),
            },
        };
        try {
            const response = await axios_1.default.post(messageEndpoint, payload, axiosConfig);
            return response.data;
        }
        catch (error) {
            console.error('[McpClient] Tool call POST error:', error?.response?.data || error.message);
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), 'Tool call failed: ' + (error?.response?.data?.message || error.message));
        }
    }
}
exports.McpClient = McpClient;

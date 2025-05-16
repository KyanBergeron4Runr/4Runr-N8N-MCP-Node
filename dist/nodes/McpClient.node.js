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
            icon: 'file:images/n8n4Runr.png',
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
                {
                    displayName: 'Tool Name',
                    name: 'toolName',
                    type: 'string',
                    default: '',
                    description: 'Name of the tool to execute (as received from the server)',
                    required: false,
                },
                {
                    displayName: 'Tool Parameters',
                    name: 'toolParameters',
                    type: 'json',
                    default: '{}',
                    description: 'Parameters for the selected tool (as JSON)',
                    required: false,
                },
                // Placeholder for future: tool name mapping, aliases, etc.
                {
                    displayName: 'Tool Name Mapping (Optional)',
                    name: 'toolNameMapping',
                    type: 'json',
                    default: '{}',
                    description: 'Optional mapping of tool names to aliases (e.g., {"calendar.check_availability": "Check Availability"})',
                    required: false,
                },
            ],
        };
    }
    async execute() {
        const credentials = await this.getCredentials('McpClientApi');
        const { sseUrl, sseTimeout, headers, messageEndpoint } = credentials;
        const toolType = this.getNodeParameter('toolType', 0);
        console.log(`[McpClient] Starting execution with config:`, {
            sseUrl,
            sseTimeout,
            messageEndpoint,
            toolType,
            hasHeaders: !!headers
        });
        return new Promise((resolve, reject) => {
            const eventSourceOptions = {};
            // Add headers if provided
            if (headers) {
                try {
                    const parsedHeaders = typeof headers === 'string' ? JSON.parse(headers) : headers;
                    eventSourceOptions.headers = parsedHeaders;
                    console.log('[McpClient] Using headers:', parsedHeaders);
                }
                catch (err) {
                    console.error('[McpClient] Failed to parse headers:', err);
                    throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Failed to parse headers: ' + err.message);
                }
            }
            console.log(`[McpClient] Connecting to SSE: ${sseUrl}`);
            const eventSource = new EventSource(sseUrl, eventSourceOptions);
            let timeoutId;
            if (sseTimeout) {
                timeoutId = setTimeout(() => {
                    console.error('[McpClient] SSE connection timed out after', sseTimeout, 'ms');
                    eventSource.close();
                    reject(new n8n_workflow_1.NodeOperationError(this.getNode(), `SSE connection timed out after ${sseTimeout}ms`));
                }, sseTimeout);
            }
            eventSource.onopen = () => {
                if (timeoutId)
                    clearTimeout(timeoutId);
                console.log('[McpClient] SSE connection opened successfully');
            };
            eventSource.onerror = (err) => {
                console.error('[McpClient] SSE connection error:', err);
                eventSource.close();
                reject(new n8n_workflow_1.NodeOperationError(this.getNode(), 'Failed to connect to SSE endpoint: ' + err.message));
            };
            // Listen for all events for debugging
            eventSource.onmessage = (event) => {
                console.log('[McpClient] Received message event:', {
                    type: event.type,
                    data: event.data,
                    lastEventId: event.lastEventId
                });
            };
            eventSource.addEventListener('tools', (event) => {
                console.log('[McpClient] Received tools event:', {
                    data: event.data,
                    lastEventId: event.lastEventId
                });
                try {
                    const parsed = JSON.parse(event.data);
                    console.log('[McpClient] Parsed tools data:', parsed);
                    if (!parsed.tools || !Array.isArray(parsed.tools)) {
                        throw new Error('Invalid tools data: missing or invalid tools array');
                    }
                    let tools = parsed.tools.map((tool) => {
                        console.log('[McpClient] Processing tool:', tool);
                        return {
                            name: tool.name,
                            description: tool.description,
                            parameters: tool.parameters || {},
                        };
                    });
                    // Filter tools by type if specified
                    if (toolType !== 'all') {
                        const originalCount = tools.length;
                        tools = tools.filter(tool => tool.name.includes(toolType));
                        console.log(`[McpClient] Filtered tools from ${originalCount} to ${tools.length} for type: ${toolType}`);
                    }
                    console.log(`[McpClient] Emitting ${tools.length} tools:`, tools);
                    eventSource.close();
                    resolve([this.helpers.returnJsonArray(tools)]);
                }
                catch (err) {
                    console.error('[McpClient] Failed to process tools event:', err);
                    eventSource.close();
                    reject(new n8n_workflow_1.NodeOperationError(this.getNode(), 'Failed to process tools event: ' + err.message));
                }
            });
        });
    }
    // --- Tool Execution Logic ---
    /**
     * Executes a tool call by POSTing to the MCP server's message endpoint.
     * Throws a clear error if toolName or parameters are missing/invalid.
     */
    async executeToolCall(context, toolName, parameters, credentials) {
        const { messageEndpoint, headers } = credentials;
        console.log('[McpClient] Executing tool call:', {
            toolName,
            parameters,
            messageEndpoint,
            hasHeaders: !!headers
        });
        if (!toolName || typeof toolName !== 'string') {
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), 'Tool name is required and must be a string.');
        }
        if (!parameters || typeof parameters !== 'object') {
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), 'Tool parameters are required and must be an object.');
        }
        const payload = {
            toolCall: {
                toolName,
                parameters,
            },
        };
        console.log('[McpClient] Preparing POST request:', {
            url: messageEndpoint,
            payload
        });
        const axiosConfig = {
            headers: {
                'Content-Type': 'application/json',
                ...(headers ? (typeof headers === 'string' ? JSON.parse(headers) : headers) : {}),
            },
        };
        try {
            console.log('[McpClient] Sending POST request...');
            const response = await axios_1.default.post(messageEndpoint, payload, axiosConfig);
            console.log('[McpClient] Received response:', {
                status: response.status,
                statusText: response.statusText,
                data: response.data
            });
            return response.data;
        }
        catch (error) {
            console.error('[McpClient] Tool call failed:', {
                error: error.message,
                response: error.response?.data,
                status: error.response?.status,
                statusText: error.response?.statusText
            });
            let errorMessage = 'Tool call failed: ';
            if (error.response?.data?.message) {
                errorMessage += error.response.data.message;
            }
            else if (error.response?.statusText) {
                errorMessage += `${error.response.status} ${error.response.statusText}`;
            }
            else {
                errorMessage += error.message;
            }
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), errorMessage);
        }
    }
}
exports.McpClient = McpClient;

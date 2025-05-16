// n8n types are resolved at runtime in the n8n environment
import type { INodeType, INodeTypeDescription, INodeExecutionData, IExecuteFunctions } from 'n8n-workflow';
import type { NodeOperationError } from 'n8n-workflow';
// Use require for EventSource for compatibility
const EventSource = require('eventsource');

interface ToolParameter {
	type: string;
	description: string;
	required?: boolean;
	default?: any;
}

interface ToolDefinition {
	name: string;
	description: string;
	parameters: { [key: string]: ToolParameter };
}

interface McpClientApiCredentials {
	sseUrl: string;
	sseTimeout?: number;
	messageEndpoint: string;
	headers?: { [key: string]: string };
}

export class McpClient implements INodeType {
	description: INodeTypeDescription = {
		displayName: '4Runr MCP Client',
		name: 'mcpClient',
		group: ['input'],
		version: 1,
		description: 'Streams tool definitions from a 4Runr MCP Server using SSE',
		defaults: {
			name: '4Runr MCP Client',
			color: '#00b894',
		},
		inputs: [],
		outputs: ['main'],
		icon: 'fa:plug',
		isTool: true,
		usableAsTool: true,
		credentials: [
			{
				name: 'McpClientApi',
				required: true,
				displayName: '4Runr MCP Access',
				displayOptions: {
					show: {
						authentication: ['apiKey'],
					},
				},
				fields: [
					{
						displayName: 'SSE URL',
						name: 'sseUrl',
						type: 'string',
						default: '',
						description: 'The URL of the MCP SSE endpoint (e.g., https://mcp-server/mcp-events)',
						required: true,
					},
					{
						displayName: 'SSE Connection Timeout',
						name: 'sseTimeout',
						type: 'number',
						default: 60000,
						description: 'Timeout in milliseconds for SSE connection (default: 60000)',
						required: false,
					},
					{
						displayName: 'Messages Post Endpoint',
						name: 'messageEndpoint',
						type: 'string',
						default: '',
						description: 'The URL for posting messages back to the MCP server (e.g., https://mcp-server/mcp/message)',
						required: true,
					},
					{
						displayName: 'Additional Headers',
						name: 'headers',
						type: 'json',
						default: '{}',
						description: 'Additional headers to send with the SSE connection (e.g., {"X-API-Key": "Test12345"})',
						required: false,
					},
				],
			},
		],
		properties: [],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const credentials = await this.getCredentials('McpClientApi') as McpClientApiCredentials;
		const { sseUrl, sseTimeout, headers } = credentials;

		console.log(`[McpClient] Connecting to SSE: ${sseUrl}`);

		return new Promise((resolve, reject) => {
			const eventSourceOptions: any = {};
			
			// Add headers if provided
			if (headers) {
				try {
					const parsedHeaders = typeof headers === 'string' ? JSON.parse(headers) : headers;
					eventSourceOptions.headers = parsedHeaders;
				} catch (err) {
					console.error('[McpClient] Failed to parse headers:', err);
				}
			}

			const eventSource = new EventSource(sseUrl, eventSourceOptions);

			// Set timeout if provided
			if (sseTimeout) {
				const timeoutId = setTimeout(() => {
					eventSource.close();
					reject(new NodeOperationError(this.getNode(), 'SSE connection timed out'));
				}, sseTimeout);

				eventSource.onopen = () => {
					clearTimeout(timeoutId);
					console.log('[McpClient] SSE connection opened');
				};
			} else {
				eventSource.onopen = () => {
					console.log('[McpClient] SSE connection opened');
				};
			}

			eventSource.onerror = (err: unknown) => {
				console.error('[McpClient] SSE connection error', err);
				eventSource.close();
				reject(new NodeOperationError(this.getNode(), 'Failed to connect to SSE endpoint'));
			};

			eventSource.addEventListener('tools', (event: MessageEvent) => {
				console.log('[McpClient] Received tools event:', event.data);
				try {
					const parsed = JSON.parse(event.data);
					if (parsed.tools && Array.isArray(parsed.tools)) {
						const tools: ToolDefinition[] = parsed.tools.map((tool: any) => ({
							name: tool.name,
							description: tool.description,
							parameters: tool.parameters || {},
						}));
						console.log(`[McpClient] Emitting ${tools.length} tools`);
						eventSource.close();
						resolve([this.helpers.returnJsonArray(tools)]);
					} else {
						console.warn('[McpClient] No tools array in event data');
					}
				} catch (err) {
					console.error('[McpClient] Failed to parse tools event', err);
				}
			});

			// Ignore all other event types (e.g., ping)
		});
	}
} 
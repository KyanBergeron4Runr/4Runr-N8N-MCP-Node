// n8n types are resolved at runtime in the n8n environment
import { INodeType, INodeTypeDescription, INodeExecutionData, IExecuteFunctions, NodeOperationError, NodeConnectionType } from 'n8n-workflow';
import axios from 'axios';
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
		description: 'Streams tool definitions from a 4Runr MCP Server via SSE. Built to power dynamic AI agents using the MCP protocol.',
		defaults: {
			name: '4Runr MCP Client',
			color: '#00b894',
		},
		inputs: [],
		outputs: [NodeConnectionType.Main],
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

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const credentials = await this.getCredentials('McpClientApi') as McpClientApiCredentials;
		const { sseUrl, sseTimeout, headers, messageEndpoint } = credentials;
		const toolType = this.getNodeParameter('toolType', 0) as string;

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

			let timeoutId: NodeJS.Timeout | undefined;
			if (sseTimeout) {
				timeoutId = setTimeout(() => {
					eventSource.close();
					reject(new NodeOperationError(this.getNode(), 'SSE connection timed out'));
				}, sseTimeout);
			}

			eventSource.onopen = () => {
				if (timeoutId) clearTimeout(timeoutId);
				console.log('[McpClient] SSE connection opened');
			};

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
						let tools: ToolDefinition[] = parsed.tools.map((tool: any) => ({
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
						resolve([this.helpers.returnJsonArray(tools as any)]);
					} else {
						console.warn('[McpClient] No tools array in event data');
					}
				} catch (err) {
					console.error('[McpClient] Failed to parse tools event', err);
					reject(new NodeOperationError(this.getNode(), 'Failed to parse tools event: ' + (err as Error).message));
				}
			});
		});
	}

	// --- Tool Execution Logic ---
	async executeToolCall(
		context: IExecuteFunctions,
		toolName: string,
		parameters: Record<string, any>,
		credentials: McpClientApiCredentials
	): Promise<any> {
		const { messageEndpoint, headers } = credentials;
		const payload = {
			toolCall: {
				toolName,
				parameters,
			},
		};
		const axiosConfig: any = {
			headers: {
				'Content-Type': 'application/json',
				...(headers ? (typeof headers === 'string' ? JSON.parse(headers) : headers) : {}),
			},
		};
		try {
			const response = await axios.post(messageEndpoint, payload, axiosConfig);
			return response.data;
		} catch (error: any) {
			console.error('[McpClient] Tool call POST error:', error?.response?.data || error.message);
			throw new NodeOperationError(context.getNode(), 'Tool call failed: ' + (error?.response?.data?.message || error.message));
		}
	}
} 
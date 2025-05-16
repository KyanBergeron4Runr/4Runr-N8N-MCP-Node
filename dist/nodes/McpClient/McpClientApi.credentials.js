"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.McpClientApi = void 0;
class McpClientApi {
    constructor() {
        this.name = 'McpClientApi';
        this.displayName = '4Runr MCP Access';
        this.properties = [
            {
                displayName: 'SSE URL',
                name: 'sseUrl',
                type: 'string',
                default: '',
                required: true,
                description: 'URL to /mcp-events endpoint',
            },
            {
                displayName: 'SSE Connection Timeout',
                name: 'sseTimeout',
                type: 'number',
                default: 60000,
                required: false,
                description: 'e.g. 60000',
            },
            {
                displayName: 'Messages POST Endpoint',
                name: 'messageEndpoint',
                type: 'string',
                default: '',
                required: true,
                description: 'Used to call toolCall',
            },
            {
                displayName: 'Additional Headers (JSON)',
                name: 'headers',
                type: 'json',
                default: '{}',
                required: false,
                description: 'API keys, custom headers, etc.',
            },
        ];
    }
}
exports.McpClientApi = McpClientApi;

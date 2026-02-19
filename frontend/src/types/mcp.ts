/** MCP 서버 관련 타입 */

export type McpTransportType = "stdio" | "sse" | "streamable-http";

export interface McpServerInfo {
  id: string;
  name: string;
  transport_type: McpTransportType;
  command?: string | null;
  args?: string[] | null;
  url?: string | null;
  headers?: Record<string, string> | null;
  env?: Record<string, string> | null;
  enabled: boolean;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface CreateMcpServerRequest {
  name: string;
  transport_type: McpTransportType;
  command?: string | null;
  args?: string[] | null;
  url?: string | null;
  headers?: Record<string, string> | null;
  env?: Record<string, string> | null;
  enabled?: boolean;
}

export interface UpdateMcpServerRequest {
  name?: string | null;
  transport_type?: McpTransportType | null;
  command?: string | null;
  args?: string[] | null;
  url?: string | null;
  headers?: Record<string, string> | null;
  env?: Record<string, string> | null;
  enabled?: boolean | null;
}

export interface SystemMcpServer {
  name: string;
  transport_type: McpTransportType;
  command?: string | null;
  args?: string[] | null;
  url?: string | null;
  headers?: Record<string, string> | null;
  env?: Record<string, string> | null;
  already_imported: boolean;
}

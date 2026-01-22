/**
 * Discovery handlers for tool introspection.
 */

import {
  SERVICE_TOOL_MAP,
  unifiedTools,
  discoveryTools,
  type ToolDefinition,
} from "../tools/definitions.js";
import { isServiceEnabled, areUnifiedToolsEnabled, type ServiceName } from "../config/index.js";
import { successResponse, structuredResponse, type ToolResponse } from "../utils/responses.js";

interface ListToolsInput {
  service?: string;
  keyword?: string;
  includeSchemas?: boolean;
}

interface ToolInfo {
  name: string;
  description: string;
  service: string;
  inputSchema?: unknown;
  outputSchema?: unknown;
}

/**
 * List available tools with optional filtering by service or keyword.
 */
export async function handleListTools(args: unknown): Promise<ToolResponse> {
  const input = args as ListToolsInput;
  const { service, keyword, includeSchemas = false } = input;

  const results: ToolInfo[] = [];
  const availableServices: string[] = [];

  // Helper to add tools from a service
  const addToolsFromService = (serviceName: string, tools: ToolDefinition[]) => {
    for (const tool of tools) {
      // Filter by keyword if provided
      if (keyword) {
        const lowerKeyword = keyword.toLowerCase();
        const matchesName = tool.name.toLowerCase().includes(lowerKeyword);
        const matchesDesc = tool.description.toLowerCase().includes(lowerKeyword);
        if (!matchesName && !matchesDesc) continue;
      }

      const toolInfo: ToolInfo = {
        name: tool.name,
        description: tool.description,
        service: serviceName,
      };

      if (includeSchemas) {
        toolInfo.inputSchema = tool.inputSchema;
        if (tool.outputSchema) {
          toolInfo.outputSchema = tool.outputSchema;
        }
      }

      results.push(toolInfo);
    }
  };

  // Add discovery tools (always available)
  if (!service || service === "discovery") {
    addToolsFromService("discovery", discoveryTools);
    if (!availableServices.includes("discovery")) {
      availableServices.push("discovery");
    }
  }

  // Add tools from each enabled service
  for (const [svcName, serviceTools] of Object.entries(SERVICE_TOOL_MAP)) {
    if (isServiceEnabled(svcName as ServiceName)) {
      if (!availableServices.includes(svcName)) {
        availableServices.push(svcName);
      }

      // Filter by service if provided
      if (service && service !== svcName) continue;

      addToolsFromService(svcName, serviceTools);
    }
  }

  // Add unified tools if enabled
  if (areUnifiedToolsEnabled()) {
    if (!availableServices.includes("unified")) {
      availableServices.push("unified");
    }

    if (!service || service === "unified") {
      addToolsFromService("unified", unifiedTools);
    }
  }

  const data = {
    tools: results,
    totalCount: results.length,
    services: availableServices,
  };

  if (results.length === 0) {
    const filterDesc = [
      service ? `service=${service}` : null,
      keyword ? `keyword="${keyword}"` : null,
    ]
      .filter(Boolean)
      .join(", ");
    return successResponse(`No tools found matching filters: ${filterDesc || "none"}`);
  }

  const summary = includeSchemas
    ? `Found ${results.length} tool(s) with full schemas`
    : `Found ${results.length} tool(s): ${results.map((t) => t.name).join(", ")}`;

  return structuredResponse(summary, data);
}

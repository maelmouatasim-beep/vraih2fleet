import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase-client";


export default defineTool({
  name: "list_projects",
  title: "List projects",
  description:
    "List the H2Fleet fleet-transition projects owned by the signed-in user, most recently updated first.",
  inputSchema: {
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("Maximum number of projects to return (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("projects")
      .select(
        "id, name, description, country_or_region, currency, default_analysis_horizon_years, default_discount_rate, created_at, updated_at"
      )
      .order("updated_at", { ascending: false })
      .limit(limit ?? 50);

    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { projects: data ?? [] },
    };
  },
});

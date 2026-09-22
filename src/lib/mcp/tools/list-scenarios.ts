import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase-client";


export default defineTool({
  name: "list_scenarios",
  title: "List scenarios in a project",
  description:
    "List the fleet-transition scenarios (BEV, FCEV, diesel, mixed…) that belong to a given H2Fleet project. Returns scenario id, name, region, analysis horizon, discount rate, and fleet composition.",
  inputSchema: {
    project_id: z.string().uuid().describe("The parent project's UUID."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ project_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("scenarios")
      .select("*")
      .eq("project_id", project_id)
      .order("created_at", { ascending: false });

    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { scenarios: data ?? [] },
    };
  },
});

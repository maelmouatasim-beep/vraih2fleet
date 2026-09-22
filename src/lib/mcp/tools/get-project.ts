import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase-client";


export default defineTool({
  name: "get_project",
  title: "Get project details",
  description:
    "Fetch a single H2Fleet project (name, region, currency, analysis horizon, discount rate) by its ID. Only projects the signed-in user can see under RLS are returned.",
  inputSchema: {
    project_id: z.string().uuid().describe("The project's UUID."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ project_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", project_id)
      .maybeSingle();

    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    if (!data) {
      return { content: [{ type: "text", text: "Project not found" }], isError: true };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { project: data },
    };
  },
});

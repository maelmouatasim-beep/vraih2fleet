import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase-client";


export default defineTool({
  name: "get_tco_results",
  title: "Get TCO results for a scenario",
  description:
    "Return the latest computed Total Cost of Ownership (TCO) results for a given scenario: capex, opex breakdown, cumulative costs, and CO2 emissions.",
  inputSchema: {
    scenario_id: z.string().uuid().describe("The scenario's UUID."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ scenario_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("tco_results")
      .select("*")
      .eq("scenario_id", scenario_id)
      .eq("is_current", true)
      .maybeSingle();

    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    if (!data) {
      return {
        content: [{ type: "text", text: "No TCO results yet for this scenario." }],
      };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { tco_result: data },
    };
  },
});

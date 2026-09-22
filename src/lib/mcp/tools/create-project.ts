import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase-client";


export default defineTool({
  name: "create_project",
  title: "Create a new project",
  description:
    "Create a new fleet-transition project owned by the signed-in user. Use this when the user wants to start a new H2Fleet analysis (e.g. a new deployment region or a new client mandate).",
  inputSchema: {
    name: z.string().trim().min(1).describe("Human-readable project name."),
    description: z.string().trim().optional().describe("Short project description."),
    country_or_region: z
      .string()
      .trim()
      .min(1)
      .describe("Country or region code, e.g. 'CA-QC', 'FR', 'US-CA'."),
    currency: z.string().trim().min(3).max(3).describe("ISO currency code, e.g. 'CAD', 'EUR', 'USD'."),
    default_analysis_horizon_years: z
      .number()
      .int()
      .min(1)
      .max(30)
      .describe("Default TCO horizon in years (1-30)."),
    default_discount_rate: z
      .number()
      .min(0)
      .max(1)
      .describe("Default discount rate as a decimal, e.g. 0.05 for 5%."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("projects")
      .insert({
        user_id: ctx.getUserId(),
        name: input.name,
        description: input.description ?? null,
        country_or_region: input.country_or_region,
        currency: input.currency,
        default_analysis_horizon_years: input.default_analysis_horizon_years,
        default_discount_rate: input.default_discount_rate,
      })
      .select("*")
      .single();

    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }

    return {
      content: [{ type: "text", text: `Project created: ${data.id}` }],
      structuredContent: { project: data },
    };
  },
});

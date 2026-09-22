import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listProjectsTool from "./tools/list-projects";
import getProjectTool from "./tools/get-project";
import listScenariosTool from "./tools/list-scenarios";
import getTcoResultsTool from "./tools/get-tco-results";
import createProjectTool from "./tools/create-project";

// The OAuth issuer MUST be the direct Supabase host (see cloud-auth-oauth-server).
// VITE_SUPABASE_PROJECT_ID is inlined at build time by Vite, so this stays
// import-safe (no runtime env read). The fallback keeps the issuer well-formed
// during the manifest-extract eval, where a token never verifies.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "h2fleet-mcp",
  title: "H2Fleet MCP",
  version: "0.1.0",
  instructions:
    "Tools for H2Fleet — a fleet-electrification planning platform for heavy vehicles (BEV, FCEV hydrogen, biomethane). Use these tools to list the signed-in user's projects, inspect scenarios, read TCO/CO2 results, and create new projects. All calls run as the authenticated user under row-level security.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listProjectsTool,
    getProjectTool,
    listScenariosTool,
    getTcoResultsTool,
    createProjectTool,
  ],
});

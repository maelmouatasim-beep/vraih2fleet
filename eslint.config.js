import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // Ancien moteur TCO : aucun NOUVEL import (les imports existants sont
      // figés dans la baseline de lint et disparaissent avec les phases 2-3
      // de la refonte). Le moteur unique est src/lib/tco.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/calculations", "@/lib/calculations/*", "**/lib/calculations", "**/lib/calculations/*"],
              message:
                "Ancien moteur TCO (suppression Phase 3) — utiliser src/lib/tco (docs/tco-methodologie.md).",
            },
          ],
        },
      ],
    },
  },
);

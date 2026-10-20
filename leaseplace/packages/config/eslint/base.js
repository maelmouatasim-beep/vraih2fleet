// Règles communes : TypeScript strict, aucun `any`, imports de types explicites.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

/** @param {{ tsconfigRootDir: string }} options */
export function baseConfig({ tsconfigRootDir }) {
  return tseslint.config(
    { ignores: ["**/dist/**", "**/.next/**", "**/coverage/**", "**/*.config.{js,mjs,cjs}"] },
    js.configs.recommended,
    ...tseslint.configs.strictTypeChecked,
    {
      languageOptions: {
        globals: { ...globals.node },
        parserOptions: { projectService: true, tsconfigRootDir },
      },
      rules: {
        "@typescript-eslint/no-explicit-any": "error",
        "@typescript-eslint/consistent-type-imports": [
          "error",
          { fixStyle: "inline-type-imports" },
        ],
        "@typescript-eslint/no-unused-vars": [
          "error",
          { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
        ],
        "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
        eqeqeq: ["error", "always"],
        "no-console": ["error", { allow: ["warn", "error"] }],
      },
    },
  );
}

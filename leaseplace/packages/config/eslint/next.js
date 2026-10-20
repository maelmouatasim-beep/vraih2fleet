// Règles de l'application Next.js : base + React Hooks + Next + accessibilité.
import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import globals from "globals";
import { baseConfig } from "./base.js";

/** @param {{ tsconfigRootDir: string }} options */
export function nextConfig({ tsconfigRootDir }) {
  return [
    ...baseConfig({ tsconfigRootDir }),
    {
      files: ["**/*.{ts,tsx}"],
      languageOptions: { globals: { ...globals.browser } },
      plugins: {
        "@next/next": nextPlugin,
        "react-hooks": reactHooks,
        "jsx-a11y": jsxA11y,
      },
      rules: {
        ...nextPlugin.configs.recommended.rules,
        ...nextPlugin.configs["core-web-vitals"].rules,
        ...reactHooks.configs.recommended.rules,
        ...jsxA11y.flatConfigs.strict.rules,
      },
    },
  ];
}

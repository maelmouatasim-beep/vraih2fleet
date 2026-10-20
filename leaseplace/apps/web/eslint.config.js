import { nextConfig } from "@leaseplace/config/eslint/next";

export default [
  { ignores: ["next-env.d.ts", ".next/**"] },
  ...nextConfig({ tsconfigRootDir: import.meta.dirname }),
];

import { defineConfig, globalIgnores } from "eslint/config";
import eslint from "@eslint/js";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";
import tseslint from "typescript-eslint";

const webFiles = ["apps/web/**/*.{js,mjs,cjs,ts,tsx}"];

export default defineConfig([
  globalIgnores([
    "**/.next/**",
    "**/coverage/**",
    "**/dist/**",
    "contracts/**",
  ]),
  ...nextCoreWebVitals.map((config) => ({ ...config, files: webFiles })),
  ...nextTypeScript.map((config) => ({ ...config, files: webFiles })),
  {
    files: ["packages/**/*.ts"],
    extends: [eslint.configs.recommended, ...tseslint.configs.recommended],
  },
]);

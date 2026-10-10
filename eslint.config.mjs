import { defineConfig, globalIgnores } from "eslint/config";
import eslint from "@eslint/js";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";
import tseslint from "typescript-eslint";

const webFiles = [
  "apps/web/**/*.js",
  "apps/web/**/*.mjs",
  "apps/web/**/*.cjs",
  "apps/web/**/*.ts",
  "apps/web/**/*.tsx",
];

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
    files: [
      "apps/web/src/components/ui/motion/**/*.ts",
      "apps/web/src/components/ui/motion/**/*.tsx",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/static-components": "off",
    },
  },
  {
    files: ["packages/**/*.ts"],
    extends: [eslint.configs.recommended, ...tseslint.configs.recommended],
  },
]);

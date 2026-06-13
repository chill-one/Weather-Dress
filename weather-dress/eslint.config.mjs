import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // The current codebase leans on the flexibility of `any` in API handlers
      // and 3D scene helpers. Relax the rule so linting can focus on actionable
      // issues while we gradually add stronger typing.
      "@typescript-eslint/no-explicit-any": "off",
      // Keep `prefer-const` as a gentle reminder instead of a hard error.
      "prefer-const": "warn",
    },
  },
];

export default eslintConfig;

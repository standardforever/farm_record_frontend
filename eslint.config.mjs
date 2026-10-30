import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

export default [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Features may only import from other features through their index (public API).
      "no-restricted-imports": ["error", { patterns: [{ group: ["@/features/*/*/*"], message: "Import from the feature's index or api file." }] }],
    },
  },
];

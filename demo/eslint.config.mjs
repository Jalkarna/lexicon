import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "components/ui/terminal-animation.tsx",
    "components/ui/toolbar-expandable.tsx",
    "components/ui/direction-aware-tabs.tsx",
    "components/ui/text-animate.tsx",
  ]),
]);

export default eslintConfig;

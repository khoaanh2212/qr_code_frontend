import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Route files are never imported: shared code lives in src/features, src/lib and
// src/components, so the (marketing) and (private) groups stay independent and can be split
// into separate deployments later by moving folders.
const routeImports = {
  group: ["@/app", "@/app/*", "**/(marketing)/*", "**/(private)/*", "**/(auth)/*", "**/app/app/*"],
  message: "Do not import route files; move shared code to src/features, src/lib or src/components.",
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [routeImports] }],
      "react/no-danger": "error",
    },
  },
  {
    // Public pages are cached at the CDN and must not depend on the visitor's session.
    files: ["src/app/(marketing)/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [routeImports, { group: ["@/features/auth", "@/features/auth/*"], message: "Marketing pages never use the session." }],
          paths: [{ name: "@/lib/api", importNames: ["sessionApi"], message: "Marketing pages use publicApi only." }],
        },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;

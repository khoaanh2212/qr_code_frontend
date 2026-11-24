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
    files: ["src/app/[[]lang]/(marketing)/**/*.{ts,tsx}", "src/features/qr-editor/**/*.{ts,tsx}"],
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
  {
    // The one exception: a frame caption of the user's own is rendered by POST /v1/me/qr/render,
    // with the session cookie, at runtime and only on the user's request. The page itself (HTML,
    // CDN copy) still never depends on the session, and every other render stays session-free.
    // The generator's design templates (src/features/templates/generator-templates.tsx, outside
    // this rule's folders) follow the same contract: the session is read only when the person
    // opens the templates section.
    files: ["src/features/qr-editor/use-render.ts", "src/features/qr-editor/qr-editor.test.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [routeImports, { group: ["@/features/auth", "@/features/auth/*"], message: "Marketing pages never use the session." }],
        },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;

import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/node/index.ts" },
    format: ["esm", "cjs"],
    platform: "node",
    outDir: "dist/node",
    sourcemap: true,
    dts: false,
    target: "es2020",
    clean: true,
    splitting: false,
    outExtension: ({ format }) => ({ js: format === "cjs" ? ".cjs" : ".mjs" }),
  },
  {
    entry: { index: "src/browser/index.ts" },
    format: ["esm", "cjs"],
    platform: "browser",
    outDir: "dist/browser",
    sourcemap: true,
    dts: { entry: "src/browser/index.ts" },
    target: "es2020",
    clean: false,
    splitting: false,
    outExtension: ({ format }) => ({ js: format === "cjs" ? ".cjs" : ".mjs" }),
  },
]);

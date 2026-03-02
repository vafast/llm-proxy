import { defineConfig } from "tsdown/config";

export default defineConfig({
  entry: { index: "src/vercel.ts" },
  format: ["esm"],
  outDir: "api",
  clean: true,
  minify: true,
  dts: false,
  outputOptions: { codeSplitting: false },
  outExtensions: () => ({ js: ".js" }),
});

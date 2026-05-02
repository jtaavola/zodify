import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  target: "node22",
  clean: true,
  dts: false,
  splitting: false,
  sourcemap: false,
});

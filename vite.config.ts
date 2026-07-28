import { defineConfig } from "vitest/config";
import preact from "@preact/preset-vite";

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/BoardGameInventory/" : "/",
  plugins: [preact()],
  test: {
    environment: "jsdom",
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
    setupFiles: ["tests/setup.ts"],
    coverage: {
      reporter: ["text", "html"]
    }
  }
});

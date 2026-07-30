import { defineConfig } from "vitest/config";
import preact from "@preact/preset-vite";

export const setupServiceOrigin = (value: string | undefined) => {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    const localHttp =
      url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost");
    if (url.username || url.password || (url.protocol !== "https:" && !localHttp)) return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
};

const serviceOrigin = setupServiceOrigin(process.env.VITE_SETUP_SERVICE_URL);

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/BoardGameInventory/" : "/",
  plugins: [
    preact(),
    {
      name: "setup-service-csp",
      transformIndexHtml(html) {
        const connectSource = serviceOrigin
          ? `connect-src 'self' ${serviceOrigin};`
          : "connect-src 'self';";
        return html.replace("connect-src 'self';", connectSource);
      }
    }
  ],
  test: {
    environment: "jsdom",
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
    setupFiles: ["tests/setup.ts"],
    coverage: {
      reporter: ["text", "html"]
    }
  }
});

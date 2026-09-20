import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

/** تست‌های واحد بدون DOM اجرا می‌شوند؛ E2E جدا با Playwright است. */
export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "apps/web/src"),
      "@sr/protocol": resolve(__dirname, "packages/protocol/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    reporters: "default",
    passWithNoTests: false,
  },
});

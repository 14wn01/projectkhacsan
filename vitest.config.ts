import { defineConfig } from "vitest/config";

/**
 * Cấu hình test cho phần logic nghiệp vụ (không cần DOM).
 * Chạy: npm test — hoặc: npm run test:watch
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    reporters: "default",
  },
});

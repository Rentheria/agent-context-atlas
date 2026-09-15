import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      // Modest floor the current suite already meets; do not chase 100%.
      thresholds: {
        lines: 70,
        functions: 70,
        statements: 70,
        branches: 55,
      },
    },
  },
});

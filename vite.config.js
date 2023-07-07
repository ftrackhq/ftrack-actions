import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["actions/**/*.test.{js,ts}"],
    globalSetup: "./vitest.global_setup.ts",
    setupFiles: ["./vitest.setup.ts"],
  },
});

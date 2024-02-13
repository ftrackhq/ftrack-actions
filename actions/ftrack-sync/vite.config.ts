import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/*.test.{js,ts}"],
    globalSetup: "./vitest.global_setup.ts",
    setupFiles: ["./vitest.setup.ts"],
    // Resolves issue where vitest sometimes hangs https://github.com/vitest-dev/vitest/issues/3077
    pool: "forks",
  },
});

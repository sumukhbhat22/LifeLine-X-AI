import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./src/test",
  timeout: 60000,
  use: {
    baseURL: "http://localhost:8080",
  },
});

const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:5015",
    headless: true,
  },
  webServer: {
    command: "node server.js",
    port: 5015,
    reuseExistingServer: true,
    timeout: 30000,
  },
});

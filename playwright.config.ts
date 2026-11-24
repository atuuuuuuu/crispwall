import { defineConfig } from '@playwright/test'

const PORT = 4174

export default defineConfig({
  testDir: 'e2e',
  timeout: 180_000,
  reporter: 'list',
  use: { baseURL: `http://localhost:${PORT}`, acceptDownloads: true },
  // Tests run against the production build, so the security policy is the real one.
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
})

import { defineConfig, devices } from '@playwright/test';

/**
 * Os testes de ponta a ponta rodam contra o servidor de verdade, com o banco de
 * verdade. É o único lugar onde o produto é exercitado como o leitor o usa: o
 * parser no worker, o IndexedDB, o WebGL e a API atravessando o mesmo processo.
 *
 * A porta é 3101 e não 3100 para não brigar com o servidor que alguém esteja
 * usando para olhar a tela enquanto os testes rodam.
 */
const PORT = Number(process.env.E2E_PORT ?? 3101);
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  // Um teste que depende de outro esconde o motivo de falhar.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev -w @pokerstudio/next -- --port ${PORT}`,
    url: `${BASE_URL}/api/v1/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      // A guarda de CSRF compara a origem com este endereço.
      APP_URL: BASE_URL,
      PORT: String(PORT),
    },
  },
});

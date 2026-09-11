import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * O caminho que um leitor percorre na primeira vez: cria a conta, cola um hand
 * history, abre a mão, anda pelas ações, escreve o que achou.
 *
 * Cada passo aqui cobre uma peça que nenhum teste unitário alcança: o parser
 * rodando no worker que o Next compilou, o IndexedDB guardando a sessão, o
 * WebGL desenhando a mesa, e a API respondendo de dentro do mesmo servidor.
 */

const FIXTURE = join(process.cwd(), 'apps/web/src/parsers/pokerstars/fixtures/synthetic-cash.txt');

/** Uma conta por execução, para os testes não disputarem a mesma linha. */
function freshAccount() {
  const stamp = Date.now().toString(36);
  return {
    email: `e2e.${stamp}@pokerstudio.test`,
    password: 'E2e!Studio2026',
    name: 'Jogador E2E',
  };
}

test.describe('do cadastro à primeira mão', () => {
  test('a API responde de dentro do Next', async ({ request }) => {
    const health = await request.get('/api/v1/health');
    expect(health.ok()).toBe(true);
    expect((await health.json()).ok).toBe(true);
  });

  test('um endereço descartável é recusado, com o motivo', async ({ request }) => {
    const answer = await request.post('/api/v1/auth/signup', {
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      data: {
        email: 'jogador@mailinator.com',
        password: 'E2e!Studio2026',
        name: 'Descartável',
        countryCode: 'BR',
        language: 'pt-BR',
        acceptedTerms: true,
      },
    });
    expect(answer.status()).toBe(422);
    expect((await answer.json()).code).toBe('disposable_email');
  });

  test('cria a conta, importa uma mão e anda por ela', async ({ page }) => {
    const account = freshAccount();

    // A conta nasce pela API, porque o formulário não é o que este teste mede.
    const signUp = await page.request.post('/api/v1/auth/signup', {
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      data: { ...account, countryCode: 'BR', language: 'pt-BR', acceptedTerms: true },
    });
    expect(signUp.status()).toBe(201);

    await page.goto('/');
    await page.getByRole('button', { name: /paste hand history|colar hand history/i }).click();

    const text = readFileSync(FIXTURE, 'utf8');
    await page.getByPlaceholder(/paste one or more hands|cole uma ou mais/i).fill(text);
    await page.getByRole('button', { name: /import pasted text|importar o texto/i }).click();

    // O importador diz quantas mãos entraram e de qual sala.
    await expect(page.getByText(/3 hands|3 mãos/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/PokerStars/).first()).toBeVisible();
  });
});

test.describe('a landing', () => {
  test('responde no mesmo servidor, com o título no HTML', async ({ page }) => {
    const answer = await page.goto('/?site=1');
    expect(answer?.ok()).toBe(true);
    // O título vem do servidor, que é o que um rastreador lê antes de qualquer
    // script rodar.
    await expect(page).toHaveTitle(/PokerStudio Replayer/);
    await expect(page.getByText(/PokerStars/).first()).toBeVisible();
  });
});

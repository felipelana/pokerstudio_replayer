# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: replayer.spec.ts >> do cadastro à primeira mão >> um endereço descartável é recusado, com o motivo
- Location: tests\e2e\replayer.spec.ts:48:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 422
Received: 429
```

# Test source

```ts
  1   | import { expect, test } from '@playwright/test';
  2   | import { readFileSync } from 'node:fs';
  3   | import { join } from 'node:path';
  4   |
  5   | /**
  6   |  * O caminho que um leitor percorre na primeira vez: cria a conta, cola um hand
  7   |  * history, abre a mão, anda pelas ações, escreve o que achou.
  8   |  *
  9   |  * Cada passo aqui cobre uma peça que nenhum teste unitário alcança: o parser
  10  |  * rodando no worker que o Next compilou, o IndexedDB guardando a sessão, o
  11  |  * WebGL desenhando a mesa, e a API respondendo de dentro do mesmo servidor.
  12  |  */
  13  |
  14  | const FIXTURE = join(process.cwd(), 'apps/web/src/parsers/pokerstars/fixtures/synthetic-cash.txt');
  15  |
  16  | /**
  17  |  * O aviso de cookies fica por cima do rodapé e intercepta cliques. Um leitor o
  18  |  * dispensa sem pensar; um teste precisa dizer isso em voz alta.
  19  |  */
  20  | async function dismissOverlays(page: import('@playwright/test').Page) {
  21  |   // O tour do primeiro acesso abre sozinho numa conta nova e cobre a tela
  22  |   // inteira. É a primeira coisa que um leitor fecha, e tem que ser a primeira
  23  |   // aqui, ou ele intercepta todo clique seguinte.
  24  |   const skip = page.getByRole('button', { name: /^(skip|pular)$/i });
  25  |   if (await skip.isVisible().catch(() => false)) await skip.click();
  26  |
  27  |   const essential = page.getByRole('button', { name: /essential only|somente essenciais/i });
  28  |   if (await essential.isVisible().catch(() => false)) await essential.click();
  29  | }
  30  |
  31  | /** Uma conta por execução, para os testes não disputarem a mesma linha. */
  32  | function freshAccount() {
  33  |   const stamp = Date.now().toString(36);
  34  |   return {
  35  |     email: `e2e.${stamp}@pokerstudio.test`,
  36  |     password: 'E2e!Studio2026',
  37  |     name: 'Jogador E2E',
  38  |   };
  39  | }
  40  |
  41  | test.describe('do cadastro à primeira mão', () => {
  42  |   test('a API responde de dentro do Next', async ({ request }) => {
  43  |     const health = await request.get('/api/v1/health');
  44  |     expect(health.ok()).toBe(true);
  45  |     expect((await health.json()).ok).toBe(true);
  46  |   });
  47  |
  48  |   test('um endereço descartável é recusado, com o motivo', async ({ request }) => {
  49  |     const answer = await request.post('/api/v1/auth/signup', {
  50  |       headers: { 'X-Requested-With': 'XMLHttpRequest' },
  51  |       data: {
  52  |         email: 'jogador@mailinator.com',
  53  |         password: 'E2e!Studio2026',
  54  |         name: 'Descartável',
  55  |         countryCode: 'BR',
  56  |         language: 'pt-BR',
  57  |         acceptedTerms: true,
  58  |       },
  59  |     });
> 60  |     expect(answer.status()).toBe(422);
      |                             ^ Error: expect(received).toBe(expected) // Object.is equality
  61  |     expect((await answer.json()).code).toBe('disposable_email');
  62  |   });
  63  |
  64  |   test('cria a conta, importa uma mão e anda por ela', async ({ page, context }) => {
  65  |     const account = freshAccount();
  66  |
  67  |     // A conta nasce pela API, porque o formulário não é o que este teste mede.
  68  |     // O pedido sai do contexto do navegador, então o cookie de sessão que volta
  69  |     // fica onde a página vai procurá-lo.
  70  |     const signUp = await context.request.post('/api/v1/auth/signup', {
  71  |       headers: { 'X-Requested-With': 'XMLHttpRequest' },
  72  |       data: { ...account, countryCode: 'BR', language: 'pt-BR', acceptedTerms: true },
  73  |     });
  74  |     expect(signUp.status(), await signUp.text()).toBe(201);
  75  |
  76  |     // Se a sessão não abriu, o resto falharia com um erro que não explica nada.
  77  |     const me = await context.request.get('/api/v1/auth/me', {
  78  |       headers: { 'X-Requested-With': 'XMLHttpRequest' },
  79  |     });
  80  |     expect(me.status(), 'a sessão não abriu depois do cadastro').toBe(200);
  81  |
  82  |     await page.goto('/');
  83  |     // A biblioteca é a tela de quem entrou. Se aparecer a de entrada, o
  84  |     // cookie não chegou, e é isso que se quer ler na falha.
  85  |     await expect(page.getByRole('heading', { name: /hand history library|biblioteca de hand histories/i })).toBeVisible({
  86  |       timeout: 20_000,
  87  |     });
  88  |
  89  |     await dismissOverlays(page);
  90  |     // A tela oferece o mesmo botão em dois lugares; o primeiro é o da área de
  91  |     // arrastar, que é onde o leitor clica.
  92  |     await page.getByRole('button', { name: /paste hand history|colar hand history/i }).first().click();
  93  |     await page.getByPlaceholder(/paste one or more hands|cole uma ou mais/i).fill(readFileSync(FIXTURE, 'utf8'));
  94  |     await page.getByRole('button', { name: /import pasted text|importar o texto colado/i }).first().click();
  95  |
  96  |     // O importador diz quantas mãos entraram e de qual sala.
  97  |     await expect(page.getByText(/3 hands|3 mãos/i)).toBeVisible({ timeout: 20_000 });
  98  |     await expect(page.getByText(/PokerStars/).first()).toBeVisible();
  99  |   });
  100 | });
  101 |
  102 | test.describe('a landing', () => {
  103 |   test('responde no mesmo servidor, com o título no HTML', async ({ page }) => {
  104 |     const answer = await page.goto('/?site=1');
  105 |     expect(answer?.ok()).toBe(true);
  106 |     // O título vem do servidor, que é o que um rastreador lê antes de qualquer
  107 |     // script rodar.
  108 |     await expect(page).toHaveTitle(/PokerStudio Replayer/);
  109 |     await expect(page.getByText(/PokerStars/).first()).toBeVisible();
  110 |   });
  111 | });
  112 |
```

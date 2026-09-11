import { describe, expect, it } from 'vitest';
import { toWebResponse } from '../../src/server/interface/http/toWebResponse.js';

/**
 * A fronteira entre o Fastify e o Next.
 *
 * O resto da suíte fala com o Fastify por `inject`, que devolve um objeto e
 * nunca constrói um `Response`. Este arquivo cobre exatamente o passo que
 * faltava, e que por isso deixou nove rotas respondendo 500 em produção.
 */

const answer = (over: Partial<Parameters<typeof toWebResponse>[0]> = {}) => ({
  statusCode: 200,
  headers: { 'content-type': 'application/json' } as Record<string, string | string[]>,
  rawPayload: Buffer.from('{"ok":true}'),
  ...over,
});

describe('a resposta do Fastify virando resposta do Next', () => {
  it('leva o corpo e o status de uma resposta comum', async () => {
    const res = toWebResponse(answer());
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('{"ok":true}');
  });

  it('não põe corpo num 204, que é o status que sair da conta devolve', async () => {
    const res = toWebResponse(answer({ statusCode: 204, rawPayload: Buffer.alloc(0) }));
    expect(res.status).toBe(204);
    expect(res.body).toBeNull();
    expect(await res.text()).toBe('');
  });

  it('vale para todo status sem corpo, não só o 204', () => {
    for (const status of [204, 205, 304]) {
      const res = toWebResponse(answer({ statusCode: status, rawPayload: Buffer.alloc(0) }));
      expect(res.status, String(status)).toBe(status);
      expect(res.body, String(status)).toBeNull();
    }
  });

  it('guarda todos os cookies, e não só o último', () => {
    const res = toWebResponse(
      answer({
        headers: {
          'content-type': 'application/json',
          'set-cookie': ['sid=um; HttpOnly', 'csrf=dois; HttpOnly'],
        },
      }),
    );
    const cookies = res.headers.getSetCookie();
    expect(cookies).toHaveLength(2);
    expect(cookies[0]).toContain('sid=um');
    expect(cookies[1]).toContain('csrf=dois');
  });

  it('descarta o tamanho que o Fastify escreveu, porque só pode discordar', () => {
    const res = toWebResponse(
      answer({ headers: { 'content-length': '999', 'transfer-encoding': 'chunked' } }),
    );
    expect(res.headers.get('content-length')).toBeNull();
    expect(res.headers.get('transfer-encoding')).toBeNull();
  });

  it('ignora um cabeçalho sem valor em vez de escrever "undefined"', () => {
    const res = toWebResponse(answer({ headers: { 'x-nada': undefined, 'x-algo': 'sim' } }));
    expect(res.headers.get('x-nada')).toBeNull();
    expect(res.headers.get('x-algo')).toBe('sim');
  });
});

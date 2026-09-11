/**
 * A resposta do Fastify, convertida na resposta que o Next devolve.
 *
 * Parece mecânico e não é. Um `Response` recusa corpo quando o status é 204,
 * 205 ou 304, e recusa mesmo um corpo vazio: passar `new Uint8Array(0)` com
 * status 204 lança, e o que chega ao leitor é a página de erro do Next, um 500
 * sem explicação. Nove rotas respondem 204, entre elas sair da conta e apagar
 * uma revisão, e nenhuma delas funcionava.
 *
 * Os 161 testes do servidor não pegaram isso porque falam com o Fastify por
 * `inject`, que nunca constrói um `Response`. Por isso a conversão virou uma
 * função à parte: é a única linha de código que só existe na fronteira entre os
 * dois mundos, e agora é a única que tem teste próprio.
 */

/** Status que a especificação define como sem corpo. */
const NULL_BODY = new Set([101, 103, 204, 205, 304]);

export interface InjectedAnswer {
  statusCode: number;
  headers: Record<string, number | string | string[] | undefined>;
  rawPayload: Buffer | Uint8Array;
}

export function toWebResponse(answer: InjectedAnswer): Response {
  const headers = new Headers();
  for (const [key, value] of Object.entries(answer.headers)) {
    if (value === undefined) continue;
    // Uma resposta pode marcar mais de um cookie, e um objeto simples guardaria
    // só o último deles.
    if (Array.isArray(value)) for (const one of value) headers.append(key, String(one));
    else headers.set(key, String(value));
  }
  // O corpo já está completo; o tamanho que o Fastify escreveu só pode discordar.
  headers.delete('content-length');
  headers.delete('transfer-encoding');

  const body = NULL_BODY.has(answer.statusCode) ? null : new Uint8Array(answer.rawPayload);
  return new Response(body, { status: answer.statusCode, headers });
}

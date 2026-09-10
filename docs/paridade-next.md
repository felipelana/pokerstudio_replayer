# Paridade entre o Vite e o Next

Medido em `C:\lanareplayer_v2`, com o Vite em 5173 e o Next em 3100, os dois
renderizando o mesmo `apps/web/src`. Cada linha foi verificada no navegador ou
por execução, não por leitura de código.

## Automatizado

| Verificação | Vite | Next |
|---|---|---|
| `tsc --noEmit` | limpo | limpo |
| ESLint | limpo | limpo |
| Build de produção | 13 s | 24 s |
| Testes do web | 113 | 113, os mesmos arquivos |
| Testes da API | 148 | 148, os mesmos arquivos |
| `check:locales` | 881 chaves em 8 idiomas | idem |
| `check:copy` | limpo | limpo |

Os testes não foram duplicados. As duas cascas compartilham o `src`, então é o
mesmo conjunto rodando uma vez.

## Funcional

| Área | Verificação | Resultado |
|---|---|---|
| Rotas | as 17 continuam no react-router, dentro de uma rota catch-all | nenhuma URL mudou |
| Recarga profunda | `/settings` pedido direto pela URL | responde |
| Parser | hand history colada, importada | 1 mão, PokerStars, Cash |
| Worker | `parse.worker.ts` compilado pelo Next | servido de `_next/static/chunks` |
| Replay | três setas para a direita | 1/14 para 4/14 |
| Mesa | Three.js sob demanda | canvas presente, sem erro |
| Hidratação | console após carregar | nenhum aviso |
| Visual | tema escuro e claro | `#101013` e `#f4f5f7`, e de volta |
| Skins | troca de skin no cabeçalho | acento muda e volta |
| i18n | troca para português e recarrega | `lang=pt-BR` mantido |
| Persistência | sessões importadas após recarga | 3 sessões, mantidas |
| Autenticação | login, sessão, biblioteca | 200, 200, 200 |
| CSRF | origem divergente | recusada, como deve |
| API | as 72 rotas por `fastify.inject` | health, auth, reviews, skins, nicks |
| Compartilhar | link com senha criado e aberto | vista restrita, com a mesa |
| Relatório | nota, cobertura, mãos revistas | 75.0, 100%, 1 |
| Exportar | jsPDF e docx | 3,7 KB e 8,7 KB, sem erro |
| Responsivo | 320 px e 1920 px | sem rolagem lateral |

## Tamanho

| Medida | Vite | Next |
|---|---|---|
| JavaScript emitido | 2,84 MB | 3,42 MB |
| Primeiro carregamento | o índice inteiro | 88,9 kB |

O total emitido cresce 20%, acima do limite de 15% que o briefing fixou. Parte é
o runtime do App Router, e nada foi otimizado ainda. O primeiro carregamento,
que é o que o leitor espera, é de 88,9 kB, porque o resto entra sob demanda:
a mesa 3D, o worker do parser e as bibliotecas de exportação são todos chunks
separados.

## Ainda não verificado

- A landing, que continua em Vite.
- Docker, imagem e proxy.
- Os três fluxos de OAuth, que dependem de credenciais que este ambiente não
  tem. O código atravessou sem alteração, mas isso não é a mesma coisa que
  tê-los visto funcionar.

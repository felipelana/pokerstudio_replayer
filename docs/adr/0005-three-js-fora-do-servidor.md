# 0005. O replayer não renderiza no servidor

**Estado:** aceito, 10 de setembro de 2026

## Contexto

O App Router renderiza no servidor por padrão. O replayer lê o IndexedDB, desenha
com WebGL, pergunta o idioma ao navegador e guarda preferências localmente.
Vinte e seis arquivos tocam `document`, e dez das dezesseis dependências do
front assumem browser já no import.

## Decisão

A rota que serve o replayer é cliente, e o app é carregado com
`dynamic(..., { ssr: false })`. Nada dele executa no servidor.

A landing é o oposto: é estática, e carrega título, descrição e Open Graph no
HTML servido.

## Consequências

O replayer não ganha renderização no servidor, e não perde nada com isso: não há
conteúdo a indexar atrás de um login, e o primeiro byte útil depende do
IndexedDB do leitor de qualquer forma. Em troca, não há um único aviso de
hidratação, que era o risco real de tentar o contrário.

O Next, para o replayer, é empacotador e servidor. Quem esperar Server Components
aqui vai achar estranho, e é por isso que está escrito.

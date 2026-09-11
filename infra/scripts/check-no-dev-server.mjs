import { createConnection } from 'node:net';

/**
 * Recusa um build enquanto o servidor de desenvolvimento estiver de pé.
 *
 * Os dois escrevem na mesma pasta `.next`. O build a reescreve inteira, e o
 * servidor que já estava rodando continua servindo uma lista de chunks que
 * deixou de existir: o navegador pede JavaScript, recebe HTML, e o que aparece
 * é "Unexpected token '<'" numa tela em branco. O servidor responde 200 o tempo
 * todo, então não há nada no terminal que denuncie o que houve.
 *
 * Isso já custou uma aplicação no ar. Estava anotado na documentação, o que não
 * impediu ninguém de repetir, então agora é uma verificação.
 */

const PORT = Number(process.env.DEV_PORT ?? 3100);

const listening = await new Promise((resolve) => {
  const socket = createConnection({ port: PORT, host: '127.0.0.1' });
  const done = (answer) => {
    socket.destroy();
    resolve(answer);
  };
  socket.setTimeout(700);
  socket.on('connect', () => done(true));
  socket.on('timeout', () => done(false));
  socket.on('error', () => done(false));
});

if (listening) {
  console.error(
    [
      '',
      `Há algo escutando na porta ${PORT}, e o build não pode continuar.`,
      '',
      'O servidor de desenvolvimento e o build compartilham a pasta .next. Construir',
      'agora reescreveria os arquivos debaixo do servidor que está no ar, e a página',
      'passaria a carregar HTML no lugar de JavaScript sem nenhum erro no terminal.',
      '',
      'Pare o servidor antes (Ctrl+C na janela em que ele roda), ou construa com',
      'outra porta declarada em DEV_PORT se o que está ali não for ele.',
      '',
    ].join('\n'),
  );
  process.exit(1);
}

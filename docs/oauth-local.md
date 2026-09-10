# Testar Google, Facebook e Apple localmente

O código dos três provedores atravessou a migração sem alteração. O que falta
são credenciais, e elas só podem ser criadas por você: eu não recebo senha,
segredo nem chave privada. Você cria os aplicativos nos consoles, cola os
valores em `apps/api/.env`, e eu testo o fluxo.

## O endereço de retorno

O servidor registra, para cada provedor, uma rota que começa o fluxo e outra que
o termina. Rodando no Next em 3100, os retornos são:

| Provedor | Redirect URI |
|---|---|
| Google | `http://localhost:3100/api/v1/auth/google/callback` |
| Facebook | `http://localhost:3100/api/v1/auth/facebook/callback` |
| Apple | não aceita `localhost`, veja abaixo |

Se você testar no Vite, troque 3100 por 5173. O `APP_URL` do `.env` precisa
apontar para a mesma porta, ou a guarda de CSRF recusa a volta.

## Google

No Google Cloud Console, em APIs e Serviços, Credenciais, crie um **OAuth client
ID** do tipo aplicativo web. Em origens JavaScript autorizadas ponha
`http://localhost:3100`; em URIs de redirecionamento autorizados, o endereço da
tabela. O `localhost` é aceito sem HTTPS.

Escopos usados: `openid email profile`.

Preencha no `apps/api/.env`:

```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3100/api/v1/auth/google/callback
```

## Facebook

Em developers.facebook.com, crie um app e adicione o produto **Facebook Login**.
Em Configurações do Login, no campo de URIs de redirecionamento OAuth válidos,
ponha o endereço da tabela. Enquanto o app estiver em modo de desenvolvimento,
o Facebook aceita `localhost`; ao publicar, passa a exigir HTTPS.

Escopos usados: `public_profile,email`.

```
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
FACEBOOK_REDIRECT_URI=http://localhost:3100/api/v1/auth/facebook/callback
```

## Apple, e a limitação

**A Apple não aceita `localhost` como endereço de retorno.** Ela exige HTTPS e um
domínio registrado e verificado na conta de desenvolvedor. Não existe truque de
configuração que contorne isso, então o Sign in with Apple não pode ser testado
nesta máquina do jeito que os outros dois podem.

Há dois caminhos:

1. **Um túnel HTTPS público** apontando para a porta 3100, com o endereço do
   túnel registrado na Apple. Funciona, mas o endereço muda a cada sessão em
   várias ferramentas, e cada mudança pede novo registro.
2. **Testar em staging**, onde já existe domínio e certificado. É o caminho que
   eu recomendo, e é onde de qualquer forma isso precisa funcionar.

O que a Apple pede é diferente dos outros: um Services ID, um Team ID, uma chave
privada `.p8` com o seu Key ID, e o servidor monta o client secret assinado em
ES256 a cada pedido.

```
APPLE_CLIENT_ID=
APPLE_TEAM_ID=
APPLE_KEY_ID=
APPLE_PRIVATE_KEY=
APPLE_REDIRECT_URI=
```

A chave privada é multilinha. Cole-a com `\n` no lugar das quebras, que o
servidor desfaz isso ao ler.

## Depois de preencher

Reinicie o servidor, porque o `.env` é lido uma vez. Os botões de Google,
Facebook e Apple aparecem na tela de entrada assim que as credenciais existem;
sem elas, aparecem apagados em desenvolvimento e somem em produção, que é o
comportamento que o código já tinha.

Me avise quando tiver preenchido e eu testo o fluxo inteiro: ida ao provedor,
volta com o código, troca no servidor, criação da conta e cookie de sessão.

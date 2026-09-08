# Diagramas

Dois desenhos para a documentação técnica, gerados do código e não desenhados à
mão — quando o schema mudar, regere em vez de editar o SVG.

| Arquivo | O que mostra |
|---|---|
| `modelo-entidade-relacionamento.svg` | As 25 tabelas do PostgreSQL em quatro domínios, com chaves e cardinalidades. Em vermelho, o caminho de uma avaliação: sessão → convite → avaliação → mão avaliada. |
| `arquitetura.svg` | Onde cada coisa roda: o navegador (parser em Web Worker, biblioteca local), a API em camadas, o banco, os provedores externos e o acesso restrito do coach. |

## Regerar

```bash
node scripts/gerar-diagramas.cjs
```

As coordenadas das caixas estão no próprio script, escolhidas à mão para o
desenho respirar; o resto — campos, arestas, alinhamento — é calculado.

## Exportar para PNG ou PDF

O SVG é o formato de arquivo: escala sem perder nitidez e o Word, o Confluence,
o Google Docs e o Notion embutem direto. Para um bitmap, abra no navegador e
imprima em PDF, ou use o Inkscape:

```bash
inkscape modelo-entidade-relacionamento.svg --export-type=png --export-dpi=300
```

## O que os desenhos não dizem

- O ER mostra as colunas que importam para ler o modelo, não todas: `User` tem
  43 colunas e só dez estão desenhadas.
- `ReviewNote` é anterior a `Assessment` e continua no schema por
  compatibilidade com o que já foi salvo. Não é o caminho novo.
- A arquitetura descreve o estado do código na data no rodapé do desenho.

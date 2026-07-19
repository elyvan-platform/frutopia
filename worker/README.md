# 🏆 Leaderboard online do Frutopia

API minúscula (1 ficheiro) para ranking global, feita para o **plano gratuito
da Cloudflare** (Workers + KV — 100k pedidos/dia grátis, sem servidor para
manter). Enquanto não for publicada, o jogo esconde o leaderboard e funciona
normalmente.

## Publicar (≈3 minutos)

Precisas de uma conta gratuita em [cloudflare.com](https://dash.cloudflare.com/sign-up).

```bash
cd worker
npx wrangler login                      # abre o browser para autorizar
npx wrangler kv namespace create SCORES # devolve um id — copia-o
# cola o id no wrangler.toml (campo `id`)
npx wrangler deploy                     # devolve o URL do worker
```

O deploy termina com algo como:

```
https://frutopia-leaderboard.<a-tua-conta>.workers.dev
```

## Ligar o jogo

Abre o `game.js` (raiz do repositório) e preenche a constante no topo:

```js
const LEADERBOARD_URL = "https://frutopia-leaderboard.<a-tua-conta>.workers.dev";
```

Faz commit/push — o botão 🏆 aparece no jogo, os resultados passam a ser
enviados no fim de cada partida (o jogador escolhe um nome, uma vez) e o
Top 10 fica visível por modo: `classic` (todos os tempos) e `daily-AAAA-MM-DD`
(um ranking novo por dia, alinhado com o Desafio Diário).

## API

| Método | Rota | Corpo/Query | Resposta |
|---|---|---|---|
| GET | `/top?board=classic` | — | `{ scores: [{name, score}] }` (top 25) |
| POST | `/submit` | `{board, name, score}` | `{ ok: true, rank }` |

Proteções incluídas: validação de board/nome/pontuação, limite de pontuação,
rate-limit por IP (12 envios/min) e top 100 guardado por board.

**Nota honesta sobre batota:** sem validação de replays no servidor, um
utilizador tecnicamente hábil pode submeter pontuações falsas. Para um jogo
casual isto é o compromisso normal (o custo/benefício de validação total não
compensa nesta fase). O limite `MAX_SCORE` e o rate-limit travam os abusos
óbvios.

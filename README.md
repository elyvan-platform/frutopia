# 🍉 Frutopia

Um jogo de fusão de frutas para o browser — cativante, gratuito e sem instalação.
Larga frutas num recipiente, junta duas iguais para evoluírem para uma fruta
maior e tenta chegar à melancia sem deixar a pilha transbordar.

*A browser-based fruit-merge game. Drop fruits, match two of a kind to evolve
them, and try to reach the watermelon. UI auto-switches between Portuguese and
English based on your browser language.*

## ▶️ Jogar

Não precisa de build, servidor nem dependências — são 3 ficheiros estáticos:

- **Localmente:** abre o `index.html` no browser (duplo clique chega), ou
  `npx serve .` para servir a pasta.
- **Publicar:** ativa o GitHub Pages neste repositório
  (*Settings → Pages → Deploy from branch*) e partilha o link. Também funciona
  em Netlify, Vercel, Cloudflare Pages, etc. — é só apontar para a raiz.

## 🎮 Como se joga

- **Toca/clica** (ou arrasta e larga) para deixar cair a fruta na posição escolhida.
- Duas frutas iguais que se toquem **fundem-se** na fruta seguinte da cadeia:
  🍒 → 🍓 → 🍇 → 🍊 → 🟠 → 🍏 → 🍐 → 🍑 → 🍍 → 🍈 → 🍉
- Fusões em cadeia dão **combos** com bónus de pontos.
- Duas melancias juntas **explodem** e valem 500 pontos extra.
- Se a pilha ficar acima da linha tracejada durante 1 segundo, perdes.
- Teclado: `←`/`→` mirar, `Espaço` largar, `R` reiniciar, `M` som.

## ✨ Funcionalidades

- **Modo Clássico** — sequência aleatória, persegue o teu recorde.
- **Desafio Diário 📅** — todos os jogadores do mundo recebem a *mesma*
  sequência de frutas nesse dia (RNG com semente = data). Compara resultados
  com amigos e volta amanhã para o próximo desafio.
- **Streak 🔥** — dias consecutivos a jogar o Desafio Diário, visível no jogo
  e incluído no texto de partilha (ao estilo Wordle).
- **PWA instalável** — no telemóvel aparece "Adicionar ao ecrã inicial";
  abre em ecrã inteiro como app e funciona offline (service worker).
- **Cartões de partilha** — meta tags Open Graph/Twitter + imagem de preview:
  o link fica apelativo no WhatsApp, X, Discord, etc.
- **Leaderboard online 🏆 (opcional)** — ranking global por modo (clássico e
  diário), com backend pronto a publicar no plano gratuito da Cloudflare em
  ~3 minutos. Ver [`worker/README.md`](worker/README.md). Enquanto não for
  configurado, o jogo esconde o leaderboard e funciona 100% offline.
- **Recordes locais** (por modo e por dia) guardados no dispositivo.
- **Partilha em 1 toque** do resultado (Web Share API / clipboard).
- Física própria de círculos (timestep fixo, solver iterativo) — sem bibliotecas.
- Sons sintetizados com WebAudio — sem ficheiros de áudio.
- Gráficos 100% desenhados em Canvas — sem imagens.
- Responsivo: touch, rato e teclado; funciona offline depois de carregado.

## 🧱 Estrutura

| Ficheiro | Conteúdo |
|---|---|
| `index.html` | Estrutura da página, HUD e meta tags de partilha |
| `style.css` | Aspeto visual |
| `game.js` | Motor de física, render, som, modos, streak, leaderboard, i18n |
| `manifest.webmanifest` / `sw.js` | PWA: instalação e funcionamento offline |
| `icons/` / `og.png` | Ícones da app e imagem de partilha (gerados por código) |
| `worker/` | API do leaderboard (Cloudflare Worker + KV) e instruções de deploy |
| `ANALISE.md` | Análise que fundamenta as escolhas de design |

## 🧪 Testes

O jogo expõe um hook mínimo (`window.__frutopia`) usado por um smoke test
headless (Playwright + Chromium) que valida: largadas, fusões, pontuação,
fim de jogo, reinício, troca de modo, streak diário, presença do manifest/OG
e o fluxo completo do leaderboard (com API simulada) — sem erros de consola.
A API do worker tem testes próprios (validação, ordenação, CORS, rate-limit).

# Análise — Que jogo construir para que muitas pessoas joguem, gostem e voltem?

## 1. Objetivo

O critério de sucesso definido é claro: **maximizar o número de pessoas que
conseguem jogar, que gostam da experiência e que voltam**. Isso impõe três
restrições de design antes sequer de escolher o género:

1. **Fricção zero de acesso** — cada passo entre "vi o link" e "estou a jogar"
   perde jogadores. Nada de instalação,登録, downloads ou logins.
2. **Compreensão em menos de 5 segundos** — o jogo tem de se explicar sozinho
   na primeira interação.
3. **Loop de "só mais uma"** — sessões curtas, derrota rápida mas justa, e uma
   razão concreta para voltar amanhã.

## 2. Plataforma

**Browser (HTML5/Canvas), mobile-first.** É a única plataforma que cumpre a
restrição nº 1 na totalidade:

- Corre em qualquer telemóvel, tablet ou PC sem instalar nada.
- Partilha-se com um simples link (o mecanismo de crescimento viral mais barato
  que existe — foi assim que o Wordle e o 2048 explodiram).
- Publica-se gratuitamente (GitHub Pages, Netlify, etc.).
- Sem backend: sem custos de servidor, sem manutenção, escala infinitamente.

## 3. Género — opções consideradas

| Opção | Prós | Contras |
|---|---|---|
| Puzzle diário de palavras (tipo Wordle) | Retenção diária excelente | Preso a um idioma; espaço saturado |
| Endless runner / Flappy | Simples, viral | Frustração alta; retenção fraca a médio prazo |
| 2048 / deslizar e fundir | Loop comprovado | Extremamente clonado, pouca margem para encantar |
| Tetris-like | Clássico | Exige teclado; fraco em mobile |
| **Merge físico de frutas (estilo Suika)** | Loop viciante comprovado (milhões de jogadores em 2023-24), controlo de 1 dedo, física dá profundidade emergente e momentos de sorte/habilidade, visual fofo com apelo universal | Física exige cuidado na implementação |

**Escolha: merge físico de frutas.** É o género com a melhor relação entre
simplicidade de controlo (tocar para largar) e profundidade real (gestão de
espaço, planeamento de cadeias, física emergente). O momento "cadeia de fusões
em cascata" produz picos de dopamina genuínos que os jogadores querem repetir.

## 4. Mecânicas de retenção incluídas

- **Recorde pessoal** guardado localmente — a razão nº 1 para "só mais uma".
- **Desafio Diário** — todos os jogadores do mundo recebem a *mesma sequência
  de frutas* nesse dia (RNG com semente = data). Cria comparação social
  ("fiz 3.412 no diário de hoje, e tu?") e um motivo para voltar amanhã.
- **Partilha em 1 toque** — botão que copia/partilha o resultado, ao estilo
  Wordle, para alimentar o ciclo viral.
- **Combos** — fusões em cadeia dão bónus e feedback exuberante, premiando
  jogo pensado em vez de aleatório.
- **"Juice"** — partículas, screen-shake, sons sintetizados, caras nas frutas,
  animações de squash. É o que separa "funciona" de "sabe bem jogar".

## 5. Decisões técnicas

- **Zero dependências e zero assets externos**: física própria (colisão de
  círculos com resolução por impulsos), sons sintetizados com WebAudio,
  gráficos desenhados em Canvas. O jogo inteiro são 3 ficheiros estáticos;
  funciona offline e abre até com duplo-clique no `index.html`.
- **Física a timestep fixo** (60 Hz, solver iterativo) para comportamento
  estável e idêntico em qualquer máquina — essencial para o desafio diário
  ser justo.
- **Bilingue automático** (PT/EN pelo idioma do browser) para não limitar o
  alcance.
- **Responsivo + touch + rato + teclado**, com suporte a ecrãs de alta
  densidade (DPR).

## 6. Riscos e mitigação

- *Física instável em pilhas grandes* → solver com múltiplas iterações,
  correção posicional e limites de velocidade.
- *Fim de jogo injusto* → a linha de derrota só conta para frutas que já
  tocaram na pilha e só após ~1 s contínuo acima da linha, com aviso visual.
- *Saturação do género* → o desafio diário com semente global e a partilha de
  resultado são diferenciadores que a maioria dos clones não tem.

## 7. Evolução futura (fora do âmbito desta entrega)

Leaderboard online (precisa de backend leve), PWA instalável, skins
desbloqueáveis, streaks do desafio diário.

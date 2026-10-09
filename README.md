# Checkmate — wagered chess on BOT Chain

Chess with skin in the game on **BOT Chain testnet (chain 968)**. Both players stake BOT,
the winner takes the pot (2× the wager), and a 24-hour move clock stops stalling. Moves are
recorded on-chain as SAN + FEN; the board runs on chess.js in your browser.

## Pages

| Page | What it does |
|---|---|
| `index.html` | Landing — live game stats and rules |
| `app.html` | Interactive board, game list, create/join/move/resign/timeout |
| `docs.html` | Game rules, contract API, demo activity, build & verify |

## On-chain (testnet)

- **Checkmate:** [`0xA3a4b15c9158dC6c93215A0c431859bad6Ac2C74`](https://scan.bohr.life/address/0xA3a4b15c9158dC6c93215A0c431859bad6Ac2C74) — verified ✓
- Chain: `968` · RPC `https://rpc.bohr.life` · explorer `https://scan.bohr.life`
- Wagers use **native BOT** (msg.value), both sides staking equally

## Core API

```
createGame(opponent, initialFEN) +value     — creator plays White
joinGame(gameId) +value                     — opponent matches the wager
submitMove(gameId, san, fenAfter, isMate)   — record a move; mate pays 2×
cancelGame / resign / claimTimeout          — exit paths (refund / forfeit / 24h clock)
getGame(gameId) → Game                       — full state incl. lastFEN
```

Events: `GameCreated`, `GameJoined`, `MoveSubmitted`, `GameFinished`.

The demo game on chain is the four-move fool's mate: `1. f3 e5 2. g4 Qh4#`.

## Run locally

Static site — any file server works:

```bash
npx serve .
```

## Stack

- Vanilla HTML/CSS/JS (no build step)
- [ethers.js 6](https://docs.ethers.org/) + [chess.js 1.4.0](https://github.com/jhlywa/chess.js) via esm.sh
- [Reown AppKit](https://reown.com/appkit) for wallet connect
- Testnet wagers are test BOT — no monetary value

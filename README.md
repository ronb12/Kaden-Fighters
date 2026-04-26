# Kaden Fighters

Browser-based martial arts fighting game (HTML5 Canvas).

**Play now:** `https://kaden-fighter.vercel.app`

## Controls

- **Menu**
  - **Enter**: select / start
  - **A/D** or **◀/▶**: change difficulty (Easy / Medium / Hard)
- **Fight**
  - **Move**: A / D
  - **Jump**: W
  - **Block**: S
  - **Punches**: J / U / I / O / P
  - **Kicks**: K / H / Y / L / N
  - **Special**: Space
  - **Super**: Shift

## Features

- **Five playable fighters**: Kaden, Raijin, Hikari, Ren, Yuki
- **Final boss**: **Reigen** (must defeat him to win)
- **Difficulty modes**: Easy / Medium / Hard
- **Combo system**: on-screen “X HIT COMBO” callouts (Street Fighter-style)
- **Scoring**: scoreboard points for hits, combos, projectiles, and round wins
- **Multiple stages**: rotating fight backgrounds (boss fight forces Shadow Temple)
- **Enhanced win/lose screens**: opponent portrait + randomized trash talk
- **App icons / favicons**: `favicon.ico`, PWA manifest, Apple touch icon

## Project structure

- `index.html`: the full game
- `assets/`: sprites, icons, stage art
- `vercel.json`: static headers for long-term asset caching

## Deploy

This repo is a static site and can be deployed to Vercel directly.

- **CLI**:

```bash
npx vercel --prod
```


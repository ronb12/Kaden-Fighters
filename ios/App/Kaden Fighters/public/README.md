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
- `api/`: Vercel serverless routes (Neon Postgres)
- `neon/schema.sql`: SQL to create tables (run once in Neon)

## Neon (Postgres)

The canvas game runs in the browser; **Neon** stores data server-side (e.g. leaderboards).

1. Create a project at [Neon](https://neon.tech).
2. Copy the **connection string** (use the **pooled** string for serverless if Neon offers it).
3. In [Vercel](https://vercel.com) → your project → **Settings → Environment Variables**, add **`DATABASE_URL`** with that string (all environments you use).
4. In Neon → **SQL Editor**, paste and run `neon/schema.sql`.
5. After deploy, verify:
   - `GET /api/db-ping` — should return `{ ok: true, neon: { now, db } }`
   - `GET /api/high-scores` — top scores (empty until you POST or insert rows)

You can also use the **Vercel Neon integration** from the Vercel Marketplace to provision Neon and inject `DATABASE_URL` automatically.

## Deploy

This repo is a static site and can be deployed to Vercel directly.

- **CLI**:

```bash
npx vercel --prod
```


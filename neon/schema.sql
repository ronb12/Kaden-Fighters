-- Run this once in Neon: Dashboard → SQL Editor → paste → Run
-- https://neon.tech/docs/introduction

CREATE TABLE IF NOT EXISTS high_scores (
  id BIGSERIAL PRIMARY KEY,
  player_name TEXT NOT NULL DEFAULT 'FIGHTER',
  score INTEGER NOT NULL CHECK (score >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS high_scores_score_desc ON high_scores (score DESC);

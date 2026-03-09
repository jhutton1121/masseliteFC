-- Matches: individual games within a game day (e.g., 2x 5v5 when 20 people show up)
CREATE TABLE matches (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  game_id    TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  label      TEXT NOT NULL DEFAULT 'Game 1',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_matches_game ON matches(game_id);

-- Track whether teams have been published for a game day
ALTER TABLE games ADD COLUMN teams_published INTEGER NOT NULL DEFAULT 0;

-- Recreate game_teams to reference matches instead of game days
DROP TABLE IF EXISTS game_teams;
CREATE TABLE game_teams (
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team     TEXT NOT NULL CHECK(team IN ('A', 'B')),
  PRIMARY KEY (match_id, user_id)
);

-- Recreate game_stats to reference matches instead of game days
DROP TABLE IF EXISTS game_stats;
CREATE TABLE game_stats (
  id       TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team     TEXT CHECK(team IN ('A', 'B')),
  goals    INTEGER NOT NULL DEFAULT 0,
  assists  INTEGER NOT NULL DEFAULT 0,
  UNIQUE(match_id, user_id)
);
CREATE INDEX idx_game_stats_user ON game_stats(user_id);
CREATE INDEX idx_game_stats_match ON game_stats(match_id);

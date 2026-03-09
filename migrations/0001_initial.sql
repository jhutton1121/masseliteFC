-- MassEliteFC Initial Schema

-- Users
CREATE TABLE users (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name          TEXT NOT NULL,
  email         TEXT UNIQUE,
  password_hash TEXT,
  whatsapp      TEXT UNIQUE,
  avatar_key    TEXT,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('superadmin', 'admin', 'user')),
  positions     TEXT NOT NULL DEFAULT '[]',
  notify_email           INTEGER NOT NULL DEFAULT 1,
  notify_whatsapp        INTEGER NOT NULL DEFAULT 1,
  notify_game_reminder   INTEGER NOT NULL DEFAULT 1,
  notify_schedule_change INTEGER NOT NULL DEFAULT 1,
  notify_stats_posted    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (email IS NOT NULL OR whatsapp IS NOT NULL)
);

-- Sessions
CREATE TABLE sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

-- OTP Codes (WhatsApp auth)
CREATE TABLE otp_codes (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  phone      TEXT NOT NULL,
  code       TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Fields (game locations)
CREATE TABLE fields (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name       TEXT NOT NULL,
  address    TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0
);

-- Games
CREATE TABLE games (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  field_id      TEXT NOT NULL REFERENCES fields(id),
  date          TEXT NOT NULL,
  time          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  max_players   INTEGER,
  notes         TEXT,
  reminder_sent INTEGER NOT NULL DEFAULT 0,
  created_by    TEXT NOT NULL REFERENCES users(id),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_games_date ON games(date);
CREATE INDEX idx_games_status ON games(status);

-- RSVPs
CREATE TABLE rsvps (
  game_id    TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status     TEXT NOT NULL CHECK (status IN ('in', 'out', 'late')),
  no_show    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (game_id, user_id)
);

-- Game Stats (per player per game)
CREATE TABLE game_stats (
  id      TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team    TEXT CHECK (team IN ('A', 'B')),
  goals   INTEGER NOT NULL DEFAULT 0,
  assists INTEGER NOT NULL DEFAULT 0,
  UNIQUE(game_id, user_id)
);
CREATE INDEX idx_game_stats_user ON game_stats(user_id);

-- Game Teams (assigned before game by team builder)
CREATE TABLE game_teams (
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team    TEXT NOT NULL CHECK (team IN ('A', 'B')),
  PRIMARY KEY (game_id, user_id)
);

-- Seasons
CREATE TABLE seasons (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name       TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date   TEXT NOT NULL
);

-- Season Awards
CREATE TABLE season_awards (
  id        TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  season_id TEXT NOT NULL REFERENCES seasons(id),
  user_id   TEXT NOT NULL REFERENCES users(id),
  award     TEXT NOT NULL CHECK (award IN ('mvp', 'rookie_of_year', 'most_dedicated', 'golden_boot', 'playmaker')),
  UNIQUE(season_id, award)
);

-- Add recap writer permission to users
ALTER TABLE users ADD COLUMN can_write_recaps INTEGER NOT NULL DEFAULT 0;

-- Game writeups table
CREATE TABLE game_writeups (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(game_id)
);

CREATE INDEX idx_game_writeups_game ON game_writeups(game_id);

-- Extra players support for RSVPs (guests brought by members)
ALTER TABLE rsvps ADD COLUMN extra_players INTEGER NOT NULL DEFAULT 0;
ALTER TABLE rsvps ADD COLUMN extra_player_names TEXT NOT NULL DEFAULT '[]';

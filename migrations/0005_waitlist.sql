-- Add 'waitlist' to RSVP status check constraint

-- 1. Create a new table with the updated constraint
CREATE TABLE rsvps_new (
  game_id    TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status     TEXT NOT NULL CHECK (status IN ('in', 'out', 'late', 'waitlist')),
  no_show    INTEGER NOT NULL DEFAULT 0,
  extra_players INTEGER,
  extra_player_names TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (game_id, user_id)
);

-- 2. Copy data from the old table
INSERT INTO rsvps_new (game_id, user_id, status, no_show, extra_players, extra_player_names, created_at, updated_at)
SELECT game_id, user_id, status, no_show, extra_players, extra_player_names, created_at, updated_at
FROM rsvps;

-- 3. Drop the old table
DROP TABLE rsvps;

-- 4. Rename the new table
ALTER TABLE rsvps_new RENAME TO rsvps;

-- CHESS.MOD Relational Schema (PostgreSQL & SQLite compatible)

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  username_lower TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  google_id TEXT UNIQUE,
  avatar TEXT NOT NULL DEFAULT 'preset:obsidian_king',
  frame_id TEXT NOT NULL DEFAULT 'frame_stone',
  board_theme_id TEXT NOT NULL DEFAULT 'board_classic_maya',
  piece_skin_id TEXT NOT NULL DEFAULT 'pieces_classic',
  equipped_power_id TEXT NOT NULL DEFAULT 'power_none',
  title TEXT NOT NULL DEFAULT '',
  elo INTEGER NOT NULL DEFAULT 0,
  xp INTEGER NOT NULL DEFAULT 50,
  mods INTEGER NOT NULL DEFAULT 100,
  vip_active INTEGER NOT NULL DEFAULT 0,
  vip_expires_at TEXT,
  is_moderator INTEGER NOT NULL DEFAULT 0,
  is_banned INTEGER NOT NULL DEFAULT 0,
  ban_reason TEXT NOT NULL DEFAULT '',
  banned_at TEXT,
  totp_enabled INTEGER NOT NULL DEFAULT 0,
  totp_secret TEXT,
  totp_pending_secret TEXT,
  backup_codes_json TEXT NOT NULL DEFAULT '[]',
  security_pin_hash TEXT,
  token_version INTEGER NOT NULL DEFAULT 1,
  level INTEGER NOT NULL DEFAULT 1,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  games_played INTEGER NOT NULL DEFAULT 0,
  bases_destroyed INTEGER NOT NULL DEFAULT 0,
  hints_used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS campaign_progress (
  user_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  level_id INTEGER NOT NULL,
  best_turns INTEGER NOT NULL DEFAULT 0,
  completions INTEGER NOT NULL DEFAULT 1,
  completed_at TEXT NOT NULL,
  PRIMARY KEY (user_id, campaign_id, level_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_unlocks (
  user_id TEXT NOT NULL,
  cosmetic_id TEXT NOT NULL,
  unlocked_at TEXT NOT NULL,
  PRIMARY KEY (user_id, cosmetic_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL,
  white_user_id TEXT,
  black_user_id TEXT,
  opponent_name TEXT NOT NULL,
  winner TEXT NOT NULL,
  result_reason TEXT NOT NULL,
  white_elo_before INTEGER,
  white_elo_after INTEGER,
  black_elo_before INTEGER,
  black_elo_after INTEGER,
  turns INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS xp_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  balance_after INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS clans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_lower TEXT NOT NULL UNIQUE,
  tag TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  leader_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (leader_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS clan_members (
  clan_id TEXT NOT NULL,
  user_id TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TEXT NOT NULL,
  PRIMARY KEY (clan_id, user_id),
  FOREIGN KEY (clan_id) REFERENCES clans(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS friendships (
  id TEXT PRIMARY KEY,
  requester_id TEXT NOT NULL,
  addressee_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(requester_id, addressee_id),
  FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (addressee_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL,
  reported_user_id TEXT,
  reported_username TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'hacks',
  description TEXT NOT NULL,
  match_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  resolved_by TEXT,
  resolution_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS security_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  ip TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  details TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_users_elo ON users(elo DESC, wins DESC);
CREATE INDEX IF NOT EXISTS idx_matches_white ON matches(white_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_matches_black ON matches(black_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_xp_user ON xp_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_friends_req ON friendships(requester_id, status);
CREATE INDEX IF NOT EXISTS idx_friends_addr ON friendships(addressee_id, status);
CREATE INDEX IF NOT EXISTS idx_sec_events_user ON security_events(user_id, created_at DESC);

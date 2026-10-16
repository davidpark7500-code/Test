// SQLite data layer for Kept. One file, synchronous (better-sqlite3), WAL mode.
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.KEPT_DATA_DIR || path.join(__dirname, '..', 'data');
export const UPLOAD_DIR = process.env.KEPT_UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const DB_PATH = process.env.KEPT_DB_PATH || path.join(DATA_DIR, 'kept.db');

export function openDb(file = DB_PATH) {
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_color TEXT NOT NULL DEFAULT '#5865f2',
  bio TEXT DEFAULT '',
  timezone TEXT DEFAULT 'UTC',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS communities (
  id INTEGER PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  tagline TEXT DEFAULT '',
  description TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'habits',
  icon TEXT DEFAULT '🎯',
  color TEXT DEFAULT '#5865f2',
  owner_id INTEGER NOT NULL REFERENCES users(id),
  is_public INTEGER NOT NULL DEFAULT 1,
  platform_fee_bps INTEGER NOT NULL DEFAULT 500,
  stripe_account_id TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS tiers (
  id INTEGER PRIMARY KEY,
  community_id INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0,
  interval TEXT NOT NULL DEFAULT 'month',
  description TEXT DEFAULT '',
  perks TEXT DEFAULT '[]',
  position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS memberships (
  id INTEGER PRIMARY KEY,
  community_id INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  tier_id INTEGER REFERENCES tiers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  joined_at INTEGER NOT NULL,
  UNIQUE(community_id, user_id)
);
CREATE TABLE IF NOT EXISTS channels (
  id INTEGER PRIMARY KEY,
  community_id INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text',
  topic TEXT DEFAULT '',
  tier_required_id INTEGER REFERENCES tiers(id) ON DELETE SET NULL,
  position INTEGER NOT NULL DEFAULT 0,
  members TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY,
  channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'text',
  meta TEXT DEFAULT '{}',
  created_at INTEGER NOT NULL,
  edited_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id, id);
CREATE TABLE IF NOT EXISTS reactions (
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  PRIMARY KEY (message_id, user_id, emoji)
);
CREATE TABLE IF NOT EXISTS read_states (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  last_read_id INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, channel_id)
);
CREATE TABLE IF NOT EXISTS challenges (
  id INTEGER PRIMARY KEY,
  community_id INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  emoji TEXT DEFAULT '🔥',
  cadence TEXT NOT NULL DEFAULT 'daily',
  target_per_week INTEGER NOT NULL DEFAULT 7,
  starts_at INTEGER NOT NULL,
  ends_at INTEGER,
  stake_cents INTEGER NOT NULL DEFAULT 0,
  proof_required INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES users(id),
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS challenge_members (
  challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at INTEGER NOT NULL,
  stake_cents INTEGER NOT NULL DEFAULT 0,
  settled_through TEXT,
  PRIMARY KEY (challenge_id, user_id)
);
CREATE TABLE IF NOT EXISTS checkins (
  id INTEGER PRIMARY KEY,
  challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_key TEXT NOT NULL,
  note TEXT DEFAULT '',
  image_path TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE(challenge_id, user_id, day_key)
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY,
  community_id INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  starts_at INTEGER NOT NULL,
  ends_at INTEGER,
  location TEXT DEFAULT '',
  channel_id INTEGER REFERENCES channels(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users(id),
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS rsvps (
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'going',
  PRIMARY KEY (event_id, user_id)
);
CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  community_id INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  tier_id INTEGER NOT NULL REFERENCES tiers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active',
  provider TEXT NOT NULL DEFAULT 'mock',
  provider_ref TEXT,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  started_at INTEGER NOT NULL,
  canceled_at INTEGER
);
CREATE TABLE IF NOT EXISTS checkout_sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  community_id INTEGER NOT NULL,
  tier_id INTEGER NOT NULL,
  provider TEXT NOT NULL DEFAULT 'mock',
  status TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS ledger (
  id INTEGER PRIMARY KEY,
  community_id INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  meta TEXT DEFAULT '{}',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS live_sessions (
  id INTEGER PRIMARY KEY,
  channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  host_id INTEGER REFERENCES users(id),
  mode TEXT NOT NULL DEFAULT 'room',
  title TEXT DEFAULT '',
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  peak_participants INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS invites (
  code TEXT PRIMARY KEY,
  community_id INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  created_by INTEGER REFERENCES users(id),
  uses INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
`;

function migrate(db) {
  db.exec(SCHEMA);
}

export const now = () => Date.now();
export const j = (v) => JSON.stringify(v ?? null);
export const pj = (s, fallback = null) => { try { return s == null ? fallback : JSON.parse(s); } catch { return fallback; } };

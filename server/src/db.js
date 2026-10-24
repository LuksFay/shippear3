import pg from "pg";
import { config } from "./config.js";

export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 });

export const q = (text, params) => pool.query(text, params);

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id               BIGSERIAL PRIMARY KEY,
  dni              VARCHAR(8) NOT NULL UNIQUE,
  email            TEXT NOT NULL,
  role             TEXT NOT NULL DEFAULT 'vecino' CHECK (role IN ('vecino', 'entidad')),
  entidad_id       TEXT,
  email_verified_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS login_tokens (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  attempts    INT NOT NULL DEFAULT 0,
  request_ip  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_tokens_user_idx ON login_tokens (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS login_tokens_ip_idx ON login_tokens (request_ip, created_at DESC);

CREATE TABLE IF NOT EXISTS sessions (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip           TEXT,
  user_agent   TEXT
);

CREATE TABLE IF NOT EXISTS ai_requests (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  provider    TEXT NOT NULL,
  model       TEXT NOT NULL,
  ok          BOOLEAN NOT NULL,
  tokens_in   INT,
  tokens_out  INT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_requests_user_idx ON ai_requests (user_id, created_at DESC);
`;

export async function migrate() {
  for (let i = 1; i <= 20; i++) {
    try {
      await q(SCHEMA);
      return;
    } catch (e) {
      console.warn(`[db] migración intento ${i} falló: ${e.code || e.message}`);
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw new Error("No se pudo inicializar la base de datos");
}

export async function cleanup() {
  await q("DELETE FROM login_tokens WHERE created_at < now() - interval '2 days'");
  await q("DELETE FROM sessions WHERE expires_at < now()");
}

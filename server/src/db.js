import pg from "pg";
import { config } from "./config.js";

export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 });
// Sin este handler, un reinicio de Postgres (p. ej. durante un redeploy) tumbaba la API.
pool.on("error", (e) => console.error("[db] conexión inactiva perdida:", e.code || e.message));

export const q = (text, params) => pool.query(text, params);

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id               BIGSERIAL PRIMARY KEY,
  doc_number       VARCHAR(11) NOT NULL,
  email            TEXT NOT NULL,
  role             TEXT NOT NULL DEFAULT 'vecino' CHECK (role IN ('vecino', 'entidad')),
  entidad_id       TEXT,
  email_verified_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at    TIMESTAMPTZ
);

-- v2: el documento depende del rol (vecino = DNI, entidad = CUIT/CUIL); único por documento + rol.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'dni') THEN
    ALTER TABLE users RENAME COLUMN dni TO doc_number;
  END IF;
END $$;
ALTER TABLE users ALTER COLUMN doc_number TYPE VARCHAR(11);
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_dni_key;
CREATE UNIQUE INDEX IF NOT EXISTS users_doc_role_uq ON users (doc_number, role);

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

-- v3: cada conversación del chat es un reclamo (borrador hasta que se presenta). Historial persistido.
CREATE TABLE IF NOT EXISTS reclamos (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  estado        TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'en_tramite', 'respondido', 'escalado', 'resuelto')),
  activa        BOOLEAN NOT NULL DEFAULT true,
  datos         JSONB NOT NULL DEFAULT '{}'::jsonb,
  memoria       TEXT NOT NULL DEFAULT '',
  listo         BOOLEAN NOT NULL DEFAULT false,
  fundamento    TEXT,
  presentado_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reclamos_user_idx ON reclamos (user_id, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS reclamos_activa_uq ON reclamos (user_id) WHERE activa;

CREATE TABLE IF NOT EXISTS reclamo_mensajes (
  id          BIGSERIAL PRIMARY KEY,
  reclamo_id  BIGINT NOT NULL REFERENCES reclamos(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  kind        TEXT NOT NULL DEFAULT 'texto' CHECK (kind IN ('texto', 'audio', 'archivo')),
  text        TEXT NOT NULL DEFAULT '',
  adjunto     JSONB,  -- metadatos del adjunto (nombre, tipo, páginas, segundos de audio, miniatura); nunca el archivo
  contexto    TEXT,   -- lo extraído del adjunto (texto del PDF o lo que la IA leyó de la imagen)
  provider    TEXT,
  model       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reclamo_mensajes_idx ON reclamo_mensajes (reclamo_id, id);

-- v4: casos de ejemplo marcados como demo (dueños sin login posible: doc_number "demo-…").
ALTER TABLE reclamos ADD COLUMN IF NOT EXISTS demo BOOLEAN NOT NULL DEFAULT false;
-- v5: estado 'recibido' (recién presentado, visible para la Oficina) y 'baja' (dado de baja por el vecino; se conserva).
ALTER TABLE reclamos DROP CONSTRAINT IF EXISTS reclamos_estado_check;
ALTER TABLE reclamos ADD CONSTRAINT reclamos_estado_check
  CHECK (estado IN ('borrador', 'recibido', 'en_tramite', 'respondido', 'escalado', 'resuelto', 'baja'));

-- v6: baja lógica (la fila se conserva) y edición con historial de versiones.
ALTER TABLE reclamos ADD COLUMN IF NOT EXISTS estado_previo TEXT;
ALTER TABLE reclamos ADD COLUMN IF NOT EXISTS baja_at TIMESTAMPTZ;
ALTER TABLE reclamos ADD COLUMN IF NOT EXISTS baja_motivo TEXT;
ALTER TABLE reclamos ADD COLUMN IF NOT EXISTS editado_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS reclamo_versiones (
  id          BIGSERIAL PRIMARY KEY,
  reclamo_id  BIGINT NOT NULL REFERENCES reclamos(id) ON DELETE CASCADE,
  version     INT NOT NULL,
  accion      TEXT NOT NULL CHECK (accion IN ('edicion', 'baja')),
  snapshot    JSONB NOT NULL,            -- cómo estaba el reclamo ANTES del cambio
  cambios     JSONB NOT NULL DEFAULT '[]', -- [{campo, antes, despues}]
  user_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,
  user_role   TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (reclamo_id, version)
);

-- v7: estudios jurídicos / abogados que quieren recibir información (sin compartir casos automáticamente).
CREATE TABLE IF NOT EXISTS abogados_interesados (
  id                BIGSERIAL PRIMARY KEY,
  nombre            TEXT NOT NULL,
  estudio           TEXT,
  matricula         TEXT,
  colegio           TEXT,
  email             TEXT NOT NULL,
  telefono          TEXT,
  ciudad            TEXT NOT NULL,
  provincia         TEXT NOT NULL,
  especialidades    TEXT[] NOT NULL DEFAULT '{}',
  mensaje           TEXT,
  consentimiento_at TIMESTAMPTZ NOT NULL,
  ip_hash           TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS abogados_ip_idx ON abogados_interesados (ip_hash, created_at);

-- v8: directorio de canales de reclamo de entidades (se carga con server/scripts/entidades-sql.mjs desde un
-- archivo que NO está en el repo). Sólo se usa para SUGERIR el destino: nunca se envía nada automáticamente.
CREATE TABLE IF NOT EXISTS entidades_destino (
  id                  TEXT PRIMARY KEY,
  nombre              TEXT NOT NULL,
  denominacion_legal  TEXT,
  cuit                TEXT,
  tipo                TEXT NOT NULL CHECK (tipo IN ('banco', 'seguro', 'billetera', 'tarjeta', 'financiera', 'mutual', 'cooperativa', 'credito', 'organismo')),
  sector              TEXT CHECK (sector IN ('publico', 'privado', 'mixto')),
  regulador           TEXT,
  emails              TEXT[] NOT NULL DEFAULT '{}',
  acepta_email        BOOLEAN NOT NULL DEFAULT false,
  acepta_email_nota   TEXT,
  area_contacto       TEXT,
  url_formulario      TEXT,
  telefono            TEXT,
  plazo_respuesta     TEXT,
  fuente              TEXT,
  fecha_verificacion  DATE,
  confianza           TEXT,
  alias               TEXT[] NOT NULL DEFAULT '{}',
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
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

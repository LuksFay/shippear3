# Saldo a Favor

> **Authoria:** Arcade Estudio
> **Version:** 0.2.0
> **Type:** Web App (React, mobile-first)

## Description

Defensor financiero vecinal para Rosario.

- **Vecino:** cuenta su problema en un chat (texto o audio) y sube una foto/PDF del
  resumen. La IA clasifica el conflicto y extrae entidad, monto, fecha y operación;
  el vecino confirma los datos. Ve sus derechos en lenguaje simple con la norma
  oficial, recibe el reclamo listo y la app sigue el plazo de 10 días hábiles del
  BCRA (vencido sin respuesta → escalada al BCRA).
- **Oficina Municipal del Consumidor:** bandeja con triage verde/amarillo/rojo,
  puntaje de prioridad por reglas configurables, seguimiento de plazos y alerta
  temprana de patrones por entidad con intimación colectiva.

**Estado actual:** el chat del vecino ya usa IA real (vía `server/`, la API propia) y el
ingreso se elige en el login: **ciudadano** (DNI) o **entidad** (CUIT/CUIL), siempre + código por email; el rol queda en la sesión y lo valida el servidor. El resto de las pantallas (reclamos, bandeja,
patrones) sigue mostrando data de `src/mock/` hasta conectar la API del BCRA.

**Escalera de reclamo:** entidad → BCRA → Oficina Municipal del Consumidor.
(COPREC disuelto por Decreto 55/25 — no forma parte.)

## Setup

```bash
npm install
npm run dev            # frontend en :5173 (proxy /api → :3401)

cd server
npm install
cp ../.env.example ../.env   # completar; NUNCA commitear .env
PORT=3401 node --env-file=../.env src/index.js
```

Requiere un Postgres (`DATABASE_URL`) y un SMTP para mandar los códigos.

## Backend (`server/`)

Node 22 sin framework (deps: `pg`, `nodemailer`).

| Ruta | Qué hace |
|---|---|
| `GET /api/health` | estado de DB e IA |
| `POST /api/auth/request` | `{role: vecino\|entidad, doc, email?}` → manda código de 6 dígitos por email (primera vez pide email). DNI 7–8 dígitos; CUIT/CUIL 11 dígitos con verificador |
| `POST /api/auth/verify` | `{role, doc, code}` → cookie de sesión httpOnly |
| `GET /api/auth/me` / `POST /api/auth/logout` | sesión |
| `POST /api/chat` | historial + adjunto (foto/PDF) → respuesta de la IA + datos extraídos |
| `POST /api/transcribe` | audio → texto |

- Códigos: 10 min, un solo uso, 5 intentos, guardados como HMAC; límites por usuario (documento + rol) e IP. Un mismo número puede existir como ciudadano y como entidad por separado.
- Roles en el servidor: `/api/chat` y `/api/transcribe` sólo para ciudadanos (403 `rol_no_permitido`); `/api/entidad/*` sólo para entidades.
- Errores de IA distinguibles: `ia_sin_credito` (503, la cuenta del proveedor no tiene saldo), `ia_ocupada` (503, rate limit), `ia_config` (503, key inválida), `ia_timeout` (504), `ia_no_disponible` (502), `ia_offline` (503, Broly/túnel apagado), `audio_no_disponible` (501), `pdf_invalido` / `pdf_vacio` (400). `/api/health` chequea el modelo local en vivo (`ai.ok`, `ai.error`).
- IA: `server/src/ai/` abstrae el proveedor. En producción `AI_PROVIDER=xai,local`: primero xAI Grok
  (`grok-4.20-0309-non-reasoning`, texto + fotos) y, si falla (sin crédito, 402/429, 5xx, timeout,
  key inválida), en la misma consulta pasa al respaldo local: Ollama en Broly
  (`qwen3.5:4b`, texto + fotos, prompt sólo en español) que llega a Contabo por un túnel SSH inverso
  (Broly → `shippear-tunnel@contabo`, `-R 172.19.0.1:11435:127.0.0.1:11434`, sólo visible para la red
  Docker `shippear_net`). Si fallan los dos el chat responde `ia_offline`. `ai_requests` guarda qué
  proveedor respondió; `/api/health` muestra el estado de cada uno (`ai.providers`). Audio deshabilitado por ahora.
  También `openai` y `local-openai` (LM Studio/vLLM). Ninguna clave llega al frontend.
- Roles en DB: `vecino` / `entidad`.

## Deploy

Push a `main` → GitHub Actions (`.github/workflows/deploy.yml`) compila y entra por SSH a
Contabo con una llave que sólo puede ejecutar el redeploy (`git pull --ff-only` +
`docker compose up -d --build`). Servicios: `web` (nginx estático, :3400), `api` (:3401),
`db` (Postgres, red interna). Secretos sólo en `/opt/shippear/.env` del servidor.

## Structure

```
[repo]/
├── goals/        ← Brand direction (brand.md, references.md, constraints.md)
├── server/       ← API (auth DNI/CUIT + código, chat IA, transcripción)
├── src/
│   ├── lib/      ← api.js (cliente de /api)
│   ├── mock/     ← Provisional data (reclamos, casos, entidades, contenido,
│   │               bibliotecaLegal, tiposConflicto, reglasPrioridad, patrones)
│   ├── styles/   ← fusion-engine.css (ecosistema) + app.css (tema saldoafavor)
│   ├── components/ ← Stamp, Doc, ReclamoTicket, Barcode, TopBar, BottomNav, Icon
│   ├── screens/  ← Home, Chat, ConfirmarDatos, Derechos, ReclamoListo,
│   │               Seguimiento, MisReclamos, Bandeja, CasoDetalle, Patrones
│   └── App.jsx
├── public/
└── package.json
```

## Data

Este proyecto usa la carpeta `src/mock/` para todos los datos mostrados
(patrón del ecosistema). Para conectar datos reales, reemplazar los imports de
mock por llamadas a API (Supabase + Vercel AI SDK + Central de Deudores del BCRA).

## Brand

Identidad: **sello de goma bermellón + papel de carta + tinta de tampón**.
Tipografía: JetBrains Mono (display) + Space Grotesk (body).

- Ver `goals/brand.md` para la esencia y personalidad de marca.
- Ver `goals/references.md` para referencias visuales y anti-referencias.
- Ver `goals/constraints.md` para lo que NUNCA se hace en este proyecto.

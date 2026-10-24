# AGENTS.md — Saldo a Favor

> **Authoria:** Arcade Estudio
> **Núcleo:** `C:\Dev\Arcade-Ecosystem\AGENTS.md` — todas las reglas de diseño, skills y estándares viven ahí. Este archivo solo agrega reglas específicas del proyecto.

## Qué es

**Saldo a Favor** — defensor financiero vecinal (Rosario).

- **Vecino:** cuenta su problema en un chat (texto o audio) y sube una foto/PDF del
  resumen. La IA clasifica el conflicto y extrae entidad, monto, fecha y operación;
  el vecino CONFIRMA los datos. Ve sus derechos en lenguaje simple con link a la
  norma oficial, recibe el reclamo listo y la app sigue el plazo de 10 días hábiles
  del BCRA (vencido sin respuesta → escalada al BCRA).
- **Oficina Municipal del Consumidor de Rosario:** bandeja de casos con triage
  automático (verde autoservicio / amarillo revisión / rojo presencial), puntaje de
  prioridad por reglas configurables, seguimiento de plazos y alerta temprana de
  patrones por entidad con nota de intimación colectiva.

## Estado actual

- **Fase actual:** chat del vecino con IA real vía `server/` (API propia, la clave vive sólo en el
  servidor) e ingreso con DNI + código por email. El resto de la data sigue en `src/mock/`.
  En el chat NO se escriben respuestas fijas en el frontend: todo sale de `/api/chat`.
- **Stack objetivo (fase funciones, según brief):** Next.js, Supabase, Vercel AI SDK
  con Gemini (plan gratuito) + Groq de respaldo, deploy en Vercel, API pública de la
  Central de Deudores del BCRA, Claude Code.

## Reglas de producto (innegociables)

1. **La IA no inventa leyes.** Solo clasifica y extrae. Derechos, normas y plantillas
   salen de `src/mock/bibliotecaLegal.json` (fija y validada), con links oficiales.
2. **El vecino confirma los datos** antes de enviar (pantalla ConfirmarDatos).
3. **Plazo BCRA:** 10 días hábiles. Vencido → escalada al BCRA (Seguimiento).
4. **Escalera de reclamo:** entidad → BCRA → Oficina Municipal del Consumidor.
   **COPREC NO existe** (disuelto por Decreto 55/25). Nunca aparece.
5. **Triage y puntaje por reglas configurables, no por IA**
   (`src/mock/reglasPrioridad.json`).
6. **Aviso fijo:** la app no reemplaza el asesoramiento legal.

## Reglas de diseño

- Identidad: SELLO bermellón (`--color-accent`) + papel + tinta. Nunca quitar los sellos.
- El chat es la interfaz del vecino (familiar tipo WhatsApp) pero con piel de remito:
  burbujas cuadradas, timestamps mono, sin emojis.
- El documento de reclamo (`components/Doc.jsx`) es el artefacto central.
- Voz del "despachante de confianza": frases cortas, lenguaje simple para adultos
  mayores, cero jerga legal (la jerga vive solo en el documento).
- Todo dato mostrado sale de `src/mock/*.json`. Al conectar API real, reemplazar imports.
- Mobile-first: probar 320 / 375 / 768 / 1024 / 1440. Nunca scroll horizontal.
- Motion solo con `data-fuse` (fusion-engine). Solo transform + opacity.
- El switch de rol CIUDADANO/ENTIDAD es la navegación principal entre los dos productos.

## Estructura

```
[repo]/
├── goals/                  ← Branding direction (brand, references, constraints)
├── src/
│   ├── mock/               ← TODA la data mostrada (provisional)
│   │   ├── bibliotecaLegal.json ← normas oficiales + links (fijo y validado)
│   │   ├── tiposConflicto.json  ← 6 conflictos financieros + derechos simples
│   │   ├── reglasPrioridad.json ← reglas configurables del puntaje
│   │   ├── patrones.json        ← alerta temprana por entidad
│   │   ├── entidades / reclamos / casos / contenido
│   ├── styles/
│   │   ├── fusion-engine.css  ← Motor del ecosistema (tokens, motion, reset)
│   │   └── app.css            ← Tema saldoafavor + componentes (papel, sello, chat, triage)
│   ├── components/         ← Stamp, Doc, ReclamoTicket, Barcode, TopBar, BottomNav, Icon
│   ├── screens/            ← Home, Chat, ConfirmarDatos, Derechos, ReclamoListo,
│   │                          Seguimiento, MisReclamos, Bandeja, CasoDetalle, Patrones
│   ├── App.jsx             ← Navegación por estado + roles
│   └── main.jsx
├── public/                 ← favicon.svg
└── package.json            ← Estándares Arcade (author Arcade Estudio, AGPL-3.0)
```

## Comandos

- `npm run dev` — desarrollo
- `npm run build` — build de producción
- `npm run lint` — oxlint
- QA headless (playwright-core temporal en node_modules): script en
  `%TEMP%\opencode\saldoafavor-qa.mjs` (no versionado)

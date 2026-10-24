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

**Estado actual: fase de DISEÑO.** La IA, Supabase y la API del BCRA se integran en
una fase posterior. Toda la data visible sale de `src/mock/`.

**Escalera de reclamo:** entidad → BCRA → Oficina Municipal del Consumidor.
(COPREC disuelto por Decreto 55/25 — no forma parte.)

## Setup

```bash
npm install
npm run dev
```

## Structure

```
[repo]/
├── goals/        ← Brand direction (brand.md, references.md, constraints.md)
├── src/
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

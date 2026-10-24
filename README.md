# Shippear

> **Authoria:** Arcade Estudio
> **Version:** 0.1.0
> **Type:** Web App (React, mobile-first)

## Description

Mesa de entrada digital para reclamos ciudadanos.

- **Ciudadano:** sube una foto de su factura o recibo → la IA detecta el problema,
  redacta el reclamo con fundamento y lo deriva a la entidad responsable.
- **Entidad:** bandeja de casos ordenados por prioridad, con documento leído,
  resumen generado por IA, trazabilidad y acciones (derivar / responder / resolver).

**Estado actual: fase de DISEÑO.** La IA, el backend y la DB (Contabo) se integran
en una fase posterior. Toda la data visible sale de `src/mock/`.

## Setup

```bash
npm install
npm run dev
```

## Structure

```
shippear/
├── goals/        ← Brand direction (brand.md, references.md, constraints.md)
├── src/
│   ├── mock/     ← Provisional data (reclamos, casos, entidades, contenido)
│   ├── styles/   ← fusion-engine.css (ecosistema) + app.css (tema shippear)
│   ├── components/ ← Stamp, Doc, ReclamoTicket, Barcode, TopBar, BottomNav, Icon
│   ├── screens/  ← Home, NuevoReclamo, Analizando, ReclamoListo, MisReclamos, Bandeja, CasoDetalle
│   └── App.jsx
├── public/
└── package.json
```

## Data

Este proyecto usa la carpeta `src/mock/` para todos los datos mostrados
(patrón del ecosistema). Para conectar datos reales, reemplazar los imports de
mock por llamadas a API.

## Brand

Identidad: **sello de goma bermellón + papel de carta + tinta de tampón**.
Tipografía: JetBrains Mono (display) + Space Grotesk (body).

- Ver `goals/brand.md` para la esencia y personalidad de marca.
- Ver `goals/references.md` para referencias visuales y anti-referencias.
- Ver `goals/constraints.md` para lo que NUNCA se hace en este proyecto.

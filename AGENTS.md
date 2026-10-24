# AGENTS.md — Shippear

> **Authoria:** Arcade Estudio
> **Núcleo:** `C:\Dev\Arcade-Ecosystem\AGENTS.md` — todas las reglas de diseño, skills y estándares viven ahí. Este archivo solo agrega reglas específicas de shippear.

## Qué es

Plataforma de reclamos ciudadanos con dos roles:

- **Ciudadano:** sube UNA foto de su factura/recibo → IA analiza → reclamo redactado y derivado.
- **Entidad** (municipalidad/organismo): bandeja de casos ordenados por prioridad para derivar o resolver.

## Estado actual

- **Fase actual: DISEÑO.** Toda la data es mock (`src/mock/`). No hay IA real, backend ni DB todavía.
- Futuro (fuera de esta fase): análisis con IA de documentos, DB en Contabo, APIs existentes.

## Reglas específicas

- La identidad es el SELLO (bermellón `--color-accent`). Nunca quitar los sellos de estado.
- El documento de reclamo (`components/Doc.jsx`) es el artefacto central: nunca reemplazar por un toast o card de éxito.
- Voz del "despachante de confianza": frases cortas, imperativo amable, cero jerga legal.
- Todo dato mostrado sale de `src/mock/*.json`. Al conectar API real, reemplazar los imports, no dispersar datos.
- Mobile-first: probar 320 / 375 / 768 / 1024 / 1440. Nunca scroll horizontal.
- Motion solo con `data-fuse` (fusion-engine). Solo transform + opacity. `prefers-reduced-motion` ya está cubierto por el engine.
- El switch de rol CIUDADANO/ENTIDAD es la navegación principal entre los dos productos.

## Estructura

```
shippear/
├── goals/                  ← Branding direction (brand, references, constraints)
├── src/
│   ├── mock/               ← TODA la data mostrada (provisional)
│   ├── styles/
│   │   ├── fusion-engine.css  ← Motor del ecosistema (tokens, motion, reset)
│   │   └── app.css            ← Tema shippear + componentes (papel, sello, ticket)
│   ├── components/         ← Stamp, Doc, ReclamoTicket, Barcode, TopBar, BottomNav, Icon
│   ├── screens/            ← Home, NuevoReclamo, Analizando, ReclamoListo, MisReclamos, Bandeja, CasoDetalle
│   ├── App.jsx             ← Navegación por estado + roles
│   └── main.jsx
├── public/                 ← favicon.svg
└── package.json            ← Estándares Arcade (author Arcade Estudio, AGPL-3.0)
```

## Comandos

- `npm run dev` — desarrollo
- `npm run build` — build de producción
- `npm run lint` — oxlint

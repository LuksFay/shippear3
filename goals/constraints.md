# Shippear — Constraints

## NEVER do this

- [ ] Usar azul institucional o blanco frío como fondo
- [ ] Usar Inter/Poppins/Roboto como display
- [ ] Redondear cards o usar sombras decorativas (radio 0, bordes 1px duros)
- [ ] Mostrar un spinner o "cargando…" sin explicar QUÉ está haciendo la IA
- [ ] Poner formularios largos en el camino del ciudadano (una foto = un reclamo)
- [ ] Hardcodear datos en componentes (todo va en `src/mock/`)
- [ ] Usar emojis o íconos de stock como iconografía
- [ ] Íconos con color distinto del token (`--color-*`)
- [ ] Métricas falsas ("+47%", "50.000 reclamos resueltos")
- [ ] Animaciones que muevan layout (solo transform + opacity)
- [ ] Centrar texto pequeño en pantallas grandes
- [ ] Letter-spacing normal en títulos grandes (siempre negativo)
- [ ] Más de 3 tipografías (JetBrains Mono + Space Grotesk + mono = mismo sistema)

## ALWAYS do this

- [x] Seguir la voz del "despachante de confianza": corto, directo, promesas cumplibles
- [x] Un solo acento: bermellón de sello `--color-accent` (papel + tinta + bermellón)
- [x] Sellos de goma como elemento de identidad (RECIBIDO / EN TRÁMITE / URGENTE / RESUELTO)
- [x] CSS variables para TODO color; tema claro y oscuro via `[data-mode]`
- [x] Mobile first: 320 → 375 → 768 → 1024 → 1440, sin scroll horizontal
- [x] Entrada animada en cada componente (`data-fuse` de fusion-engine)
- [x] Cargar todos los datos desde `src/mock/` (reclamos, casos, entidades, contenido)
- [x] Aplicar ADP Protocol antes de cerrar cada pantalla
- [x] El documento de reclamo como artefacto central, no un toast de éxito

## ADP Protocol checklist (Alma, Huesos, Aliento, Chispa, Piel, IDENTIDAD)

- [ ] Alma: ¿el concepto (mesa de entrada digital) es coherente en TODAS las pantallas?
- [ ] Huesos: ¿la estructura es asimétrica e intencional, no centrada por defecto?
- [ ] Aliento: ¿usa fusion-engine (data-fuse) con jerarquía de entradas?
- [ ] Chispa: ¿hay feedback táctil? (hover magnético, squash al click, glow)
- [ ] Piel: ¿hay textura? (grano, papel, perforado de ticket, código de barras)
- [ ] IDENTIDAD: ¿si cambiás la tipografía, la app pierde su esencia? (debe: sí)

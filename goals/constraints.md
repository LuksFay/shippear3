# Saldo a Favor — Constraints

## NEVER do this

- [ ] Usar azul institucional o blanco frío como fondo
- [ ] Usar Inter/Poppins/Roboto como display
- [ ] Redondear cards o usar sombras decorativas (radio 0, bordes 1px duros)
- [ ] Mostrar un spinner o "cargando…" sin explicar QUÉ está haciendo la IA
- [ ] Poner formularios largos en el camino del vecino (el trámite es un chat)
- [ ] Dejar que la IA genere normas, derechos o artículos — todo sale de
      `mock/bibliotecaLegal.json` (fijo y validado), con links oficiales
- [ ] Mencionar COPREC en la escalera de reclamo (disuelto por Decreto 55/25);
      la escalera es: entidad → BCRA → Oficina Municipal del Consumidor
- [ ] Triage o puntaje de prioridad calculado por IA — son reglas configurables
- [ ] Omitir el aviso de que la app no reemplaza el asesoramiento legal
- [ ] Hardcodear datos en componentes (todo va en `src/mock/`)
- [ ] Usar emojis o íconos de stock como iconografía
- [ ] Métricas falsas ("+47%", "50.000 reclamos resueltos")
- [ ] Animaciones que muevan layout (solo transform + opacity)
- [ ] Letter-spacing normal en títulos grandes (siempre negativo)
- [ ] Más de 3 tipografías (JetBrains Mono + Space Grotesk = mismo sistema)

## ALWAYS do this

- [x] Voz del "despachante de confianza": corto, directo, lenguaje simple para
      adultos mayores, promesas cumplibles
- [x] Un solo acento: bermellón de sello `--color-accent` + señalética funcional
      (verde/amarillo/rojo) solo para triage y estados
- [x] Sellos de goma como elemento de identidad (RECIBIDO / EN TRÁMITE / VENCIDO / YA)
- [x] CSS variables para TODO color; tema claro y oscuro via `[data-mode]`
- [x] Mobile first: 320 → 375 → 768 → 1024 → 1440, sin scroll horizontal
- [x] Entrada animada en cada componente (`data-fuse` de fusion-engine)
- [x] Cargar todos los datos desde `src/mock/`
- [x] Plazo BCRA de 10 días hábiles visible en cada reclamo en trámite
- [x] El documento de reclamo como artefacto central, no un toast de éxito
- [x] Aplicar ADP Protocol antes de cerrar cada pantalla

## ADP Protocol checklist (Alma, Huesos, Aliento, Chispa, Piel, IDENTIDAD)

- [ ] Alma: ¿el concepto (mesa de entrada digital + chat familiar) es coherente en TODAS las pantallas?
- [ ] Huesos: ¿la estructura es asimétrica e intencional, no centrada por defecto?
- [ ] Aliento: ¿usa fusion-engine (data-fuse) con jerarquía de entradas?
- [ ] Chispa: ¿hay feedback táctil? (hover magnético, squash al click, typing dots)
- [ ] Piel: ¿hay textura? (grano, papel, perforado de ticket, código de barras)
- [ ] IDENTIDAD: ¿si cambiás la tipografía, la app pierde su esencia? (debe: sí)

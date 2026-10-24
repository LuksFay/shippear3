# Shippear — References

## Visual references

- **Guía de remito / ticket de encomienda** — estructura de datos expuesta: nº de
  expediente, fecha, monto, remitente/destinatario en filas mono. De ahí sale la
  jerarquía de cada "caso".
- **Sello de goma de mesa de entrada** — sellos rotados 2-6°, bermellón sobre papel,
  borde doble, texto mono en mayúsculas. Es EL elemento de identidad (RECIBIDO /
  EN TRÁMITE / URGENTE / RESUELTO / DERIVADO).
- **Bandeja de entrada física** — la cola de casos ordenada por prioridad se presenta
  como bandeja de despacho, no como lista SaaS.
- **Brutalismo cálido web** — bordes 1px duros, radio 0, separadores punteados de
  troquel (dashed), tipografía masiva, sin sombras decorativas.
- **Recibos térmicos / timbrados** — bloques de texto mono, separadores de guiones,
  códigos de barras como textura de fondo.

## Anti-references (lo que NO hacer)

- **Portales de reclamos gubernamentales** — azul institucional, helvetica, tablas
  grises, 40 campos de formulario. TODO lo que evitamos.
- **Apps de bancos genéricas** — blanco frío, azul, cards redondeadas con sombra,
  íconos de stock, "cargando…" infinito sin explicar qué pasa.
- **SaaS landing clásica** — hero con ilustración 3D, "features" en grid simétrico,
  métricas falsas ("+47%", "trusted by"), gradientes violeta.
- **Legal-tech pretencioso** — serif formal, dorado, lenguaje "estimado usuario".

## Structural references

- **App shell mobile-first** — bottom nav fija (INICIO / NUEVO / MIS RECLAMOS),
  contenido en columna única hasta 768px; la bandeja de entidad se expande a grid ≥1024px.
- **El documento ES la pantalla** — el reclamo generado no es un "resumen de éxito",
  es un PAPEL con nº de expediente, datos extraídos, fundamento y sello. Se comparte
  como tal.
- **Trámite visible** — la espera de la IA se muestra como bitácora de mesa de entrada
  (leyendo factura → detectando problema → redactando), nunca un spinner.
- **Transiciones yui540** — página out→in, sellos con squash-and-stretch, listas con
  stagger. Solo transform + opacity.

## Anti-structural (lo que NO hacer)

- **Formulario largo como pantalla principal** — la app pide UNA foto. El análisis lo
  hace la IA.
- **Dashboard tipo admin genérico** — sidebar + tabla de datos. La bandeja de la
  entidad es una cola priorizada con sellos, no un spreadsheet.
- **Onboarding de 5 slides** — la propuesta se entiende en la pantalla inicial.

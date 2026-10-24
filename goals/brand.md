# Reclamá Ya — Brand Essence

> **Authoria:** Arcade Estudio
> **Producto:** Defensor financiero vecinal para Rosario. El vecino cuenta su problema
> con un banco, tarjeta o billetera virtual (chat, texto o audio) y sube una foto/PDF
> del resumen. La app identifica el conflicto, le explica sus derechos con la norma
> oficial, le arma el reclamo y lo acompaña con plazos hasta que se resuelve.
> Del otro lado, la Oficina Municipal del Consumidor recibe los casos clasificados y
> priorizados, con triage verde/amarillo/rojo y detección de patrones para intimar
> empresas en bloque.
> **Nombre del proyecto en código:** shippear (repo). **Marca:** Reclamá Ya.

## Core values

- **Directo** (opuesto: burocrático)
- **Legible** (opuesto: opaco)
- **Acompaña** (opuesto: abandona) — el vecino no queda solo a mitad del trámite
- **Con la ley en la mano** (opuesto: opinión) — derechos reales, normas oficiales, nunca inventadas

## Personality

- **Si fuera persona:** el despachante de confianza — el empleado de la oficina del
  consumidor que atiende en 30 segundos, te dice qué derecho tenés, te arma el papel
  y te avisa cuándo reclamar de nuevo. Sin vueltas, sin jerga legal.
- **Tono:** corto, imperativo amable, lenguaje simple (pensado para quien usa
  WhatsApp todos los días, incluidos adultos mayores). Cero jerga legal en la voz;
  la jerga vive solo en el documento formal.
- **Sensación:** el ruido seco de un sello al estampar + la tranquilidad de saber
  que alguien sigue tu caso.

## Voice

- **Qué SÍ dice:**
  - "Contame qué te pasó. Escribí o hablá."
  - "La IA leyó tu resumen. Confirmá estos datos."
  - "Tenés derecho a reclamar este cargo. Ley 24.240, art. 35."
  - "Día 8 de 10 hábiles. Si el banco no responde, armamos el reclamo al BCRA."
- **Qué NO dice:**
  - "Estimado usuario, mediante la presente le notificamos…"
  - "Su solicitud será procesada a la brevedad por el área competente."
  - "Cargando… espere por favor." (nunca hacer esperar sin decir QUÉ pasa)
- **Ejemplo de tweet:** "Te cobraron algo que no pediste. Contanos. La ley está de tu lado."
- **Ejemplo de mensaje de error:** "No pudimos leer el resumen. Sacá la foto de
  frente, sin reflejos, y volvé a intentar."

## Soul questions (respuestas del cliente)

| Pregunta | Respuesta |
|---|---|
| ¿Qué emoción debe sentir el usuario? | **Eficiencia sin fricción** — "por fin algo que funciona como debe" |
| ¿Si fuera una persona, cómo hablaría? | **El despachante de confianza** |
| ¿Si fuera música? | *Delegada por el cliente.* Decisión de estudio: **jazz duro de estación de tren** |
| ¿Si fuera arquitectura? | *Delegada por el cliente ("sorpresa").* Decisión de estudio: **mesa de entrada brutalista** |

## Visual DNA

- **Sello > logo** — la identidad es el sello de goma (RECIBIDO, EN TRÁMITE, VENCIDO, YA)
- **Remito > tarjeta** — los contenedores son guías de remito, no cards SaaS
- **Tinta > píxel** — un acento (bermellón de sello), papel cálido, tinta negra
- **Chat familiar > formulario** — la interfaz del vecino es un chat tipo WhatsApp,
  no un formulario (por eso se siente conocido para adultos mayores)
- **Triage de señalética > semáforo corporativo** — verde autoservicio, amarillo
  revisión, rojo presencial: la bandeja de la oficina habla en colores de trámite
- **Mono > sans genérica** — JetBrains Mono como display: ADN de despacho/remito

## Decisiones anti-obvias (análisis competitivo)

| Competencia / categoría | Qué hacen | Qué hacemos NOSOTROS |
|---|---|---|
| Portales de reclamos institucionales | Azul institucional, Inter/Helvetica, formularios de 40 campos | Bermellón + papel + tinta. Un chat. Cero formulario. |
| Apps de banca/entidades | Blanco frío, azul corporativo, cards con sombra, íconos de stock | Papel cálido, bordes duros (radio 0), sellos como iconografía |
| Bots de reclamos SaaS | Chat genérico, promesas vagas, "la IA te asesora" | La IA NO inventa normas: solo clasifica y extrae. Los derechos salen de una biblioteca legal fija con links oficiales. |

**Regla aplicada:** si el primer color que viene a la mente para "reclamos/estado" es
el azul institucional, está mal. El acento es el bermellón de los sellos de goma
(`#E8492C`), el fondo es papel de carta cálido, la tinta es negra-marrón de tampón.

## Reglas de producto (del brief, innegociables)

1. **La IA no inventa leyes.** Solo clasifica el caso y extrae datos. Derechos,
   normas y plantillas salen de la biblioteca legal fija y validada.
2. **El vecino confirma los datos extraídos** antes de enviar.
3. **Plazo BCRA:** 10 días hábiles desde el reclamo. Vencido sin respuesta →
   escalada automática al BCRA.
4. **Escalera de reclamo:** entidad → BCRA → Oficina Municipal del Consumidor.
   COPREC NO existe (disuelto por Decreto 55/25). Nunca aparece.
5. **Triage por reglas configurables, no por IA:** urgencia, vulnerabilidad (65+ /
   ingreso bajo), monto vs ingreso, Central de Deudores ≥ 3, patrón por entidad.
6. **Aviso fijo:** la app no reemplaza el asesoramiento legal.

// Casos de ejemplo (demo) coherentes entre Mis reclamos (Mirta), Bandeja, Patrones y Archivo.
// Entidades ficticias. Los dueños son usuarios "demo-…": el login exige DNI/CUIT numérico, así que nadie puede entrar con ellos.
// Se regeneran en cada arranque con fechas relativas a hoy, para que la demo siempre muestre plazos vigentes y vencidos.
import { pool } from "./db.js";

const VECINOS = {
  "demo-mirta": { nombre: "Mirta Gómez", edad: 72, distrito: "Centro", ingreso: "Jubilación mínima", ingresoMensual: 380000, ingresoBajo: true },
  "demo-jorge": { nombre: "Jorge Ríos", edad: 45, distrito: "Norte", ingreso: "$ 950.000", ingresoMensual: 950000 },
  "demo-lucia": { nombre: "Lucía Paz", edad: 29, distrito: "Oeste", ingreso: "$ 620.000", ingresoMensual: 620000 },
  "demo-ana": { nombre: "Ana Sosa", edad: 67, distrito: "Sur", ingreso: "Jubilación", ingresoMensual: 450000, ingresoBajo: true },
  "demo-raul": { nombre: "Raúl Benítez", edad: 52, distrito: "Noroeste", ingreso: "$ 700.000", ingresoMensual: 700000, centralDeudores: 3 },
  "demo-sofia": { nombre: "Sofía Medina", edad: 34, distrito: "Sudoeste", ingreso: "$ 820.000", ingresoMensual: 820000 },
};

const S = "servicio-no-solicitado";
// [vecino, entidad, categoria, tipo, monto, díasDesdePresentado, estado, resumen, operacion]
const CASOS = [
  ["demo-mirta", "Delta Banco", "BANCOS", S, 25500, 18, "en_tramite", "Le cobran un seguro de vida que nunca pidió: $ 8.500 por mes durante 3 meses.", "SEG-448120"],
  ["demo-mirta", "Tarjeta Clave", "TARJETAS", "cargo-no-reconocido", 42300, 5, "recibido", "Compra online de $ 42.300 que no hizo, en el resumen de septiembre.", "TC-99031"],
  ["demo-mirta", "Billetera Luma", "BILLETERAS", "debito-no-baja", 3200, 40, "resuelto", "Débito mensual que no le daban de baja. La billetera devolvió lo cobrado.", ""],
  ["demo-jorge", "Delta Banco", "BANCOS", S, 12000, 9, "en_tramite", "Seguro de desempleo agregado a la cuenta sueldo sin autorización.", ""],
  ["demo-lucia", "Delta Banco", "BANCOS", S, 6900, 7, "en_tramite", "Asistencia al viajero cobrada sin haberla contratado.", ""],
  ["demo-ana", "Delta Banco", "BANCOS", S, 15400, 12, "en_tramite", "Seguro de protección de compras cobrado dos meses sin pedirlo.", ""],
  ["demo-sofia", "Delta Banco", "BANCOS", S, 8500, 3, "en_tramite", "Seguro de vida debitado sin consentimiento desde agosto.", ""],
  ["demo-raul", "Financiera Progreso", "BANCOS", "cobranza-abusiva", 186000, 4, "en_tramite", "Llamados diarios y amenaza de embargo por una deuda ya refinanciada.", ""],
  ["demo-jorge", "Banco Austral", "BANCOS", "tasa-abusiva", 98000, 15, "escalado", "Préstamo personal con costo financiero mayor al informado al firmar.", "PR-20931"],
  ["demo-lucia", "Billetera Volt", "BILLETERAS", "debito-no-baja", 4800, 2, "en_tramite", "No encuentra el botón de baja de la suscripción premium.", ""],
  ["demo-sofia", "Tarjeta Clave", "TARJETAS", "cargo-no-reconocido", 27600, 30, "resuelto", "Cargo duplicado en un supermercado. Reintegrado en el resumen siguiente.", ""],
  ["demo-ana", "Banco Austral", "BANCOS", "deuda-mal-informada", 0, 6, "respondido", "Figura en la Central de Deudores por una tarjeta que dio de baja en 2024.", ""],
];

// Fecha hábil N días hacia atrás (lun-vie), a media mañana.
function haceHabiles(n) {
  const d = new Date();
  d.setHours(10, 30, 0, 0);
  let k = 0;
  while (k < n) {
    d.setDate(d.getDate() - 1);
    if (d.getDay() % 6 !== 0) k++;
  }
  return d;
}

export async function seedDemo() {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(424242)");
    await c.query("DELETE FROM reclamos WHERE demo");
    const ids = {};
    for (const doc of Object.keys(VECINOS)) {
      ids[doc] = (
        await c.query(
          `INSERT INTO users (doc_number, role, email) VALUES ($1, 'vecino', $2)
           ON CONFLICT (doc_number, role) DO UPDATE SET email = EXCLUDED.email RETURNING id`,
          [doc, `${doc}@demo.invalid`],
        )
      ).rows[0].id;
    }
    for (const [doc, entidad, categoria, tipo, monto, dias, estado, resumen, operacion] of CASOS) {
      const pres = haceHabiles(dias);
      const ciudadano = VECINOS[doc];
      const datos = { entidad, categoria, tipo, monto: String(monto), resumen, operacion, fecha: pres.toISOString().slice(0, 10), ciudadano };
      const memoria = `- ${ciudadano.nombre}, ${ciudadano.edad} años. ${resumen}`;
      const r = (
        await c.query(
          `INSERT INTO reclamos (user_id, estado, activa, datos, memoria, listo, fundamento, presentado_at, created_at, updated_at, demo)
           VALUES ($1, $2, false, $3, $4, true, $5, $6, $6, $6, true) RETURNING id`,
          [ids[doc], estado, datos, memoria, "Ley 24.240, arts. 4 y 8 bis. [Artículo específico del tipo de conflicto: a validar por legales]", pres],
        )
      ).rows[0];
      await c.query(
        `INSERT INTO reclamo_mensajes (reclamo_id, role, text, created_at) VALUES ($1, 'user', $2, $3)`,
        [r.id, resumen, pres],
      );
    }
    await c.query("COMMIT");
    console.log(`[demo] ${CASOS.length} casos de ejemplo cargados`);
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    console.error("[demo] no se pudieron cargar los casos de ejemplo:", e.message);
  } finally {
    c.release();
  }
}

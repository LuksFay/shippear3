import Stamp from "./Stamp.jsx";
import Barcode from "./Barcode.jsx";

const tonePorEstado = {
  "EN TRÁMITE": "",
  PENDIENTE: "",
  DERIVADO: "warn",
  RESPONDIDO: "plain",
  RESUELTO: "ok",
};

function fechaLarga(iso) {
  const f = new Date(`${iso}T12:00:00`);
  return f.toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
}

export default function Doc({ reclamo, contenido }) {
  const tono = tonePorEstado[reclamo.estado] ?? "plain";
  const monto = (reclamo.monto || 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  });
  const fundamento = contenido?.reclamoListo?.fundamento || "";
  return (
    <div className="doc" data-fuse="brake" data-fuse-auto>
      <div className="doc__head">
        <div>
          <div className="doc__titulo">RECLAMO FORMAL</div>
          <div className="doc__nro">Nº DE EXPEDIENTE: {reclamo.id}</div>
        </div>
        <Stamp tone={tono} size="lg" rotate="r">
          {reclamo.estado}
        </Stamp>
      </div>

      <dl className="doc__dato">
        <dt>ENTIDAD</dt>
        <dd>{reclamo.entidad}</dd>
      </dl>
      <dl className="doc__dato">
        <dt>FECHA</dt>
        <dd>{fechaLarga(reclamo.fecha)}</dd>
      </dl>
      <dl className="doc__dato">
        <dt>CATEGORÍA</dt>
        <dd>{reclamo.categoria}</dd>
      </dl>
      <dl className="doc__dato">
        <dt>MONTO RECLAMADO</dt>
        <dd>{monto}</dd>
      </dl>

      <div className="doc__seccion">PROBLEMA DETECTADO</div>
      <p className="doc__texto">{reclamo.resumen}.</p>

      <div className="doc__seccion">FUNDAMENTO</div>
      <p className="doc__texto">{reclamo.fundamento || fundamento}</p>

      <div className="doc__sello">
        <Stamp size="xl" data-fuse="popup" data-fuse-auto>
          RECIBIDO
        </Stamp>
      </div>

      <div className="doc__foot">
        <Barcode />
        <span className="fecha-stamp">
          MESA DE ENTRADA — {fechaLarga(reclamo.fecha)}
        </span>
      </div>
    </div>
  );
}

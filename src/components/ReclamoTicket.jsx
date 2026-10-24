import Stamp from "./Stamp.jsx";
import Barcode from "./Barcode.jsx";

const tonePorEstado = {
  "EN TRÁMITE": "plain",
  RECIBIDO: "plain",
  VENCIDO: "",
  "ESCALADO AL BCRA": "warn",
  RESPONDIDO: "plain",
  RESUELTO: "ok",
};

export default function ReclamoTicket({ reclamo, onOpen, tag }) {
  const tono = tonePorEstado[reclamo.estado] ?? "plain";
  const monto = (reclamo.monto || 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });
  const plazo = reclamo.diasPlazo != null ? `DÍA ${reclamo.diasPlazo}/10` : null;
  return (
    <article
      className={`ticket ${reclamo.triage === "rojo" ? "ticket--urgente" : ""} ${
        reclamo.estado === "RESUELTO" ? "ticket--resuelto" : ""
      }`}
      data-fuse="fade-up"
      data-fuse-auto
    >
      <div className="ticket__talon">
        <span>SALDO A FAVOR {tag || reclamo.id}</span>
      </div>
      <div className="ticket__body">
        <div className="ticket__head">
          <span className="ticket__id">{reclamo.id}</span>
          <Stamp tone={tono} rotate={reclamo.id.length % 2 ? "l" : "r"}>
            {reclamo.estado}
          </Stamp>
        </div>
        <hr className="ticket__perf" />
        <dl className="ticket__row">
          <dt>ENTIDAD</dt>
          <dd>{reclamo.entidad}</dd>
        </dl>
        <dl className="ticket__row">
          <dt>CATEGORÍA</dt>
          <dd>{reclamo.categoria}</dd>
        </dl>
        <dl className="ticket__row">
          <dt>MONTO</dt>
          <dd className="ticket__monto">{monto}</dd>
        </dl>
        <p className="ticket__resumen">{reclamo.resumen}</p>
        <div className="ticket__foot">
          <Barcode />
          {onOpen && (
            <button type="button" className="btn btn--ghost" onClick={() => onOpen(reclamo)}>
              {reclamo.borrador ? "CONTINUAR" : plazo || "VER DETALLE"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

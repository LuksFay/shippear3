import { useState } from "react";
import ReclamoTicket from "../components/ReclamoTicket.jsx";
import Doc from "../components/Doc.jsx";
import Icon from "../components/Icon.jsx";

const filtros = ["TODOS", "EN TRÁMITE", "DERIVADOS", "RESUELTOS"];

export default function MisReclamos({ reclamos, contenido, onNuevo, onVolver }) {
  const [filtro, setFiltro] = useState("TODOS");
  const [seleccionado, setSeleccionado] = useState(null);

  const filtrados = reclamos.filter((r) => {
    if (filtro === "TODOS") return true;
    if (filtro === "EN TRÁMITE") return r.estado === "EN TRÁMITE";
    if (filtro === "DERIVADOS") return r.estado === "DERIVADO";
    return r.estado === "RESUELTO";
  });

  return (
    <div className="view view--app">
      <span className="view__kicker">VISTA CIUDADANO</span>
      <h1>
        MIS <em>RECLAMOS</em>
      </h1>
      <p className="view__sub">
        Cada reclamo tiene número de expediente, sello de estado y seguimiento en vivo.
      </p>

      <div className="chip-row">
        {filtros.map((f) => (
          <button
            key={f}
            type="button"
            className={`chip ${filtro === f ? "is-active" : ""}`}
            onClick={() => setFiltro(f)}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="list-stack" data-fuse-container>
        {filtrados.map((r) => (
          <ReclamoTicket key={r.id} reclamo={r} onOpen={() => setSeleccionado(r)} />
        ))}
      </div>

      {seleccionado && (
        <div className="section" data-fuse="fade-up" data-fuse-auto>
          <div className="section__head">
            <h2>EXPEDIENTE</h2>
            <span className="section__num">{seleccionado.id}</span>
          </div>
          <Doc reclamo={seleccionado} contenido={contenido} />
        </div>
      )}

      <div className="form-group" style={{ marginTop: "1.5rem" }}>
        <button type="button" className="btn btn--ghost btn--block" onClick={onNuevo}>
          NUEVO RECLAMO <Icon name="plus" size={14} />
        </button>
        <button
          type="button"
          className="btn btn--block"
          style={{ marginTop: "0.5rem" }}
          onClick={onVolver}
        >
          VOLVER AL INICIO
        </button>
      </div>
    </div>
  );
}

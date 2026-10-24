import { useState } from "react";
import ReclamoTicket from "../components/ReclamoTicket.jsx";
import Icon from "../components/Icon.jsx";

const filtros = ["TODOS", "EN TRÁMITE", "VENCIDOS", "ESCALADOS", "RESUELTOS"];

export default function MisReclamos({ reclamos, onNuevo, onOpen, onVolver }) {
  const [filtro, setFiltro] = useState("TODOS");

  const filtrados = reclamos.filter((r) => {
    if (filtro === "TODOS") return true;
    if (filtro === "EN TRÁMITE") return r.estado === "EN TRÁMITE";
    if (filtro === "VENCIDOS") return r.estado === "VENCIDO";
    if (filtro === "ESCALADOS") return r.estado === "ESCALADO AL BCRA";
    return r.estado === "RESUELTO";
  });

  return (
    <div className="view view--app">
      <span className="view__kicker">VISTA CIUDADANO</span>
      <h1>
        MIS <em>RECLAMOS</em>
      </h1>
      <p className="view__sub">
        Cada reclamo tiene expediente, sello de estado y el plazo de 10 días hábiles
        del BCRA. Los vencidos se escalan al BCRA.
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
          <ReclamoTicket key={r.id} reclamo={r} onOpen={onOpen} />
        ))}
      </div>

      <div className="form-group" style={{ marginTop: "1.5rem" }}>
        <button type="button" className="btn btn--ghost btn--block" onClick={onNuevo}>
          NUEVO RECLAMO <Icon name="plus" size={14} />
        </button>
        {onVolver && (
          <button
            type="button"
            className="btn btn--block"
            style={{ marginTop: "0.5rem" }}
            onClick={onVolver}
          >
            VOLVER
          </button>
        )}
      </div>
    </div>
  );
}

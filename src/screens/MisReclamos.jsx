import { useState } from "react";
import { api } from "../lib/api.js";
import ReclamoTicket from "../components/ReclamoTicket.jsx";
import Icon from "../components/Icon.jsx";

const filtros = ["TODOS", "EN TRÁMITE", "VENCIDOS", "ESCALADOS", "RESUELTOS"];

export default function MisReclamos({ reclamos, onNuevo, onOpen, onVolver }) {
  const [filtro, setFiltro] = useState("TODOS");
  const [ejemplo, setEjemplo] = useState(null); // casos demo de Mirta, sólo lectura
  const verEjemplo = () => api.ejemplo().then(setEjemplo).catch(() => setEjemplo({ reclamos: [] }));

  const filtrados = reclamos.filter((r) => {
    if (filtro === "TODOS") return true;
    if (filtro === "EN TRÁMITE") return r.estado === "EN TRÁMITE" || r.estado === "RECIBIDO" || r.borrador;
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
        {filtrados.length === 0 ? (
          <div className="derecho" data-fuse="fade-up" data-fuse-auto>
            <div className="derecho__label">BANDEJA VACÍA</div>
            <p className="derecho__texto">
              Todavía no hiciste reclamos. Contanos qué te pasó con el banco, la
              tarjeta o la billetera y armamos el primero.
            </p>
            <button
              type="button"
              className="btn btn--primary"
              style={{ marginTop: "0.75rem" }}
              onClick={onNuevo}
            >
              NUEVO RECLAMO <Icon name="plus" size={14} />
            </button>
            {reclamos.length === 0 && !ejemplo && (
              <button type="button" className="link-btn" style={{ display: "block", marginTop: "0.75rem" }} onClick={verEjemplo}>
                Ver un ejemplo: los reclamos de Mirta, 72 años
              </button>
            )}
          </div>
        ) : (
          filtrados.map((r) => (
            <ReclamoTicket key={r.id} reclamo={r} onOpen={onOpen} />
          ))
        )}
      </div>

      {ejemplo && ejemplo.reclamos.length > 0 && (
        <div className="section">
          <div className="aviso-demo" role="note">
            <strong>Ejemplo.</strong> Así se ven los reclamos de {ejemplo.vecina}. Son casos de demostración, no tuyos.
          </div>
          <div className="list-stack">
            {ejemplo.reclamos.map((r) => (
              <ReclamoTicket key={r.id} reclamo={r} tag={`${r.id} · EJEMPLO`} onOpen={onOpen} />
            ))}
          </div>
        </div>
      )}

      <div className="form-group" style={{ marginTop: "1.5rem" }}>
        {reclamos.length > 0 && (
          <button type="button" className="btn btn--ghost btn--block" onClick={onNuevo}>
            NUEVO RECLAMO <Icon name="plus" size={14} />
          </button>
        )}
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

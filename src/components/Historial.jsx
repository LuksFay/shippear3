import { useEffect, useState } from "react";
import { api, hora24 } from "../lib/api.js";

const fecha = (d) => `${new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })} ${hora24(d)}`;

// Historial de versiones de un reclamo (dueño u Oficina). Todo se renderiza como texto: nada de HTML del usuario.
export default function Historial({ dbId }) {
  const [abierto, setAbierto] = useState(false);
  const [vs, setVs] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!abierto || vs) return;
    api.historial(dbId).then((r) => setVs(r.versiones || [])).catch((e) => setError(e.message || "No pude cargar el historial."));
  }, [abierto, vs, dbId]);
  return (
    <div className="historial">
      <button type="button" className="link-btn" onClick={() => setAbierto(!abierto)} aria-expanded={abierto}>
        {abierto ? "Ocultar historial" : "Ver historial"}
      </button>
      {abierto && (
        <div className="historial__lista">
          {error && <p className="login__error">{error}</p>}
          {!error && !vs && <p className="historial__vacio">Cargando…</p>}
          {vs && !vs.length && <p className="historial__vacio">Sin cambios desde que se presentó.</p>}
          {vs?.map((v) => (
            <div key={v.version} className="historial__item">
              <div className="historial__meta">
                {v.accion === "baja" ? "DADO DE BAJA" : `EDICIÓN ${v.version}`} · {v.por} · {fecha(v.at)}
              </div>
              {v.cambios.map((c, i) => (
                <div key={i} className="historial__cambio">
                  <strong>{c.campo}:</strong> <del>{c.antes || "(vacío)"}</del> → <span>{c.despues || "(vacío)"}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

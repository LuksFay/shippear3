import Doc from "../components/Doc.jsx";
import Icon from "../components/Icon.jsx";
import GestionReclamo from "../components/GestionReclamo.jsx";

export default function Seguimiento({ reclamo, contenido, onVolver, onNuevo, onCambio, onBaja, soloLectura }) {
  const vencido = reclamo.vencido || reclamo.estado === "VENCIDO" || reclamo.estado === "ESCALADO AL BCRA";
  const escalado = reclamo.estado === "ESCALADO AL BCRA";
  const total = contenido.plazo.total;
  const dias = Math.min(reclamo.diasPlazo || 0, total);
  const pasoActivo = escalado || vencido ? 2 : 1;

  return (
    <div className="view view--app">
      <span className="view__kicker">TRÁMITE Nº {reclamo.id}</span>
      <h1>
        SEGUIMIENTO <em>EN VIVO</em>
      </h1>
      <p className="view__sub">{contenido.plazo.nota}</p>

      <div className={`plazo ${vencido ? "plazo--vencido" : ""}`} data-fuse="fade-up" data-fuse-auto>
        <div className="plazo__head">
          <span className="plazo__label">
            DÍA <em>{vencido ? `${reclamo.diasPlazo}` : dias}</em> DE {total} HÁBILES
          </span>
          <span className="plazo__meta">{vencido ? "PLAZO VENCIDO" : "EN CURSO"}</span>
        </div>
        <div className="plazo__grid">
          {Array.from({ length: total }, (_, i) => {
            const dia = i + 1;
            const cls = vencido
              ? "plazo__dia--done"
              : dia < dias
                ? "plazo__dia--done"
                : dia === dias
                  ? "plazo__dia--today"
                  : "";
            return (
              <span key={dia} className={`plazo__dia ${cls}`}>
                {dia}
              </span>
            );
          })}
        </div>
      </div>

      {vencido && (
        <div className="derecho" data-fuse="popup" data-fuse-auto>
          <div className="derecho__label">LA ENTIDAD NO RESPONDIÓ</div>
          <p className="derecho__texto">
            Pasaron {reclamo.diasPlazo} días hábiles sin respuesta.
            {escalado
              ? " Ya armamos el reclamo ante el BCRA. Seguí el estado acá."
              : " Podemos armar el reclamo ante el BCRA ahora mismo."}
          </p>
          <div className="form-group" style={{ marginTop: "0.75rem" }}>
            <button type="button" className="btn btn--primary btn--block" disabled={escalado}>
              {escalado ? "RECLAMO ENVIADO AL BCRA" : "ARMAR RECLAMO AL BCRA"}{" "}
              <Icon name="send" size={14} />
            </button>
          </div>
        </div>
      )}

      <div className="doc__seccion">ESCALERA DE RECLAMO</div>
      <div className="escalera">
        {contenido.escalera.map((e) => {
          const cls = e.paso < pasoActivo ? "escalera__paso--done" : e.paso === pasoActivo ? "escalera__paso--active" : "";
          return (
            <div key={e.paso} className={`escalera__paso ${cls}`} data-fuse="fade-up" data-fuse-auto>
              <span className="escalera__num">{String(e.paso).padStart(2, "0")}</span>
              <div>
                <div className="escalera__titulo">{e.titulo}</div>
                <div className="escalera__detalle">{e.detalle}</div>
              </div>
            </div>
          );
        })}
      </div>

      {!soloLectura && <GestionReclamo reclamo={reclamo} onCambio={onCambio} onBaja={onBaja} />}

      <div className="doc__seccion">DOCUMENTO</div>
      <Doc reclamo={reclamo} contenido={contenido} />

      <div className="form-group" style={{ marginTop: "1.5rem" }}>
        <button type="button" className="btn btn--ghost btn--block" onClick={onVolver}>
          VER TODOS MIS RECLAMOS
        </button>
        <button type="button" className="btn btn--block" style={{ marginTop: "0.5rem" }} onClick={onNuevo}>
          NUEVO RECLAMO <Icon name="plus" size={14} />
        </button>
      </div>
    </div>
  );
}

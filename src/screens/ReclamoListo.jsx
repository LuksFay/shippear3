import Doc from "../components/Doc.jsx";
import Icon from "../components/Icon.jsx";

export default function ReclamoListo({ reclamo, contenido, onVerEstado, onNuevo }) {
  return (
    <div className="view view--app">
      <span className="view__kicker">TRÁMITE SELLADO</span>
      <h1>
        TU RECLAMO ESTÁ <em>LISTO</em>
      </h1>
      <p className="view__sub">{contenido.reclamoListo.nota}</p>

      <Doc reclamo={reclamo} contenido={contenido} />

      <div className="form-group" style={{ marginTop: "1.5rem" }}>
        <button type="button" className="btn btn--primary btn--block btn--lg" data-fuse="fade-up" data-fuse-auto>
          DESCARGAR PDF <Icon name="download" size={16} />
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--block"
          style={{ marginTop: "0.5rem" }}
          data-fuse="fade-up"
          data-fuse-auto
          onClick={onVerEstado}
        >
          VER ESTADO <Icon name="arrowRight" size={14} />
        </button>
        <button
          type="button"
          className="btn btn--block"
          style={{ marginTop: "0.5rem" }}
          data-fuse="fade-up"
          data-fuse-auto
          onClick={onNuevo}
        >
          NUEVO RECLAMO <Icon name="plus" size={14} />
        </button>
      </div>
    </div>
  );
}

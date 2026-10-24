import { useState } from "react";
import Icon from "../components/Icon.jsx";
import Stamp from "../components/Stamp.jsx";

export default function NuevoReclamo({ entidades, nroExpediente, onAnalizar }) {
  const [foto, setFoto] = useState(false);
  const [entidadId, setEntidadId] = useState("");
  const [nota, setNota] = useState("");

  const listo = Boolean(foto && entidadId);

  return (
    <div className="view view--app">
      <span className="view__kicker">TRÁMITE Nº {nroExpediente}</span>
      <h1>
        NUEVO <em>RECLAMO</em>
      </h1>
      <p className="view__sub">
        Una foto alcanza. La IA lee la factura, detecta el problema y redacta el reclamo.
      </p>

      <div className="form-group">
        <label className="field-label" htmlFor="foto">1 — LA FACTURA O RECIBO</label>
        <div className={`photo-zone ${foto ? "is-set" : ""}`} data-fuse="fade-up" data-fuse-auto>
          {!foto ? (
            <>
              <span className="photo-zone__icon">
                <Icon name="camera" size={22} />
              </span>
              <span className="photo-zone__titulo">SACAR FOTO</span>
              <span className="photo-zone__hint">
                De frente, sin reflejos. JPG o PNG.
              </span>
            </>
          ) : (
            <div className="docmock" data-fuse="popup" data-fuse-auto>
              <div className="docmock__line">
                <span>FACTURA</span>
                <span>0042-8821</span>
              </div>
              <div className="docmock__line">
                <i /><i /><i />
              </div>
              <div className="docmock__line">
                <span>PERÍODO</span>
                <span>09/2026</span>
              </div>
              <div className="docmock__monto">$48.200,00</div>
              <div className="ticket__head">
                <span />
                <Stamp tone="" rotate="r" data-fuse="popup" data-fuse-auto>CARGADA</Stamp>
              </div>
            </div>
          )}
          <input
            id="foto"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              if (e.target.files?.length) setFoto(true);
            }}
          />
        </div>
        {foto && (
          <button
            type="button"
            className="list-stack__foot"
            onClick={() => setFoto(false)}
            style={{ marginTop: "0.5rem" }}
          >
            SACAR OTRA
          </button>
        )}
      </div>

      <div className="form-group">
        <span className="field-label">2 — ENTIDAD RESPONSABLE</span>
        <div className="entidades">
          {entidades.map((e) => (
            <button
              key={e.id}
              type="button"
              className={`chip ${entidadId === e.id ? "is-active" : ""}`}
              onClick={() => setEntidadId(e.id)}
            >
              {e.nombre}
            </button>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label className="field-label" htmlFor="nota">3 — ¿QUÉ PASÓ? (OPCIONAL)</label>
        <textarea
          id="nota"
          className="textarea"
          placeholder="Ej: me cobraron dos veces el mismo cargo…"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
        />
      </div>

      <button
        type="button"
        className="btn btn--primary btn--block btn--lg"
        disabled={!listo}
        style={{ opacity: listo ? 1 : 0.4, pointerEvents: listo ? "auto" : "none" }}
        onClick={() => onAnalizar({ entidadId, nota })}
        data-fuse="fade-up"
        data-fuse-auto
      >
        ANALIZAR CON IA <Icon name="arrowRight" size={16} />
      </button>
    </div>
  );
}

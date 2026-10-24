import { useState } from "react";
import Stamp from "../components/Stamp.jsx";
import Icon from "../components/Icon.jsx";
import tiposConflicto from "../mock/tiposConflicto.json";

export default function Patrones({ patrones, contenido, onVolver }) {
  const [seleccionado, setSeleccionado] = useState(null);

  const nombreTipo = (id) => tiposConflicto.find((t) => t.id === id)?.nombre || id;

  const nota = (p) =>
    contenido.intimacion.cuerpo
      .replaceAll("{n}", p.casos)
      .replaceAll("{tipo}", nombreTipo(p.tipo))
      .replaceAll("{entidad}", p.entidad)
      .replaceAll("{periodo}", p.periodo);

  return (
    <div className="view view--wide">
      <span className="view__kicker">ALERTA TEMPRANA — PATRONES POR ENTIDAD</span>
      <h1>
        INTIMACIONES <em>EN BLOQUE</em>
      </h1>
      <p className="view__sub">
        La bandeja detecta picos de reclamos por entidad y tipo de conflicto. Cuando
        hay patrón, la oficina intima a la empresa en bloque con una nota fundada en
        la biblioteca legal.
      </p>

      {patrones.length === 0 && (
        <p className="view__sub">Por ahora no hay patrones: aparecen cuando hay 3 o más reclamos iguales contra la misma entidad en 30 días.</p>
      )}
      <div className="patrones-grid" data-fuse-container>
        {patrones.map((p) => (
          <div className="patron" key={`${p.demo}|${p.entidad}|${p.tipo}`} data-fuse="fade-up" data-fuse-auto>
            <div className="patron__head">
              <span className="patron__entidad">{p.entidad}{p.demo && <span className="ticket__tag-demo">DEMO</span>}</span>
              <Stamp tone={p.gravedad === "ALTA" ? "" : "warn"} rotate="r">
                {p.gravedad}
              </Stamp>
            </div>
            <div className="patron__nums">
              <div className="patron__num">
                <b>{p.casos}</b>
                <span>RECLAMOS · {p.periodo}</span>
              </div>
              <div className="patron__num">
                <b className="is-delta">{p.delta}</b>
                <span>VS PERÍODO ANTERIOR</span>
              </div>
            </div>
            <div className="patron__bars">
              {Array.from({ length: 7 }, (_, i) => (
                <i
                  key={i}
                  className={i === 6 ? "is-peak" : ""}
                  style={{ height: `${12 + i * 5}%` }}
                />
              ))}
            </div>
            <div className="patron__meta">TIPO: {nombreTipo(p.tipo).toUpperCase()}</div>
            <button
              type="button"
              className="btn btn--primary btn--block"
              onClick={() => setSeleccionado(p)}
            >
              GENERAR INTIMACIÓN COLECTIVA <Icon name="doc" size={14} />
            </button>
          </div>
        ))}
      </div>

      {seleccionado && (
        <div className="section" data-fuse="fade-up" data-fuse-auto>
          <div className="section__head">
            <h2>NOTA DE INTIMACIÓN</h2>
            <span className="section__num">MODELO — BIBLIOTECA LEGAL</span>
          </div>
          <div className="doc" data-fuse="brake" data-fuse-auto>
            <div className="doc__head">
              <div>
                <div className="doc__titulo">{contenido.intimacion.titulo}</div>
                <div className="doc__nro">
                  CONTRA: {seleccionado.entidad.toUpperCase()} — {seleccionado.casos} CASOS
                </div>
              </div>
              <Stamp size="lg" rotate="r" data-fuse="popup" data-fuse-auto>
                INTIMACIÓN
              </Stamp>
            </div>
            <p className="doc__texto">{nota(seleccionado)}</p>
            <div className="doc__seccion">FUNDAMENTO NORMATIVO</div>
            <p className="doc__texto">
              Ley 24.240 de Defensa del Consumidor, art. 52; texto ordenado del BCRA
              sobre protección de usuarios de servicios financieros. Patrón detectado
              con reglas configurables, no generativo.
            </p>
            <div className="doc__foot">
              <div className="list-stack" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <button type="button" className="btn btn--primary">
                  ENVIAR A LA ENTIDAD <Icon name="send" size={14} />
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => setSeleccionado(null)}>
                  DESCARTAR <Icon name="x" size={14} />
                </button>
              </div>
              <span className="fecha-stamp">OFICINA DEL CONSUMIDOR — ROSARIO</span>
            </div>
          </div>
        </div>
      )}

      {!seleccionado && (
        <button type="button" className="btn btn--block" onClick={onVolver} style={{ marginTop: "1.5rem" }}>
          VOLVER A LA BANDEJA
        </button>
      )}
    </div>
  );
}

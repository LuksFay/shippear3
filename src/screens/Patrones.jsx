import { useEffect, useRef, useState } from "react";
import Stamp from "../components/Stamp.jsx";
import Icon from "../components/Icon.jsx";
import tiposConflicto from "../mock/tiposConflicto.json";

export default function Patrones({ patrones, contenido, onVolver }) {
  const [seleccionado, setSeleccionado] = useState(null);
  const [revisando, setRevisando] = useState(false);
  const [revisado, setRevisado] = useState(false);
  const notaRef = useRef(null);
  const abrir = (p) => { setSeleccionado(p); setRevisando(false); setRevisado(false); };
  // La nota se abre a la vista: scroll automático hasta el borrador.
  useEffect(() => {
    if (seleccionado) notaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [seleccionado]);

  const nombreTipo = (id) => tiposConflicto.find((t) => t.id === id)?.nombre || id;

  const nota = (p) =>
    contenido.intimacion.cuerpo
      .replaceAll("{n}", p.casos)
      .replaceAll("{tipo}", nombreTipo(p.tipo))
      .replaceAll("{entidad}", p.entidad)
      .replaceAll("{periodo}", p.periodo);
  const articuloTipo = (p) => contenido.intimacion.articuloTipo.replaceAll("{tipo}", nombreTipo(p.tipo));

  const descargar = (p) => {
    const i = contenido.intimacion;
    const texto = [
      i.aviso.toUpperCase(),
      "",
      i.titulo,
      `Contra: ${p.entidad} — ${p.casos} casos (${p.periodo})`,
      "",
      nota(p),
      "",
      "FUNDAMENTO NORMATIVO",
      i.fundamento,
      articuloTipo(p),
      "",
      "Oficina del Consumidor — Rosario",
      `Generado el ${new Date().toLocaleString("es-AR", { hour12: false })} con Saldo a Favor (piloto). No es un documento firmado.`,
    ].join("\n");
    const url = URL.createObjectURL(new Blob([texto], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `borrador-intimacion-${p.entidad.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-")}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

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
              onClick={() => abrir(p)}
            >
              GENERAR INTIMACIÓN COLECTIVA <Icon name="doc" size={14} />
            </button>
          </div>
        ))}
      </div>

      {seleccionado && (
        <div className="section" ref={notaRef} style={{ scrollMarginTop: "4.5rem" }} data-fuse="fade-up" data-fuse-auto>
          <div className="section__head">
            <h2>BORRADOR DE NOTA</h2>
            <span className="section__num">A REVISAR</span>
          </div>
          <div className="doc" data-fuse="brake" data-fuse-auto>
            <div className="doc__head">
              <div>
                <div className="doc__aviso">{contenido.intimacion.aviso}</div>
                <div className="doc__titulo">{contenido.intimacion.titulo}</div>
                <div className="doc__nro">
                  CONTRA: {seleccionado.entidad.toUpperCase()} — {seleccionado.casos} CASOS
                </div>
              </div>
              <Stamp size="lg" rotate="r" data-fuse="popup" data-fuse-auto>
                BORRADOR
              </Stamp>
            </div>
            <p className="doc__texto">{nota(seleccionado)}</p>
            <div className="doc__seccion">FUNDAMENTO NORMATIVO</div>
            <p className="doc__texto">
              {contenido.intimacion.fundamento}
              <br />
              <span className="doc__placeholder">{articuloTipo(seleccionado)}</span>
            </p>
            {revisando && (
              <div className="revision" role="group" aria-label="Revisión antes de descargar">
                <label className="check">
                  <input type="checkbox" checked={revisado} onChange={(e) => setRevisado(e.target.checked)} />
                  <span>Entiendo que es un borrador: el texto y el fundamento los revisa y valida el área jurídica antes de firmarlo o enviarlo.</span>
                </label>
                <button type="button" className="btn btn--primary" disabled={!revisado} onClick={() => descargar(seleccionado)}>
                  DESCARGAR BORRADOR (.TXT) <Icon name="doc" size={14} />
                </button>
              </div>
            )}
            <div className="doc__foot">
              <div className="list-stack" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {!revisando && (
                  <button type="button" className="btn btn--primary" onClick={() => setRevisando(true)}>
                    DESCARGAR BORRADOR <Icon name="doc" size={14} />
                  </button>
                )}
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

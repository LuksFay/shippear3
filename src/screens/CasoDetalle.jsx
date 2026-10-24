import { useState } from "react";
import Stamp from "../components/Stamp.jsx";
import Barcode from "../components/Barcode.jsx";
import Icon from "../components/Icon.jsx";
import Historial from "../components/Historial.jsx";

function fechaCorta(iso) {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CasoDetalle({ caso, contenido, reglas, onVolver, onPatrones }) {
  const [resuelto, setResuelto] = useState(caso.estado === "RESUELTO");
  const monto = (caso.monto || 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });

  const reglasAplicadas = (caso.puntaje?.reglas || [])
    .map((id) => reglas.find((r) => r.id === id))
    .filter(Boolean);

  const timeline = [
    { label: "RECIBIDO", meta: fechaCorta(caso.fecha), state: "is-done" },
    {
      label: "ANALIZADO POR IA",
      meta: "documento leído — conflicto clasificado — datos confirmados por el vecino",
      state: "is-done",
    },
    {
      label: caso.vencido ? "PLAZO VENCIDO — SIN RESPUESTA" : resuelto ? "RESUELTO" : "EN TRÁMITE",
      meta: caso.vencido
        ? `pasaron ${caso.diasPlazo} días hábiles — escalar al BCRA`
        : `día ${caso.diasPlazo} de 10 hábiles`,
      state: caso.vencido ? "is-active" : "is-done",
    },
  ];

  return (
    <div className="view view--wide">
      <button type="button" className="list-stack__foot" onClick={onVolver}>
        <Icon name="arrowRight" size={13} style={{ transform: "rotate(180deg)" }} />
        VOLVER A LA BANDEJA
      </button>

      <span className="view__kicker" style={{ marginTop: "1rem" }}>
        CASO {caso.id} {caso.editado && <span className="badge-editado">EDITADO</span>}
      </span>
      {caso.editado && !caso.demo && <Historial key={caso.editadoAt} dbId={caso.dbId} />}
      <h1>
        DETALLE DE <em>CASO</em>
      </h1>

      <div className="caso-grid">
        <div>
          <div className="doc" data-fuse="brake" data-fuse-auto>
            <div className="doc__head">
              <div>
                <div className="doc__titulo">EXPEDIENTE {caso.reclamo}</div>
                <div className="doc__nro">CASO: {caso.id}</div>
              </div>
              <div style={{ display: "grid", gap: "6px", justifyItems: "end" }}>
                <span className={`triage triage--${caso.triage}`}>
                  <span className="triage__dot" />
                  {caso.triage === "verde" ? "AUTOSERVICIO" : caso.triage === "amarillo" ? "REVISIÓN" : "PRESENCIAL"}
                </span>
                <Stamp tone={resuelto ? "ok" : ""} rotate="r">
                  {resuelto ? "RESUELTO" : caso.estado}
                </Stamp>
              </div>
            </div>

            <dl className="doc__dato">
              <dt>CIUDADANO</dt>
              <dd>
                {caso.ciudadano.iniciales} — {caso.ciudadano.distrito}{caso.ciudadano.edad != null ? ` · ${caso.ciudadano.edad} años` : ""}
              </dd>
            </dl>
            <dl className="doc__dato">
              <dt>INGRESO DECLARADO</dt>
              <dd>{caso.ciudadano.ingreso}</dd>
            </dl>
            <dl className="doc__dato">
              <dt>ENTIDAD</dt>
              <dd>{caso.entidad}</dd>
            </dl>
            <dl className="doc__dato">
              <dt>CATEGORÍA</dt>
              <dd>{caso.categoria}</dd>
            </dl>
            <dl className="doc__dato">
              <dt>MONTO</dt>
              <dd>{monto}</dd>
            </dl>

            <div className="doc__seccion">RESUMEN DEL RECLAMO</div>
            <p className="doc__texto">{caso.resumen}</p>

            <div className="doc__seccion">PUNTAJE DE PRIORIDAD (REGLAS, NO IA)</div>
            <div className="puntaje">
              <div className="puntaje__head">
                <span className="puntaje__num">
                  {caso.puntaje.total} <span>/ 50</span>
                </span>
                <span className="triage__dot" style={{ width: 10, height: 10, background: "var(--color-accent)" }} />
                <span className="plazo__meta">MÁS PUNTOS = MÁS URGENTE</span>
              </div>
              <div className="puntaje__bar">
                <div
                  className="puntaje__fill"
                  style={{ width: `${Math.min(100, (caso.puntaje.total / 50) * 100)}%` }}
                />
              </div>
              {reglasAplicadas.map((r) => (
                <div className="puntaje__regla" key={r.id}>
                  <span>{r.regla}</span>
                  <b>+{r.puntos}</b>
                </div>
              ))}
            </div>

            {caso.patron && (
              <div className="derecho" style={{ borderLeft: "3px solid var(--color-accent)" }}>
                <div className="derecho__label">PATRÓN ACTIVO CONTRA {caso.entidad.toUpperCase()}</div>
                <p className="derecho__texto">
                  Hay reclamos repetidos del mismo tipo contra esta entidad. Podés
                  generar una intimación colectiva desde PATRONES.
                </p>
                <button
                  type="button"
                  className="btn btn--ghost"
                  style={{ marginTop: "0.5rem" }}
                  onClick={onPatrones}
                >
                  VER PATRONES <Icon name="alert" size={14} />
                </button>
              </div>
            )}

            <div className="doc__seccion">TRAZABILIDAD</div>
            <div className="timeline">
              {timeline.map((t) => (
                <div key={t.label} className={`timeline__item ${t.state}`}>
                  <span className="timeline__dot" />
                  <div>
                    <div className="timeline__label">{t.label}</div>
                    <div className="timeline__meta">{t.meta}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="doc__foot">
              <Barcode />
              <span className="fecha-stamp">OFICINA DEL CONSUMIDOR — {fechaCorta(caso.fecha)}</span>
            </div>
          </div>
        </div>

        <aside className="form-group" data-fuse="fade-up" data-fuse-auto>
          <div className="section__head">
            <h2>ACCIONES</h2>
            <span className="section__num">MESA</span>
          </div>
          <div className="list-stack">
            <button type="button" className="btn btn--primary btn--block">
              DERIVAR A OFICINA <Icon name="send" size={14} />
            </button>
            <button type="button" className="btn btn--block">
              ENVIAR RESPUESTA <Icon name="doc" size={14} />
            </button>
            {caso.vencido && (
              <button type="button" className="btn btn--block" style={{ borderColor: "var(--color-accent)", color: "var(--color-accent)" }}>
                ESCALAR AL BCRA <Icon name="alert" size={14} />
              </button>
            )}
            <button
              type="button"
              className={`btn ${resuelto ? "btn--ghost" : ""} btn--block`}
              onClick={() => setResuelto(!resuelto)}
            >
              {resuelto ? "REABRIR CASO" : "MARCAR RESUELTO"} <Icon name="check" size={14} />
            </button>
          </div>
          <p className="view__sub" style={{ marginTop: "1rem", fontSize: "0.8rem" }}>
            {contenido.avisoLegal} La respuesta modelo se genera con la biblioteca
            legal validada, nunca con la IA.
          </p>
        </aside>
      </div>
    </div>
  );
}

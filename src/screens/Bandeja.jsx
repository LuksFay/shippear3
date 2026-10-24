import { useMemo, useState } from "react";
import Stamp from "../components/Stamp.jsx";
import Barcode from "../components/Barcode.jsx";
import Icon from "../components/Icon.jsx";

const NOW = Date.now();

const estadoTone = {
  "EN TRÁMITE": "plain",
  RECIBIDO: "plain",
  VENCIDO: "",
  RESPONDIDO: "plain",
  RESUELTO: "ok",
};

function hace(iso) {
  const diff = NOW - new Date(iso).getTime();
  const hs = Math.max(1, Math.round(diff / 3600000));
  if (hs < 24) return `HACE ${hs} H`;
  return `HACE ${Math.round(hs / 24)} D`;
}

export default function Bandeja({ casos, vinculada = true, filtros, filtro, onFiltro, onOpenCaso }) {
  const [filtroInterno, setFiltroInterno] = useState("TODOS");
  const filtroActivo = filtro || filtroInterno;

  const archivo = filtroActivo === "ARCHIVO";
  const abiertos = useMemo(() => casos.filter((c) => c.estado !== "RESUELTO"), [casos]);
  const stats = useMemo(() => {
    const casos = abiertos;
    const vencidos = casos.filter((c) => c.vencido).length;
    const verdes = casos.filter((c) => c.triage === "verde").length;
    const amarillos = casos.filter((c) => c.triage === "amarillo").length;
    const rojos = casos.filter((c) => c.triage === "rojo").length;
    return [
      { num: verdes, label: "VERDES · AUTOSERVICIO", cls: "verde" },
      { num: amarillos, label: "AMARILLOS · REVISIÓN", cls: "amarillo" },
      { num: rojos, label: "ROJOS · PRESENCIAL", cls: "rojo" },
      { num: vencidos, label: "VENCIDOS SIN RESPUESTA", cls: "vencido" },
    ];
  }, [abiertos]);

  const filtrados = useMemo(() => {
    let lista = archivo ? casos.filter((c) => c.estado === "RESUELTO") : [...abiertos];
    if (filtroActivo === "VERDES") lista = lista.filter((c) => c.triage === "verde");
    else if (filtroActivo === "AMARILLOS") lista = lista.filter((c) => c.triage === "amarillo");
    else if (filtroActivo === "ROJOS") lista = lista.filter((c) => c.triage === "rojo");
    else if (filtroActivo === "VENCIDOS") lista = lista.filter((c) => c.vencido);
    const peso = { rojo: 0, amarillo: 1, verde: 2 };
    return lista.sort(
      (a, b) =>
        (b.vencido - a.vencido) ||
        peso[a.triage] - peso[b.triage] ||
        new Date(b.fecha) - new Date(a.fecha),
    );
  }, [casos, abiertos, archivo, filtroActivo]);

  const aplicar = (f) => {
    setFiltroInterno(f);
    if (onFiltro) onFiltro(f);
  };

  return (
    <div className="view view--wide">
      <span className="view__kicker">Piloto para la Oficina del Consumidor de Rosario</span>
      <h1>
        {archivo ? <>ARCHIVO DE <em>CASOS</em></> : <>BANDEJA DE <em>ENTRADA</em></>}
      </h1>
      <p className="view__sub">
        Triage automático: verde para autoservicio, amarillo para revisión de un
        empleado, rojo para atención presencial. Prioridad por reglas configurables,
        no por IA.
      </p>
      {!vinculada && (
        <div className="aviso-demo" role="note">
          <strong>Modo demostración.</strong> Esta cuenta todavía no está habilitada como Oficina: ves sólo casos de
          ejemplo (marcados DEMO). Los reclamos reales aparecen cuando la oficina habilita tu CUIT.
        </div>
      )}

      <div className="stats stats--4" data-fuse-container>
        {stats.map((s) => (
          <div className="stat" key={s.label} data-fuse="fade-up" data-fuse-auto>
            <div className={`triage triage--${s.cls}`}>
              <span className="triage__dot" />
              {s.num}
            </div>
            <div className="stat__label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="chip-row">
        {filtros.map((f) => (
          <button
            key={f}
            type="button"
            className={`chip ${filtroActivo === f ? "is-active" : ""}`}
            onClick={() => aplicar(f)}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="bandeja-list" data-fuse-container>
        {filtrados.map((c) => (
          <article
            key={c.id}
            className={`ticket ${c.triage === "rojo" ? "ticket--urgente" : ""} ${
              c.estado === "RESUELTO" ? "ticket--resuelto" : ""
            }`}
            data-fuse="fade-up"
            data-fuse-auto
          >
            <div className="ticket__talon">
              <span>BANDEJA {c.triage.toUpperCase()}</span>
            </div>
            <div className="ticket__body">
              <div className="ticket__head">
                <span className="ticket__id">{c.id}</span>
                <span className="ticket__date">{hace(c.fecha)}</span>
                <span className={`triage triage--${c.triage}`}>
                  <span className="triage__dot" />
                  {c.triage}
                </span>
                <Stamp tone={estadoTone[c.estado]} rotate={c.id.length % 2 ? "l" : "r"}>
                  {c.estado}
                </Stamp>
              </div>
              <div className="caso-head">
                <span className="caso-iniciales">{c.ciudadano.iniciales}</span>
                <span className="caso-cat">{c.categoria}</span>
                {c.demo && <span className="caso-cat caso-cat--demo">DEMO</span>}
                {c.patron && (
                  <span className="caso-cat" style={{ color: "var(--color-accent)", borderColor: "var(--color-accent)" }}>
                    PATRÓN
                  </span>
                )}
                <span className="ticket__date">
                  {c.vencido ? "PLAZO VENCIDO" : `DÍA ${c.diasPlazo}/10`}
                </span>
              </div>
              <hr className="ticket__perf" />
              <dl className="ticket__row">
                <dt>ENTIDAD</dt>
                <dd>{c.entidad}</dd>
              </dl>
              <dl className="ticket__row">
                <dt>DISTRITO</dt>
                <dd>{c.ciudadano.distrito}</dd>
              </dl>
              <p className="ticket__resumen">{c.resumen}</p>
              <div className="case-actions">
                <button type="button" className="btn btn--primary" onClick={() => onOpenCaso(c)}>
                  ABRIR CASO <Icon name="arrowRight" size={12} />
                </button>
                <button type="button" className="btn btn--ghost">
                  DERIVAR
                </button>
                <button type="button" className="btn btn--ghost">
                  RESPONDER
                </button>
              </div>
              <div className="ticket__foot">
                <Barcode />
              </div>
            </div>
          </article>
        ))}
      </div>

      {filtrados.length === 0 && (
        <p className="view__sub" data-fuse="fade-up" data-fuse-auto>
          {archivo ? "Todavía no hay casos resueltos en el archivo." : "Sin casos en esta bandeja. Todo al día."}
        </p>
      )}
    </div>
  );
}

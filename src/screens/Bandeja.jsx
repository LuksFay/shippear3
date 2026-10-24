import { useMemo, useState } from "react";
import Stamp from "../components/Stamp.jsx";
import Barcode from "../components/Barcode.jsx";
import Icon from "../components/Icon.jsx";

const estadoTone = {
  PENDIENTE: "",
  DERIVADO: "warn",
  RESPONDIDO: "plain",
  RESUELTO: "ok",
};

const NOW = Date.now();

function hace(iso) {
  const diff = NOW - new Date(iso).getTime();
  const hs = Math.max(1, Math.round(diff / 3600000));
  if (hs < 24) return `HACE ${hs} H`;
  return `HACE ${Math.round(hs / 24)} D`;
}

export default function Bandeja({ casos, filtros, filtro, onFiltro, onOpenCaso }) {
  const [filtroInterno, setFiltroInterno] = useState("TODOS");
  const filtroActivo = filtro || filtroInterno;

  const stats = useMemo(() => {
    const hoy = casos.filter((c) => NOW - new Date(c.fecha).getTime() < 48 * 3600000).length;
    const urgentes = casos.filter((c) => c.prioridad === "URGENTE" && c.estado === "PENDIENTE").length;
    const resueltos = casos.filter((c) => c.estado === "RESUELTO").length;
    return [
      { num: hoy, label: "ENTRANTES 48H" },
      { num: urgentes, label: "URGENTES" },
      { num: casos.length - resueltos, label: "PENDIENTES" },
    ];
  }, [casos]);

  const filtrados = useMemo(() => {
    let lista = [...casos];
    if (filtroActivo === "URGENTES") lista = lista.filter((c) => c.prioridad === "URGENTE");
    else if (filtroActivo === "ARCHIVO") lista = lista.filter((c) => c.estado === "RESUELTO");
    else if (filtroActivo !== "TODOS") lista = lista.filter((c) => c.categoria === filtroActivo);
    const peso = { URGENTE: 0, NORMAL: 1, BAJA: 2 };
    return lista.sort((a, b) => peso[a.prioridad] - peso[b.prioridad] || new Date(b.fecha) - new Date(a.fecha));
  }, [casos, filtroActivo]);

  const aplicar = (f) => {
    setFiltroInterno(f);
    if (onFiltro) onFiltro(f);
  };

  return (
    <div className="view view--wide">
      <span className="view__kicker">MESA DE ENTRADA — VISTA ENTIDAD</span>
      <h1>
        BANDEJA DE <em>ENTRADA</em>
      </h1>
      <p className="view__sub">
        Casos ordenados por prioridad. Derivá, respondé o resolvé. Cada caso llega con
        documento leído y fundamento redactado por IA.
      </p>

      <div className="stats" data-fuse-container>
        {stats.map((s) => (
          <div className="stat" key={s.label} data-fuse="fade-up" data-fuse-auto>
            <div className="stat__num">{s.num}</div>
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
            className={`ticket ${c.prioridad === "URGENTE" ? "ticket--urgente" : ""} ${
              c.estado === "RESUELTO" ? "ticket--resuelto" : ""
            }`}
            data-fuse="fade-up"
            data-fuse-auto
          >
            <div className="ticket__talon">
              <span>BANDEJA {c.prioridad}</span>
            </div>
            <div className="ticket__body">
              <div className="ticket__head">
                <span className="ticket__id">{c.id}</span>
                <span className="ticket__date">{hace(c.fecha)}</span>
                <Stamp tone={estadoTone[c.estado]} rotate={c.id.length % 2 ? "l" : "r"}>
                  {c.estado}
                </Stamp>
              </div>
              <div className="caso-head">
                <span className="caso-iniciales">{c.ciudadano.iniciales}</span>
                <span className="caso-cat">{c.categoria}</span>
                {c.prioridad === "URGENTE" && (
                  <Stamp tone="" rotate="r" data-fuse="popup" data-fuse-auto>
                    URGENTE
                  </Stamp>
                )}
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
              <dl className="ticket__row">
                <dt>RECLAMO</dt>
                <dd>{c.reclamo}</dd>
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
          Sin casos en esta bandeja. Todo al día.
        </p>
      )}
    </div>
  );
}

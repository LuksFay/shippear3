import { useEffect, useMemo, useState } from "react";
import Stamp from "../components/Stamp.jsx";

export default function Analizando({ analisis, reclamo, onDone }) {
  const [pasoActivo, setPasoActivo] = useState(0);
  const [lineasVisibles, setLineasVisibles] = useState(0);
  const [terminado, setTerminado] = useState(false);

  const lineas = useMemo(() => analisis.lineas, [analisis]);

  useEffect(() => {
    const timers = [];
    let t = 500;
    for (let i = 0; i < lineas.length; i += 1) {
      timers.push(
        setTimeout(() => setLineasVisibles(i + 1), t),
      );
      t += 480;
    }
    analisis.steps.forEach((s, i) => {
      const base = 400 + i * 900;
      timers.push(setTimeout(() => setPasoActivo(i + 1), base));
      if (i === analisis.steps.length - 1) {
        timers.push(setTimeout(() => setTerminado(true), base + 1000));
        timers.push(setTimeout(() => onDone(), base + 1900));
      }
    });
    return () => timers.forEach(clearTimeout);
  }, [lineas, analisis, onDone]);

  return (
    <div className="view view--app">
      <span className="view__kicker">TRÁMITE Nº {reclamo.id}</span>
      <h1>
        ANALIZANDO <em>FACTURA</em>
      </h1>

      <div className="form-group">
        <div className="photo-zone" style={{ minHeight: 0, cursor: "default" }}>
          <div className="docmock" data-fuse="fade-up" data-fuse-auto>
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
          </div>
          {!terminado && <span className="scanline" />}
        </div>
      </div>

      <div className="analisis-status" data-fuse-container>
        {analisis.steps.map((s, i) => {
          const cls =
            terminado || i < pasoActivo
              ? "is-done"
              : i === pasoActivo
                ? "is-active"
                : "";
          return (
            <div key={s.id} className={`analisis-status__row ${cls}`} data-fuse="fade-up" data-fuse-auto>
              <span className="status-idx">0{s.id}</span>
              {s.accion}
            </div>
          );
        })}
      </div>

      <div className="log" data-fuse="fade-up" data-fuse-auto>
        {lineas.slice(0, lineasVisibles).map((l, i) => (
          <div
            key={l}
            className={`log__line ${i === lineasVisibles - 1 && !terminado ? "log__line--active" : "log__line--done"}`}
            data-fuse="fade-left"
            data-fuse-auto
          >
            {l}
            {i === lineasVisibles - 1 && !terminado && <span className="log__cursor" />}
          </div>
        ))}
      </div>

      {terminado && (
        <div className="doc__sello" data-fuse="popup" data-fuse-auto>
          <Stamp size="xl" rotate="l">
            LISTO
          </Stamp>
        </div>
      )}
    </div>
  );
}

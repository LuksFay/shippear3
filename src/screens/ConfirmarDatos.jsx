import { useState } from "react";
import Icon from "../components/Icon.jsx";
import Stamp from "../components/Stamp.jsx";

export default function ConfirmarDatos({ datos, tipos, onConfirmar }) {
  const [d, setD] = useState({ ...datos });
  const tipo = tipos.find((t) => t.id === d.tipo);

  const campos = [
    { key: "entidad", label: "ENTIDAD" },
    { key: "monto", label: "MONTO" },
    { key: "fecha", label: "FECHA" },
    { key: "operacion", label: "Nº OPERACIÓN" },
  ];

  return (
    <div className="view view--app">
      <span className="view__kicker">PASO 2 — VOS CONFIRMÁS</span>
      <h1>
        REVISÁ LOS <em>DATOS</em>
      </h1>
      <p className="view__sub">
        La IA extrajo esto de tu resumen. Si hay algo mal, tocá el dato y corregilo.
        Nada se envía sin tu confirmación.
      </p>

      <div className="confirm" data-fuse="brake" data-fuse-auto>
        <div className="confirm__head">
          <span>CONFLICTO CLASIFICADO</span>
          <Stamp tone="" rotate="r">{tipo?.nombre || d.tipo}</Stamp>
        </div>
        {campos.map((c) => (
          <div className="confirm__row" key={c.key}>
            <span className="confirm__label">{c.label}</span>
            <input
              className="confirm__value"
              value={d[c.key]}
              onChange={(e) => setD({ ...d, [c.key]: e.target.value })}
              aria-label={c.label}
            />
          </div>
        ))}
        <div className="confirm__foot">
          <button
            type="button"
            className="btn btn--primary btn--block btn--lg"
            onClick={() => onConfirmar(d)}
            data-fuse="fade-up"
            data-fuse-auto
          >
            CONFIRMAR DATOS <Icon name="check" size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

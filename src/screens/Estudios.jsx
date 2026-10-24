import { useEffect, useState } from "react";
import { api } from "../lib/api.js";

// Oficina: lista de sólo lectura de estudios que se registraron. No hay acciones de envío de casos.
export default function Estudios() {
  const [lista, setLista] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api.estudios().then((r) => setLista(r.estudios || [])).catch((e) => setError(e.message || "No pude cargar la lista."));
  }, []);
  return (
    <div className="view view--wide">
      <span className="view__kicker">RED DE ESTUDIOS JURÍDICOS — SÓLO LECTURA</span>
      <h1>
        ESTUDIOS <em>INTERESADOS</em>
      </h1>
      <p className="view__sub">Abogados que aceptaron recibir información y posibles casos derivados. Los casos no se comparten automáticamente.</p>
      {error && <p className="login__error">{error}</p>}
      {lista && !lista.length && <p className="view__sub">Todavía no se registró ningún estudio.</p>}
      <div className="estudios">
        {lista?.map((e) => (
          <article key={e.id} className="estudio">
            <div className="estudio__nombre">{e.estudio || e.nombre}</div>
            {e.estudio && <div>{e.nombre}</div>}
            <div className="estudio__meta">
              {e.ciudad}, {e.provincia}
              {e.matricula ? ` · Mat. ${e.matricula}` : ""}
              {e.colegio ? ` (${e.colegio})` : ""}
            </div>
            <div className="estudio__esp">{e.especialidades.join(" · ")}</div>
            <div className="estudio__contacto">
              <a href={`mailto:${encodeURIComponent(e.email).replace("%40", "@")}`}>{e.email}</a>
              {e.telefono ? ` · ${e.telefono}` : ""}
            </div>
            {e.mensaje && <p className="estudio__msj">{e.mensaje}</p>}
            <div className="estudio__meta">Consentimiento: {new Date(e.consentimiento_at).toLocaleDateString("es-AR")}</div>
          </article>
        ))}
      </div>
    </div>
  );
}

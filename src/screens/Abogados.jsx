import { useState } from "react";
import { api } from "../lib/api.js";

const ESPECIALIDADES = [
  ["bancario", "Bancario"],
  ["tarjetas", "Tarjetas"],
  ["billeteras", "Billeteras virtuales"],
  ["consumidor", "Consumidor general"],
];

const CAMPOS = [
  { id: "nombre", label: "Nombre y apellido", max: 120, req: true, auto: "name" },
  { id: "estudio", label: "Estudio (opcional)", max: 160, auto: "organization" },
  { id: "matricula", label: "Matrícula (opcional)", max: 40 },
  { id: "colegio", label: "Colegio de abogados (opcional)", max: 120 },
  { id: "email", label: "Email", max: 254, req: true, type: "email", auto: "email" },
  { id: "telefono", label: "Teléfono (opcional)", max: 40, type: "tel", auto: "tel" },
  { id: "ciudad", label: "Ciudad", max: 80, req: true, auto: "address-level2" },
  { id: "provincia", label: "Provincia", max: 80, req: true, auto: "address-level1" },
];

// Formulario público para estudios jurídicos. No comparte casos: sólo registra interés con consentimiento.
export default function Abogados({ onVolver, onPrivacidad }) {
  const [f, setF] = useState({ provincia: "Santa Fe", especialidades: [] });
  const [consent, setConsent] = useState(false);
  const [estado, setEstado] = useState("form"); // form | enviando | ok
  const [error, setError] = useState("");
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const toggle = (id) => set("especialidades", f.especialidades.includes(id) ? f.especialidades.filter((e) => e !== id) : [...f.especialidades, id]);

  const enviar = async (e) => {
    e.preventDefault();
    setError("");
    if (!f.especialidades.length) return setError("Elegí al menos una especialidad.");
    if (!consent) return setError("Para registrarte tenés que aceptar el consentimiento.");
    setEstado("enviando");
    try {
      await api.abogados({ ...f, consentimiento: true });
      setEstado("ok");
    } catch (err) {
      setError(err.message || "No pudimos guardar tus datos. Probá de nuevo.");
      setEstado("form");
    }
  };

  if (estado === "ok")
    return (
      <div className="view">
        <span className="view__kicker">ESTUDIOS JURÍDICOS Y ABOGADOS</span>
        <h1>¡GRACIAS!</h1>
        <p className="view__sub">Recibimos tus datos y te mandamos un email de confirmación. Si en algún momento hay un caso para derivar, primero te lo consultamos.</p>
        <button type="button" className="btn btn--ghost btn--block" onClick={onVolver}>VOLVER</button>
      </div>
    );

  return (
    <div className="view">
      <span className="view__kicker">ESTUDIOS JURÍDICOS Y ABOGADOS</span>
      <h1>
        SUMATE A LA <em>RED</em>
      </h1>
      <p className="view__sub">
        Saldo a Favor ayuda a vecinos de Rosario con cobros indebidos de bancos, tarjetas y billeteras. Si tu estudio trabaja estos temas, dejanos tus datos. No compartimos casos de forma automática.
      </p>
      <form className="confirm abogados" onSubmit={enviar} noValidate>
        {CAMPOS.map((c) => (
          <div key={c.id} className="confirm__row">
            <label className="confirm__label" htmlFor={`ab-${c.id}`}>{c.label}</label>
            <input id={`ab-${c.id}`} className="confirm__value" type={c.type || "text"} maxLength={c.max} required={c.req} autoComplete={c.auto} value={f[c.id] || ""} onChange={(e) => set(c.id, e.target.value)} />
          </div>
        ))}
        <fieldset className="abogados__esp">
          <legend className="field-label">Especialidades</legend>
          {ESPECIALIDADES.map(([id, label]) => (
            <label key={id} className="check">
              <input type="checkbox" checked={f.especialidades.includes(id)} onChange={() => toggle(id)} /> {label}
            </label>
          ))}
        </fieldset>
        <div className="confirm__row">
          <label className="confirm__label" htmlFor="ab-mensaje">Mensaje (opcional)</label>
          <textarea id="ab-mensaje" className="textarea" maxLength={1000} value={f.mensaje || ""} onChange={(e) => set("mensaje", e.target.value)} />
        </div>
        {/* Honeypot: invisible para personas, los bots lo completan. */}
        <div className="hp" aria-hidden="true">
          <label htmlFor="ab-web">Sitio web</label>
          <input id="ab-web" tabIndex={-1} autoComplete="off" value={f.sitio_web || ""} onChange={(e) => set("sitio_web", e.target.value)} />
        </div>
        <label className="check check--consent">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>
            Acepto recibir información y posibles casos derivados de Saldo a Favor.{" "}
            <button type="button" className="link-btn" onClick={onPrivacidad}>Nota de privacidad</button>
          </span>
        </label>
        {error && <p className="login__error" role="alert">{error}</p>}
        <button type="submit" className="btn btn--primary btn--block" disabled={estado === "enviando"}>
          {estado === "enviando" ? "ENVIANDO…" : "ENVIAR MIS DATOS"}
        </button>
        <button type="button" className="btn btn--ghost btn--block" onClick={onVolver}>VOLVER</button>
      </form>
    </div>
  );
}

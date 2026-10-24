import { useState } from "react";
import Icon from "../components/Icon.jsx";
import { api } from "../lib/api.js";
import { cuitValido, formatDoc, soloNumeros } from "../lib/doc.js";

const TIPOS = {
  vecino: { label: "CIUDADANO", doc: "DNI", max: 8, placeholder: "Sin puntos", ayuda: "Ciudadano: entrás con tu DNI para hacer y seguir tus reclamos." },
  entidad: { label: "OFICINA", doc: "CUIT/CUIL", max: 11, placeholder: "11 números, sin guiones", ayuda: "Oficina del Consumidor: entrás con el CUIT/CUIL para ver la bandeja de reclamos." },
};

export default function Login({ onLogin, rolInicial = "vecino", onVolver }) {
  const [rol, setRol] = useState(TIPOS[rolInicial] ? rolInicial : "vecino");
  const [paso, setPaso] = useState("doc");
  const [doc, setDoc] = useState("");
  const [email, setEmail] = useState("");
  const [pideEmail, setPideEmail] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [destino, setDestino] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const t = TIPOS[rol];

  const cambiarRol = (r) => {
    if (r === rol) return;
    setRol(r);
    setDoc("");
    setError("");
    setPideEmail(false);
  };

  const validar = () => {
    if (rol === "vecino") return /^\d{7,8}$/.test(doc) ? "" : "El DNI tiene que tener 7 u 8 números, sin puntos.";
    if (doc.length !== 11) return "El CUIT/CUIL tiene que tener 11 números, sin guiones.";
    return cuitValido(doc) ? "" : "El CUIT/CUIL no es válido. Revisá los números.";
  };

  const pedir = async (e) => {
    e?.preventDefault();
    setError("");
    const msg = validar();
    if (msg) return setError(msg);
    if (pideEmail && !email.trim()) return setError("Escribí tu email para mandarte el código.");
    setCargando(true);
    try {
      const r = await api.pedirCodigo(rol, doc, email.trim() || undefined);
      setDestino(r.email);
      setPaso("codigo");
      setCodigo("");
    } catch (err) {
      if (err.data?.needEmail) setPideEmail(true);
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  const entrar = async (e) => {
    e.preventDefault();
    setError("");
    if (codigo.length !== 6) return setError("El código tiene 6 números.");
    setCargando(true);
    try {
      const r = await api.verificar(rol, doc, codigo);
      onLogin(r.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="view view--app">
      <span className="view__kicker">INGRESO — SIN CONTRASEÑAS</span>
      <h1>
        ENTRÁ CON TU <em>{t.doc}</em>
      </h1>

      {paso === "doc" ? (
        <>
          <div className="role-switch login__tipo" role="radiogroup" aria-label="Tipo de usuario">
            {Object.entries(TIPOS).map(([id, x]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={rol === id}
                className={rol === id ? "is-active" : ""}
                onClick={() => cambiarRol(id)}
              >
                {x.label}
              </button>
            ))}
          </div>
          <p className="view__sub">
            {t.ayuda} Te mandamos un código por email; la primera vez te pedimos el email.
          </p>
          <form className="confirm" onSubmit={pedir} data-fuse="brake" data-fuse-auto>
            <div className="confirm__row">
              <label className="confirm__label" htmlFor="doc">{t.doc}</label>
              <input
                id="doc"
                className="confirm__value"
                inputMode="numeric"
                autoComplete="username"
                placeholder={t.placeholder}
                maxLength={14}
                value={doc}
                onChange={(e) => setDoc(soloNumeros(e.target.value).slice(0, t.max))}
              />
            </div>
            <div className="confirm__row">
              <label className="confirm__label" htmlFor="email">
                EMAIL {pideEmail ? "" : "(SOLO LA 1ª VEZ)"}
              </label>
              <input
                id="email"
                className="confirm__value"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder={rol === "entidad" ? "reclamos@oficina.gob.ar" : "tu@email.com"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {error && <p className="login__error" role="alert">{error}</p>}
            <div className="confirm__foot">
              <button type="submit" className="btn btn--primary btn--block btn--lg" disabled={cargando}>
                {cargando ? "ENVIANDO…" : "PEDIR CÓDIGO"} <Icon name="send" size={15} />
              </button>
              {onVolver && (
                <button type="button" className="btn btn--ghost btn--block" onClick={onVolver}>
                  VOLVER AL INICIO
                </button>
              )}
            </div>
          </form>
        </>
      ) : (
        <>
          <p className="view__sub">
            {`${t.label} ${t.doc} ${formatDoc(doc, rol)}. Te mandamos un código de 6 números a ${destino}. Mirá también en correo no deseado.`}
          </p>
          <form className="confirm" onSubmit={entrar} data-fuse="brake" data-fuse-auto>
            <div className="confirm__row">
              <label className="confirm__label" htmlFor="codigo">CÓDIGO</label>
              <input
                id="codigo"
                className="confirm__value login__code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={6}
                value={codigo}
                onChange={(e) => setCodigo(soloNumeros(e.target.value).slice(0, 6))}
                autoFocus
              />
            </div>
            {error && <p className="login__error" role="alert">{error}</p>}
            <div className="confirm__foot">
              <button type="submit" className="btn btn--primary btn--block btn--lg" disabled={cargando}>
                {cargando ? "VERIFICANDO…" : "ENTRAR"} <Icon name="check" size={15} />
              </button>
              <button type="button" className="btn btn--ghost btn--block" onClick={pedir} disabled={cargando}>
                PEDIR OTRO CÓDIGO
              </button>
              <button type="button" className="btn btn--ghost btn--block" onClick={() => { setPaso("doc"); setError(""); }}>
                CAMBIAR {t.doc} O TIPO DE USUARIO
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}

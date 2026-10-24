import { useState } from "react";
import Icon from "../components/Icon.jsx";
import { api } from "../lib/api.js";

const soloNumeros = (v) => v.replace(/\D/g, "");

export default function Login({ onLogin }) {
  const [paso, setPaso] = useState("dni");
  const [dni, setDni] = useState("");
  const [email, setEmail] = useState("");
  const [pideEmail, setPideEmail] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [destino, setDestino] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const dniOk = /^\d{7,8}$/.test(dni);

  const pedir = async (e) => {
    e?.preventDefault();
    setError("");
    if (!dniOk) return setError("El DNI tiene que tener 7 u 8 números, sin puntos.");
    if (pideEmail && !email.trim()) return setError("Escribí tu email para mandarte el código.");
    setCargando(true);
    try {
      const r = await api.pedirCodigo(dni, email.trim() || undefined);
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
      const r = await api.verificar(dni, codigo);
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
        ENTRÁ CON TU <em>DNI</em>
      </h1>
      <p className="view__sub">
        {paso === "dni"
          ? "Te mandamos un código por email. La primera vez te pedimos el email; después alcanza con el DNI."
          : `Te mandamos un código de 6 números a ${destino}. Mirá también en correo no deseado.`}
      </p>

      {paso === "dni" ? (
        <form className="confirm" onSubmit={pedir} data-fuse="brake" data-fuse-auto>
          <div className="confirm__row">
            <label className="confirm__label" htmlFor="dni">DNI</label>
            <input
              id="dni"
              className="confirm__value"
              inputMode="numeric"
              autoComplete="username"
              placeholder="Sin puntos"
              maxLength={10}
              value={dni}
              onChange={(e) => setDni(soloNumeros(e.target.value).slice(0, 8))}
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
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {error && <p className="login__error" role="alert">{error}</p>}
          <div className="confirm__foot">
            <button type="submit" className="btn btn--primary btn--block btn--lg" disabled={cargando}>
              {cargando ? "ENVIANDO…" : "PEDIR CÓDIGO"} <Icon name="send" size={15} />
            </button>
          </div>
        </form>
      ) : (
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
            <button type="button" className="btn btn--ghost btn--block" onClick={() => { setPaso("dni"); setError(""); }}>
              CAMBIAR DNI
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

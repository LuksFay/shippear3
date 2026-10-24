import Icon from "./Icon.jsx";
import { formatDoc } from "../lib/doc.js";

export default function TopBar({ dark, onTheme, user, onSalir, onIngresar, onHome }) {
  const docLabel = user ? `${user.docType || (user.role === "entidad" ? "CUIT" : "DNI")} ${formatDoc(user.doc, user.role)}` : "";
  return (
    <header className="topbar">
      <button
        type="button"
        className="topbar__brand"
        onClick={onHome}
        aria-label="Volver al inicio"
        title="Volver al inicio"
      >
        saldo a<b>favor</b>
      </button>
      <span className="topbar__tag">MESA DE ENTRADA — ROSARIO</span>
      <div className="topbar__controls">
        {user && (
          <span className="topbar__user" title={user.role === "entidad" ? "Entidad" : "Ciudadano"}>
            <Icon name={user.role === "entidad" ? "building" : "user"} size={13} />
            {docLabel}
          </span>
        )}
        {!user && onIngresar && (
          <button type="button" className="topbar__user topbar__login" onClick={onIngresar}>
            <Icon name="user" size={13} />
            INGRESAR
          </button>
        )}
        <button
          type="button"
          className="icon-btn"
          onClick={onTheme}
          aria-label={dark ? "Modo claro" : "Modo oscuro"}
          title={dark ? "Modo claro" : "Modo oscuro"}
        >
          <Icon name={dark ? "sun" : "moon"} size={15} />
        </button>
        {user && (
          <button type="button" className="icon-btn" onClick={onSalir} aria-label="Cerrar sesión" title="Cerrar sesión">
            <Icon name="x" size={15} />
          </button>
        )}
      </div>
    </header>
  );
}

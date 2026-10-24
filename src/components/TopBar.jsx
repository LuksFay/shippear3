import Icon from "./Icon.jsx";

export default function TopBar({ role, onRole, dark, onTheme }) {
  return (
    <header className="topbar">
      <div className="topbar__brand">
        ship<b>pear</b>
      </div>
      <span className="topbar__tag">MESA DE ENTRADA</span>
      <div className="topbar__controls">
        <div className="role-switch" role="tablist" aria-label="Perfil">
          <button
            type="button"
            className={role === "ciudadano" ? "is-active" : ""}
            onClick={() => onRole("ciudadano")}
          >
            CIUDADANO
          </button>
          <button
            type="button"
            className={role === "entidad" ? "is-active" : ""}
            onClick={() => onRole("entidad")}
          >
            ENTIDAD
          </button>
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={onTheme}
          aria-label={dark ? "Modo claro" : "Modo oscuro"}
          title={dark ? "Modo claro" : "Modo oscuro"}
        >
          <Icon name={dark ? "sun" : "moon"} size={15} />
        </button>
      </div>
    </header>
  );
}

import Icon from "./Icon.jsx";

const items = {
  ciudadano: [
    { id: "home", label: "INICIO", icon: "home" },
    { id: "chat", label: "RECLAMAR", icon: "plus" },
    { id: "mis", label: "MIS RECLAMOS", icon: "ticket" },
  ],
  entidad: [
    { id: "bandeja", label: "BANDEJA", icon: "inbox" },
    { id: "patrones", label: "PATRONES", icon: "alert" },
    { id: "archivo", label: "ARCHIVO", icon: "check" },
  ],
};

export default function BottomNav({ role, active, onNav }) {
  return (
    <nav className="bottomnav" aria-label="Navegación principal">
      {items[role].map((item) => (
        <button
          key={item.id}
          type="button"
          className={`bottomnav__item ${active === item.id ? "is-active" : ""}`}
          onClick={() => onNav(item.id)}
        >
          <Icon name={item.icon} />
          {item.label}
        </button>
      ))}
    </nav>
  );
}

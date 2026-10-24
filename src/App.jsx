import { useCallback, useMemo, useState } from "react";
import contenido from "./mock/contenido.json";
import entidades from "./mock/entidades.json";
import reclamosMock from "./mock/reclamos.json";
import casosMock from "./mock/casos.json";
import TopBar from "./components/TopBar.jsx";
import BottomNav from "./components/BottomNav.jsx";
import Home from "./screens/Home.jsx";
import NuevoReclamo from "./screens/NuevoReclamo.jsx";
import Analizando from "./screens/Analizando.jsx";
import ReclamoListo from "./screens/ReclamoListo.jsx";
import MisReclamos from "./screens/MisReclamos.jsx";
import Bandeja from "./screens/Bandeja.jsx";
import CasoDetalle from "./screens/CasoDetalle.jsx";

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

export default function App() {
  const [role, setRole] = useState("ciudadano");
  const [dark, setDark] = useState(false);
  const [view, setView] = useState("home");
  const [filtro, setFiltro] = useState("TODOS");
  const [reclamos, setReclamos] = useState(reclamosMock);
  const [casos] = useState(casosMock);
  const [currentReclamo, setCurrentReclamo] = useState(null);
  const [currentCaso, setCurrentCaso] = useState(null);

  const nroExpediente = useMemo(() => {
    const nums = reclamos
      .map((r) => Number(r.id.split("-").pop()) || 0);
    return `RE-2026-${String(Math.max(0, ...nums) + 1).padStart(4, "0")}`;
  }, [reclamos]);

  const irACiudadano = useCallback(() => {
    setRole("ciudadano");
    setView("home");
    setFiltro("TODOS");
    setCurrentCaso(null);
  }, []);

  const irAEntidad = useCallback(() => {
    setRole("entidad");
    setView("bandeja");
    setFiltro("TODOS");
    setCurrentReclamo(null);
  }, []);

  const handleRole = useCallback(
    (r) => (r === "ciudadano" ? irACiudadano() : irAEntidad()),
    [irACiudadano, irAEntidad],
  );

  const toggleTheme = useCallback(() => {
    setDark((d) => {
      const next = !d;
      document.documentElement.setAttribute("data-mode", next ? "dark" : "light");
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", next ? "#12100c" : "#f4efe4");
      return next;
    });
  }, []);

  const handleAnalizar = useCallback(
    ({ entidadId, nota }) => {
      const entidad = entidades.find((e) => e.id === entidadId);
      const reclamo = {
        id: nroExpediente,
        fecha: hoy(),
        entidad: entidad?.nombre || "Entidad",
        categoria: entidad?.categoria || "Servicios",
        monto: 48200,
        estado: "EN TRÁMITE",
        resumen: nota?.trim()
          ? nota.trim()
          : "Cargo duplicado en factura detectado por IA",
      };
      setReclamos((prev) => [reclamo, ...prev]);
      setCurrentReclamo(reclamo);
      setView("analizando");
    },
    [nroExpediente],
  );

  const handleNav = useCallback(
    (id) => {
      if (role === "ciudadano") {
        if (id === "home") setView("home");
        if (id === "nuevo") setView("nuevo");
        if (id === "mis") setView("mis");
        return;
      }
      setView("bandeja");
      if (id === "urgentes") setFiltro("URGENTES");
      if (id === "archivo") setFiltro("ARCHIVO");
      if (id === "bandeja") setFiltro("TODOS");
    },
    [role],
  );

  const navActivo =
    role === "ciudadano"
      ? view === "home"
        ? "home"
        : view === "nuevo" || view === "analizando" || view === "listo"
          ? "nuevo"
          : "mis"
      : view === "caso"
        ? "bandeja"
        : filtro === "URGENTES"
          ? "urgentes"
          : filtro === "ARCHIVO"
            ? "archivo"
            : "bandeja";

  let screen = null;
  if (role === "ciudadano") {
    switch (view) {
      case "nuevo":
        screen = (
          <NuevoReclamo
            entidades={entidades}
            nroExpediente={nroExpediente}
            onAnalizar={handleAnalizar}
          />
        );
        break;
      case "analizando":
        screen = currentReclamo ? (
          <Analizando
            analisis={contenido.analisis}
            reclamo={currentReclamo}
            onDone={() => setView("listo")}
          />
        ) : null;
        break;
      case "listo":
        screen = currentReclamo ? (
          <ReclamoListo
            reclamo={currentReclamo}
            contenido={contenido}
            onVerEstado={() => setView("mis")}
            onNuevo={() => setView("nuevo")}
          />
        ) : null;
        break;
      case "mis":
        screen = (
          <MisReclamos
            reclamos={reclamos}
            contenido={contenido}
            onNuevo={() => setView("nuevo")}
            onVolver={() => setView("home")}
          />
        );
        break;
      default:
        screen = (
          <Home
            contenido={contenido}
            reclamos={reclamos}
            onNuevo={() => setView("nuevo")}
            onVerMis={() => setView("mis")}
            onOpen={() => setView("mis")}
          />
        );
    }
  } else {
    screen =
      view === "caso" && currentCaso ? (
        <CasoDetalle
          caso={currentCaso}
          contenido={contenido}
          onVolver={() => setView("bandeja")}
        />
      ) : (
        <Bandeja
          casos={casos}
          filtros={contenido.filtros}
          filtro={filtro}
          onFiltro={setFiltro}
          onOpenCaso={(c) => {
            setCurrentCaso(c);
            setView("caso");
          }}
        />
      );
  }

  const viewKey = `${role}-${view}-${currentReclamo?.id || ""}-${currentCaso?.id || ""}-${filtro}`;

  return (
    <div className="shell">
      <TopBar role={role} onRole={handleRole} dark={dark} onTheme={toggleTheme} />
      <main className="main">
        <div key={viewKey} className="fuse-page-in">
          {screen}
        </div>
      </main>
      <BottomNav role={role} active={navActivo} onNav={handleNav} />
    </div>
  );
}

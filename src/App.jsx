import { useCallback, useEffect, useMemo, useState } from "react";
import contenido from "./mock/contenido.json";
import entidades from "./mock/entidades.json";
import reclamosMock from "./mock/reclamos.json";
import casosMock from "./mock/casos.json";
import tiposConflicto from "./mock/tiposConflicto.json";
import bibliotecaLegal from "./mock/bibliotecaLegal.json";
import reglasPrioridad from "./mock/reglasPrioridad.json";
import patronesMock from "./mock/patrones.json";
import TopBar from "./components/TopBar.jsx";
import BottomNav from "./components/BottomNav.jsx";
import Home from "./screens/Home.jsx";
import Chat from "./screens/Chat.jsx";
import ConfirmarDatos from "./screens/ConfirmarDatos.jsx";
import Derechos from "./screens/Derechos.jsx";
import ReclamoListo from "./screens/ReclamoListo.jsx";
import Seguimiento from "./screens/Seguimiento.jsx";
import MisReclamos from "./screens/MisReclamos.jsx";
import Bandeja from "./screens/Bandeja.jsx";
import CasoDetalle from "./screens/CasoDetalle.jsx";
import Patrones from "./screens/Patrones.jsx";
import Login from "./screens/Login.jsx";
import { api } from "./lib/api.js";

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

function parseMonto(s) {
  if (typeof s === "number") return s;
  const n = Number(String(s).replaceAll(".", "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = verificando sesión
  const [dark, setDark] = useState(false);
  const [view, setView] = useState("chat");
  const [publico, setPublico] = useState({ pantalla: "landing", rol: "vecino" }); // sin sesión: landing o ingreso
  const [filtro, setFiltro] = useState("TODOS");
  const [reclamos, setReclamos] = useState(reclamosMock);
  const [casos] = useState(casosMock);
  const [datos, setDatos] = useState(null);
  const [currentReclamo, setCurrentReclamo] = useState(null);
  const [currentCaso, setCurrentCaso] = useState(null);

  // El tipo de usuario lo define la sesión (lo valida el servidor); no se cambia desde la UI.
  const role = user?.role === "entidad" ? "entidad" : "ciudadano";

  const entrar = useCallback((u) => {
    setUser(u);
    setView(u?.role === "entidad" ? "bandeja" : "chat");
    setFiltro("TODOS");
    setDatos(null);
    setCurrentReclamo(null);
    setCurrentCaso(null);
  }, []);

  useEffect(() => {
    api
      .me()
      .then((r) => entrar(r.user ?? null))
      .catch(() => setUser(null));
  }, [entrar]);

  const salir = useCallback(async () => {
    await api.salir().catch(() => {});
    setUser(null);
    setView("chat");
    setPublico({ pantalla: "landing", rol: "vecino" });
  }, []);

  const irAlIngreso = useCallback((rol = "vecino") => {
    setPublico({ pantalla: "login", rol });
    window.scrollTo(0, 0);
  }, []);

  // El brand "saldo a favor" lleva al inicio: sin sesión → landing (o sale del login);
  // con sesión → la pantalla principal del tipo de usuario logueado.
  const irAlInicio = useCallback(() => {
    if (user) {
      setView(user.role === "entidad" ? "bandeja" : "chat");
      setFiltro("TODOS");
      setDatos(null);
      setCurrentReclamo(null);
      setCurrentCaso(null);
      window.scrollTo(0, 0);
    } else {
      setPublico({ pantalla: "landing", rol: "vecino" });
      window.scrollTo(0, 0);
    }
  }, [user]);

  const nroExpediente = useMemo(() => {
    const nums = reclamos.map((r) => Number(r.id.split("-").pop()) || 0);
    return `RE-2026-${String(Math.max(0, ...nums) + 1).padStart(4, "0")}`;
  }, [reclamos]);

  const tipoActual = useMemo(
    () => tiposConflicto.find((t) => t.id === datos?.tipo) || tiposConflicto[0],
    [datos],
  );

  const normasActuales = useMemo(
    () => bibliotecaLegal.filter((n) => tipoActual.normas.includes(n.id)),
    [tipoActual],
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

  const handleArmar = useCallback(() => {
    if (!datos) return;
    const entidad = entidades.find(
      (e) => e.nombre.toLowerCase() === datos.entidad.toLowerCase(),
    );
    const fundamento = `${tipoActual.derecho} Normativa: ${normasActuales
      .map((n) => `${n.nombre} (${n.articulos})`)
      .join("; ")}.`;
    const reclamo = {
      id: nroExpediente,
      fecha: hoy(),
      entidad: datos.entidad,
      categoria: entidad?.categoria || "BANCOS",
      tipo: datos.tipo,
      operacion: datos.operacion,
      monto: parseMonto(datos.monto),
      estado: "EN TRÁMITE",
      diasPlazo: 1,
      vencido: false,
      resumen: tipoActual.nombre,
      fundamento,
    };
    setReclamos((prev) => [reclamo, ...prev]);
    setCurrentReclamo(reclamo);
    setView("listo");
  }, [datos, tipoActual, normasActuales, nroExpediente]);

  const handleNav = useCallback(
    (id) => {
      if (role === "ciudadano") {
        if (id === "chat") setView("chat");
        if (id === "mis") setView("mis");
        return;
      }
      if (id === "patrones") {
        setView("patrones");
        return;
      }
      setView("bandeja");
      setFiltro(id === "archivo" ? "ARCHIVO" : "TODOS");
    },
    [role],
  );

  const navActivo =
    role === "ciudadano"
      ? view === "mis" || view === "seguimiento"
        ? "mis"
        : "chat"
      : view === "patrones"
        ? "patrones"
        : view === "caso"
          ? "bandeja"
          : filtro === "ARCHIVO"
            ? "archivo"
            : "bandeja";

  let screen = null;
  if (role === "ciudadano") {
    switch (view) {
      case "chat":
        screen = (
          <Chat
            nroExpediente={nroExpediente}
            onConfirmar={(d) => { setDatos(d); setView("confirmar"); }}
            onSinSesion={() => { setUser(null); irAlIngreso("vecino"); }}
          />
        );
        break;
      case "confirmar":
        screen = datos ? (
          <ConfirmarDatos datos={datos} tipos={tiposConflicto} onConfirmar={(d) => { setDatos(d); setView("derechos"); }} />
        ) : null;
        break;
      case "derechos":
        screen = (
          <Derechos
            tipo={tipoActual}
            normas={normasActuales}
            contenido={contenido}
            onArmar={handleArmar}
          />
        );
        break;
      case "listo":
        screen = currentReclamo ? (
          <ReclamoListo
            reclamo={currentReclamo}
            contenido={contenido}
            onSeguimiento={() => setView("seguimiento")}
            onNuevo={() => setView("chat")}
          />
        ) : null;
        break;
      case "seguimiento":
        screen = currentReclamo ? (
          <Seguimiento
            reclamo={currentReclamo}
            contenido={contenido}
            onVolver={() => setView("mis")}
            onNuevo={() => setView("chat")}
          />
        ) : null;
        break;
      case "mis":
        screen = (
          <MisReclamos
            reclamos={reclamos}
            onNuevo={() => setView("chat")}
            onOpen={(r) => { setCurrentReclamo(r); setView("seguimiento"); }}
          />
        );
        break;
      default:
        screen = (
          <Chat
            nroExpediente={nroExpediente}
            onConfirmar={(d) => { setDatos(d); setView("confirmar"); }}
            onSinSesion={() => { setUser(null); irAlIngreso("vecino"); }}
          />
        );
    }
  } else if (view === "caso" && currentCaso) {
    screen = (
      <CasoDetalle
        caso={currentCaso}
        contenido={contenido}
        reglas={reglasPrioridad}
        onVolver={() => setView("bandeja")}
        onPatrones={() => setView("patrones")}
      />
    );
  } else if (view === "patrones") {
    screen = <Patrones patrones={patronesMock} contenido={contenido} onVolver={() => setView("bandeja")} />;
  } else {
    screen = (
      <Bandeja
        casos={casos}
        filtros={contenido.filtros}
        filtro={filtro}
        onFiltro={setFiltro}
        onOpenCaso={(c) => { setCurrentCaso(c); setView("caso"); }}
      />
    );
  }

  if (user === undefined) {
    screen = null;
  } else if (!user) {
    // Sin sesión: la landing (lo que antes era INICIO) y desde ahí el ingreso.
    screen =
      publico.pantalla === "login" ? (
        <Login key={publico.rol} rolInicial={publico.rol} onLogin={entrar} onVolver={() => setPublico({ pantalla: "landing", rol: "vecino" })} />
      ) : (
        <Home
          publico
          contenido={contenido}
          onNuevo={() => irAlIngreso("vecino")}
          onVerMis={() => irAlIngreso("vecino")}
          onEntidad={() => irAlIngreso("entidad")}
        />
      );
  }

  const viewKey = `${user ? "in" : `out-${publico.pantalla}-${publico.rol}`}-${role}-${view}-${currentReclamo?.id || ""}-${currentCaso?.id || ""}-${filtro}`;

  return (
    <div className={`shell${user && role === "ciudadano" && view === "chat" ? " shell--chat" : ""}`}>
      <TopBar dark={dark} onTheme={toggleTheme} user={user} onSalir={salir} onIngresar={user === null && publico.pantalla === "landing" ? () => irAlIngreso("vecino") : null} onHome={irAlInicio} />
      <main className="main">
        <div key={viewKey} className="fuse-page-in">
          {screen}
        </div>
      </main>
      {user && <BottomNav role={role} active={navActivo} onNav={handleNav} />}
    </div>
  );
}

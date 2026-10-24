import { useCallback, useEffect, useMemo, useState } from "react";
import contenido from "./mock/contenido.json";
import entidades from "./mock/entidades.json";
import tiposConflicto from "./mock/tiposConflicto.json";
import bibliotecaLegal from "./mock/bibliotecaLegal.json";
import reglasPrioridad from "./mock/reglasPrioridad.json";
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

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = verificando sesión
  const [dark, setDark] = useState(false);
  const [view, setView] = useState("chat");
  const [publico, setPublico] = useState({ pantalla: "landing", rol: "vecino" }); // sin sesión: landing o ingreso
  const [filtro, setFiltro] = useState("TODOS");
  // Sólo datos reales de la base: reclamos del vecino y casos de la entidad vinculada.
  const [reclamos, setReclamos] = useState([]);
  const [casos, setCasos] = useState([]);
  const [vinculada, setVinculada] = useState(true);
  const [chatReclamo, setChatReclamo] = useState(null); // { dbId, id } de la conversación abierta
  const [resumeId, setResumeId] = useState(null); // borrador a retomar desde Mis reclamos
  const [chatKey, setChatKey] = useState(0);
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

  const cargarReclamos = useCallback(() => {
    api.reclamos().then((r) => setReclamos(r.reclamos || [])).catch(() => {});
  }, []);
  const cargarCasos = useCallback(() => {
    api.casosEntidad().then((r) => { setCasos(r.casos || []); setVinculada(r.vinculada !== false); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    if (user.role === "entidad") cargarCasos();
    else cargarReclamos();
  }, [user, view, cargarReclamos, cargarCasos]);

  // La Oficina ve los reclamos nuevos sin recargar: refresco cada 30 s mientras la pestaña está visible.
  useEffect(() => {
    if (user?.role !== "entidad") return undefined;
    const t = setInterval(() => document.visibilityState === "visible" && cargarCasos(), 30000);
    return () => clearInterval(t);
  }, [user, cargarCasos]);

  // Patrones calculados de los casos reales (entidad + tipo, últimos 30 días).
  const patrones = useMemo(() => {
    const ahora = Date.now(), mes = 30 * 86400000;
    const g = new Map();
    for (const c of casos) {
      const t = new Date(c.fecha).getTime();
      const k = `${c.demo ? 1 : 0}|${c.entidad}|${c.tipo}`;
      const p = g.get(k) || { entidad: c.entidad, tipo: c.tipo, demo: c.demo, casos: 0, previos: 0, periodo: "ÚLTIMOS 30 DÍAS" };
      if (t >= ahora - mes) p.casos++;
      else if (t >= ahora - 2 * mes) p.previos++;
      g.set(k, p);
    }
    return [...g.values()]
      .filter((p) => p.casos >= 3)
      .sort((a, b) => b.casos - a.casos)
      .map((p) => ({ ...p, delta: p.previos ? `${p.casos >= p.previos ? "+" : ""}${Math.round(((p.casos - p.previos) / p.previos) * 100)}%` : "NUEVO", gravedad: p.casos >= 5 ? "ALTA" : "MEDIA" }));
  }, [casos]);

  const nuevoReclamo = useCallback(async () => {
    await api.nuevaConversacion().catch(() => {});
    setResumeId(null);
    setChatKey((k) => k + 1);
    setView("chat");
  }, []);

  const abrirChat = useCallback((id = null) => {
    setResumeId(id);
    setChatKey((k) => k + 1);
    setView("chat");
  }, []);

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

  const handleArmar = useCallback(async () => {
    if (!datos || !chatReclamo) return;
    const entidad = entidades.find(
      (e) => e.nombre.toLowerCase() === datos.entidad.toLowerCase(),
    );
    const fundamento = `${tipoActual.derecho} Normativa: ${normasActuales
      .map((n) => `${n.nombre} (${n.articulos})`)
      .join("; ")}.`;
    try {
      const { reclamo } = await api.presentar(chatReclamo.dbId, { ...datos, categoria: entidad?.categoria || "BANCOS", resumen: tipoActual.nombre }, fundamento);
      setCurrentReclamo(reclamo);
      setChatReclamo(null);
      setResumeId(null);
      setChatKey((k) => k + 1); // el próximo chat arranca de cero
      cargarReclamos();
      setView("listo");
    } catch (e) {
      if (e.status === 401) return setUser(null);
      alert(e.message || "No pude guardar el reclamo. Probá de nuevo.");
    }
  }, [datos, chatReclamo, tipoActual, normasActuales, cargarReclamos]);

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
            key={chatKey}
            resumeId={resumeId}
            onReclamo={setChatReclamo}
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
            onNuevo={nuevoReclamo}
          />
        ) : null;
        break;
      case "seguimiento":
        screen = currentReclamo ? (
          <Seguimiento
            reclamo={currentReclamo}
            contenido={contenido}
            onVolver={() => setView("mis")}
            onNuevo={nuevoReclamo}
            soloLectura={currentReclamo.demo}
            onCambio={(r) => { setCurrentReclamo(r); cargarReclamos(); }}
            onBaja={() => { setCurrentReclamo(null); cargarReclamos(); setView("mis"); }}
          />
        ) : null;
        break;
      case "mis":
        screen = (
          <MisReclamos
            reclamos={reclamos}
            onNuevo={nuevoReclamo}
            onOpen={(r) => (r.borrador ? abrirChat(r.dbId) : (setCurrentReclamo(r), setView("seguimiento")))}
          />
        );
        break;
      default:
        screen = (
          <Chat
            key={chatKey}
            resumeId={resumeId}
            onReclamo={setChatReclamo}
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
    screen = <Patrones patrones={patrones} contenido={contenido} onVolver={() => setView("bandeja")} />;
  } else {
    screen = (
      <Bandeja
        casos={casos}
        vinculada={vinculada}
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

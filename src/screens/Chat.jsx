import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "../components/Icon.jsx";
import { api, fileToDataUrl, hora24, miniatura } from "../lib/api.js";

// Chat agéntico: las respuestas vienen del backend (/api/chat → modelo de IA). El historial y la memoria
// del caso viven en el servidor (Postgres): al recargar o entrar desde otro dispositivo sigue la misma charla.
// Lo único fijo es el saludo de bienvenida, que NO es de la IA (no se genera ni se le manda al modelo).
export const BIENVENIDA = "Hola, soy Saldo a Favor. Contame qué te pasó con el banco, la tarjeta o la billetera. Podés escribir o mandar un audio.";

const MAX_MB = 8;

// Todo se renderiza como TEXTO (React escapa HTML; nunca usamos dangerouslySetInnerHTML).
// Además sacamos caracteres de control y de override bidi que sirven para engañar visualmente.
const limpio = (t) =>
  String(t ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]/g, "")
    .slice(0, 4000);

// Sólo previsualizamos imágenes locales en data: URL de tipos seguros (nada de SVG ni URLs remotas).
const previewSegura = (u) => (/^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i.test(u) ? u : null);

const ERRORES = {
  ia_sin_credito: "El asistente está fuera de servicio por un momento. Ya lo estamos resolviendo; probá más tarde.",
  ia_offline: "El asistente está desconectado en este momento. Probá de nuevo en unos minutos.",
  ia_ocupada: "El asistente está muy ocupado. Esperá unos segundos y probá de nuevo.",
  ia_timeout: "El asistente tardó demasiado. Probá de nuevo.",
  audio_no_disponible: "No pude escuchar el audio en este momento. Probá de nuevo o escribilo.",
  solo_fotos: "Por ahora no puedo leer PDF. Mandame una foto o captura del resumen.",
  rol_no_permitido: "El chat de reclamos es sólo para ciudadanos. Entrá con tu DNI.",
};

const metaHora = (d) => hora24(d);

// Mensaje guardado en el servidor → burbuja.
const deServidor = (m) => {
  const base = { from: m.from, text: m.text, por: m.por, time: metaHora(m.at) };
  if (m.kind === "archivo" && m.adjunto)
    return { ...base, file: { name: m.adjunto.name, isPdf: m.adjunto.tipo === "pdf", preview: previewSegura(m.adjunto.preview || "") } };
  if (m.kind === "audio") return { ...base, audio: m.adjunto?.seg || 1 };
  return base;
};

export default function Chat({ resumeId, onConfirmar, onSinSesion, onReclamo }) {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [datos, setDatos] = useState(null);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState("");
  const [grabando, setGrabando] = useState(false);
  const msgsBoxRef = useRef(null);
  const busy = useRef(false);
  const msgsRef = useRef([]);
  const recRef = useRef(null);
  const started = useRef(false);
  const cancelado = useRef(false);
  const [reclamo, setReclamo] = useState(null); // { dbId, id } cuando ya hay un mensaje del vecino
  const reclamoRef = useRef(null);
  const [cargando, setCargando] = useState(true);
  const [reintentable, setReintentable] = useState(false);
  const [seg, setSeg] = useState(0);

  // Teclado del celular: abierto = input enfocado Y el alto visible bajó bastante respecto del máximo
  // visto. Cuando se cierra (enviar, elegir archivo, botón atrás) el bottom nav vuelve.
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;
    let base = Math.max(window.innerHeight, vv?.height || 0);
    let lastW = window.innerWidth;
    const update = () => {
      if (window.innerWidth !== lastW) {
        lastW = window.innerWidth; // rotó: nueva base
        base = 0;
      }
      const h = vv ? vv.height : window.innerHeight;
      const focused = document.activeElement?.classList?.contains("chat__input");
      if (!focused) base = Math.max(base, h, window.innerHeight);
      root.classList.toggle("kb-open", Boolean(focused && base - h > 120));
    };
    const later = () => setTimeout(update, 350); // el teclado anima
    vv?.addEventListener("resize", update);
    window.addEventListener("resize", update);
    document.addEventListener("focusin", later);
    document.addEventListener("focusout", later);
    update();
    return () => {
      vv?.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
      document.removeEventListener("focusin", later);
      document.removeEventListener("focusout", later);
      root.classList.remove("kb-open");
    };
  }, []);

  // Cronómetro mientras se graba.
  useEffect(() => {
    if (!grabando) return setSeg(0);
    const t0 = Date.now();
    const id = setInterval(() => setSeg(Math.floor((Date.now() - t0) / 1000)), 250);
    return () => clearInterval(id);
  }, [grabando]);

  // Auto-scroll dentro de la lista de mensajes (la barra de escritura queda fija abajo).
  useEffect(() => {
    const box = msgsBoxRef.current;
    if (box) box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
  }, [msgs, typing, listo, error]);

  const push = useCallback((m) => {
    const next = [...msgsRef.current, { time: metaHora(), ...m }];
    msgsRef.current = next;
    setMsgs(next);
    return next;
  }, []);

  const fijarReclamo = useCallback(
    (r) => {
      if (!r) return;
      reclamoRef.current = r;
      setReclamo(r);
      onReclamo?.(r);
    },
    [onReclamo],
  );

  // Manda UN mensaje nuevo (o reintenta el último sin respuesta). El contexto lo arma el servidor.
  const preguntar = useCallback(
    async (payload) => {
      busy.current = true;
      setTyping(true);
      setError("");
      setReintentable(false);
      try {
        const r = await api.chat({ reclamoId: reclamoRef.current?.dbId, ...payload });
        fijarReclamo(r.reclamo);
        push({ from: "ia", text: limpio(r.reply), por: r.ia });
        if (r.datos) setDatos(r.datos);
        setListo(Boolean(r.listo));
      } catch (e) {
        if (e.status === 401) return onSinSesion?.();
        if (e.data?.reclamo) fijarReclamo(e.data.reclamo);
        setReintentable(Boolean(e.data?.reintentable));
        setError(ERRORES[e.code] || e.message || "La IA no respondió. Probá de nuevo en un momento.");
      } finally {
        setTyping(false);
        busy.current = false;
      }
    },
    [push, onSinSesion, fijarReclamo],
  );

  // Al entrar: se restaura la conversación guardada (sin llamar a la IA). El saludo es fijo.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    api
      .conversacion(resumeId)
      .then(({ reclamo: r, mensajes }) => {
        if (r) {
          fijarReclamo({ dbId: r.dbId, id: r.id });
          const ms = mensajes.map(deServidor);
          msgsRef.current = ms;
          setMsgs(ms);
          const d = r.datos || {};
          setDatos({ tipo: d.tipo || "", entidad: d.entidad || "", monto: d.monto || "", fecha: d.fecha || "", operacion: d.operacion || "" });
          setListo(Boolean(r.listo));
          if (ms.length && ms[ms.length - 1].from === "user") setReintentable(true);
        }
      })
      .catch((e) => e.status === 401 && onSinSesion?.())
      .finally(() => setCargando(false));
  }, [resumeId, fijarReclamo, onSinSesion]);

  // "Nueva conversación": la actual queda guardada en Mis reclamos y el contexto arranca de cero.
  const nuevaConversacion = async () => {
    if (busy.current) return;
    try {
      await api.nuevaConversacion();
    } catch (e) {
      if (e.status === 401) return onSinSesion?.();
    }
    reclamoRef.current = null;
    setReclamo(null);
    onReclamo?.(null);
    msgsRef.current = [];
    setMsgs([]);
    setDatos(null);
    setListo(false);
    setError("");
    setReintentable(false);
    setInput("");
  };

  const enviarTexto = () => {
    // Grabando: el botón Enviar corta la grabación y manda el audio (un solo toque).
    if (grabando) return recRef.current?.stop();
    const t = input.trim();
    if (!t || busy.current) return;
    setInput("");
    push({ from: "user", text: limpio(t) });
    preguntar({ text: t });
  };

  const subirArchivo = async (file) => {
    if (!file || busy.current) return;
    if (file.size > MAX_MB * 1024 * 1024) return setError(`El archivo pesa más de ${MAX_MB} MB.`);
    if (!/^image\/|application\/pdf/.test(file.type)) return setError("Subí una foto (JPG, PNG) o un PDF.");
    busy.current = true;
    try {
      const dataUrl = await fileToDataUrl(file);
      const isPdf = file.type === "application/pdf";
      const preview = isPdf ? null : await miniatura(dataUrl);
      push({ from: "user", file: { name: file.name, isPdf, preview: previewSegura(preview || "") || previewSegura(dataUrl) } });
      await preguntar({ attachment: { name: file.name, dataUrl, preview } });
    } catch {
      busy.current = false;
      setError("No pude leer el archivo.");
    }
  };

  // Formato que soporta el navegador: Chrome/Android/Firefox graban webm/opus; Safari/iOS, mp4 (aac).
  const mimeGrabacion = () => {
    const c = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/aac", "audio/ogg;codecs=opus"];
    return c.find((t) => MediaRecorder.isTypeSupported?.(t)) || "";
  };

  const cancelarAudio = () => {
    cancelado.current = true;
    recRef.current?.stop();
  };

  const toggleAudio = async () => {
    if (grabando) {
      recRef.current?.stop();
      return;
    }
    if (busy.current) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined")
      return setError("Este navegador no permite grabar audio. Escribí el mensaje.");
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const tipo = mimeGrabacion();
      const rec = tipo ? new MediaRecorder(stream, { mimeType: tipo }) : new MediaRecorder(stream);
      const chunks = [];
      const inicio = Date.now();
      cancelado.current = false;
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setGrabando(false);
        if (cancelado.current) return;
        const blob = new Blob(chunks, { type: (rec.mimeType || tipo || "audio/webm").split(";")[0] });
        const seg = Math.max(1, Math.round((Date.now() - inicio) / 1000));
        if (blob.size < 1000) return setError("El audio quedó vacío. Tocá el micrófono, hablá y tocá enviar.");
        busy.current = true;
        // Burbuja provisoria mientras se transcribe; después se reemplaza por lo que dijo.
        push({ from: "user", text: "Escuchando tu audio…", audio: seg, pendiente: true });
        const sacarProvisoria = () => {
          msgsRef.current = msgsRef.current.filter((m) => !m.pendiente);
          setMsgs(msgsRef.current);
        };
        try {
          const dataUrl = await fileToDataUrl(blob);
          const { text } = await api.transcribir(dataUrl);
          sacarProvisoria();
          if (!text) throw new Error("No se entendió el audio. Probá de nuevo o escribilo.");
          push({ from: "user", text: limpio(text), audio: seg });
          await preguntar({ text, audio: { seg } });
        } catch (e) {
          sacarProvisoria();
          busy.current = false;
          if (e.status === 401) return onSinSesion?.();
          setError(ERRORES[e.code] || e.message);
        }
      };
      recRef.current = rec;
      rec.start(1000);
      setGrabando(true);
      setTimeout(() => rec.state === "recording" && rec.stop(), 120_000);
    } catch {
      setError("No pude usar el micrófono. Revisá el permiso del navegador o escribí el mensaje.");
    }
  };

  return (
    <div className="view view--app view--chat">
      <div className="chat__head">
        <div>
          {reclamo && <span className="view__kicker">TRÁMITE Nº {reclamo.id}</span>}
          <h1>
            CONTAME QUÉ <em>PASÓ</em>
          </h1>
        </div>
        {msgs.length > 0 && (
          <button type="button" className="btn btn--ghost chat__nueva" onClick={nuevaConversacion} disabled={typing}>
            <Icon name="plus" size={14} /> NUEVA CONVERSACIÓN
          </button>
        )}
      </div>

      <div className="chat">
        <div className="chat__msgs" ref={msgsBoxRef} aria-live="polite" data-fuse-container>
          <div className="bubble bubble--ia bubble--bienvenida">
            {BIENVENIDA}
            <span className="bubble__meta">SALDO A FAVOR</span>
          </div>
          {cargando && (
            <div className="bubble bubble--ia">
              <span className="typing"><i /><i /><i /></span>
            </div>
          )}
          {msgs.map((m, i) =>
            m.from === "ia" ? (
              <div className="bubble bubble--ia" key={i} data-fuse="fade-up" data-fuse-auto>
                {m.text}
                <span className="bubble__meta">SALDO A FAVOR · {m.time} · {m.por === "Grok" || m.por === "Qwen" ? m.por : "IA"}</span>
              </div>
            ) : m.file ? (
              <div className="bubble bubble--user" key={i} data-fuse="fade-up" data-fuse-auto>
                {m.file.preview ? (
                  <img className="bubble__img" src={m.file.preview} alt="Resumen adjunto" />
                ) : (
                  <span className="bubble__file"><Icon name="doc" size={16} /> {m.file.name}</span>
                )}
                <span className="bubble__meta">{m.file.isPdf ? "PDF" : "FOTO"} ENVIADO — {m.time}</span>
              </div>
            ) : (
              <div className={`bubble bubble--user${m.pendiente ? " is-pending" : ""}`} key={i} data-fuse="fade-up" data-fuse-auto>
                {m.audio ? <span className="bubble__tag"><Icon name="mic" size={12} /> AUDIO {m.audio}s</span> : null}
                {m.text}
                <span className="bubble__meta">VOS — {m.time}</span>
              </div>
            ),
          )}

          {typing && (
            <div className="bubble bubble--ia" data-fuse="fade-up" data-fuse-auto>
              <span className="typing"><i /><i /><i /></span>
            </div>
          )}

          {error && (
            <div className="bubble bubble--log" role="alert">
              <div className="bubble__line--active">{error}</div>
              {!typing && reintentable && msgs.length > 0 && msgs[msgs.length - 1].from === "user" && (
                <button type="button" className="btn btn--ghost" onClick={() => preguntar({ reintentar: true })}>
                  REINTENTAR
                </button>
              )}
            </div>
          )}

          {listo && datos && !typing && (
            <div className="qr" data-fuse="popup" data-fuse-auto>
              <button type="button" className="btn btn--primary" onClick={() => onConfirmar(datos)}>
                REVISAR LOS DATOS <Icon name="arrowRight" size={14} />
              </button>
            </div>
          )}
        </div>

        <div
          className="chat__bar"
          onMouseDown={(e) => {
            // Que tocar enviar/mic/adjuntar no saque el foco del input: si no, el teclado se cierra,
            // el layout salta y el toque se pierde.
            if (e.target.closest("button, label")) e.preventDefault();
          }}
        >
          <button
            type="button"
            className={`icon-btn${grabando ? " is-recording" : ""}`}
            onClick={toggleAudio}
            aria-label={grabando ? "Enviar audio" : "Grabar audio"}
            title={grabando ? "Tocá para enviar el audio" : "Grabar audio"}
          >
            <Icon name={grabando ? "send" : "mic"} size={17} />
          </button>
          {grabando ? (
            <button type="button" className="icon-btn" onClick={cancelarAudio} aria-label="Cancelar audio" title="Cancelar audio">
              <Icon name="x" size={17} />
            </button>
          ) : (
          <label className="icon-btn" aria-label="Adjuntar resumen" title="Adjuntar foto o PDF" style={{ cursor: "pointer" }}>
            <Icon name="paperclip" size={17} />
            <input
              type="file"
              accept="image/*,application/pdf"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                subirArchivo(f);
              }}
            />
          </label>
          )}
          <input
            className="chat__input"
            placeholder={grabando ? `● Grabando ${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, "0")} — tocá enviar` : "Escribí tu mensaje…"}
            value={input}
            maxLength={2000}
            enterKeyHint="send"
            autoComplete="off"
            aria-label="Mensaje"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                enviarTexto();
              }
            }}
          />
          <button type="button" className="chat__send" onClick={enviarTexto} aria-label="Enviar">
            <Icon name="send" size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

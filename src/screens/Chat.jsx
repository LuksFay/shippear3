import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "../components/Icon.jsx";
import { api, fileToDataUrl } from "../lib/api.js";

// Chat agéntico: TODAS las respuestas vienen del backend (/api/chat → modelo de IA).
// Acá no hay textos de respuesta fijos ni datos simulados.

const MAX_MB = 8;

function metaHora() {
  return new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

const aHistorial = (msgs) =>
  msgs
    .filter((m) => m.text && (m.from === "ia" || m.from === "user"))
    .map((m) => ({ role: m.from === "ia" ? "assistant" : "user", content: m.text }));

export default function Chat({ nroExpediente, onConfirmar, onSinSesion }) {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [datos, setDatos] = useState(null);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState("");
  const [grabando, setGrabando] = useState(false);
  const endRef = useRef(null);
  const busy = useRef(false);
  const msgsRef = useRef([]);
  const recRef = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, typing, listo, error]);

  const push = useCallback((m) => {
    const next = [...msgsRef.current, { ...m, time: metaHora() }];
    msgsRef.current = next;
    setMsgs(next);
    return next;
  }, []);

  const preguntar = useCallback(
    async (historial, adjunto) => {
      busy.current = true;
      setTyping(true);
      setError("");
      try {
        const r = await api.chat(historial, adjunto);
        push({ from: "ia", text: r.reply });
        if (r.datos) setDatos(r.datos);
        setListo(Boolean(r.listo));
      } catch (e) {
        if (e.status === 401) return onSinSesion?.();
        setError(e.message);
      } finally {
        setTyping(false);
        busy.current = false;
      }
    },
    [push, onSinSesion],
  );

  // Saludo inicial: también lo genera la IA.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    preguntar([]);
  }, [preguntar]);

  const enviarTexto = () => {
    const t = input.trim();
    if (!t || busy.current) return;
    setInput("");
    const next = push({ from: "user", text: t });
    preguntar(aHistorial(next));
  };

  const subirArchivo = async (file) => {
    if (!file || busy.current) return;
    if (file.size > MAX_MB * 1024 * 1024) return setError(`El archivo pesa más de ${MAX_MB} MB.`);
    if (!/^image\/|application\/pdf/.test(file.type)) return setError("Subí una foto (JPG, PNG) o un PDF.");
    busy.current = true;
    try {
      const dataUrl = await fileToDataUrl(file);
      const next = push({ from: "user", file: { name: file.name, isPdf: file.type === "application/pdf", preview: file.type.startsWith("image/") ? dataUrl : null } });
      await preguntar(aHistorial(next), { name: file.name, dataUrl });
    } catch {
      busy.current = false;
      setError("No pude leer el archivo.");
    }
  };

  const toggleAudio = async () => {
    if (grabando) {
      recRef.current?.stop();
      return;
    }
    if (busy.current) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined")
      return setError("Este navegador no permite grabar audio. Escribí el mensaje.");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks = [];
      const inicio = Date.now();
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setGrabando(false);
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        if (blob.size < 1000) return;
        const seg = Math.round((Date.now() - inicio) / 1000);
        busy.current = true;
        setTyping(true);
        try {
          const dataUrl = await fileToDataUrl(blob);
          const { text } = await api.transcribir(dataUrl);
          if (!text) throw new Error("No se entendió el audio. Probá de nuevo o escribilo.");
          const next = push({ from: "user", text, audio: seg });
          await preguntar(aHistorial(next));
        } catch (e) {
          if (e.status === 401) return onSinSesion?.();
          setTyping(false);
          busy.current = false;
          setError(e.message);
        }
      };
      recRef.current = rec;
      rec.start();
      setGrabando(true);
      setTimeout(() => rec.state === "recording" && rec.stop(), 90_000);
    } catch {
      setError("No pude usar el micrófono. Revisá el permiso o escribí el mensaje.");
    }
  };

  return (
    <div className="view view--app">
      <span className="view__kicker">TRÁMITE Nº {nroExpediente}</span>
      <h1>
        CONTAME QUÉ <em>PASÓ</em>
      </h1>

      <div className="chat">
        <div className="chat__msgs" data-fuse-container>
          {msgs.map((m, i) =>
            m.from === "ia" ? (
              <div className="bubble bubble--ia" key={i} data-fuse="fade-up" data-fuse-auto>
                {m.text}
                <span className="bubble__meta">MESA DE ENTRADA — {m.time}</span>
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
              <div className="bubble bubble--user" key={i} data-fuse="fade-up" data-fuse-auto>
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
              {!typing && msgs.length === 0 && (
                <button type="button" className="btn btn--ghost" onClick={() => preguntar([])}>REINTENTAR</button>
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
          <div ref={endRef} />
        </div>

        <div className="chat__bar">
          <button
            type="button"
            className={`icon-btn${grabando ? " is-recording" : ""}`}
            onClick={toggleAudio}
            aria-label={grabando ? "Terminar audio" : "Mandar audio"}
            title={grabando ? "Tocá para terminar" : "Mandar audio"}
          >
            <Icon name={grabando ? "x" : "mic"} size={17} />
          </button>
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
          <input
            className="chat__input"
            placeholder={grabando ? "Grabando… tocá la X para enviar" : "Escribí tu mensaje…"}
            value={input}
            maxLength={2000}
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

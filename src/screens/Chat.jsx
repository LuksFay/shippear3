import { useEffect, useRef, useState } from "react";
import Icon from "../components/Icon.jsx";

const DATOS_EXTRAIDOS = {
  entidad: "DELTA BANCO",
  monto: "48.200,00",
  fecha: "30/09/2026",
  operacion: "OP-88213",
  tipo: "cargo-no-reconocido",
};

function metaHora() {
  return new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

export default function Chat({ contenido, nroExpediente, onConfirmar }) {
  const [msgs, setMsgs] = useState([{ from: "ia", text: contenido.chat.saludo, time: metaHora() }]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [resumen, setResumen] = useState(false);
  const [leyendo, setLeyendo] = useState([]);
  const [listo, setListo] = useState(false);
  const endRef = useRef(null);
  const busy = useRef(false);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, leyendo, typing, listo]);

  const say = (m) => setMsgs((p) => [...p, { ...m, time: metaHora() }]);

  const enviarTexto = () => {
    const t = input.trim();
    if (!t || typing || busy.current) return;
    say({ from: "user", text: t });
    setInput("");
    busy.current = true;
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      say({ from: "ia", text: contenido.chat.pedidoResumen });
      busy.current = false;
    }, 900);
  };

  const enviarAudio = () => {
    if (typing || busy.current) return;
    say({ from: "user", audio: true });
    busy.current = true;
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      say({ from: "ia", text: contenido.chat.pedidoResumen });
      busy.current = false;
    }, 900);
  };

  const subirResumen = () => {
    if (busy.current) return;
    setResumen(true);
    busy.current = true;
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      contenido.chat.leyendo.forEach((l, i) => {
        setTimeout(() => setLeyendo((p) => [...p, l]), 550 * (i + 1));
      });
      setTimeout(() => {
        setListo(true);
        busy.current = false;
      }, 550 * contenido.chat.leyendo.length + 700);
    }, 800);
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
            ) : m.audio ? (
              <div className="bubble bubble--user bubble--audio" key={i} data-fuse="fade-up" data-fuse-auto>
                <span className="audio-wave">
                  <i /><i /><i /><i /><i /><i />
                </span>
                <span className="bubble__meta">AUDIO 0:07 — {m.time}</span>
              </div>
            ) : (
              <div className="bubble bubble--user" key={i} data-fuse="fade-up" data-fuse-auto>
                {m.text}
                <span className="bubble__meta">VOS — {m.time}</span>
              </div>
            ),
          )}

          {resumen && (
            <div className="bubble bubble--ia" data-fuse="fade-up" data-fuse-auto>
              <div className="docmock">
                <div className="docmock__line">
                  <span>RESUMEN</span>
                  <span>OCT 2026</span>
                </div>
                <div className="docmock__line">
                  <i /><i /><i />
                </div>
                <div className="docmock__monto">$48.200,00</div>
              </div>
              <span className="bubble__meta">PDF RECIBIDO — {metaHora()}</span>
            </div>
          )}

          {leyendo.length > 0 && (
            <div className="bubble bubble--log" data-fuse="fade-up" data-fuse-auto>
              {leyendo.map((l, i) => (
                <div key={l} className={i === leyendo.length - 1 && !listo ? "bubble__line--active" : "bubble__line--done"}>
                  {l}
                  {i === leyendo.length - 1 && !listo && <span className="log__cursor" />}
                </div>
              ))}
            </div>
          )}

          {typing && (
            <div className="bubble bubble--ia" data-fuse="fade-up" data-fuse-auto>
              <span className="typing"><i /><i /><i /></span>
            </div>
          )}

          {listo && (
            <div className="qr" data-fuse="popup" data-fuse-auto>
              <button type="button" className="btn btn--primary" onClick={() => onConfirmar(DATOS_EXTRAIDOS)}>
                VER DATOS EXTRAÍDOS <Icon name="arrowRight" size={14} />
              </button>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="chat__bar">
          <button type="button" className="icon-btn" onClick={enviarAudio} aria-label="Mandar audio" title="Mandar audio">
            <Icon name="mic" size={17} />
          </button>
          <label className="icon-btn" aria-label="Adjuntar resumen" title="Adjuntar foto o PDF" style={{ cursor: "pointer" }}>
            <Icon name="paperclip" size={17} />
            <input
              type="file"
              accept="image/*,.pdf"
              style={{ display: "none" }}
              onChange={(e) => {
                if (e.target.files?.length) subirResumen();
              }}
            />
          </label>
          <input
            className="chat__input"
            placeholder="Escribí tu mensaje…"
            value={input}
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

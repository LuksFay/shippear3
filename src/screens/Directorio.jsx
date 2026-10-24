import { useEffect, useState } from "react";
import { api } from "../lib/api.js";

const TIPOS = [["", "Todos"], ["banco", "Bancos"], ["billetera", "Billeteras"], ["seguro", "Seguros"], ["tarjeta", "Tarjetas"], ["financiera", "Financieras"], ["credito", "Crédito no bancario"], ["mutual", "Mutuales"], ["cooperativa", "Cooperativas"], ["organismo", "Organismos"]];
const SECTOR = { publico: "Público", privado: "Privado", mixto: "Mixto" };
const httpUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : null);

// Oficina: directorio de canales de reclamo (sólo lectura).
export default function Directorio() {
  const [tipo, setTipo] = useState("banco");
  const [buscar, setBuscar] = useState("");
  const [r, setR] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      api.directorio({ tipo, q: buscar }).then(setR).catch((e) => setError(e.message || "No pude cargar el directorio."));
    }, 250);
    return () => clearTimeout(t);
  }, [tipo, buscar]);
  return (
    <div className="view view--wide">
      <span className="view__kicker">DIRECTORIO DE CANALES DE RECLAMO — SÓLO LECTURA</span>
      <h1>
        ADÓNDE <em>RECLAMAR</em>
      </h1>
      <p className="view__sub">Canales oficiales de cada entidad. El sistema sólo sugiere el destino: no envía nada a las entidades.</p>
      <div className="directorio__filtros">
        <input className="confirm__value" placeholder="Buscar entidad…" value={buscar} maxLength={60} onChange={(e) => setBuscar(e.target.value)} aria-label="Buscar entidad" />
        <select className="confirm__value" value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo">
          {TIPOS.map(([id, l]) => <option key={id} value={id}>{l}</option>)}
        </select>
      </div>
      {error && <p className="login__error">{error}</p>}
      {r && <p className="estudio__meta">{r.entidades.length} resultados</p>}
      <div className="estudios">
        {r?.entidades.map((e) => (
          <article key={e.id} className="estudio">
            <div className="estudio__nombre">{e.nombre}</div>
            <div className="estudio__esp">{e.tipo}{e.sector ? ` · ${SECTOR[e.sector]}` : ""}{e.regulador ? ` · ${e.regulador}` : ""}</div>
            {e.emails.length > 0 && (
              <div className="estudio__contacto">
                {e.emails.map((m) => <div key={m}><a href={`mailto:${m}`}>{m}</a></div>)}
                {!e.acepta_email && <div className="estudio__meta">{e.acepta_email_nota || "No confirma que acepte reclamos por email"}</div>}
              </div>
            )}
            {e.area_contacto && <div className="estudio__meta">{e.area_contacto}</div>}
            {httpUrl(e.url_formulario) && <a href={e.url_formulario} target="_blank" rel="noopener noreferrer">Canal web</a>}
            {e.telefono && <div className="estudio__meta">Tel.: {e.telefono}</div>}
            <div className="estudio__meta">
              {httpUrl(e.fuente?.split(" ")[0]) ? <a href={e.fuente.split(" ")[0]} target="_blank" rel="noopener noreferrer">Fuente</a> : "Fuente: —"}
              {e.fecha_verificacion ? ` · verificado ${String(e.fecha_verificacion).slice(0, 10)}` : ""}
              {e.confianza ? ` · confianza ${e.confianza.toLowerCase()}` : ""}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

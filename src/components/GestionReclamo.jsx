import { useState } from "react";
import { api } from "../lib/api.js";
import Icon from "./Icon.jsx";
import Historial from "./Historial.jsx";

const CAMPOS = [
  { id: "entidad", label: "ENTIDAD", max: 120 },
  { id: "monto", label: "MONTO ($)", max: 40, inputMode: "decimal" },
  { id: "fecha", label: "FECHA DEL COBRO", max: 40 },
  { id: "operacion", label: "N° DE OPERACIÓN", max: 60 },
  { id: "resumen", label: "QUÉ PASÓ", max: 400, area: true },
];

// Acciones del dueño sobre su reclamo: completar/corregir datos y darlo de baja. El servidor valida dueño y datos.
export default function GestionReclamo({ reclamo, onCambio, onBaja }) {
  const [modo, setModo] = useState(null); // null | "editar" | "baja"
  const [form, setForm] = useState({});
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const abrirEdicion = () => {
    setForm({
      entidad: reclamo.entidad === "—" ? "" : reclamo.entidad,
      monto: reclamo.monto ? String(reclamo.monto) : "",
      fecha: reclamo.fechaHecho || "",
      operacion: reclamo.operacion || "",
      resumen: reclamo.resumen || "",
    });
    setError("");
    setModo("editar");
  };

  const guardar = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await api.editar(reclamo.dbId, form);
      setModo(null);
      onCambio?.(r.reclamo);
    } catch (e) {
      setError(e.message || "No pude guardar los cambios.");
    } finally {
      setBusy(false);
    }
  };

  const darDeBaja = async () => {
    setBusy(true);
    setError("");
    try {
      await api.baja(reclamo.dbId, motivo);
      onBaja?.();
    } catch (e) {
      setError(e.message || "No pude dar de baja el reclamo.");
      setBusy(false);
    }
  };

  return (
    <div className="gestion">
      <div className="doc__seccion">
        TU RECLAMO {reclamo.editado && <span className="badge-editado">EDITADO</span>}
      </div>
      {reclamo.editado && <Historial key={reclamo.editadoAt} dbId={reclamo.dbId} />}

      {modo === "editar" && (
        <div className="confirm" style={{ marginTop: "0.75rem" }}>
          {CAMPOS.map((c) => (
            <div key={c.id} className="confirm__row">
              <label className="confirm__label" htmlFor={`ed-${c.id}`}>{c.label}</label>
              {c.area ? (
                <textarea id={`ed-${c.id}`} className="textarea" maxLength={c.max} value={form[c.id] || ""} onChange={(e) => setForm({ ...form, [c.id]: e.target.value })} />
              ) : (
                <input id={`ed-${c.id}`} className="confirm__value" maxLength={c.max} inputMode={c.inputMode} value={form[c.id] || ""} onChange={(e) => setForm({ ...form, [c.id]: e.target.value })} />
              )}
            </div>
          ))}
          {error && <p className="login__error">{error}</p>}
          <div className="gestion__acciones">
            <button type="button" className="btn btn--primary" onClick={guardar} disabled={busy}>GUARDAR CAMBIOS</button>
            <button type="button" className="btn btn--ghost" onClick={() => setModo(null)} disabled={busy}>CANCELAR</button>
          </div>
        </div>
      )}

      {modo === "baja" && (
        <div className="dialogo" role="alertdialog" aria-labelledby="baja-titulo" aria-describedby="baja-texto">
          <strong id="baja-titulo">¿Dar de baja el reclamo {reclamo.id}?</strong>
          <p id="baja-texto">Deja de aparecer en tus reclamos y en la Oficina del Consumidor. Si ya lo mandaste a la entidad, avisale vos que lo retirás.</p>
          <label className="field-label" htmlFor="baja-motivo">MOTIVO (OPCIONAL)</label>
          <input id="baja-motivo" className="confirm__value" maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: ya me devolvieron la plata" />
          {error && <p className="login__error">{error}</p>}
          <div className="gestion__acciones">
            <button type="button" className="btn btn--danger" onClick={darDeBaja} disabled={busy}>SÍ, DAR DE BAJA</button>
            <button type="button" className="btn btn--ghost" onClick={() => setModo(null)} disabled={busy}>NO, VOLVER</button>
          </div>
        </div>
      )}

      {!modo && (
        <div className="gestion__acciones">
          <button type="button" className="btn btn--ghost" onClick={abrirEdicion}>
            <Icon name="check" size={14} /> COMPLETAR O CORREGIR DATOS
          </button>
          <button type="button" className="btn btn--ghost gestion__baja" onClick={() => { setError(""); setModo("baja"); }}>
            <Icon name="x" size={14} /> DAR DE BAJA
          </button>
        </div>
      )}
    </div>
  );
}

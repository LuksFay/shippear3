export default function Privacidad({ onVolver }) {
  return (
    <div className="view">
      <span className="view__kicker">NOTA DE PRIVACIDAD</span>
      <h1>
        TUS <em>DATOS</em>
      </h1>
      <div className="privacidad">
        <p>Saldo a Favor es un piloto para la Oficina del Consumidor de Rosario. Usamos tus datos sólo para lo que nos pediste: armar y seguir tu reclamo, o —si sos abogado/a— contactarte con información del piloto.</p>
        <p><strong>Qué guardamos.</strong> Vecinos/as: DNI, email y los datos del reclamo. Estudios jurídicos: los datos del formulario, la fecha del consentimiento y un identificador cifrado de la conexión (no guardamos la IP).</p>
        <p><strong>Con quién lo compartimos.</strong> La Oficina ve los reclamos presentados con datos minimizados. No vendemos datos ni compartimos casos con estudios jurídicos de forma automática: cualquier derivación se consulta antes con la persona.</p>
        <p><strong>Tus derechos (Ley 25.326).</strong> Podés pedir acceso, corrección o eliminación de tus datos escribiendo a <a href="mailto:saldoafavor@arcadeestudio.com">saldoafavor@arcadeestudio.com</a>. La Agencia de Acceso a la Información Pública es el órgano de control.</p>
        <p className="privacidad__aviso">Esto es orientación, no asesoramiento legal.</p>
      </div>
      <button type="button" className="btn btn--ghost btn--block" onClick={onVolver}>VOLVER</button>
    </div>
  );
}

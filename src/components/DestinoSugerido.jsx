// Destino sugerido para el reclamo, según el directorio de canales de entidades. Saldo a Favor no envía nada:
// el vecino (o la Oficina) decide y lo manda por su cuenta.
export default function DestinoSugerido({ destino, quien = "vos" }) {
  if (!destino) return null;
  return (
    <div className="destino" role="note">
      <div className="destino__titulo">DESTINO SUGERIDO · {destino.nombre}</div>
      {destino.email ? (
        <p>
          Email de reclamos: <a href={`mailto:${destino.email}`}>{destino.email}</a>
        </p>
      ) : (
        <p>
          No publica un email para reclamos. {destino.canal ? `Canal: ${destino.canal}.` : ""}{" "}
          {destino.url && (
            <a href={destino.url} target="_blank" rel="noopener noreferrer">Ir al canal oficial</a>
          )}
        </p>
      )}
      {destino.plazo && <p className="destino__nota">Plazo de respuesta: {destino.plazo}.</p>}
      <p className="destino__nota">Saldo a Favor no lo envía automáticamente: lo manda {quien}.</p>
    </div>
  );
}

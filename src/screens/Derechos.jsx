import Icon from "../components/Icon.jsx";

export default function Derechos({ tipo, normas, contenido, onArmar }) {
  return (
    <div className="view view--app">
      <span className="view__kicker">PASO 3 — TUS DERECHOS</span>
      <h1>
        LA LEY ESTÁ <em>DE TU LADO</em>
      </h1>
      <p className="view__sub">{contenido.derechos.intro}</p>

      <div className="derecho" data-fuse="fade-up" data-fuse-auto>
        <div className="derecho__label">{tipo.nombre}</div>
        <p className="derecho__texto">{tipo.derecho}</p>
      </div>

      <div data-fuse-container>
        {normas.map((n) => (
          <a
            key={n.id}
            className="norma-link"
            href={n.link}
            target="_blank"
            rel="noopener noreferrer"
            data-fuse="fade-up"
            data-fuse-auto
          >
            <span>
              <b>{n.nombre}</b>
              <span>{n.articulos}</span>
            </span>
            <span className="norma-link__go">VER NORMA OFICIAL ↗</span>
          </a>
        ))}
      </div>

      <div className="log" data-fuse="fade-up" data-fuse-auto>
        <div className="log__line">{contenido.avisoLegal}</div>
      </div>

      <div className="form-group" style={{ marginTop: "1.5rem" }}>
        <button type="button" className="btn btn--primary btn--block btn--lg" onClick={onArmar}>
          ARMAR MI RECLAMO <Icon name="doc" size={16} />
        </button>
      </div>
    </div>
  );
}

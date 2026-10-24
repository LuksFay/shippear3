import Stamp from "../components/Stamp.jsx";
import Icon from "../components/Icon.jsx";

export default function Home({ contenido, onNuevo, onVerMis, onEntidad }) {
  const { hero, steps, oficina } = contenido;
  return (
    <div className="view view--wide">
      <section className="hero">
        <span className="hero__label" data-fuse="fade-up" data-fuse-auto>
          {hero.label}
        </span>
        <h1 className="hero__title hero__title--eslogan" data-fuse="brake" data-fuse-auto>
          <span className="hero__line">{hero.titleTop}</span>
          <span className="hero__line hero__line--accent">{hero.titleBottom}</span>
        </h1>
        <div className="hero__claim hero__claim--sello" data-fuse="fade-up" data-fuse-auto style={{ "--f-delay": "200ms" }}>
          <Stamp size="lg" rotate="r" data-fuse="popup" data-fuse-auto>
            {hero.stamp}
          </Stamp>
        </div>
        <p className="hero__sub" data-fuse="fade-up" data-fuse-auto style={{ "--f-delay": "300ms" }}>
          {hero.sub}
        </p>
        <div className="hero__actions" data-fuse="fade-up" data-fuse-auto style={{ "--f-delay": "400ms" }}>
          <button type="button" className="btn btn--primary btn--lg" onClick={onNuevo}>
            {hero.cta} <Icon name="arrowRight" size={16} />
          </button>
          <button type="button" className="btn btn--lg" onClick={onVerMis}>
            MIS RECLAMOS
          </button>
          {onEntidad && (
            <button type="button" className="btn btn--ghost btn--lg" onClick={onEntidad}>
              SOY DE LA OFICINA <Icon name="building" size={16} />
            </button>
          )}
        </div>
        <p className="hero__aviso" role="note">{hero.aviso}</p>
        <div className="hero__meta" data-fuse="fade-up" data-fuse-auto style={{ "--f-delay": "500ms" }}>
          <span><i />LENGUAJE SIMPLE</span>
          <span><i />NORMAS OFICIALES</span>
          <span><i />PLAZOS BCRA</span>
        </div>
      </section>

      <section className="section" aria-label="Cómo funciona">
        <div className="section__head">
          <h2>CÓMO FUNCIONA</h2>
          <span className="section__num">3 PASOS</span>
        </div>
        <div className="steps" data-fuse-container>
          {steps.map((s) => (
            <div className="step" key={s.num} data-fuse="fade-up" data-fuse-auto>
              <span className="step__num">{s.num}</span>
              <div>
                <div className="step__titulo">{s.titulo}</div>
                <p className="step__texto">{s.texto}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {oficina && (
        <section className="section oficina-landing" aria-labelledby="oficina-landing-titulo">
          <div className="section__head">
            <h2 id="oficina-landing-titulo">{oficina.titulo}</h2>
          </div>
          <p className="oficina-landing__texto">{oficina.texto}</p>
          <div className="oficina-landing__items">
            {oficina.items.map((it) => (
              <div className="oficina-landing__item" key={it.titulo}>
                <div className="step__titulo">{it.titulo}</div>
                <p className="step__texto">{it.texto}</p>
              </div>
            ))}
          </div>
          {onEntidad && (
            <button type="button" className="btn btn--lg" onClick={onEntidad}>
              {oficina.cta} <Icon name="building" size={16} />
            </button>
          )}
        </section>
      )}

      <footer className="footer">
        <div className="footer__line">
          <span>SALDO A FAVOR © 2026</span>
          <span>{contenido.motto}</span>
        </div>
      </footer>
    </div>
  );
}

import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/authTypes'
import Brand from '../components/Brand'
import Migas from '../components/Migas'
import { useTitle } from '../hooks/useTitle'
import './LandingPage.css'

// Un almuerzo de ejemplo: el plan en papel y cómo se ve en miga después de anotarlo.
const ALMUERZO = [
  { id: 'prot', name: 'Proteínas', color: 'var(--g-prot)', done: 2, total: 2 },
  { id: 'cer', name: 'Cereales', color: 'var(--g-cer)', done: 1, total: 2 },
  { id: 'gras', name: 'Grasas', color: 'var(--g-gras)', done: 1, total: 1 },
]

export default function LandingPage() {
  useTitle('Miga - Tu plan, miga a miga')
  const { token } = useAuth()

  if (token) return <Navigate to="/hoy" replace />

  return (
    <div className="land-page">
      <header className="land-nav">
        <Brand size={24} />
        <nav className="land-nav__links" aria-label="Cuenta">
          <Link to="/login" className="land-nav__login">Iniciar sesión</Link>
          <Link to="/register" className="land-btn land-btn--primary land-btn--sm">Crear cuenta</Link>
        </nav>
      </header>

      <main className="land-main">
        <section className="land-hero" aria-labelledby="land-titulo">
          <div className="land-hero__text">
            <h1 id="land-titulo" className="land-hero__title">
              Tu plan, miga a miga<span className="punto-miga">.</span>
            </h1>
            <p className="land-hero__sub">
              Cargás el plan que te dio tu nutricionista, con sus porciones e intercambios,
              y en cada comida ves qué te toca y cuánto llevás.
            </p>
            <div className="land-hero__actions">
              <Link to="/register" className="land-btn land-btn--primary">Crear cuenta gratis</Link>
              <Link to="/login" className="land-btn land-btn--secondary">Ya tengo cuenta</Link>
            </div>
          </div>

          <figure className="land-ejemplo">
            <div className="land-ejemplo__papel">
              <p className="land-ejemplo__rotulo">Tu plan en papel</p>
              <ul className="land-ejemplo__plan">
                <li>2 porciones de proteínas</li>
                <li>2 porciones de cereales</li>
                <li>1 porción de grasas</li>
                <li>Verduras libres</li>
              </ul>
            </div>
            <div className="land-ejemplo__miga">
              <p className="land-ejemplo__rotulo">El almuerzo en miga</p>
              <Migas rows={ALMUERZO} />
              <p className="land-ejemplo__nota">
                Anotaste milanesa con ensalada y una rodaja de pan: faltó 1 cereal.
              </p>
            </div>
            <figcaption className="land-ejemplo__caption">
              Cada porción de tu plan es una miga: se rellena cuando la comés.
            </figcaption>
          </figure>
        </section>

        <section className="land-detalle" aria-labelledby="land-anotar">
          <div className="land-detalle__texto">
            <h2 id="land-anotar" className="land-detalle__titulo">
              Anotás lo que comiste como se lo contarías a alguien.
            </h2>
            <p>
              Escribís "tarta de zapallitos y ensalada" o lo dictás. miga lo compara con tu plan
              y te dice si esa comida fue como el plan o qué grupo te faltó. El plan no cambia:
              eso lo decide tu nutricionista.
            </p>
          </div>
          <dl className="land-hechos">
            <div>
              <dt>Funciona aunque tu nutricionista no use apps</dt>
              <dd>Pasás el plan del papel a miga una vez, con una guía paso a paso.</dd>
            </div>
            <div>
              <dt>Porciones e intercambios, como en Uruguay</dt>
              <dd>Los mismos grupos y equivalencias que figuran en tu plan.</dd>
            </div>
            <div>
              <dt>Tus datos de salud son tuyos</dt>
              <dd>Guardamos lo mínimo, según la Ley 18.331, y podés borrar tu cuenta cuando quieras.</dd>
            </div>
          </dl>
        </section>

        <section className="land-cierre" aria-labelledby="land-empezar">
          <h2 id="land-empezar" className="land-cierre__titulo">Empezá con el plan que ya tenés.</h2>
          <p className="land-cierre__sub">Es gratis y no pide tarjeta.</p>
          <Link to="/register" className="land-btn land-btn--primary">Crear cuenta gratis</Link>
        </section>
      </main>

      <footer className="land-footer">
        <Brand size={18} />
        <div className="land-footer__right">
          <Link to="/privacidad" className="land-footer__priv">Privacidad y términos</Link>
          <p className="land-footer__copy">Hecho en Uruguay.</p>
        </div>
      </footer>
    </div>
  )
}

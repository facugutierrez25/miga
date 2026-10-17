import { useEffect } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Brand from '../components/Brand'
import './LandingPage.css'

function useScrollReveal() {
  useEffect(() => {
    const io = new IntersectionObserver(
      entries =>
        entries.forEach(e => {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible')
            io.unobserve(e.target)
          }
        }),
      { threshold: 0.1 }
    )
    document.querySelectorAll('[data-reveal]').forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [])
}

function PhoneMockup() {
  return (
    <div className="phone-wrap">
      <div className="phone">
        <div className="phone__pill" />
        <div className="phone__screen">
          <div className="pscreen__header">
            <span className="pscreen__brand">miga</span>
            <span className="pscreen__date">Viernes, 17 de oct.</span>
          </div>
          <div className="pscreen__greeting">Buenos días, María.</div>
          <div className="pscreen__cards">
            <div className="pscreen__card">
              <span className="pscreen__meal">Desayuno</span>
              <div className="pscreen__badges">
                <span className="pbadge pbadge--prot">2 Proteínas</span>
                <span className="pbadge pbadge--cer">2 Cereales</span>
                <span className="pbadge pbadge--frut">1 Frutas</span>
              </div>
            </div>
            <div className="pscreen__card">
              <span className="pscreen__meal">Almuerzo</span>
              <div className="pscreen__badges">
                <span className="pbadge pbadge--prot">1 Proteínas</span>
                <span className="pbadge pbadge--verd">3 Verduras</span>
                <span className="pbadge pbadge--cer">0.5 Cereales</span>
              </div>
            </div>
            <div className="pscreen__card">
              <span className="pscreen__meal">Merienda</span>
              <div className="pscreen__badges">
                <span className="pbadge pbadge--cer">2 Cereales</span>
                <span className="pbadge pbadge--lac">1 Lácteos</span>
              </div>
            </div>
            <div className="pscreen__card">
              <span className="pscreen__meal">Cena</span>
              <div className="pscreen__badges">
                <span className="pbadge pbadge--prot">1 Proteínas</span>
                <span className="pbadge pbadge--verd">3 Verduras</span>
                <span className="pbadge pbadge--gras">1 Grasas</span>
              </div>
            </div>
          </div>
        </div>
        <div className="phone__home" />
      </div>
    </div>
  )
}

export default function LandingPage() {
  const { token } = useAuth()
  useScrollReveal()

  if (token) return <Navigate to="/hoy" replace />

  return (
    <div className="land-page">

      {/* ── Nav ── */}
      <header className="land-nav">
        <Brand size={22} />
        <nav className="land-nav__links">
          <Link to="/login" className="land-nav__login">Iniciar sesión</Link>
          <Link to="/register" className="land-nav__cta">Crear cuenta</Link>
        </nav>
      </header>

      {/* ── Hero ── */}
      <div className="land-hero-wrap">
        <div className="land-hero__bg" aria-hidden="true">
          <span className="land-orb land-orb--prot" />
          <span className="land-orb land-orb--cer" />
          <span className="land-orb land-orb--frut" />
          <span className="land-orb land-orb--verd" />
          <span className="land-orb land-orb--lac" />
        </div>
        <section className="land-hero">
          <div className="land-hero__text">
            <h1 className="land-hero__title">
              Cumplí el plan<br />
              de tu<br />
              nutricionista.
            </h1>
            <p className="land-hero__sub">
              Cargá el plan que te dio tu nutricionista y organizá cada comida sin esfuerzo.
              Sin apps extras. Sin papel.
            </p>
            <div className="land-hero__actions">
              <Link to="/register" className="land-btn-primary">Crear cuenta gratis</Link>
              <Link to="/login" className="land-btn-ghost">Ya tengo cuenta</Link>
            </div>
          </div>
          <div className="land-hero__mockup">
            <PhoneMockup />
          </div>
        </section>
      </div>

      {/* ── Features ── */}
      <section className="land-features">
        <div className="land-section-inner">
          <p className="land-section-label" data-reveal>Qué hace miga</p>
          <h2 className="land-section-title" data-reveal>Diseñado para el día a día del paciente</h2>
          <div className="land-features__grid">
            <div className="land-feature" data-reveal data-delay="0">
              <div className="land-feature__dot land-feature__dot--hoy" />
              <h3 className="land-feature__title">Tu plan, cada día</h3>
              <p className="land-feature__desc">
                Cada mañana sabés exactamente qué comer en cada comida: cuántas porciones de cada grupo alimenticio.
              </p>
            </div>
            <div className="land-feature" data-reveal data-delay="1">
              <div className="land-feature__dot land-feature__dot--plan" />
              <h3 className="land-feature__title">Porciones e intercambios</h3>
              <p className="land-feature__desc">
                Trabajamos con el sistema de porciones que usán los nutricionistas en Uruguay. Tu plan, tal cual te lo dieron.
              </p>
            </div>
            <div className="land-feature" data-reveal data-delay="2">
              <div className="land-feature__dot land-feature__dot--semana" />
              <h3 className="land-feature__title">Sin apps del profesional</h3>
              <p className="land-feature__desc">
                Tu nutricionista no necesita usar ninguna app. Vos cargás el plan y listo. Funciona desde el día uno.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Cómo funciona ── */}
      <section className="land-steps">
        <div className="land-section-inner">
          <p className="land-section-label" data-reveal>Cómo funciona</p>
          <h2 className="land-section-title" data-reveal>Tres pasos para empezar</h2>
          <div className="land-steps__list">
            <div className="land-step" data-reveal data-delay="0">
              <span className="land-step__num">1</span>
              <div className="land-step__body">
                <h3 className="land-step__title">Cargá tu plan</h3>
                <p className="land-step__desc">
                  Tenés el papel o la foto del plan de tu nutricionista. En minutos lo pasás a la app con nuestra guía.
                </p>
              </div>
            </div>
            <div className="land-step" data-reveal data-delay="1">
              <span className="land-step__num">2</span>
              <div className="land-step__body">
                <h3 className="land-step__title">Revisá tu día</h3>
                <p className="land-step__desc">
                  Cada día ves de un vistazo qué comer en cada comida: desayuno, almuerzo, merienda y cena.
                </p>
              </div>
            </div>
            <div className="land-step" data-reveal data-delay="2">
              <span className="land-step__num">3</span>
              <div className="land-step__body">
                <h3 className="land-step__title">Seguí tu semana</h3>
                <p className="land-step__desc">
                  Próximamente: vista semanal, menú de recetas y lista de compras con precios de supermercados uruguayos.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="land-cta">
        <div className="land-section-inner land-cta__inner" data-reveal>
          <div className="land-cta__badges">
            <span className="land-cta__badge land-cta__badge--prot" />
            <span className="land-cta__badge land-cta__badge--cer" />
            <span className="land-cta__badge land-cta__badge--frut" />
            <span className="land-cta__badge land-cta__badge--verd" />
            <span className="land-cta__badge land-cta__badge--lac" />
            <span className="land-cta__badge land-cta__badge--gras" />
          </div>
          <h2 className="land-cta__title">Empezá hoy.</h2>
          <p className="land-cta__sub">Gratis. Sin tarjeta de crédito.</p>
          <Link to="/register" className="land-btn-primary land-btn-primary--lg">Crear cuenta gratis</Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="land-footer">
        <Brand size={18} />
        <div className="land-footer__right">
          <Link to="/privacidad" className="land-footer__priv">Privacidad y términos</Link>
          <p className="land-footer__copy">Hecho con cuidado en Uruguay.</p>
        </div>
      </footer>

    </div>
  )
}

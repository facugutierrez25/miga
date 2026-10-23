import { Link } from 'react-router-dom'
import Brand from '../components/Brand'
import { useTitle } from '../hooks/useTitle'
import './PrivacidadPage.css'

export default function PrivacidadPage() {
  useTitle('Privacidad | Miga')
  return (
    <div className="priv-page">

      <header className="land-nav">
        <Brand size={22} />
        <nav className="land-nav__links">
          <Link to="/login" className="land-nav__login">Iniciar sesión</Link>
          <Link to="/register" className="land-nav__cta">Crear cuenta</Link>
        </nav>
      </header>

      <main className="priv-main">
        <div className="priv-inner">

          <div className="priv-hero">
            <p className="priv-hero__updated">Actualizado: octubre 2026</p>
            <h1 className="priv-hero__title">Privacidad y términos</h1>
            <p className="priv-hero__sub">
              Miga es un proyecto personal. Tratamos tus datos con el mínimo necesario,
              los protegemos con las mejores prácticas disponibles y nunca los vendemos ni compartimos.
            </p>
          </div>

          <section className="priv-section">
            <h2 className="priv-section__title">Qué datos guardamos</h2>
            <div className="priv-section__body">
              <p>Solo recopilamos lo estrictamente necesario para que la app funcione:</p>
              <ul className="priv-list">
                <li><strong>Email</strong> — para identificarte y que puedas iniciar sesión.</li>
                <li><strong>Contraseña</strong> — almacenada con hash bcrypt. Nunca se guarda ni se transmite en texto plano.</li>
                <li><strong>Tu plan nutricional</strong> — las comidas, porciones e intercambios que vos cargás voluntariamente.</li>
              </ul>
              <p>No recopilamos datos biométricos, historial médico, información de pago ni datos de geolocalización.</p>
            </div>
          </section>

          <section className="priv-section">
            <h2 className="priv-section__title">Cómo protegemos tu información</h2>
            <div className="priv-section__body">
              <ul className="priv-list">
                <li>Todas las comunicaciones entre tu dispositivo y nuestros servidores usan <strong>HTTPS</strong> (cifrado en tránsito).</li>
                <li>Los datos se almacenan en servidores con <strong>cifrado en reposo</strong>.</li>
                <li>Las contraseñas se hashean con <strong>bcrypt</strong> y son irrecuperables, incluso para nosotros.</li>
                <li><strong>No compartimos</strong> tus datos con terceros con fines comerciales ni publicitarios.</li>
              </ul>
            </div>
          </section>

          <section className="priv-section">
            <h2 className="priv-section__title">Deslinde de responsabilidad</h2>
            <div className="priv-section__body">
              <p>
                Miga es una <strong>herramienta de apoyo</strong>, no un servicio médico ni nutricional.
                La app no interpreta, modifica ni valida el plan nutricional: lo que cargás es exactamente
                lo que se muestra.
              </p>
              <p>
                La responsabilidad del contenido del plan —sus indicaciones, porciones y equivalencias—
                es exclusiva del profesional que lo emitió. Ante cualquier duda sobre tu plan,
                consultá con tu nutricionista.
              </p>
            </div>
          </section>

          <section className="priv-section">
            <h2 className="priv-section__title">Tus derechos (Ley 18.331)</h2>
            <div className="priv-section__body">
              <p>
                De acuerdo con la Ley 18.331 de Protección de Datos Personales de Uruguay, tenés derecho a:
              </p>
              <ul className="priv-list">
                <li><strong>Acceso</strong> — saber qué datos tuyos tenemos guardados.</li>
                <li><strong>Rectificación</strong> — corregir datos incorrectos o desactualizados.</li>
                <li><strong>Cancelación</strong> — solicitar el borrado de tu cuenta y todos tus datos.</li>
                <li><strong>Oposición</strong> — oponerte al tratamiento de tus datos en cualquier momento.</li>
              </ul>
              <p>
                Para ejercer cualquiera de estos derechos, escribinos a{' '}
                <a href="mailto:hola@miga.uy" className="priv-link">hola@miga.uy</a>.
              </p>
            </div>
          </section>

          <section className="priv-section">
            <h2 className="priv-section__title">Eliminación de cuenta</h2>
            <div className="priv-section__body">
              <p>
                Podés solicitar la eliminación de tu cuenta y todos tus datos en cualquier momento
                escribiéndonos a{' '}
                <a href="mailto:hola@miga.uy" className="priv-link">hola@miga.uy</a>.
                Procesamos la solicitud dentro de los 10 días hábiles siguientes.
              </p>
            </div>
          </section>

          <section className="priv-section">
            <h2 className="priv-section__title">Cambios en esta política</h2>
            <div className="priv-section__body">
              <p>
                Si realizamos cambios relevantes, te lo comunicamos por email con al menos 14 días
                de anticipación. La fecha de actualización al inicio de esta página siempre refleja
                la versión vigente.
              </p>
            </div>
          </section>

          <section className="priv-section priv-section--last">
            <h2 className="priv-section__title">Contacto</h2>
            <div className="priv-section__body">
              <p>
                Cualquier consulta sobre privacidad o términos la podés enviar a{' '}
                <a href="mailto:hola@miga.uy" className="priv-link">hola@miga.uy</a>.
              </p>
            </div>
          </section>

        </div>
      </main>

      <footer className="land-footer">
        <Brand size={18} />
        <div className="land-footer__right">
          <Link to="/" className="land-footer__priv">Inicio</Link>
          <p className="land-footer__copy">Hecho con cuidado en Uruguay.</p>
        </div>
      </footer>

    </div>
  )
}

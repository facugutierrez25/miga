import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/authTypes'
import Brand from '../components/Brand'
import Miga from '../components/Miga'
import { useTitle } from '../hooks/useTitle'
import { LandingDemo, LandingHabits, StampGrid } from './landing/LandingExamples'
import './LandingPage.css'

export default function LandingPage() {
  useTitle('Miga - Anotá lo que comiste')
  const { token } = useAuth()
  const location = useLocation()
  if (token) return <Navigate to="/hoy" replace />
  return <div className="land-page"><header className="land-container land-nav">
  <Brand />
  <div><Link className="land-login" to="/login">Iniciar sesión</Link><Link className="land-button land-button--primary land-button--small" to="/register">Crear cuenta</Link></div>
</header>

<main>
{location.state?.accountDeleted === true && <p role="status" className="land-container">Tu cuenta y todos tus datos fueron eliminados. Se cerró tu sesión.</p>}
  <div className="land-container land-hero">
    <div className="land-hero__text">
      <h1>Anotá lo que comiste. Miga te dice cómo vas con tu plan<b>.</b></h1>
      <p className="land-lead">Cargás una vez el plan que te dio tu nutricionista. Después escribís «milanesa con ensalada», como se lo contarías a alguien, y ves qué faltó o qué sobró.</p>
      <div className="land-hero__actions"><Link className="land-button land-button--primary" to="/register">Crear cuenta</Link></div>
    </div>

    <LandingDemo />
  </div>

  <section className="land-container" aria-labelledby="landing-steps">
    <div className="land-heading"><h2 id="landing-steps">Tres cosas, y la primera se hace una sola vez.</h2></div>
    <ol className="land-steps">
      <li className="land-step">
        <div className="land-step__visual">
          <p className="land-paper">Almuerzo<br />1 proteína · 1 cereal<br />1 grasa · 2 verduras</p>
          <span className="land-arrow">pasa a ser</span>
          <p className="land-portions"><span><i className="land-dot land-dot--protein" aria-hidden="true"></i>1 Proteínas</span><span><i className="land-dot land-dot--grain" aria-hidden="true"></i>1 Cereales</span><span><i className="land-dot land-dot--fat" aria-hidden="true"></i>1 Grasas</span><span><i className="land-dot land-dot--vegetable" aria-hidden="true"></i>2 Verduras</span></p>
        </div>
        <h3>Pasás tu plan del papel</h3>
        <p>Las comidas y las porciones de cada grupo, tal como te las dieron. Una guía te lleva paso a paso, y tu nutricionista no tiene que usar ninguna app.</p>
      </li>
      <li className="land-step">
        <div className="land-step__visual">
          <div className="land-input">tarta de zapallitos y ensalada<i></i></div>
          <span className="land-muted land-small">o lo dictás, o tocás lo de siempre</span>
        </div>
        <h3>Anotás como hablás</h3>
        <p>Sin buscar alimentos en una lista ni pesar nada. Lo que comés seguido queda a un toque.</p>
      </li>
      <li className="land-step">
        <div className="land-step__visual">
          <ul className="land-states">
            <li><Miga aspect="full" />Como el plan</li>
            <li><Miga aspect="half" />Faltó 1 porción de Verduras</li>
            <li><Miga aspect="flexible" />Comida flexible</li>
          </ul>
        </div>
        <h3>Ves cómo vas</h3>
        <p>Cada comida es una miga: llena si salió como el plan, a medias si faltó o sobró algo. Y siempre te dice qué.</p>
      </li>
    </ol>
  </section>

  <section className="land-container land-week" aria-labelledby="landing-week">
    <div className="land-week__text">
      <h2 id="landing-week">Tu semana entra en una tarjeta.</h2>
      <p className="land-lead">Una fila por comida y una columna por día. De un vistazo ves qué días salieron como el plan y en qué comida se te complica.</p>
      <div className="land-export">
        <h3>Y el día de la consulta, se la llevás a tu nutri.</h3>
        <p>Descargás la semana en Excel o PDF, con lo que escribiste en cada comida. La mandás vos: Miga no la comparte con nadie.</p>
      </div>
    </div>
    <div>
      <p className="land-summary" ><strong className="land-number">19<small> de 28</small></strong><span className="land-muted land-small">comidas como el plan esta semana</span></p>
      <div className="land-card land-stamps" role="img" aria-label="Tarjeta de la semana: una miga por comida y por día. 19 de 28 comidas salieron como el plan."><StampGrid /></div>
      <ul className="land-legend" aria-hidden="true"><li><Miga aspect="full" />Como el plan</li><li><Miga aspect="half" />Faltó o sobró algo</li><li><Miga aspect="flexible" />Flexible</li><li><Miga aspect="empty" />Sin anotar</li></ul>
    </div>
  </section>

  <section className="land-container land-habits" aria-labelledby="landing-habits">
    <LandingHabits />
    <div className="land-habits__text">
      <h2 id="landing-habits">Tus hábitos también se anotan.</h2>
      <p className="land-lead">Cargás los que te marcó tu nutricionista, cada uno con su meta, y los anotás con un toque. Estos dos son de ejemplo: tocá las migas.</p>
    </div>
  </section>

  <section className="land-limits" aria-labelledby="landing-limits">
    <div className="land-container">
      <h2 id="landing-limits">Lo que Miga no hace<span className="land-period">.</span></h2>
      <ul>
        <li><strong>No arma dietas ni cambia tu plan.</strong><span>Eso lo decide tu nutricionista. Miga solo te ayuda a cumplir lo que ya te indicó.</span></li>
        <li><strong>No cuenta calorías.</strong><span>Trabaja con porciones e intercambios, como los planes de acá.</span></li>
        <li><strong>No te reta.</strong><span>Te muestra el dato, «Faltó 1 porción de verduras», y cómo lo entendió.</span></li>
        <li><strong>No hace nada con tus datos.</strong><span>Guardamos lo mínimo, según la Ley 18.331, y podés borrar tu cuenta cuando quieras.</span></li>
      </ul>
    </div>
  </section>

  <section className="land-container" aria-labelledby="landing-origin">
    <figure className="land-origin">
      <h2 id="landing-origin" className="land-small land-muted" >Por qué existe</h2>
      <blockquote>Mi nutricionista me pedía anotar cada comida en una planilla. Anotar era fácil. Saber cómo venía con el plan, no. Miga es esa planilla, un paso más allá.</blockquote>
      <figcaption>Facu, que hace Miga en Uruguay.</figcaption>
    </figure>
  </section>

  <div className="land-container land-closing">
    <h2>Empezá con el plan que ya tenés<span className="land-period">.</span></h2>
    <p className="land-lead">Lo cargás hoy y mañana ya anotás el desayuno.</p>
    <Link className="land-button land-button--primary" to="/register">Crear cuenta</Link>
  </div>
</main>

<footer><div className="land-container"><Brand /><span><Link to="/privacidad">Privacidad y términos</Link> · Hecho en Uruguay.</span></div></footer>

</div>
}

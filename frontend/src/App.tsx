import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { useAuth } from './auth/authTypes'
import AppLayout from './components/AppLayout'
import LandingPage from './pages/LandingPage'
import RegisterPage from './pages/RegisterPage'
import LoginPage from './pages/LoginPage'
import HoyPage from './pages/HoyPage'
import SemanaPage from './pages/SemanaPage'
import PerfilPage from './pages/PerfilPage'
import MiPlanPage from './pages/MiPlanPage'
import OnboardingPage from './pages/OnboardingPage'
import PrivacidadPage from './pages/PrivacidadPage'
import VerificarEmailPage from './pages/VerificarEmailPage'
import ScrollToTop from './components/ScrollToTop'

function AuthLayout() {
  const { token } = useAuth()
  if (!token) return <Navigate to="/" replace />
  return <AppLayout />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/privacidad" element={<PrivacidadPage />} />
          <Route path="/verificar-email" element={<VerificarEmailPage />} />
          <Route element={<AuthLayout />}>
            <Route path="/hoy" element={<HoyPage />} />
            <Route path="/semana" element={<SemanaPage />} />
            <Route path="/perfil" element={<PerfilPage />} />
            <Route path="/mi-plan" element={<MiPlanPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

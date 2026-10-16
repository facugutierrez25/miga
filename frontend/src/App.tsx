import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { useAuth } from './auth/AuthContext'
import AppLayout from './components/AppLayout'
import RegisterPage from './pages/RegisterPage'
import LoginPage from './pages/LoginPage'
import HoyPage from './pages/HoyPage'
import SemanaPage from './pages/SemanaPage'
import ComprasPage from './pages/ComprasPage'
import PerfilPage from './pages/PerfilPage'
import MiPlanPage from './pages/MiPlanPage'
import OnboardingPage from './pages/OnboardingPage'

function AuthLayout() {
  const { token } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  return <AppLayout />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AuthLayout />}>
            <Route path="/hoy" element={<HoyPage />} />
            <Route path="/semana" element={<SemanaPage />} />
            <Route path="/compras" element={<ComprasPage />} />
            <Route path="/perfil" element={<PerfilPage />} />
            <Route path="/mi-plan" element={<MiPlanPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/hoy" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

import { lazy, Suspense } from 'react'
import { LoadingSkeleton } from './components/Skeleton'
import { createBrowserRouter, createRoutesFromElements, RouterProvider, Outlet, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { useAuth } from './auth/authTypes'
import AppLayout from './components/AppLayout'
import LandingPage from './pages/LandingPage'
import ScrollToTop from './components/ScrollToTop'

const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const HoyPage = lazy(() => import('./pages/HoyPage'))
const SemanaPage = lazy(() => import('./pages/SemanaPage'))
const PerfilPage = lazy(() => import('./pages/PerfilPage'))
const MiPlanPage = lazy(() => import('./pages/MiPlanPage'))
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'))
const PrivacidadPage = lazy(() => import('./pages/PrivacidadPage'))
const VerificarEmailPage = lazy(() => import('./pages/VerificarEmailPage'))

function AuthLayout() {
  const { token, restoring } = useAuth()
  if (!token && restoring) return <main className="app-restoring" aria-busy="true" aria-label="Abriendo tu sesión" />
  if (!token) return <Navigate to="/" replace />
  return <AppLayout />
}

const router = createBrowserRouter(createRoutesFromElements(
  <Route element={<><ScrollToTop /><Suspense fallback={<LoadingSkeleton label="Cargando…" />}><Outlet /></Suspense></>}>
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
  </Route>
))

export default function App() {
  return <AuthProvider><RouterProvider router={router} /></AuthProvider>
}

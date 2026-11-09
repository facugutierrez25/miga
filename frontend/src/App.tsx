import React, { lazy, Suspense } from 'react'
import { LoadingSkeleton } from './components/Skeleton'
import { createBrowserRouter, createRoutesFromElements, RouterProvider, Outlet, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { useAuth } from './auth/authTypes'
import AppLayout from './components/AppLayout'
import LandingPage from './pages/LandingPage'
import ScrollToTop from './components/ScrollToTop'

const RELOAD_KEY = 'miga-chunk-reload'

// Una pestaña abierta antes de un deploy puede pedir un archivo que ya no existe: se recarga una vez.
function lazyPage<T extends { default: React.ComponentType }>(load: () => Promise<T>) {
  return lazy(async () => {
    try {
      const page = await load()
      try { sessionStorage.removeItem(RELOAD_KEY) } catch { /* sin almacenamiento */ }
      return page
    } catch (error) {
      let reloaded = true
      try {
        reloaded = sessionStorage.getItem(RELOAD_KEY) === '1'
        if (!reloaded) sessionStorage.setItem(RELOAD_KEY, '1')
      } catch { /* sin almacenamiento */ }
      if (reloaded) throw error
      window.location.reload()
      return new Promise<T>(() => {})
    }
  })
}
const RegisterPage = lazyPage(() => import('./pages/RegisterPage'))
const LoginPage = lazyPage(() => import('./pages/LoginPage'))
const HoyPage = lazyPage(() => import('./pages/HoyPage'))
const SemanaPage = lazyPage(() => import('./pages/SemanaPage'))
const PerfilPage = lazyPage(() => import('./pages/PerfilPage'))
const MiPlanPage = lazyPage(() => import('./pages/MiPlanPage'))
const OnboardingPage = lazyPage(() => import('./pages/OnboardingPage'))
const PrivacidadPage = lazyPage(() => import('./pages/PrivacidadPage'))
const VerificarEmailPage = lazyPage(() => import('./pages/VerificarEmailPage'))

function AuthLayout() {
  const { token, restoring } = useAuth()
  if (!token && restoring) return <main className="app-restoring" aria-busy="true" aria-label="Abriendo tu sesión" />
  if (!token) return <Navigate to="/" replace />
  return <AppLayout />
}

const router = createBrowserRouter(createRoutesFromElements(
  <Route element={<Suspense fallback={<LoadingSkeleton label="Cargando…" />}><ScrollToTop /><Outlet /></Suspense>}>
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

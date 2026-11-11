import React, { lazy, Suspense } from 'react'
import { LoadingSkeleton } from './components/Skeleton'
import { createBrowserRouter, createRoutesFromElements, RouterProvider, Outlet, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { useAuth } from './auth/authTypes'
import AppLayout from './components/AppLayout'
import LandingPage from './pages/LandingPage'
import ScrollToTop from './components/ScrollToTop'
import SearchMetadata from './components/SearchMetadata'

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
const TodayPage = lazyPage(() => import('./pages/TodayPage'))
const WeekPage = lazyPage(() => import('./pages/WeekPage'))
const ProfilePage = lazyPage(() => import('./pages/ProfilePage'))
const MyPlanPage = lazyPage(() => import('./pages/MyPlanPage'))
const OnboardingPage = lazyPage(() => import('./pages/OnboardingPage'))
const PrivacyPage = lazyPage(() => import('./pages/PrivacyPage'))
const VerifyEmailPage = lazyPage(() => import('./pages/VerifyEmailPage'))

function AuthLayout() {
  const { token, restoring } = useAuth()
  if (!token && restoring) return <main className="app-restoring" aria-busy="true" aria-label="Abriendo tu sesión" />
  if (!token) return <Navigate to="/" replace />
  return <AppLayout />
}

const router = createBrowserRouter(createRoutesFromElements(
  <Route element={<Suspense fallback={<LoadingSkeleton label="Cargando…" />}><ScrollToTop /><SearchMetadata /><Outlet /></Suspense>}>
    <Route path="/" element={<LandingPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/privacidad" element={<PrivacyPage />} />
    <Route path="/verificar-email" element={<VerifyEmailPage />} />
    <Route element={<AuthLayout />}>
      <Route path="/hoy" element={<TodayPage />} />
      <Route path="/semana" element={<WeekPage />} />
      <Route path="/perfil" element={<ProfilePage />} />
      <Route path="/mi-plan" element={<MyPlanPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Route>
))

export default function App() {
  return <AuthProvider><RouterProvider router={router} /></AuthProvider>
}

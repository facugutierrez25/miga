import { Suspense } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from './auth/authTypes'
import LandingPage from './pages/LandingPage'

export function render() {
  return renderToString(<AuthContext.Provider value={{ token: null, email: null, firstName: null, sessionExpired: false, restoring: true, login() {}, logout() {}, setFirstName() {} }}>
    <MemoryRouter initialEntries={['/']}><Suspense><LandingPage /></Suspense></MemoryRouter>
  </AuthContext.Provider>)
}

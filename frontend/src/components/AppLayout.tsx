import React from 'react'
import { Link, Outlet, useMatch } from 'react-router-dom'
import './AppLayout.css'

function IcHoy() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  )
}

function IcSemana() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  )
}

function IcCompras() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 6h18M16 10a4 4 0 0 1-8 0" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  )
}

function IcPerfil() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2.2"/>
      <path d="M4 20c0-4 3.58-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  )
}

const NAV_ITEMS = [
  { to: '/hoy',      label: 'Hoy',     Icon: IcHoy     },
  { to: '/semana',   label: 'Semana',   Icon: IcSemana  },
  { to: '/compras',  label: 'Compras',  Icon: IcCompras },
  { to: '/perfil',   label: 'Perfil',   Icon: IcPerfil  },
]

function NavItem({ to, label, Icon }: { to: string; label: string; Icon: () => React.ReactElement }) {
  const match = useMatch({ path: to, end: false })
  const active = !!match
  return (
    <Link
      to={to}
      className={`nav-item${active ? ' nav-item--active' : ''}`}
      aria-current={active ? 'page' : undefined}
    >
      <Icon />
      <span className="nav-item__label">{label}</span>
    </Link>
  )
}

export default function AppLayout() {
  return (
    <div className="app-layout">
      <main className="app-layout__main">
        <Outlet />
      </main>
      <nav className="app-nav" aria-label="Navegación principal">
        {NAV_ITEMS.map(item => (
          <NavItem key={item.to} {...item} />
        ))}
      </nav>
    </div>
  )
}

import React, { useState } from 'react'
import { Link, Outlet, useMatch } from 'react-router-dom'
import Brand from './Brand'
import './AppLayout.css'

function IcHoy() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  )
}

function IcSemana() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  )
}

function IcCompras() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 6h18M16 10a4 4 0 0 1-8 0" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  )
}

function IcPlan() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="9" y="3" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9 12h6M9 16h4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  )
}

function IcPerfil() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2.2"/>
      <path d="M4 20c0-4 3.58-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  )
}

function IcMenu() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M2.5 4.5h13M2.5 9h13M2.5 13.5h13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  )
}

const NAV_ITEMS = [
  { to: '/hoy',     label: 'Hoy',     Icon: IcHoy     },
  { to: '/semana',  label: 'Semana',  Icon: IcSemana  },
  { to: '/compras', label: 'Compras', Icon: IcCompras },
  { to: '/mi-plan', label: 'Mi plan', Icon: IcPlan    },
  { to: '/perfil',  label: 'Perfil',  Icon: IcPerfil  },
]

function NavItem({ to, label, Icon }: { to: string; label: string; Icon: () => React.ReactElement }) {
  const match = useMatch({ path: to, end: false })
  const active = !!match
  return (
    <Link
      to={to}
      className={`nav-item${active ? ' nav-item--active' : ''}`}
      aria-current={active ? 'page' : undefined}
      title={label}
    >
      <Icon />
      <span className="nav-item__label">{label}</span>
    </Link>
  )
}

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('nav-collapsed') === 'true'
  )

  function toggleNav() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('nav-collapsed', String(next))
  }

  return (
    <div className={`app-layout${collapsed ? ' app-layout--collapsed' : ''}`}>
      <div className="app-body">

        <nav className="app-nav" aria-label="Navegación principal">
          {/* Brand + toggle — solo visible en desktop */}
          <div className="app-nav__brand">
            <Brand size={20} />
            <button
              className="app-nav__toggle"
              onClick={toggleNav}
              aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
            >
              <IcMenu />
            </button>
          </div>

          <div className="app-nav__items">
            {NAV_ITEMS.map(item => (
              <NavItem key={item.to} {...item} />
            ))}
          </div>
        </nav>

        <main className="app-layout__main">
          <Outlet />
        </main>

      </div>
    </div>
  )
}

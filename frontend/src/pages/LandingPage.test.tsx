import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import LandingPage from './LandingPage'
const auth = vi.hoisted(() => ({ token: null as string | null }))
vi.mock('../auth/authTypes', () => ({ useAuth: () => auth }))
afterEach(() => { auth.token = null; vi.unstubAllGlobals() })
function show(state?: object) { return render(<MemoryRouter initialEntries={[{ pathname: '/', state }]}><Routes><Route path="/" element={<LandingPage />} /><Route path="/hoy" element={<p>Hoy autenticado</p>} /></Routes></MemoryRouter>) }
test.each([
 ['Milanesa con ensalada', 'half', 'Faltó algo', 'Milanesa: 1 Proteínas y 1 Cereales. Ensalada: 2 Verduras.'],
 ['Pollo con arroz, ensalada y aceite de oliva', 'full', 'Como el plan', 'Pollo: 1 Proteínas. Arroz: 1 Cereales. Ensalada: 2 Verduras. Aceite: 1 Grasas.'],
 ['Pizza con amigos', 'flexible', 'Flexible', 'Pizza cuenta como comida flexible: se anota y no se compara con el plan.'],
])('prueba %s y permite reiniciar', (text, aspect, label, understood) => {
 const { container } = show()
 fireEvent.click(screen.getByRole('button', { name: text }))
 const panel = container.querySelector('[aria-live="polite"]')!
 expect(panel).toHaveTextContent(label)
 expect(panel).toHaveTextContent(`Así lo entendí: ${understood}`)
 expect(container.querySelectorAll('.land-strip .meal-crumb')[1]).toHaveClass(`meal-crumb--${aspect}`)
 if (aspect === 'half') expect(panel).toHaveTextContent('Faltó 1 porción de Grasas')
 else expect(panel.querySelector('.land-difference')).toBeNull()
 fireEvent.click(screen.getByRole('button', { name: 'Probar con otra comida' }))
 expect(container.querySelectorAll('.land-options button')).toHaveLength(3)
 expect(container.querySelectorAll('.land-strip .meal-crumb')[1]).toHaveClass('meal-crumb--empty')
})
test('comparte las reglas de hábitos de Hoy y permite superar la meta', () => {
 show()
 fireEvent.click(screen.getByRole('button', { name: 'Agua: 1,5 Lt' }))
 expect(screen.getByText('1,5 de 2 Lt')).toBeInTheDocument()
 fireEvent.click(screen.getByRole('button', { name: 'Agua: 2 Lt' }))
 fireEvent.click(screen.getByRole('button', { name: 'Sumar 0,5 Lt a Agua' }))
 expect(screen.getByText('2,5 de 2 Lt')).toBeInTheDocument()
 expect(screen.getByText('+1')).toBeInTheDocument()
 fireEvent.click(screen.getByRole('button', { name: 'Entrenamiento: Hecho' }))
 expect(screen.getByText('Hecho')).toBeInTheDocument()
 fireEvent.click(screen.getByRole('button', { name: 'Entrenamiento: Sin hacer' }))
 expect(screen.queryByText('Hecho')).not.toBeInTheDocument()
})
test('conserva contenido, accesibilidad, enlaces y no llama a la API', () => {
 const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
 const { container } = show({ accountDeleted: true })
 expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
 expect(document.title).toBe('Miga - Anotá lo que comiste')
 expect(screen.getByRole('status')).toHaveTextContent('Se cerró tu sesión')
 for (const link of screen.getAllByRole('link', { name: 'Crear cuenta' })) expect(link).toHaveAttribute('href', '/register')
 expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/login')
 expect(screen.getByRole('link', { name: 'Privacidad y términos' })).toHaveAttribute('href', '/privacidad')
 expect(container.textContent).not.toMatch(/gratis|sin tarjeta|Ya tengo cuenta/i)
 expect(container.querySelector('.land-strip')).toHaveAttribute('aria-hidden', 'true')
 expect(screen.getByRole('img', { name: /Tarjeta de la semana/ })).toBeInTheDocument()
 fireEvent.click(screen.getByRole('button', { name: 'Pizza con amigos' }))
 fireEvent.click(screen.getByRole('button', { name: 'Sumar 0,5 Lt a Agua' }))
 expect(fetch).not.toHaveBeenCalled()
})
test('redirige a Hoy con sesión', () => { auth.token = 'sesión'; show(); expect(screen.getByText('Hoy autenticado')).toBeInTheDocument() })

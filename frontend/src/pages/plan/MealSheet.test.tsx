import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import MealSheet from './MealSheet'

const groups = [
  { id: 1, name: 'Cereales', abbreviation: 'CER', displayOrder: 1, color: '#123456' },
  { id: 2, name: 'Frutas', abbreviation: 'FRU', displayOrder: 2, color: '#654321' },
]
function setup(portions = { 1: 2, 2: 0 }, isNew = false) {
  const props = {
    meal: { name: isNew ? '' : 'Desayuno', time: '08:00', weekdays: [1, 3], portions },
    groups, isNew, busy: false, error: null, conflict: false,
    onReload: vi.fn(), onClose: vi.fn(), onSave: vi.fn(), onDelete: vi.fn(), onDirtyChange: vi.fn(),
  }
  render(<MealSheet {...props} />)
  return props
}
test('edita nombre, hora, medias porciones y los días de la comida', () => {
  const props = setup()
  fireEvent.change(screen.getByLabelText('Nombre de la comida'), { target: { value: 'Merienda' } })
  fireEvent.change(screen.getByLabelText('Hora sugerida'), { target: { value: '17:00' } })
  fireEvent.click(screen.getByRole('button', { name: 'Martes' }))
  fireEvent.click(screen.getByRole('button', { name: 'Aumentar Cereales' }))
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  expect(props.onSave).toHaveBeenCalledWith({ name: 'Merienda', time: '17:00', weekdays: [1, 2, 3], portions: { 1: 2.5, 2: 0 } })
})
test('el tope de 12 deshabilita todos los aumentos y reducir los habilita', () => {
  setup({ 1: 10, 2: 2 })
  expect(screen.getByText('12 de 12')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Aumentar Cereales' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Aumentar Frutas' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Reducir Frutas' }))
  fireEvent.click(screen.getByRole('button', { name: 'Reducir Frutas' }))
  expect(screen.getByRole('button', { name: 'Aumentar Frutas' })).toBeEnabled()
})
test('cerrar, Escape y fondo conservan el borrador hasta confirmar descarte', () => {
  const props = setup()
  fireEvent.change(screen.getByLabelText('Nombre de la comida'), { target: { value: 'Otro' } })
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
  expect(props.onClose).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Seguir editando' }))
  expect(screen.getByDisplayValue('Otro')).toBeInTheDocument()
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  expect(props.onClose).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Descartar cambios' }))
  expect(props.onClose).toHaveBeenCalledOnce()
})
test('cerrar sin cambios no pide confirmación y eliminar sí', () => {
  const props = setup()
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
  expect(props.onClose).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar comida' }))
  expect(props.onDelete).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar comida' }))
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
  expect(props.onDelete).toHaveBeenCalledOnce()
})
test('la hoja vacía valida nombre y no permite porciones negativas', () => {
  setup({ 1: 0, 2: 0 }, true)
  expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Reducir Cereales' })).toBeDisabled()
  expect(screen.queryByRole('button', { name: 'Eliminar comida' })).not.toBeInTheDocument()
})

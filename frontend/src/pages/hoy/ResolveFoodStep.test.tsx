import {
  mockGetMyPlan,
  mockGetDayRegistro,
  proteinGroups,
  planWithMeal,
  emptyDay,
  renderToday,
  removableItems,
  setupRemoval,
  openDetails,
  unknownFood,
  openResolution,
  mockResolution,
} from './test-utils'
import { screen, waitFor, fireEvent, within } from '@testing-library/react'
import { vi, test, expect } from 'vitest'
import { searchCatalog } from '../../api/planRules'
import * as registroApi from '../../api/registro'
test('cuenta y separa los alimentos sin reconocer del resumen', async () => {
  setupRemoval([unknownFood, { ...removableItems[0], uncertain: true }])
  renderToday()
  expect(await screen.findByRole('button', { name: 'Así lo entendí · 1 sin reconocer · 1 estimados' })).toBeInTheDocument()
  await openDetails()
  expect(screen.getByRole('heading', { name: 'No reconocí 1 cosa' })).toBeInTheDocument()
  expect(screen.getByText('«milanesa rara»')).toBeInTheDocument()
  expect(screen.getByText(/^Entendí:/)).not.toHaveTextContent('milanesa rara')
})

test('resuelve por catálogo y deshace restaurando el aviso', async () => {
  const resolved = mockResolution()
  vi.mocked(searchCatalog).mockResolvedValue([{ uid: 'milanesa', alcance: 'CATALOGO', alimento: 'Milanesa', sinonimos: [], tipo: 'NORMAL', groupUid: null, textoRegla: '1 porción', ajustadoPorUid: null }])
  await openResolution()
  expect(screen.getByRole('heading', { name: '¿Qué es «milanesa rara»?' })).toHaveFocus()
  fireEvent.click(await screen.findByRole('button', { name: 'Es esto' }))
  await waitFor(() => expect(registroApi.resolveItem).toHaveBeenCalledWith('tok', expect.any(String), 501, { kind: 'SAME_AS', ruleUid: 'milanesa', remember: true }))
  expect(await screen.findByText(/Listo:.*Milanesa/)).toHaveTextContent('Lo voy a reconocer la próxima vez.')
  vi.mocked(registroApi.undoResolveItem).mockImplementation(async () => {
    mockGetDayRegistro.mockResolvedValue({ ...emptyDay, meals: [{ mealId: 1, noteId: 3, noteVersion: 7, noteText: 'nota', items: [unknownFood], comparison: [] }] })
    return { replacedItemIds: [resolved.id], items: [unknownFood] }
  })
  fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }))
  expect(await screen.findByText('Listo, quedó como antes.')).toBeInTheDocument()
  expect(registroApi.undoResolveItem).toHaveBeenCalledWith('tok', expect.any(String), { occurrenceId: 'occ', ruleUid: 'rule' })
  expect(screen.getByRole('button', { name: 'Decime qué es «milanesa rara»' })).toBeInTheDocument()
})

test('resuelve dos grupos con porciones', async () => {
  mockResolution()
  setupRemoval([unknownFood])
  mockGetMyPlan.mockResolvedValue({ ...planWithMeal, foodGroups: [...proteinGroups, { id: 2, name: 'Cereales', abbreviation: 'CER', displayOrder: 2, color: null }] })
  renderToday()
  await openDetails()
  fireEvent.click(screen.getByRole('button', { name: 'Decime qué es «milanesa rara»' }))
  fireEvent.click(screen.getByRole('button', { name: 'Elegir grupos y porciones' }))
  fireEvent.click(screen.getByRole('button', { name: '+ Agregar grupo' }))
  fireEvent.change(screen.getByLabelText('Porciones 2'), { target: { value: '1.5' } })
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^Guardar$/ }))
  await waitFor(() => expect(registroApi.resolveItem).toHaveBeenCalledWith('tok', expect.any(String), 501, { kind: 'GROUPS', groups: [{ foodGroupId: 1, portions: 1 }, { foodGroupId: 2, portions: 1.5 }], remember: true }))
})

test('muestra error y vuelve con foco mediante volver y Escape', async () => {
  vi.mocked(searchCatalog).mockResolvedValue([])
  vi.mocked(registroApi.resolveItem).mockRejectedValue(new Error('error'))
  await openResolution()
  fireEvent.click(screen.getByRole('button', { name: 'Comida flexible' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar. Probá de nuevo.')
  fireEvent.click(screen.getByRole('button', { name: 'Volver a Así lo entendí' }))
  expect(screen.getByRole('button', { name: 'Decime qué es «milanesa rara»' })).toHaveFocus()
  fireEvent.click(screen.getByRole('button', { name: 'Decime qué es «milanesa rara»' }))
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(screen.getByRole('button', { name: 'Decime qué es «milanesa rara»' })).toHaveFocus()
})


test.each([['Comida flexible', 'FLEXIBLE'], ['No cuenta para el plan', 'NOT_COUNTED']])('resuelve %s sin recordar', async (label, kind) => {
  mockResolution()
  await openResolution()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Reconocerlo siempre que lo escriba' }))
  fireEvent.click(screen.getByRole('button', { name: label }))
  await waitFor(() => expect(registroApi.resolveItem).toHaveBeenCalledWith('tok', expect.any(String), 501, { kind, remember: false }))
  expect(await screen.findByText(/Listo:/)).not.toHaveTextContent('Lo voy a reconocer')
})

import * as recordsApi from '../../api/records'
import { ItemOrigin } from '../../api/records'
/// <reference types="node" />
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, expect, beforeEach, afterEach } from 'vitest'
import TodayPage from '../TodayPage'
import * as plansApi from '../../api/plans'
import * as AuthContext from '../../auth/authTypes'

const mealRenders = vi.hoisted(() => new Map<string, number>())

vi.mock('react/jsx-dev-runtime', async importOriginal => {
  const runtime = await importOriginal<typeof import('react/jsx-dev-runtime')>()
  const { memo } = await import('react')
  const wrappers = new Map<unknown, React.ElementType>()
  function instrument(type: React.ElementType): React.ElementType {
    const component = typeof type === 'function' ? type : (type as { type?: unknown }).type
    if (typeof component !== 'function' || !['MealNoteSection', 'MealDetail', 'MealRow', 'CurrentMeal'].includes(component.name)) return type
    if (!wrappers.has(type)) {
      const counted = (props: { meal: { id: number } }) => {
        const key = `${component.name}-${props.meal.id}`
        mealRenders.set(key, (mealRenders.get(key) ?? 0) + 1)
        return component(props)
      }
      wrappers.set(type, typeof type === 'function' ? counted : memo(counted))
    }
    return wrappers.get(type)!
  }
  return {
    ...runtime,
    jsxDEV: (type, props, key, isStatic, source, self) => runtime.jsxDEV(instrument(type), props, key, isStatic, source, self),
  } satisfies typeof runtime
})

vi.mock('../../api/week', () => ({ getWeek: vi.fn().mockResolvedValue({ habits: [], days: [] }) }))

vi.mock('../../api/planRules', () => ({ searchCatalog: vi.fn().mockResolvedValue([]) }))
vi.mock('../../api/plans')
vi.mock('../../api/records', async importOriginal => {
  const current = await importOriginal<typeof import('../../api/records')>()
  return { ...current, getDayRecord: vi.fn(), saveNote: vi.fn(), patchItem: vi.fn(),
    saveAnswer: vi.fn(), getSuggestions: vi.fn(), deleteNote: vi.fn(), removeItem: vi.fn(), resolveItem: vi.fn(), undoResolveItem: vi.fn() }
})
vi.mock('../../auth/authTypes')

export const mockGetMyPlan = vi.mocked(plansApi.getMyPlan)
export const mockGetDayRecord = vi.mocked(recordsApi.getDayRecord)
export const mockSaveNote = vi.mocked(recordsApi.saveNote)
export const mockGetSuggestions = vi.mocked(recordsApi.getSuggestions)
export const mockDeleteNote = vi.mocked(recordsApi.deleteNote)

export const proteinGroups = [{ id: 1, name: 'Proteínas', abbreviation: 'PRO', displayOrder: 1, color: null }]

export const planWithMeal = {
  foodGroups: proteinGroups,
  meals: [{
    id: 1,
    name: 'Desayuno',
    suggestedTime: '08:00:00',
    displayOrder: 1,
    portions: [{ foodGroupId: 1, portions: 2 }],
  }],
}

export const emptyDay = {
  date: '2025-01-01',
  meals: [],
  summary: [],
}

beforeEach(() => {
  vi.mocked(AuthContext.useAuth).mockReturnValue({
    token: 'tok',
    email: 'facu@miga.uy',
    firstName: 'Facu',
    login: vi.fn(),
    setFirstName: vi.fn(),
    sessionExpired: false, restoring: false,
    logout: vi.fn(),
  })
  mockGetDayRecord.mockResolvedValue(emptyDay)
  mockGetSuggestions.mockResolvedValue([])
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

export function renderToday() {
  return render(<MemoryRouter><TodayPage /></MemoryRouter>)
}

export const barGroups = [
  { id: 1, name: 'Proteínas', abbreviation: 'PRO', displayOrder: 1, color: null },
  { id: 2, name: 'Cereales', abbreviation: 'CER', displayOrder: 2, color: null },
  { id: 3, name: 'Grasas', abbreviation: 'GRA', displayOrder: 3, color: null },
]

export const barRule = '1 barrita = 1 Proteínas + 1 Cereales + 1 Grasas'

export function barEntry(id: number, foodGroupId: number) {
  return {
    id, food: 'barrita', quantity: 1, unit: 'u', foodGroupId, portions: 1, origin: ItemOrigin.RULE,
    uncertain: false, originalText: '1 barrita', appliedRule: barRule, occurrenceId: 'occ-1',
  }
}

export async function openNote() {
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Desayuno', level: 2 })).toBeInTheDocument())
  const edit = screen.queryByRole('button', { name: 'Editar' })
  if (edit) fireEvent.click(edit)
  await waitFor(() => expect(screen.getByRole('textbox', { name: '¿Qué comiste?' })).toBeInTheDocument())
}

export const twoMealPlan = {
  foodGroups: [
    { id: 1, name: 'Proteínas', abbreviation: 'PRO', displayOrder: 1, color: null },
    { id: 2, name: 'Frutas', abbreviation: 'FRU', displayOrder: 2, color: null },
  ],
  meals: [
    { id: 1, name: 'Desayuno', displayOrder: 1, portions: [{ foodGroupId: 1, portions: 1 }] },
    { id: 2, name: 'Cena', displayOrder: 2, portions: [{ foodGroupId: 1, portions: 2 }, { foodGroupId: 2, portions: 1 }] },
  ],
}

export const dayWithNote = {
  ...emptyDay,
  meals: [{
    mealId: 1, status: 'EN_PLAN' as const, noteId: 5, noteVersion: 3, noteText: 'leche y pan',
    items: [
      { id: 21, food: 'leche', quantity: 1, unit: 'taza', foodGroupId: 1, portions: 1, origin: ItemOrigin.RULE,
        uncertain: false, originalText: 'leche', appliedRule: null, occurrenceId: 'occ-a' },
      { id: 22, food: 'pan', quantity: 1, unit: 'u', foodGroupId: 1, portions: 1, origin: ItemOrigin.RULE,
        uncertain: false, originalText: 'pan', appliedRule: null, occurrenceId: 'occ-b' },
    ],
    comparison: [{ foodGroupId: 1, name: 'Proteínas', expected: 2, recorded: 2, status: 'EN_PLAN' }],
  }],
  summary: [{ foodGroupId: 1, name: 'Proteínas', clave: 'PRO', totalRecorded: 2 }],
}

export const removableItems = [
  { id: 101, food: 'leche', quantity: 1, unit: 'u', foodGroupId: 1, portions: 1, origin: ItemOrigin.RULE, uncertain: false, occurrenceId: 'milk' },
  { id: 102, food: 'manzana', quantity: 1, unit: 'u', foodGroupId: null, portions: null, origin: ItemOrigin.MENTION, uncertain: false, occurrenceId: 'apple' },
]

export function setupRemoval(items: recordsApi.EntryItemDto[] = removableItems) {
  mockGetMyPlan.mockResolvedValue(planWithMeal)
  const meal = { mealId: 1, status: 'REGISTRADA' as const, noteId: 3, noteVersion: 7, noteText: 'leche, manzana', items, comparison: [] }
  mockGetDayRecord.mockResolvedValue({ ...emptyDay, meals: [meal] })
  return meal
}


export async function openDetails() {
  if (!screen.queryByRole('dialog', { name: 'Así lo entendí' })) {
    fireEvent.click(await screen.findByRole('button', { name: /^Así lo entendí/ }))
  }
}




export const unknownFood: recordsApi.EntryItemDto = { id: 501, food: 'milanesa rara', originalText: 'milanesa rara', quantity: null, unit: null, foodGroupId: null, portions: null, origin: ItemOrigin.UNKNOWN, uncertain: false }
export async function openResolution() {
  setupRemoval([unknownFood, { ...removableItems[0], uncertain: true }])
  renderToday()
  await openDetails()
  fireEvent.click(screen.getByRole('button', { name: 'Decime qué es «milanesa rara»' }))
}
export function mockResolution() {
  const resolved = { ...unknownFood, id: 502, food: 'Milanesa', origin: ItemOrigin.RULE }
  vi.mocked(recordsApi.resolveItem).mockImplementation(async () => {
    mockGetDayRecord.mockResolvedValue({ ...emptyDay, meals: [{ mealId: 1, status: 'REGISTRADA' as const, noteId: 3, noteVersion: 7, noteText: 'nota', items: [resolved], comparison: [] }] })
    return { status: 'REGISTRADA' as const, replacedItemIds: [501], items: [resolved], undo: { occurrenceId: 'occ', ruleUid: 'rule' } }
  })
  return resolved
}

export { mealRenders }

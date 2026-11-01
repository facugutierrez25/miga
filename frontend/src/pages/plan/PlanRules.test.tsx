import userEvent from '@testing-library/user-event'
import { within } from '@testing-library/react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import * as api from '../../api/planRules'
import PlanRulesSection from './PlanRulesSection'
import FoodRuleForm from './FoodRuleForm'
import GroupsEditor from './GroupsEditor'

vi.mock('../../api/planRules')

const groups: api.PlanGroup[] = ['Proteínas', 'Cereales', 'Grasas'].map((name, i) => ({
  id: i + 1,
  uid: `group-${i}`,
  name,
  abbreviation: '',
  displayOrder: i,
  color: null,
  clave: null,
  preguntarSiFalta: false,
  opcional: false,
}))

const plan: api.PlanRules = {
  planId: 1,
  planVersion: 3,
  modoRegistro: 'LIBRE',
  grupos: groups,
  alimentos: [
    {
      uid: 'food',
      alcance: 'USUARIO',
      alimento: 'Manzana',
      sinonimos: [],
      tipo: 'LIBRE',
      groupUid: null,
      cantidadPorPorcion: null,
      unidad: null,
      porcionPorDefecto: 1,
      componentes: [],
      overridesRuleUid: null,
      textoRegla: 'Se anota pero no suma',
    },
  ],
  habitos: [
    {
      id: 1,
      uid: 'habit',
      name: 'Agua',
      habitType: 'CANTIDAD',
      unit: 'vasos',
      goal: 8,
      period: 'DIA',
      step: 0.5,
      displayOrder: 1,
    },
  ],
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(api.getPlanRules).mockResolvedValue(plan)
})

test('grupos suma las porciones de las comidas y no pide una meta diaria', () => {
  const { rerender } = render(<GroupsEditor token="tok" plan={plan} mutate={vi.fn()} meals={[
    { portions: [{ foodGroupId: 1, portions: 1.5 }] },
    { portions: [{ foodGroupId: 1, portions: 2 }, { foodGroupId: 2, portions: 1 }] },
  ]} />)
  expect(screen.getByText('Total del día: 3,5')).toBeInTheDocument()
  expect(screen.getByText('Total del día: 1')).toBeInTheDocument()
  expect(screen.getByText('No está en ninguna comida')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Editar Proteínas' }))
  expect(screen.queryByLabelText('Meta diaria')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  fireEvent.click(screen.getByRole('button', { name: 'Agregar grupo' }))
  expect(screen.queryByLabelText('Meta diaria')).not.toBeInTheDocument()
  rerender(<GroupsEditor token="tok" plan={plan} mutate={vi.fn()} meals={[]} />)
  expect(screen.getAllByText('No está en ninguna comida')).toHaveLength(3)
})

async function open() {
  render(<PlanRulesSection token="tok" />)
  await screen.findByText('Proteínas')
}

test('carga grupos, alimentos y hábitos', async () => {
  await open()

  fireEvent.click(screen.getByRole('button', { name: 'Alimentos' }))

  expect(screen.getByText('Manzana')).toBeInTheDocument()

  expect(screen.getByText('Se anota pero no suma')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Hábitos' }))

  expect(screen.getByText('Agua')).toBeInTheDocument()
})

test('crea grupo con preguntar si falta y reemplaza el estado', async () => {
  vi.mocked(api.createGroup).mockResolvedValue({
    ...plan,
    planVersion: 4,
    grupos: [...groups, { ...groups[0], uid: 'new', name: 'Nuevo' }],
  })

  await open()
  fireEvent.click(screen.getByText('Agregar grupo'))

  fireEvent.change(screen.getByLabelText('Nombre del grupo'), { target: { value: 'Nuevo' } })

  fireEvent.click(screen.getByText('Más opciones'))
  fireEvent.click(screen.getByLabelText('Preguntar si falta'))

  fireEvent.click(screen.getByText('Guardar grupo'))

  await screen.findByText('Nuevo')

  expect(api.createGroup).toHaveBeenCalledWith(
    'tok',
    expect.objectContaining({ name: 'Nuevo', preguntarSiFalta: true, planVersion: 3 })
  )
})

test('reordena por uid', async () => {
  vi.mocked(api.reorderGroups).mockResolvedValue(plan)

  await open()
  fireEvent.click(screen.getByRole('button', { name: 'Ordenar' }))
  fireEvent.click(screen.getByLabelText('Subir Cereales'))

  await waitFor(() =>
    expect(api.reorderGroups).toHaveBeenCalledWith('tok', {
      planVersion: 3,
      uids: ['group-1', 'group-0', 'group-2'],
    })
  )
})

test('muestra GROUP_IN_USE del backend', async () => {
  vi.mocked(api.deleteGroup).mockRejectedValue({
    code: 'GROUP_IN_USE',
    error: 'Se usa en dos comidas.',
  })

  await open()
  fireEvent.click(screen.getByRole('button', { name: 'Editar Proteínas' }))
  fireEvent.click(screen.getByRole('button', { name: 'Borrar Proteínas' }))
  fireEvent.click(screen.getByText('Confirmar borrado'))

  expect(await screen.findByRole('alert')).toHaveTextContent('Se usa en dos comidas.')
})

test('conflicto bloquea cambios y permite recargar', async () => {
  vi.mocked(api.reorderGroups).mockRejectedValue({ code: 'VERSION_CONFLICT' })

  await open()
  fireEvent.click(screen.getByRole('button', { name: 'Ordenar' }))
  fireEvent.click(screen.getByLabelText('Subir Cereales'))

  expect(await screen.findByRole('alert')).toHaveTextContent('El plan cambió en otra sesión.')

  fireEvent.click(screen.getByText('Recargar'))

  await waitFor(() => expect(api.getPlanRules).toHaveBeenCalledTimes(2))

  await screen.findByText('Proteínas')
})

test('compuesto valida grupos y envía componentes con vista previa', async () => {
  const save = vi.fn().mockResolvedValue(true)

  render(<FoodRuleForm groups={groups} onSave={save} onCancel={vi.fn()} />)

  fireEvent.change(screen.getByLabelText('Alimento'), { target: { value: 'barrita' } })

  fireEvent.click(screen.getByRole('radio', { name: 'Varios grupos' }))

  fireEvent.change(screen.getByLabelText('Grupo 1'), { target: { value: 'group-0' } })

  expect(screen.getByText('Guardar alimento')).toBeDisabled()

  fireEvent.change(screen.getByLabelText('Grupo 2'), { target: { value: 'group-1' } })

  fireEvent.click(screen.getByText('+ Agregar grupo'))

  fireEvent.change(screen.getByLabelText('Grupo 3'), { target: { value: 'group-2' } })

  expect(screen.getByText('1 barrita = 1 Proteínas + 1 Cereales + 1 Grasas')).toHaveAttribute(
    'aria-live',
    'polite'
  )

  fireEvent.click(screen.getByText('Guardar alimento'))

  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({
      tipo: 'COMPUESTO',
      componentes: groups.map((g) => ({ groupUid: g.uid, porciones: 1 })),
    })
  )
})

test('busca catálogo, ajusta y abre la regla nueva', async () => {
  vi.mocked(api.searchCatalog).mockResolvedValue([
    {
      uid: 'catalog',
      alcance: 'GLOBAL',
      alimento: 'Pera',
      sinonimos: [],
      tipo: 'LIBRE',
      groupUid: null,
      textoRegla: 'Libre',
      ajustadoPorUid: null,
    },
  ])

  vi.mocked(api.adjustFromCatalog).mockResolvedValue({
    ...plan,
    alimentos: [
      ...plan.alimentos,
      { ...plan.alimentos[0], uid: 'adjusted', alimento: 'Pera', overridesRuleUid: 'catalog' },
    ],
  })

  await open()
  fireEvent.click(screen.getByRole('button', { name: 'Alimentos' }))

  fireEvent.change(screen.getByLabelText('Buscar alimentos'), { target: { value: 'pe' } })

  fireEvent.click(await screen.findByText('Ajustar para mi plan'))

  await waitFor(() => expect(api.adjustFromCatalog).toHaveBeenCalledWith('tok', 'catalog', 3))

  expect(await screen.findByDisplayValue('Pera')).toBeInTheDocument()

  expect(screen.getByText('Ya ajustado')).toBeDisabled()
})

test('crea hábito Cantidad por día con paso 0.5', async () => {
  vi.mocked(api.createHabit).mockResolvedValue(plan)

  await open()
  fireEvent.click(screen.getByRole('button', { name: 'Hábitos' }))
  fireEvent.click(screen.getByText('Agregar hábito'))

  fireEvent.change(screen.getByLabelText('Nombre del hábito'), { target: { value: 'Agua' } })

  fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'CANTIDAD' } })

  fireEvent.change(screen.getByLabelText('Paso'), { target: { value: '0.5' } })

  fireEvent.click(screen.getByText('Guardar hábito'))

  await waitFor(() =>
    expect(api.createHabit).toHaveBeenCalledWith(
      'tok',
      expect.objectContaining({
        name: 'Agua',
        habitType: 'CANTIDAD',
        period: 'DIA',
        step: 0.5,
        planVersion: 3,
      })
    )
  )
})

test('Compuesto muestra nombres legibles y empieza con dos filas', () => {
  render(<FoodRuleForm groups={groups} onSave={vi.fn()} onCancel={vi.fn()} />)
  fireEvent.click(screen.getByRole('radio', { name: 'Varios grupos' }))
  expect(screen.queryByText('COMPUESTO')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Grupo 1')).toBeInTheDocument()
  expect(screen.getByLabelText('Grupo 2')).toBeInTheDocument()
  expect(screen.queryByLabelText('Grupo 3')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Quitar grupo/ })).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Alimento'), { target: { value: 'barrita' } })
  fireEvent.change(screen.getByLabelText('Grupo 1'), { target: { value: 'group-0' } })
  fireEvent.change(screen.getByLabelText('Porciones 1'), { target: { value: '0.5' } })
  fireEvent.change(screen.getByLabelText('Grupo 2'), { target: { value: 'group-1' } })
  expect(screen.getByText('1 barrita = 0,5 Proteínas + 1 Cereales')).toBeInTheDocument()
})

test('borrar hábito pide confirmación y conserva los registros', async () => {
  vi.mocked(api.deleteHabit).mockResolvedValue({ ...plan, habitos: [] })
  await open()
  fireEvent.click(screen.getByRole('button', { name: 'Hábitos' }))
  fireEvent.click(screen.getByRole('button', { name: 'Editar Agua' }))
  fireEvent.click(screen.getByRole('button', { name: 'Borrar Agua' }))
  expect(api.deleteHabit).not.toHaveBeenCalled()
  expect(
    screen.getByText(
      'Si ya tiene registros, se archiva y deja de mostrarse; sus registros se conservan.'
    )
  ).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar borrado' }))
  await waitFor(() => expect(api.deleteHabit).toHaveBeenCalledWith('tok', 'habit', 3))
})

test('editar grupo abre el formulario dentro de su tarjeta y enfoca el nombre', async () => {
  await open()
  const trigger = screen.getByRole('button', { name: 'Editar Proteínas' })
  trigger.focus()
  fireEvent.click(trigger)
  const input = screen.getByLabelText('Nombre del grupo')
  expect(input).toHaveFocus()
  expect(trigger.closest('li')).toContainElement(input)
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  await waitFor(() => expect(trigger).toHaveFocus())
})


test('compuesto muestra cantidad y unidad, valida el par y conserva los valores al guardar', async () => {
  const onSave = vi.fn().mockResolvedValue(true)
  render(<FoodRuleForm groups={groups} onSave={onSave} onCancel={vi.fn()} />)
  fireEvent.change(screen.getByLabelText('Alimento'), { target: { value: 'Tarta' } })
  fireEvent.click(screen.getByRole('radio', { name: 'Varios grupos' }))
  fireEvent.change(screen.getByLabelText('Grupo 1'), { target: { value: 'group-0' } })
  fireEvent.change(screen.getByLabelText('Grupo 2'), { target: { value: 'group-1' } })
  const quantity = screen.getByLabelText('Cantidad por porci\u00f3n')
  const unit = screen.getByLabelText('Unidad')
  const save = screen.getByRole('button', { name: 'Guardar alimento' })
  expect(save).toBeEnabled()
  fireEvent.change(quantity, { target: { value: '150' } })
  expect(save).toBeDisabled()
  expect(quantity).toHaveAttribute('aria-invalid', 'true')
  expect(screen.getByRole('alert')).toHaveTextContent('Complet\u00e1 la cantidad y la unidad juntas')
  fireEvent.change(unit, { target: { value: 'g' } })
  expect(save).toBeEnabled()
  fireEvent.change(quantity, { target: { value: '' } })
  expect(save).toBeDisabled()
  fireEvent.change(quantity, { target: { value: '150' } })
  fireEvent.click(save)
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    tipo: 'COMPUESTO', cantidadPorPorcion: 150, unidad: 'g', groupUid: null,
  })))
})

test('un compuesto viejo con unidad y sin cantidad se puede editar y guardar', async () => {
  const onSave = vi.fn().mockResolvedValue(true)
  const legacy: api.FoodRule = {
    uid: 'rule-legacy', alcance: 'USUARIO', textoRegla: '', alimento: 'Barrita', sinonimos: [], tipo: 'COMPUESTO',
    groupUid: null, cantidadPorPorcion: null, unidad: 'u', porcionPorDefecto: 1, overridesRuleUid: null,
    componentes: [{ groupUid: 'group-0', porciones: 1 }, { groupUid: 'group-1', porciones: 1 }],
  }
  render(<FoodRuleForm groups={groups} rule={legacy} onSave={onSave} onCancel={vi.fn()} />)
  fireEvent.change(screen.getByLabelText('Alimento'), { target: { value: 'Barrita de cereal' } })
  const save = screen.getByRole('button', { name: 'Guardar alimento' })
  expect(save).toBeEnabled()
  fireEvent.click(save)
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    alimento: 'Barrita de cereal', cantidadPorPorcion: null, unidad: null,
  })))
})

test('ofrece diez colores y preselecciona el primero libre', () => {
  const coloredPlan = { ...plan, grupos: groups.map((g, i) => ({ ...g, color: ['#C0704A', '#A8822E', '#B5627A'][i] })) }
  render(<GroupsEditor token="tok" plan={coloredPlan} mutate={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Agregar grupo' }))
  expect(screen.getAllByRole('radio')).toHaveLength(10)
  expect(screen.getByRole('radio', { name: 'Azul' })).toBeChecked()
  fireEvent.click(screen.getByRole('radio', { name: 'Coral' }))
  expect(screen.getByRole('radio', { name: 'Coral' })).toBeChecked()
})

test('Ordenar muestra controles operables con teclado y Listo los oculta', async () => {
  const user = userEvent.setup()
  vi.mocked(api.reorderGroups).mockResolvedValue(plan)
  await open()
  expect(screen.queryByRole('button', { name: 'Subir Cereales' })).not.toBeInTheDocument()
  screen.getByRole('button', { name: 'Ordenar' }).focus()
  await user.keyboard('{Enter}')
  screen.getByRole('button', { name: 'Subir Cereales' }).focus()
  await user.keyboard(' ')
  await waitFor(() => expect(api.reorderGroups).toHaveBeenCalledTimes(1))
  screen.getByRole('button', { name: 'Listo' }).focus()
  await user.keyboard('{Enter}')
  expect(screen.queryByRole('button', { name: 'Subir Cereales' })).not.toBeInTheDocument()
})

test('una sola búsqueda muestra el plan y el catálogo y exige dos caracteres', async () => {
  vi.mocked(api.searchCatalog).mockResolvedValue([{
    uid: 'catalog', alcance: 'GLOBAL', alimento: 'Manzana verde', sinonimos: [], tipo: 'LIBRE',
    groupUid: null, textoRegla: 'Libre', ajustadoPorUid: null,
  }])
  await open()
  fireEvent.click(screen.getByRole('button', { name: 'Alimentos' }))
  expect(screen.getAllByRole('textbox')).toHaveLength(1)
  const search = screen.getByRole('textbox', { name: 'Buscar alimentos' })
  fireEvent.change(search, { target: { value: 'm' } })
  expect(screen.getByText(/al menos 2 caracteres/)).toBeInTheDocument()
  expect(api.searchCatalog).not.toHaveBeenCalled()
  fireEvent.change(search, { target: { value: 'man' } })
  expect(screen.getByRole('heading', { name: 'En tu plan' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Del catálogo' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Editar Manzana' })).toBeInTheDocument()
  expect(await screen.findByText('Manzana verde')).toBeInTheDocument()
  expect(api.searchCatalog).toHaveBeenCalledWith('tok', 'man')
  fireEvent.change(search, { target: { value: 'x' } })
  expect(screen.queryByText('Manzana verde')).not.toBeInTheDocument()
})

test('fila de alimento abre editor, Escape devuelve el foco y borrar se confirma adentro', async () => {
  const user = userEvent.setup()
  vi.mocked(api.deleteFood).mockResolvedValue({ ...plan, alimentos: [] })
  await open()
  fireEvent.click(screen.getByRole('button', { name: 'Alimentos' }))
  expect(screen.queryByRole('button', { name: 'Borrar Manzana' })).not.toBeInTheDocument()
  const row = screen.getByRole('button', { name: 'Editar Manzana' })
  await user.click(row)
  expect(screen.getByLabelText('Alimento')).toHaveFocus()
  await user.keyboard('{Escape}')
  await waitFor(() => expect(row).toHaveFocus())
  await user.click(row)
  await user.click(screen.getByRole('button', { name: 'Borrar Manzana' }))
  expect(api.deleteFood).not.toHaveBeenCalled()
  const confirmation = screen.getByRole('group', { name: 'Confirmar borrado' })
  await user.keyboard('{Escape}')
  expect(confirmation).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Borrar Manzana' })).toHaveFocus()
  await user.click(screen.getByRole('button', { name: 'Borrar Manzana' }))
  await user.click(within(screen.getByRole('group', { name: 'Confirmar borrado' })).getByRole('button', { name: 'Confirmar borrado' }))
  await waitFor(() => expect(api.deleteFood).toHaveBeenCalledWith('tok', 'food', 3))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Agregar alimento' })).toHaveFocus())
})

test('Más opciones y la ayuda de tipos se despliegan a pedido', async () => {
  const user = userEvent.setup()
  render(<FoodRuleForm groups={groups} onSave={vi.fn()} onCancel={vi.fn()} />)
  const options = screen.getByText('Más opciones').closest('details')!
  expect(options).not.toHaveAttribute('open')
  await user.click(screen.getByText('Más opciones'))
  expect(options).toHaveAttribute('open')
  expect(within(options).getByLabelText('Sinónimos separados por comas')).toBeVisible()
  expect(within(options).getByLabelText('Porción por defecto')).toBeVisible()
  const help = screen.getByRole('button', { name: 'Ayuda sobre tipos de alimento' })
  expect(help).toHaveAttribute('aria-expanded', 'false')
  await user.click(help)
  expect(help).toHaveAttribute('aria-expanded', 'true')
  expect(document.getElementById(help.getAttribute('aria-describedby')!)).toHaveTextContent('Suma a varios grupos')
})

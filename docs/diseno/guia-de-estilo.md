# Guía de estilo — Miga (v0 a v2)

Estilo acordado para las primeras versiones: **sobrio, profesional y con poco texto**.
Paleta "Azul noche", IBM Plex Sans y esquinas casi rectas. Funciona en modo claro y oscuro.

## Principios

1. **Poco texto.** Títulos cortos, contadores en formato `3/4`, sin frases explicativas en pantalla.
2. **El color nunca va solo.** Todo dato con color (grupo de alimentos, estado) lleva también número o texto.
3. **Sin contornos gruesos ni sombras decorativas.** Las tarjetas se separan del fondo por color, no por bordes.
4. **Una sola acción principal por pantalla**, en color primario. El resto, botones secundarios.
5. **Pensado para el celular:** zonas táctiles de 44 px como mínimo y navegación inferior.

## Tokens de color

Se definen como variables CSS y se cambian según el tema. Nunca usar hex sueltos en los componentes.

| Token | Uso | Claro | Oscuro |
| --- | --- | --- | --- |
| `--bg` | Fondo de la app | `#F1F4F9` | `#0E1420` |
| `--surface` | Tarjetas, barras, encabezados | `#FFFFFF` | `#172133` |
| `--surface-2` | Paneles laterales (escritorio) | `#FBFCFE` | `#131C2C` |
| `--ink` | Texto principal | `#111C2E` | `#E6EBF3` |
| `--muted` | Texto secundario, íconos inactivos | `#566275` | `#9AA6B8` |
| `--primary` | Acción principal, selección, navegación activa | `#1D3A6B` | `#8DB0E6` |
| `--on-primary` | Texto e íconos sobre `--primary` | `#FFFFFF` | `#0B1424` |
| `--selected` | Fondo de ítem seleccionado | `#E8EDF5` | `#22324D` |
| `--accent` | Avisos puntuales (mensaje sin leer) | `#1F7A70` | `#4DB6A8` |
| `--line` | Divisores principales | `#E2E6EE` | `#263247` |
| `--line-soft` | Divisores dentro de listas | `#EEF1F5` | `#1F2A3D` |
| `--border` | Borde de inputs y botones secundarios | `#D3D9E2` | `#33415A` |
| `--control` | Borde de checkbox y botones vacíos | `#8A93A3` | `#76839A` |

### Grupos de alimentos

El color de cada grupo es el mismo en los dos temas; solo cambia el fondo suave (tinte).

| Grupo | Color | Tinte claro | Tinte oscuro |
| --- | --- | --- | --- |
| Proteínas | `#C0704A` | `#F4E7E0` | `#3A2A24` |
| Cereales | `#B8913A` | `#F4EEDD` | `#38321F` |
| Frutas | `#B5627A` | `#F4E4EA` | `#3A2630` |
| Lácteos | `#4F86B8` | `#E3ECF5` | `#1F3045` |
| Grasas | `#8070B0` | `#ECE9F4` | `#2C2840` |
| Verduras | `#4E8F6A` | `#E2EEE6` | `#203329` |

Se muestran como **punto de 8 px + texto** o como **barra segmentada + número**. Nunca como etiqueta de color lleno.

### Tema

- Por defecto se sigue la preferencia del sistema (`prefers-color-scheme`).
- En **Perfil** hay un selector: Automático / Claro / Oscuro. Se guarda en el navegador.

## Tipografía

Una sola familia: **IBM Plex Sans** (Google Fonts), pesos 400, 500 y 600.

| Rol | Tamaño | Peso |
| --- | --- | --- |
| Título de pantalla | 26 px, `letter-spacing: -0.01em` | 600 |
| Número destacado | 22 px | 600 |
| Título de sección (escritorio) | 18 px | 600 |
| Título de tarjeta / ítem | 16 px | 600 |
| Texto y botones | 15–16 px | 400 / 500–600 |
| Secundario | 14 px | 400 |
| Meta (horarios, contadores) | 13 px | 400 |
| Mínimo (etiquetas de navegación) | 12 px | 500 |

Inputs siempre a 16 px para que el celular no haga zoom.

## Forma y espaciado

| Elemento | Radio |
| --- | --- |
| Tarjetas, paneles | 8 px |
| Botones, inputs, chips cuadrados | 6 px |
| Checkbox, controles chicos | 4 px |
| Segmentos de barras | 2 px |
| Puntos de grupo, filtros tipo píldora, botón de check redondo | redondo |

- Ritmo de espaciado de 4/8 px. Margen de pantalla en celular: 16 px.
- Separación entre tarjetas: 10–12 px. Entre secciones: 16 px.
- Sin sombras, salvo la pestaña activa del control segmentado (`0 1px 2px` muy suave).

## Componentes

**Botón primario.** Alto 44–48 px, fondo `--primary`, texto `--on-primary`, peso 600.

**Botón secundario.** Alto 44 px, fondo `--bg` sobre tarjetas o borde `--border` sobre fondo, texto `--ink`.

**Input.** Alto 44 px, borde 1 px `--border`, radio 6 px. Etiqueta visible o, si el diseño no la muestra, oculta solo visualmente (nunca solo placeholder).

**Tarjeta.** Fondo `--surface` sobre `--bg`, radio 8 px, sin borde. Estado "ahora" o destacado: borde izquierdo de 3 px en `--primary`.

**Botón de marcar (comida comida).** Círculo de 44 px. Vacío: borde 1,5 px `--control`. Marcado: fondo `--primary` con check en `--on-primary`. Usa `aria-pressed`.

**Checkbox (lista de compras).** 22 px, radio 4 px. Toda la fila es el área táctil (mínimo 56 px de alto), con `role="checkbox"` y `aria-checked`. Marcado: texto tachado en `--control`.

**Filtros.** Píldoras de 36 px. Activo: fondo `--primary`. Inactivo: borde `--border`. Usan `aria-pressed`.

**Control segmentado.** Fondo `--bg`, pestaña activa en `--surface`. `role="tablist"` / `aria-selected`.

**Barra de progreso de porciones.** Una barra de 12 px dividida por grupo, cada tramo proporcional a sus porciones del día, con el tinte de fondo y el color del grupo como relleno. Debajo, leyenda con punto + `Grupo 2/3`.

**Navegación inferior (paciente).** 4 ítems: Hoy, Semana, Compras, Perfil. Ícono de línea de 22 px (trazo 1,75) + etiqueta de 12 px. Activo: color `--primary`, línea superior de 2 px y `aria-current="page"`. Fondo `--surface`, borde superior `--line`, margen inferior para la zona de gestos.

**Navegación lateral (nutricionista).** Ancho ~232 px, fondo `--surface`. Ítem activo con fondo `--selected` y texto `--primary`. Badge numérico para mensajes sin leer.

**Logo.** Monograma "M" en un cuadrado de radio 6 px con fondo `--primary`, junto a "Miga" en peso 600.

**Íconos.** De línea, trazo 1,75, sin emoji. Decorativos con `aria-hidden="true"`; los botones solo-ícono llevan `aria-label`.

## Interacción y accesibilidad

- Contraste mínimo 4,5:1 para texto (verificado en ambos temas).
- Foco visible: `outline: 2px solid var(--primary); outline-offset: 2px` con `:focus-visible`.
- Presión: opacidad 0,85 durante 120 ms. Respetar `prefers-reduced-motion`.
- Zonas táctiles de 44 × 44 px como mínimo, con al menos 8 px entre ellas.
- Tablas anchas dentro de un contenedor con `overflow-x: auto`.

## Pantallas de referencia

| Pantalla | Puntos clave |
| --- | --- |
| **Paciente · Hoy** | Título "Hoy" + fecha. Tira de 7 días (hoy en `--primary`). Resumen "7 de 13 porciones" + barra por grupo + leyenda. Tarjetas por comida: hora, nombre corto del plato, puntos de grupo y botón de marcar. La comida actual muestra "Cambiar plato" y "Ver receta". |
| **Paciente · Cambiar plato** | Volver + "Cambiar almuerzo" y las porciones a cumplir. Control segmentado: *Platos* / *Armar con equivalencias*. Platos: buscador, filtros (Todos, Favoritos, Rápidos, De tu nutri), tarjetas con favorito. Equivalencias: un grupo por bloque con opciones en gramos. Botón fijo abajo: "Usar este plato". |
| **Paciente · Semana** | Contador `18/28 comidas` + barra. Botones "Autocompletar" y "Lista de compras". Una tarjeta por día con sus 4 comidas en filas; vacías muestran "+ Elegir plato". |
| **Paciente · Compras** | Contadores de productos y costo estimado. Input "Agregar producto". Secciones del súper con contador `2/5`. Filas con checkbox, nombre y cantidad. Botón compartir. |
| **Nutricionista · Pacientes y plan** | Navegación lateral + lista de pacientes con filtros (Todos, Requieren atención, Sin plan) y estado con punto + texto. Detalle: nombre, próxima consulta, 3 indicadores, editor de porciones (tabla comidas × grupos con −/+ y total del día) y equivalencias en gramos. Botones "Guardar como plantilla" y "Enviar plan al paciente". |

## Implementación sugerida

```css
:root {
  color-scheme: light;
  --bg: #F1F4F9; --surface: #FFFFFF; --surface-2: #FBFCFE;
  --ink: #111C2E; --muted: #566275;
  --primary: #1D3A6B; --on-primary: #FFFFFF; --selected: #E8EDF5; --accent: #1F7A70;
  --line: #E2E6EE; --line-soft: #EEF1F5; --border: #D3D9E2; --control: #8A93A3;
  --g-prot: #C0704A; --g-cer: #B8913A; --g-frut: #B5627A;
  --g-lac: #4F86B8; --g-gras: #8070B0; --g-verd: #4E8F6A;
  --t-prot: #F4E7E0; --t-cer: #F4EEDD; --t-frut: #F4E4EA;
  --t-lac: #E3ECF5; --t-gras: #ECE9F4; --t-verd: #E2EEE6;
  --radius-card: 8px; --radius-control: 6px; --radius-sm: 4px;
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
}

/* Oscuro: por preferencia del sistema (salvo que el usuario elija claro) o por elección explícita */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --bg: #0E1420; --surface: #172133; --surface-2: #131C2C;
    --ink: #E6EBF3; --muted: #9AA6B8;
    --primary: #8DB0E6; --on-primary: #0B1424; --selected: #22324D; --accent: #4DB6A8;
    --line: #263247; --line-soft: #1F2A3D; --border: #33415A; --control: #76839A;
    --t-prot: #3A2A24; --t-cer: #38321F; --t-frut: #3A2630;
    --t-lac: #1F3045; --t-gras: #2C2840; --t-verd: #203329;
  }
}

:root[data-theme="dark"] {
  color-scheme: dark;
  --bg: #0E1420; --surface: #172133; --surface-2: #131C2C;
  --ink: #E6EBF3; --muted: #9AA6B8;
  --primary: #8DB0E6; --on-primary: #0B1424; --selected: #22324D; --accent: #4DB6A8;
  --line: #263247; --line-soft: #1F2A3D; --border: #33415A; --control: #76839A;
  --t-prot: #3A2A24; --t-cer: #38321F; --t-frut: #3A2630;
  --t-lac: #1F3045; --t-gras: #2C2840; --t-verd: #203329;
}

body { margin: 0; background: var(--bg); color: var(--ink); }
:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
```

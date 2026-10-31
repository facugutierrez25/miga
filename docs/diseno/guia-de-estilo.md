# Guía de estilo — Miga

Estilo acordado para las primeras versiones: **divertido, cercano y confiable**.
Verde azulado con amarillo, títulos en Bricolage Grotesque y textos en DM Sans.
Funciona en modo claro y oscuro.

## Principios

1. **Poco texto.** Frases cortas y humanas ("Te quedan 3 comidas"), contadores en formato `1/4`.
2. **El color nunca va solo.** Todo dato con color (grupo de alimentos, estado) lleva también número o texto.
3. **Cálido, no infantil.** Sin bordes gruesos ni negros, sin emojis, sin tarjetas con borde de color a un costado. Los únicos degradados son los del vidrio en celular (fondo ambiental y botón primario).
4. **Una sola acción principal por pantalla**, en color primario. El resto, botones secundarios.
5. **Pensado para el celular:** zonas táctiles de 44 px como mínimo y navegación inferior.
6. **Tono:** voseo uruguayo, directo, como un amigo ordenado. Nada de jerga técnica ni frases motivacionales largas.

## Tokens de color

Se definen como variables CSS y se cambian según el tema. Nunca usar hex sueltos en los componentes.

| Token | Uso | Claro | Oscuro |
| --- | --- | --- | --- |
| `--bg` | Fondo de la app | `#F2F7F6` | `#0B1716` |
| `--surface` | Tarjetas, barras | `#FFFFFF` | `#132322` |
| `--surface-2` | Paneles laterales (escritorio) | `#F8FBFA` | `#0F1D1C` |
| `--ink` | Texto principal | `#102624` | `#E6F0EF` |
| `--muted` | Texto secundario | `#5A706E` | `#9BB1AF` |
| `--muted-2` | Íconos decorativos | `#6E8482` | `#7F9795` |
| `--done` | Texto de cosas ya hechas | `#7C918F` | `#6E8684` |
| `--primary` | Encabezado, acción principal, navegación activa | `#0E6E6B` | `#3FB3AE` |
| `--on-primary` | Texto e íconos sobre `--primary` | `#FFFFFF` | `#062120` |
| `--on-primary-muted` | Texto secundario sobre `--primary` | `#CFE6E4` | `#0F3D3B` |
| `--primary-soft` | Botón secundario, ítem seleccionado | `#EAF4F3` | `#173634` |
| `--accent` | Detalles: punto del logo, "lo que toca ahora" | `#F6C344` | `#F6C344` |
| `--accent-soft` | Fondo de etiquetas tipo "Toca ahora" | `#FDF1D2` | `#3A3016` |
| `--on-accent-soft` | Texto sobre `--accent-soft` | `#7A5A0B` | `#F6D27A` |
| `--line` | Divisores | `#DCE9E7` | `#1F3533` |
| `--line-soft` | Divisores dentro de listas | `#E8F1EF` | `#1A2D2B` |
| `--rail` | Línea de tiempo del día | `#CFE0DE` | `#24403E` |
| `--border` | Borde de inputs y botones secundarios | `#C6DCDA` | `#2C4644` |
| `--control` | Borde de checkbox y puntos pendientes | `#7A9290` | `#6F8B88` |
| `--text-secondary` | Texto pequeño y navegación inactiva | `#526865` | `#9BB1AF` |
| `--control-border` | Bordes de campos (contraste mínimo 3:1) | `#708784` | `#789592` |

El amarillo (`--accent`) es solo para detalles: nunca para texto ni para fondos grandes.

### Grupos de alimentos

Los chips usan `--group-text: var(--ink)` para el texto sobre tinte y el color del grupo en un punto o borde.

El color de cada grupo es el mismo en los dos temas; solo cambia el fondo suave (tinte).

| Grupo | Color | Tinte claro | Tinte oscuro |
| --- | --- | --- | --- |
| Proteínas | `#C0704A` | `#F4E7E0` | `#3A2A24` |
| Cereales | `#B8913A` | `#F4EEDD` | `#38321F` |
| Frutas | `#B5627A` | `#F4E4EA` | `#3A2630` |
| Lácteos | `#4F86B8` | `#E3ECF5` | `#1F3045` |
| Grasas | `#8070B0` | `#ECE9F4` | `#2C2840` |
| Verduras | `#4E8F6A` | `#E2EEE6` | `#203329` |

Se muestran como **punto de 8 px + texto** ("Proteína 1") o como **barra segmentada + número**. Nunca como etiqueta de color lleno.

### Tema

- Por defecto se sigue la preferencia del sistema (`prefers-color-scheme`).
- En **Perfil** hay un selector: Automático / Claro / Oscuro. Se guarda en el navegador.

## Vidrio (Liquid Glass) — solo en celular

En pantallas de menos de 640 px la app usa superficies de vidrio translúcido sobre un fondo ambiental, al estilo de iOS. En escritorio todo sigue sólido, con los colores y radios de siempre: los mismos tokens cambian de valor en `@media (min-width: 640px)`.

| Token | Uso | Claro | Oscuro |
| --- | --- | --- | --- |
| `--glass-bg` | Tarjetas, botones secundarios, cápsula de fecha | `rgba(255,255,255,.55)` | `rgba(30,56,54,.42)` |
| `--glass-bg-strong` | Barra inferior, pestaña activa, hojas modales | `rgba(255,255,255,.72)` | `rgba(24,46,44,.72)` |
| `--glass-border` | Borde fino de luz | `rgba(255,255,255,.80)` | `rgba(255,255,255,.12)` |
| `--glass-blur` | Difuminado de lo que hay detrás | `blur(24px) saturate(180%)` | igual |
| `--glass-shadow` | Brillo interior arriba + sombra suave | — | — |
| `--btn-primary-bg` | Botón primario con leve degradé vertical | `#158581 → #0E6E6B` | `#57C6C1 → #3FB3AE` |
| `--ambient-1/2/3` | Manchas de color del fondo (verde azulado, amarillo, verde) | — | — |

- **Fondo ambiental:** tres degradés radiales fijos en `body::before`. Las páginas tienen fondo transparente para que se vea.
- **Tarjetas:** `--glass-bg` + `backdrop-filter: var(--glass-blur)` + borde `--glass-border` + `--glass-shadow`, radio 22 px.
- **Tarjeta "Ahora":** vidrio teñido con el color principal (`--glass-shadow-ahora`).
- **Botones:** en píldora (`--radius-pill`). Primario con `--btn-primary-bg`; secundarios de vidrio.
- **Chips de grupos:** tinte del grupo mezclado con transparente, en píldora (`--radius-chip`).
- **Barra inferior:** cápsula flotante de vidrio separada 16 px de los bordes; la pestaña activa es una "lente" más clara.
- **Resumen de Hoy:** un anillo de progreso por grupo (en escritorio siguen las barras).
- **Accesibilidad:** con `prefers-reduced-transparency` o sin soporte de `backdrop-filter`, el vidrio pasa a ser sólido.

## Tipografía

Dos familias de Google Fonts:

- **Bricolage Grotesque** (`--font-display`), peso 800: títulos, números, horas y el logo. Letter-spacing de −0,02 a −0,04 em; interlineado 1,05–1,1 en títulos.
- **DM Sans** (`--font-body`), pesos 400, 500 y 700: todo lo demás.

| Rol | Familia | Tamaño | Peso |
| --- | --- | --- | --- |
| Título de pantalla | Bricolage | 34 px, `letter-spacing: -0.03em` | 800 |
| Título de tarjeta destacada | Bricolage | 23 px, `letter-spacing: -0.02em` | 800 |
| Número destacado | Bricolage | 28–40 px | 800 |
| Título de sección | Bricolage | 18 px | 800 |
| Horarios | Bricolage | 15 px | 800 |
| Título de ítem | DM Sans | 15–16 px | 700 |
| Texto y botones | DM Sans | 15–16 px | 400 / 700 |
| Secundario | DM Sans | 13–14 px | 500 |
| Mínimo (etiquetas de navegación) | DM Sans | 11–12 px | 500–700 |

No usar IBM Plex, Inter, Roboto, Arial ni tipografías con serifa. Inputs siempre a 16 px para que el celular no haga zoom.

## Forma y espaciado

| Elemento | Radio |
| --- | --- |
| Encabezado de color (esquinas inferiores) | 24 px |
| Ícono de la app | 24 px |
| Tarjetas, paneles | 16 px |
| Botones, inputs | 12 px |
| Etiquetas, checkbox | 8 px |
| Puntos de grupo y de la línea de tiempo | redondo |

- Ritmo de espaciado de 4 px. Margen de pantalla en celular: 16–20 px.
- Dentro de una tarjeta: 12 px entre elementos. Entre tarjetas: 10–12 px.
- Sombra solo en la tarjeta destacada "Ahora": `0 6px 20px rgba(16, 38, 36, 0.08)`. El resto, planas (blanco sobre `--bg`).

## Componentes

**Logo.** La palabra "miga" en minúscula, Bricolage Grotesque 800, `letter-spacing: -0.04em`. El punto de la "i" es un círculo `--accent`: se escribe con "ı" (sin punto) y el círculo encima. Sobre `--primary` va en blanco; sobre fondo claro, en `--primary`.

**Ícono de la app.** Cuadrado `--primary` con radio 24 px, una "m" blanca en Bricolage 800 y un punto `--accent` arriba a la derecha. La "m" ocupa el 62 % del ancho y el conjunto se centra por peso visual (centro de masa de la "m" y el punto), no por su caja: así la "m" queda centrada y el punto acompaña arriba a la derecha. Archivos en `frontend/public/`: `apple-touch-icon.png` (180 px, iPhone; va cuadrado porque iOS redondea solo), `icon-192.png` e `icon-512.png` (Android, manifest) y `favicon.svg`.

**Encabezado de color.** Bloque `--primary` con radio inferior de 24 px. Arriba: logo a la izquierda y fecha a la derecha (`--on-primary-muted`, 14 px). Abajo: título humano en dos líneas ("Buen día. / Te quedan 3 comidas."). Padding inferior de 56 px para que se le superponga la tarjeta destacada.

**Tarjeta destacada "Ahora".** Fondo `--surface`, radio 16 px, con sombra y margen superior de −36 px sobre el encabezado. Contiene: "Ahora · Almuerzo 13:00" (`--primary`, 13 px, 700) y la etiqueta "Toca ahora"; el plato en Bricolage 23 px; los grupos con punto de color; y dos botones del mismo ancho: "Ya lo comí" (primario) y "Cambiar plato" (secundario).

**Botón primario.** Alto 44–48 px, fondo `--primary`, texto `--on-primary`, DM Sans 15 px / 700, radio 12 px.

**Botón secundario.** Alto 44 px, fondo `--primary-soft`, texto `--primary`, radio 12 px.

**Input.** Alto 44 px, borde 1 px `--border`, radio 12 px, fondo `--bg`. Etiqueta visible o, si el diseño no la muestra, oculta solo visualmente (nunca solo placeholder).

**Etiqueta.** Radio 8 px, 12 px / 700. "Toca ahora": fondo `--accent-soft`, texto `--on-accent-soft`.

**Línea de tiempo "Tu día".** Cada comida tiene un punto de 14 px sobre una línea vertical de 2 px en `--rail`. Punto relleno `--primary` = hecha; `--accent` = ahora; vacío con borde 2 px `--control` = pendiente. A la derecha del punto: plato (15 px / 700) y comida (13 px, `--muted`); la hora va alineada a la derecha en Bricolage. Lo ya hecho va en `--done`.

**Checkbox (lista de compras).** 22 px, radio 8 px. Toda la fila es el área táctil (mínimo 56 px de alto), con `role="checkbox"` y `aria-checked`. Marcado: fondo `--primary` y texto tachado en `--done`.

**Filtros.** Píldoras de 36 px. Activo: fondo `--primary`. Inactivo: fondo `--surface` con borde `--border`. Usan `aria-pressed`.

**Control segmentado.** Fondo `--primary-soft`, pestaña activa en `--surface`. `role="tablist"` / `aria-selected`.

**Barra de progreso de porciones.** Barra de 12 px dividida por grupo, cada tramo proporcional a sus porciones del día, con el tinte de fondo y el color del grupo como relleno. Debajo, leyenda con punto + `Grupo 2/3`.

**Navegación inferior (paciente).** 4 ítems: Hoy, Semana, Compras, Perfil. Alto 82 px, fondo `--surface`, borde superior `--line`. Ícono de línea de 24 px (trazo 2,2, puntas redondeadas) + etiqueta de 11 px. Activo: color `--primary` y `aria-current="page"`; inactivo: `--text-secondary`.

**Navegación lateral (nutricionista).** Ancho ~232 px, fondo `--surface`. Ítem activo con fondo `--primary-soft` y texto `--primary`.

**Íconos.** De línea, trazo 2,2, puntas redondeadas, sin emoji. Decorativos con `aria-hidden="true"`; los botones solo-ícono llevan `aria-label`.

## Interacción y accesibilidad

- Contraste mínimo 4,5:1 para texto (3:1 desde 24 px), verificado en ambos temas.
- Foco visible: `outline: 2px solid var(--primary); outline-offset: 2px` con `:focus-visible`.
- Presión: opacidad 0,85 durante 120 ms. Respetar `prefers-reduced-motion`.
- Zonas táctiles de 44 × 44 px como mínimo, con al menos 8 px entre ellas.
- Tablas anchas dentro de un contenedor con `overflow-x: auto`.

## Pantallas de referencia

| Pantalla | Puntos clave |
| --- | --- |
| **Paciente · Hoy** | Encabezado de color con logo, fecha y "Buen día. / Te quedan 3 comidas.". Tarjeta destacada "Ahora" con "Ya lo comí" y "Cambiar plato". Debajo, "Tu día" como línea de tiempo con las 4 comidas. Navegación inferior. |
| **Paciente · Cambiar plato** | Volver + "Cambiar almuerzo" y las porciones a cumplir. Control segmentado: *Platos* / *Armar con equivalencias*. Platos: buscador, filtros (Todos, Favoritos, Rápidos, De tu nutri), tarjetas con favorito. Equivalencias: un grupo por bloque con opciones en gramos. Botón fijo abajo: "Usar este plato". |
| **Paciente · Semana** | Contador `18/28 comidas` + barra. Botones "Autocompletar" y "Lista de compras". Una tarjeta por día con sus 4 comidas en filas; las vacías muestran "+ Elegir plato". |
| **Paciente · Compras** | Contador de productos. Input "Agregar producto". Secciones del súper con contador `2/5`. Filas con checkbox, nombre y cantidad. Botón compartir. |
| **Nutricionista · Pacientes y plan** | Navegación lateral + lista de pacientes con filtros (Todos, Requieren atención, Sin plan) y estado con punto + texto. Detalle: nombre, próxima consulta, indicadores, editor de porciones (tabla comidas × grupos con −/+ y total del día) y equivalencias en gramos. |

## Implementación

Los tokens viven en `frontend/src/index.css`. Las fuentes se cargan en `frontend/index.html`:

```html
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,800&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
```

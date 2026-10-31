# Guía de estilo — Miga

Estilo: **natural, cercano y de calidad**. Papel liso, tinta legible, verde para lo que se toca
y el amarillo del logo para marcar dónde estás. Funciona en modo claro y oscuro.

## Principios

1. **Poco texto y concreto.** Frases cortas y humanas que dicen el dato ("Faltó 1 cereal"), no evaluaciones vagas ("Casi").
2. **El color nunca va solo.** Todo dato con color (grupo de alimentos, estado) lleva también número o texto.
3. **Sin decoración.** Nada de orbes, auras, degradés, vidrio en tarjetas, brillos, sombras de color, emojis, etiquetas en mayúsculas sobre los títulos ni tarjetas con borde de color a un costado.
4. **Una sola acción principal por pantalla**, en color primario. El resto, botones secundarios.
5. **Lo urgente primero.** Cada pantalla abre con lo que la persona tiene que hacer ahora; lo demás se resume o se despliega.
6. **Pensado para el celular:** zonas táctiles de 44 px como mínimo y navegación inferior.
7. **Tono:** voseo uruguayo, directo, como un amigo ordenado. Nada de jerga técnica, eslóganes ni frases motivacionales.

## Concepto miga

Cumplir el plan es juntar cosas chicas: una porción, una comida, un día. **Cada porción del plan es una miga**, el punto de la i del logo llevado a toda la app. Se avanza miga a miga.

| Miga | Significado |
| --- | --- |
| Círculo lleno del color del grupo | Una porción que se comió |
| Contorno del color del grupo | Una porción que falta |
| Medio círculo | Media porción (lleno si se comió, contorno si falta) |
| Miga amarilla (`--accent`) | La del logo, la única que no es comida: marca "ahora" (la comida actual) y "hoy" |
| Miga verde en la semana | Una comida como el plan; media miga si faltó algo; contorno si no se anotó; contorno punteado si el día no llegó |

Reglas:

- **La miga es siempre un círculo liso**, como el punto del logo: sin formas irregulares, pan dibujado, texturas, bordes de refuerzo, sombras ni brillos.
- **"Porción" sigue siendo la palabra.** La miga es cómo se ve una porción; los datos dicen "porciones", como el plan de la nutricionista. La app nunca cambia el lenguaje ni el contenido del plan.
- **Siempre con su número o palabra al lado** ("2 de 5") y con un nombre accesible por fila ("Proteínas: 2 de 5 porciones"); los SVG de las migas van ocultos al lector de pantalla.
- **Al anotar** se rellenan solo las migas de esa comida y un texto dice qué se sumó y qué faltó. Sin animaciones de festejo.
- **La palabra "miga" se usa con medida:** landing, día vacío y estados vacíos. No en cada pantalla.
- **El punto final amarillo** aparece solo en el saludo de Hoy y en el titular de la landing, como firma de la marca.
- **La navegación no lleva migas:** la pestaña activa se marca con color, negrita y fondo suave.

## Tokens de color

Se definen como variables CSS en `frontend/src/index.css` y cambian según el tema. Nunca usar hex sueltos en los componentes.

| Token | Uso | Claro | Oscuro |
| --- | --- | --- | --- |
| `--bg` | Fondo de la app (papel) | `#F6F6F3` | `#111111` |
| `--surface` | Tarjetas, listas, barras | `#FFFFFF` | `#1A1A1A` |
| `--surface-2` | Fondo de controles segmentados, avisos, pistas de progreso | `#EEEEEA` | `#262626` |
| `--ink` | Texto principal | `#16201F` | `#EDEDEA` |
| `--muted` / `--text-secondary` | Texto secundario | `#5A6462` | `#A6A6A1` |
| `--muted-2` | Íconos e información terciaria | `#646E6C` | `#8F8F8A` |
| `--primary` | Acción principal, enlaces, selección, navegación activa | `#0E6E6B` | `#4DB8B2` |
| `--on-primary` | Texto sobre `--primary` | `#FFFFFF` | `#0B1F1E` |
| `--primary-soft` | Fondo de ítem seleccionado | `#E7F1F0` | `#18302F` |
| `--accent` | Punto del logo y miga de "ahora" / "hoy" | `#F6C344` | `#F6C344` |
| `--accent-soft` / `--on-accent-soft` | Etiqueta "Ahora" | `#FCEFC7` / `#5C4300` | `#3A3218` / `#F6D27A` |
| `--line` / `--line-soft` | Bordes de tarjetas y divisores | `#E3E4DF` / `#ECECE8` | `#2C2C2C` / `#222222` |
| `--control-border` | Bordes de campos (3:1) | `#858D8B` | `#7A7A75` |
| `--miga-empty` | Contorno de miga sin anotar en la semana | `#858D8B` | `#7A7A75` |
| `--ok` / `--warn` | Texto de estado "como el plan" / "faltó" | `#2F7A4F` / `#8A5A00` | `#7CC79A` / `#F0C46A` |
| `--error` / `--error-bg` | Errores | `#B42318` / `#FEF3F2` | `#F97066` / `#3A1C1A` |

- El oscuro es gris casi negro neutro: la elevación se marca con superficies más claras, no con verde.
- El amarillo nunca es color de texto ni fondo grande. Como siempre acompaña a una palabra ("Ahora", "Hoy"), no depende de su contraste.
- Contrastes verificados contra `--bg`, `--surface` y `--surface-2`: texto ≥ 4,5:1, migas y bordes de control ≥ 3:1.

### Grupos de alimentos

| Grupo | Color claro | Color oscuro | Tinte claro | Tinte oscuro |
| --- | --- | --- | --- | --- |
| Proteínas | `#C0704A` | `#C0704A` | `#F4E7E0` | `#3A2A24` |
| Cereales | `#A8822E` | `#C9A24A` | `#F4EEDD` | `#38321F` |
| Frutas | `#B5627A` | `#B5627A` | `#F4E4EA` | `#3A2630` |
| Lácteos | `#4F86B8` | `#4F86B8` | `#E3ECF5` | `#1F3045` |
| Grasas | `#8070B0` | `#8070B0` | `#ECE9F4` | `#2C2840` |
| Verduras | `#4E8F6A` | `#4E8F6A` | `#E2EEE6` | `#203329` |

El color del grupo se usa en las migas y en el punto de los chips. Los chips llevan el tinte de fondo y el texto en `--ink`.

### Tema

- Por defecto se sigue la preferencia del sistema (`prefers-color-scheme`).
- En **Perfil** hay un selector: Automático / Claro / Oscuro. Se guarda en el navegador.

## Superficies

- **Todo es sólido:** tarjetas `--surface` con borde de 1 px `--line` y sin sombra.
- **El único vidrio es la barra de navegación inferior**, porque el contenido pasa por debajo: `--nav-glass` + `backdrop-filter: var(--nav-blur)`. Con `prefers-reduced-transparency` o sin soporte de `backdrop-filter`, pasa a sólido.
- **Sombra** (`--shadow-float`) solo en lo que flota: la barra inferior, diálogos y menús.
- Agrupar con espacio antes que con tarjetas; una tarjeta se justifica para algo que se acciona por sí mismo. Las listas van en una sola superficie con divisores.

## Tipografía

| Rol | Familia | Tamaño / interlineado | Peso |
| --- | --- | --- | --- |
| Logo | Bricolage Grotesque | según contexto, `letter-spacing: -0.02em` | 700 |
| Título de pantalla (`h1`) | Bricolage Grotesque | 24 / 28 px, `letter-spacing: -0.01em` | 700 |
| Número destacado | Bricolage Grotesque | 28 / 32 px | 700 |
| Título de sección | DM Sans | 19 / 24 px | 600 |
| Título de tarjeta o fila | DM Sans | 16 / 20 px | 600 |
| Texto y botones | DM Sans | 16 / 24 px (botones 15 px) | 400 / 600 |
| Secundario y migas | DM Sans | 14 / 20 px | 400–500 |
| Chips | DM Sans | 13 / 18 px | 500 |
| Mínimo (etiquetas de navegación, días de la semana) | DM Sans | 12 / 16 px | 500–600 |

- Escala en proporción 1,2 (`--fs-cap`, `--fs-sm`, `--fs-body`, `--fs-h3`, `--fs-h1`, `--fs-num`).
- Sin etiquetas en mayúsculas ni letras apretadas. Sin IBM Plex, Inter, Roboto, Arial ni serifas.
- Inputs siempre a 16 px para que el celular no haga zoom.

## Forma y espaciado

| Elemento | Radio |
| --- | --- |
| Tarjetas, listas, barra de navegación (en píldora) | 12 px (la barra, 999 px) |
| Botones, campos, controles segmentados | 10 px |
| Chips de grupo | 999 px |
| Migas | círculo |

- Escala de 4 y 8 px (`--s1` a `--s6`): 4, 8, 12, 16, 24, 32.
- **Lo de afuera ≥ lo de adentro:** el espacio entre tarjetas es mayor o igual que su relleno.
- Tarjetas: relleno de 12 px y 8 px entre elementos internos. Margen de pantalla en celular: 16 px.

## Componentes

**Logo.** "miga" en minúscula, Bricolage Grotesque 700. El punto de la "i" es un círculo `--accent` liso: se escribe con "ı" (sin punto) y el círculo encima. Sobre fondo claro, en `--primary`.

**Ícono de la app.** Cuadrado `--primary` con radio 24 px, una "m" blanca y un punto `--accent` arriba a la derecha. Archivos en `frontend/public/`.

**Migas (`Migas`).** Fila por grupo: nombre (80 px), migas de 12 px con 4 px de separación y "2 de 5" alineado a la derecha. Si se comió de más, todas llenas y el texto lo dice ("6 de 5").

**Botón primario.** Alto 44 px, fondo `--primary` plano, texto `--on-primary`, DM Sans 15 px / 600, radio 10 px.

**Botón secundario.** Alto 44 px, fondo `--surface`, borde `--line`, texto `--ink`, radio 10 px.

**Campo.** Borde 1 px `--control-border`, radio 10 px, fondo `--surface`. Etiqueta visible o, si el diseño no la muestra, oculta solo visualmente (nunca solo placeholder).

**Etiqueta "Ahora".** Miga amarilla de 8 px + texto 12 px / 600 en `--on-accent-soft`.

**Control segmentado.** Fondo `--surface-2`, opción activa en `--surface` con sombra de 1 px. Usa `aria-pressed`.

**Navegación inferior.** Píldora compacta centrada, separada 14 px del borde inferior; pestañas de 62 × 54 px con ícono de línea de 22 px y etiqueta de 12 px. Activa: color `--primary`, negrita y fondo `--surface-2`, con `aria-current="page"`. El contenido de la página deja espacio inferior para que nunca quede tapado (WCAG 2.4.11).

**Íconos.** De línea, trazo 1,6–1,8, puntas redondeadas, sin emoji. Decorativos con `aria-hidden="true"`; los botones solo-ícono llevan `aria-label`.

## Interacción y accesibilidad

- Contraste mínimo 4,5:1 para texto (3:1 desde 24 px) y 3:1 para migas, bordes de control e indicadores, verificado en ambos temas.
- Foco visible: `outline: 2px solid var(--primary); outline-offset: 2px` con `:focus-visible`. Ningún elemento con foco puede quedar tapado por la barra inferior.
- Movimiento: solo transiciones de estado de unos 150 ms (tocar, desplegar, guardar). Sin animaciones de entrada, flotantes ni de festejo. Respetar `prefers-reduced-motion`.
- Zonas táctiles de 44 × 44 px como mínimo, con al menos 8 px entre ellas.
- Tablas anchas dentro de un contenedor con `overflow-x: auto`.

## Pantallas de referencia

| Pantalla | Puntos clave |
| --- | --- |
| **Hoy** | Saludo con punto final amarillo. Primero la comida de ahora con sus migas, el campo para anotar, Guardar y Dictar. Después "Tu día por grupo" desplegable con migas por grupo. Al final, las comidas anteriores como filas con su estado en texto. Día vacío: una frase explica las migas. |
| **Mi plan** | Comidas en una sola superficie con filas; editar y borrar como botones de 44 px sin recuadro; "Agregar comida" como última fila y "Confirmar plan" al final. |
| **Semana** | Tira de 7 días con una miga por comida (sale del plan de cada día) y la miga amarilla en hoy. Debajo, el detalle del día elegido y los hábitos como casillas. Descarga en un solo botón. |
| **Landing** | Titular "Tu plan, miga a miga." con punto amarillo. El plan en papel traducido a migas. Textos concretos sobre porciones, intercambios y datos de salud. |

## Implementación

Los tokens viven en `frontend/src/index.css`. Las fuentes se cargan en `frontend/index.html`:

```html
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700..800&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
```

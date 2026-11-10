# Guía de estilo — Miga

Estilo: **natural, cercano y de calidad**. Papel salvia, tinta negra, verde bosque para el logo y el
amarillo del punto de la i para marcar dónde estás. Funciona en modo claro y oscuro.

## Principios

1. **Anotar primero.** La comida de ahora y su campo están siempre a la vista. Nada del rediseño suma pasos para anotar.
2. **Poco texto y concreto.** Frases cortas y humanas que dicen el dato ("Faltó 1 verdura"), no evaluaciones vagas.
3. **El color nunca va solo.** Todo dato con color (grupo, estado) lleva también número o texto.
4. **Mostrar cómo se entendió, nunca juzgar.** Toda devolución se puede abrir para ver la regla que la produjo.
5. **Sin decoración.** Nada de orbes, degradés de adorno, vidrio en tarjetas, emojis, etiquetas en mayúsculas sobre los títulos ni tarjetas con borde de color a un costado.
6. **Una sola acción principal por pantalla**, en negro (claro) o crema (oscuro). El resto, botones secundarios.
7. **Pensado para el celular:** zonas táctiles de 44 px como mínimo y navegación inferior.
8. **Tono:** voseo uruguayo, directo, como un amigo ordenado. Nada de jerga técnica, eslóganes ni frases motivacionales.

## Concepto: migas y tira del día

Cada porción del plan es una miga: un círculo liso del color de su grupo.

La tira del día reúne todas las comidas en una fila tocable con nombre y miga de estado. Una banda marca la selección y se desliza al elegir otra comida. Un punto amarillo con «Sigue» indica la próxima comida, independiente de la seleccionada. «Tu día por grupo» se despliega dentro de la tarjeta del día.

Antes de anotar, el panel muestra «Te toca» con las porciones por grupo, campo, «Lo de siempre», Guardar y Dictar. Después muestra el texto y las diferencias en palabras, Editar y una sola hoja «Así lo entendí» para revisar y corregir. Preguntas y alimentos sin reconocer quedan a la vista.

Los hábitos se anotan con migas tocables y un «+» final para superar la meta. Los hábitos largos o sin meta usan un número con − y +. Las casillas quedan para opciones puntuales de los formularios.

**La tarjeta de la semana.** Semana es una tarjeta de sellos: una fila por comida del plan, una columna por día y una miga por comida.

| Miga en la semana | Significado |
| --- | --- |
| Llena en tinta | Como el plan |
| Mitad llena | Faltó o sobró algo, o queda una pregunta |
| Llena en gris | Anotada sin comparación (plan libre) |
| Contorno | Sin anotar |
| Contorno punteado | El día todavía no llegó |
| Guion corto | El plan de ese día no tiene esa comida |

Reglas:

- **La miga es siempre un círculo liso**: sin texturas, pan dibujado, sombras ni brillos.
- **"Porción" sigue siendo la palabra.** La miga es cómo se ve; los datos dicen "porciones", como el plan de la nutricionista.
- **La palabra "miga" se usa con medida:** landing, día vacío y estados vacíos.
- **El punto final amarillo** aparece solo en el saludo de Hoy y en el titular de la landing.

## Tokens de color

Se definen como variables CSS en `frontend/src/index.css`. Nunca usar hex sueltos en los componentes.

| Token | Uso | Claro | Oscuro |
| --- | --- | --- | --- |
| `--bg` | Fondo de la app | `#F2F1EA` | `#121212` |
| `--surface` | Tarjetas, listas, hojas | `#FBFAF5` | `#1C1C1C` |
| `--surface-2` / `--surface-3` | Banda de selección, chips, controles segmentados / su hover | `#E8E6DA` / `#DEDBCB` | `#262626` / `#303030` |
| `--ink` | Texto principal y migas de la semana | `#040200` | `#F3EFE6` |
| `--muted` / `--text-secondary` | Texto secundario | `#3F5E3A` | `#ADA89D` |
| `--primary` / `--on-primary` | Acción principal | `#040200` / `#F2F1EA` | `#F3EFE6` / `#121212` |
| `--brand` | Logo | `#2F6336` | `#F3EFE6` |
| `--accent` / `--on-accent` | «Sigue», «Hoy», punto del logo | `#F6C344` / `#3A2A00` | igual |
| `--line` | Divisores | `#E2E0D3` | `#2C2C2C` |
| `--control-border` / `--miga-empty` | Bordes de campos y migas vacías (3:1) | `#6B8066` | `#8A867C` |
| `--ok` | "Como el plan" | `#2F6B45` | `#7CC79A` |
| `--warn` / `--warn-soft` | Faltantes y excesos | `#A9431B` / `#F8E6DB` | `#F4A57E` / `#38271F` |
| `--error` / `--error-bg` | Errores | `#B42318` / `#FDEDEB` | `#F97066` / `#3A1C1A` |

- **El oscuro es neutro:** grises casi negros, sin verde. La elevación se marca con grises más claros, no con color.
- **El amarillo nunca es color de texto** y siempre acompaña a una palabra («Sigue», «Hoy»). Lleva `--on-accent` encima, nunca blanco.
- **Se evita juntar naranja y verde.** El verde bosque queda solo para el logo.
- Contrastes verificados: texto ≥ 4,5:1 y migas, bordes de control e indicadores ≥ 3:1, en ambos temas.

### Grupos de alimentos

| Grupo | Claro | Oscuro |
| --- | --- | --- |
| Proteínas | `#C8553D` | `#E6707B` |
| Cereales | `#9A7420` | `#E3B04F` |
| Frutas | `#B04A72` | `#E07AA0` |
| Lácteos | `#3F7FB5` | `#6FA8DA` |
| Grasas | `#6F63B8` | `#9C91E0` |
| Verduras | `#2E8B6E` | `#7CC277` |

Los colores de grupo se usan en migas y puntos, **nunca como color de texto**: el texto va en tinta, con un punto del color al lado. Los grupos guardan su color como el hex de la paleta original (`GROUP_PALETTE`) y la app lo traduce al token del tema, así que cambiar la paleta no toca los datos.

### Tema

- Por defecto se sigue la preferencia del sistema (`prefers-color-scheme`).
- En **Perfil** hay un selector: Automático / Claro / Oscuro. Se guarda en el navegador.

## Superficies

- **Tarjetas sin borde, con sombra suave** (`--shadow-card`): una de 1 px y una difusa. En oscuro la sombra pasa a un filo de 1 px más claro.
- **Lo que flota** (navegación inferior, hojas, menús) usa `--shadow-float`.
- **El único vidrio es la barra de navegación inferior.** Con `prefers-reduced-transparency` pasa a sólido.
- Agrupar con espacio antes que con tarjetas. Las listas van en una sola superficie con divisores.

## Tipografía

| Rol | Familia | Tamaño / interlineado | Peso |
| --- | --- | --- | --- |
| Logo | Bricolage Grotesque | según contexto | 700–800 |
| Título de pantalla (`h1`) | Bricolage Grotesque | 28 / 32 px | 700 |
| Número destacado | Bricolage Grotesque | 44 / 44 px | 700 |
| Título de sección | Onest | 19 / 24 px | 600 |
| Texto y botones | Onest | 16 / 24 px (botones 15 px) | 400 / 600 |
| Secundario | Onest | 14 / 20 px | 400–500 |
| Mínimo | Onest | 12 / 16 px | 600 |

- Números que cambian, con `font-variant-numeric: tabular-nums`.
- Títulos con `text-wrap: balance`; párrafos con `text-wrap: pretty`.
- Inputs siempre a 16 px para que el celular no haga zoom.

## Forma y espaciado

| Elemento | Radio |
| --- | --- |
| Panel de la comida seleccionada | 20 px |
| Tarjetas y listas | 16 px |
| Botones, campos, controles segmentados | 12 px |
| Hojas inferiores | 24 px arriba |
| Chips y etiquetas | 999 px |

- Escala de 4 y 8 px (`--s1` a `--s6`).
- Botón principal de 48 px de alto.

## Movimiento

Solo se mueve lo que cambió por algo que hiciste. Anotar nunca espera a una animación.

| Momento | Qué se mueve | Tiempo y curva | Cómo |
| --- | --- | --- | --- |
| Abrir una hoja | Sube 24 px y aparece | 400 ms, `--ease-out` | CSS |
| Cambiar de día o de vista | La franja o la pastilla se desliza | 250 ms ida y vuelta | CSS |
| Tocar un botón | Se achica a 0,96 | 150 ms | CSS |
| Cambiar de pantalla | Nada | — | — |

- Tokens: `--ease-out`, `--dur-quick` (150), `--dur-fast` (250), `--dur-medium` (350), `--dur-slow` (400).
- Al cargar la pantalla no se anima nada. Con `prefers-reduced-motion` no corre nada: el estado ya está dibujado.

## Pantallas

| Pantalla | Puntos clave |
| --- | --- |
| **Landing** | Inicio con demo de tres comidas, tres pasos, tarjeta semanal y exportación para la nutri, hábitos interactivos, límites, origen y cierre. Usa las piezas de la app, con claro y oscuro; [prototipo v3.1](landing-v3.1.html). |
| **Hoy** | Saludo con punto amarillo, tira del día con banda y punto «Sigue», resumen por grupo desplegable y panel de la comida elegida. «Te toca» antes de anotar; texto y diferencias en palabras después. Una hoja «Así lo entendí». Hábitos con migas y «+». |
| **Semana** | Exportar, resumen «N de M comidas como el plan», selector Tarjeta / Planilla, sellos de comidas y hábitos con franja del día elegido. El detalle abre esa fecha en Hoy. Metas semanales con hábitos automáticos. |
| **Exportar** | Excel y PDF por impresión del navegador; la persona descarga y comparte el archivo. |
| **Mi plan** | Portada con migas y «Actualizado el». Tocar una comida abre su hoja de edición, con tope visible de 12 porciones. Hábitos con vista previa, alimentos y grupos editables. |
| **Perfil** | Datos personales, tema Automático / Claro / Oscuro, acceso a exportar y cierre de sesión. |

En escritorio se conserva la barra lateral y una columna de hasta 480 px.

## Definiciones D1–D14

Reglas de la [épica #352](https://github.com/facugutierrez25/miga/issues/352) y el [prototipo v3](prototipo-v3.html).

| N.º | Definición | Regla |
| --- | --- | --- |
| D1 | Miga de comida | Llena: como el plan. Media: faltó, sobró o queda una pregunta. Amarilla: flexible. Gris: anotada sin comparación. Contorno: sin anotar. Punteada: fecha futura. |
| D2 | Extra sin porciones | No es pendiente ni cuenta en comidas como el plan. Sin anotar: «+» en Hoy y guion en Semana. |
| D3 | Sigue | Solo hoy: primera comida con horario sin anotar cuya hora no pasó hace más de 90 minutos. Si todas pasaron, última con horario sin anotar. Si no queda ninguna, no aparece. Nunca una comida sin horario. |
| D4 | Selección inicial | La que sigue; en otra fecha o sin próxima comida, primera con horario sin anotar y, en su defecto, primera del plan. Se conserva mientras hay un borrador sin guardar. |
| D5 | Flexible | Estado propio de la comida, independiente de los hábitos. No se compara ni suma porciones. |
| D6 | Antes de anotar | «Te toca», porciones por grupo, campo, «Lo de siempre», Guardar y Dictar. |
| D7 | Comida anotada | Texto, diferencias en palabras («Faltó 1 porción de Grasas»), preguntas y alimentos sin reconocer visibles, Editar y «Así lo entendí». |
| D8 | Así lo entendí | Una sola hoja: alimento, cómo contó, regla y Corregir en la misma fila. La corrección vale para esa comida; «Usar siempre» la guarda como regla propia. |
| D9 | Hábito con migas | Migas = meta ÷ paso. Tocar N fija N pasos; tocar la última llena la vacía. «+» suma un paso por encima de la meta y muestra «+N». Sí o no usa una sola miga. |
| D10 | Hábito largo | Más de 6 pasos o sin meta: número con − y +. |
| D11 | Ubicación del hábito | Los automáticos, como flexibles, solo se ven en Semana. Los manuales, incluso semanales, se anotan en Hoy; Semana acumula el total contra la meta. |
| D12 | Hábito en Semana | Llena: meta cumplida, o valor mayor que 0 sin meta. Media: hizo algo. Contorno: nada. |
| D13 | Resumen semanal | «N de M comidas como el plan»: M cuenta las comidas con porciones de los días hasta hoy. |
| D14 | Edición por comida | Tocar una comida abre la edición de esa sola, con tope visible de 12 porciones. Cada guardado crea una nueva versión del plan. |

## Implementación

Los tokens viven en `frontend/src/index.css`. Las fuentes se cargan en `frontend/index.html`:

```html
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700..800&family=Onest:wght@400;500;600;700&display=swap" rel="stylesheet">
```

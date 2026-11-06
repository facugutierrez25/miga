# Guía de estilo — Miga

Estilo: **natural, cercano y de calidad**. Papel salvia, tinta negra, oliva para el logo y el
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

## Concepto: migas y ficha de dominó

Cumplir el plan es juntar cosas chicas. **Cada porción del plan es una miga**, un círculo liso del color de su grupo.

**La ficha.** La comida de ahora se muestra como una ficha de dominó: a la izquierda las porciones que pide el plan, a la derecha las que se anotaron. Si las dos mitades coinciden, la comida va como el plan. El clavo del medio es el punto amarillo del logo.

| Ficha | Regla |
| --- | --- |
| Hasta 9 porciones | Se dibujan como un dado (patrón de 1 a 9 en una grilla de 3 × 3) |
| De 10 a 12 porciones | Grilla de 4 × 3, en el orden de los grupos |
| Más de 12 | No pasa: Mi plan no deja guardar más de 12 porciones por comida. Si un plan viejo las tuviera, se muestran filas por grupo |
| Media porción | Medio círculo, lleno o en contorno |

Debajo de la ficha, una línea por grupo con su número ("Verduras 1 de 2"); cada línea tiene su nombre accesible con la diferencia ("Verduras: 1 de 2, falta 1").

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
| `--surface-2` / `--surface-3` | Ficha, chips, controles segmentados / su hover | `#E8E6DA` / `#DEDBCB` | `#262626` / `#303030` |
| `--ink` | Texto principal y migas de la semana | `#040200` | `#F3EFE6` |
| `--muted` / `--text-secondary` | Texto secundario | `#5E5A2E` | `#ADA89D` |
| `--primary` / `--on-primary` | Acción principal | `#040200` / `#F2F1EA` | `#F3EFE6` / `#121212` |
| `--brand` | Logo | `#7C773F` | `#F3EFE6` |
| `--accent` / `--on-accent` | "Ahora", "Hoy", clavo de la ficha, punto del logo | `#F6C344` / `#3A2A00` | igual |
| `--line` | Divisores | `#E2E0D3` | `#2C2C2C` |
| `--control-border` / `--miga-empty` | Bordes de campos y migas vacías (3:1) | `#857F62` | `#8A867C` |
| `--ok` | "Como el plan" | `#2F6B45` | `#7CC79A` |
| `--warn` / `--warn-soft` | Faltantes y excesos | `#A9431B` / `#F8E6DB` | `#F4A57E` / `#38271F` |
| `--error` / `--error-bg` | Errores | `#B42318` / `#FDEDEB` | `#F97066` / `#3A1C1A` |

- **El oscuro es neutro:** grises casi negros, sin verde. La elevación se marca con grises más claros, no con color.
- **El amarillo nunca es color de texto** y siempre acompaña a una palabra ("Ahora", "Hoy"). Lleva `--on-accent` encima, nunca blanco.
- **Se evita juntar naranja y verde.** El oliva queda solo para el logo.
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
| Tarjeta de la comida de ahora | 20 px |
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
| Anotar una comida | Aparecen solo las porciones nuevas de la ficha, una tras otra | 500 ms, cada 60 ms, `back.out` | GSAP con `useGSAP` en `FichaComida` |
| Abrir una hoja | Sube 24 px y aparece | 400 ms, `--ease-out` | CSS |
| Cambiar de día o de vista | La franja o la pastilla se desliza | 250 ms ida y vuelta | CSS |
| Tocar un botón | Se achica a 0,96 | 150 ms | CSS |
| Cambiar de pantalla | Nada | — | — |

- Tokens: `--ease-out`, `--dur-quick` (150), `--dur-fast` (250), `--dur-medium` (350), `--dur-slow` (400).
- Al cargar la pantalla no se anima nada. Con `prefers-reduced-motion` no corre nada: el estado ya está dibujado.

## Pantallas

| Pantalla | Puntos clave |
| --- | --- |
| **Hoy** | Saludo con punto final amarillo. La comida de ahora con la etiqueta "Ahora", su ficha, el campo, "Lo de siempre", Guardar y Dictar. "Así lo entendí" con "Cómo lo calculé", que abre una hoja con cada cosa escrita, el tipo de regla y el resultado. Después, "Tu día por grupo", y las comidas en "Después" y "Antes", con su hora. |
| **Semana** | Botón "Exportar" junto al título. Número grande de comidas como el plan. Control segmentado Tarjeta / Planilla. La tarjeta de sellos con la franja del día elegido; debajo, el detalle del día y los hábitos. |
| **Exportar** | Solo Excel y PDF (PDF por la impresión del navegador). Se descarga en el celular y la persona lo manda: no hay links ni fecha de consulta guardada. |
| **Mi plan** | Hasta 12 porciones por comida, con el contador visible al editar. Las correcciones que hace la persona son reglas suyas: no cambian el plan de su nutricionista. |

## Implementación

Los tokens viven en `frontend/src/index.css`. Las fuentes se cargan en `frontend/index.html`:

```html
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700..800&family=Onest:wght@400;500;600;700&display=swap" rel="stylesheet">
```

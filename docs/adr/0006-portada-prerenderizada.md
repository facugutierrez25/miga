# ADR 0006: portada prerenderizada durante el build

## Contexto
La portada pública depende de JavaScript para entregar sus textos. Se necesita facilitar su indexación sin cambiar su diseño, sus interacciones ni el comportamiento de las rutas autenticadas.

## Decisión
Vite compila una entrada SSR temporal que renderiza el mismo componente LandingPage con una sesión anónima y sus valores iniciales. El build inserta ese contenido en index.html y elimina el bundle temporal. React hidrata la portada; las demás rutas mantienen createRoot y una plantilla app.html vacía. Vercel sirve index.html solo para la raíz y app.html para las rutas de la app.

La portada tiene descripción y canónica; sitemap.xml incluye solo esa URL. Las rutas de la app reciben noindex y no comparten la canónica de portada. La navegación del cliente mantiene estos metadatos. Robots permite el rastreo para que los buscadores puedan leer noindex. Esto no reemplaza la autenticación ni protege datos.

## Consecuencias
No se agregan dependencias ni servidor SSR en producción. El build falla si no se genera la portada. Los textos y estilos siguen teniendo una sola implementación. Se verifica tanto el HTML sin JavaScript como la hidratación y las interacciones con JavaScript.

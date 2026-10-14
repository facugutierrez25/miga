// Logo de Miga: la palabra con el punto de la "i" en amarillo (ver docs/diseno/guia-de-estilo.md)
export default function Brand({ size = 26 }: { size?: number }) {
  return (
    <span className="brand" role="img" aria-label="Miga" style={{ fontSize: size }}>
      m<span className="brand-i" aria-hidden="true">ı</span>ga
    </span>
  )
}

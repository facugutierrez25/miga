# ADR 0007: Flexible con grupos

Estado: aceptado. Decidido por Facu en #394.

La marca de flexible es independiente de los grupos y sus porciones. Una ocurrencia NORMAL o COMPUESTO puede sumar sus porciones habituales y contar una sola vez como flexible, aunque tenga varias filas.

Se persiste `counts_flexible` en reglas y entradas. El estado de la comida es FLEXIBLE cuando contiene una ocurrencia flexible; los totales y comparaciones conservan sus porciones. Semana, metas y exportaciones consumen el mismo conteo por ocurrencia.

El tipo FLEXIBLE sin grupos se conserva por compatibilidad y siempre cuenta como flexible. La migración V42 agrega ambas columnas con valor inicial falso, sin transformar los datos existentes.

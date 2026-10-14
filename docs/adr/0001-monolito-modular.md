# ADR 0001 — Monolito modular

- **Estado:** aceptada
- **Fecha:** 2026-09-23

## Contexto

Miga lo desarrolla una sola persona, de punta a punta. Los datos del dominio
(plan, alimentos, recetas, menú, lista de compras) están muy relacionados y se
consultan juntos. La app tiene que soportar usuarios concurrentes.

## Decisión

Un **monolito modular** con Spring Boot:

- Cada subpaquete directo de `uy.miga` es un módulo con su interfaz pública.
- Spring Modulith verifica en los tests que ningún módulo use clases internas de otro.
- La comunicación entre módulos se hace por llamadas a su API pública o por eventos internos.
- La API es sin estado, para poder correr varias instancias detrás de un balanceador.

## Consecuencias

- Un solo deploy, una sola base, transacciones simples.
- Si un módulo necesita escalar aparte (por ejemplo, el job de precios), se puede
  extraer a un servicio sin reescribir el resto.
- Hay que cuidar los límites entre módulos: el test de modularidad lo controla.

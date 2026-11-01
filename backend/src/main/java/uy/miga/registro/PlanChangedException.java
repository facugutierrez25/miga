package uy.miga.registro;

// La comida pedida no pertenece al plan vigente de esa fecha: el cliente tiene un plan desactualizado.
class PlanChangedException extends RuntimeException {
}

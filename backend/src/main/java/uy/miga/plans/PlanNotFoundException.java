package uy.miga.plans;

public class PlanNotFoundException extends RuntimeException {
    public PlanNotFoundException() {
        super("El usuario no tiene un plan cargado.");
    }
}

package uy.miga.plans;

public class PlanConflictException extends RuntimeException {
    public PlanConflictException() {
        super("El plan fue modificado por otra sesión. Recargá para ver la versión actual.");
    }
}

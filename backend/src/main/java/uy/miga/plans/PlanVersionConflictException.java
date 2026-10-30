package uy.miga.plans;
public class PlanVersionConflictException extends RuntimeException { public PlanVersionConflictException() { super("El plan cambió en otra sesión. Recargá para ver la versión actual."); } }

package uy.miga.plans;

public class InvalidPortionsException extends RuntimeException {
    public InvalidPortionsException() {
        super("Las porciones deben ser múltiplos de 0.5.");
    }
}

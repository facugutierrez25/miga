package uy.miga.users;

public class InvalidCredentialsException extends RuntimeException {
    public InvalidCredentialsException() {
        super("Email o contraseña incorrectos.");
    }
}

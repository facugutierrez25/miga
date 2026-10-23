package uy.miga.users;

public class InvalidVerificationTokenException extends RuntimeException {
    InvalidVerificationTokenException() {
        super("Invalid or expired verification token");
    }
}

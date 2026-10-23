package uy.miga.users;

interface EmailService {
    void sendVerificationEmail(String to, String token);
}

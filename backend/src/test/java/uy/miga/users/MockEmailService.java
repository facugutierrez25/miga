package uy.miga.users;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

@Service
@Profile("test")
class MockEmailService implements EmailService {

    private String lastToken;

    @Override
    public void sendVerificationEmail(String to, String token) {
        this.lastToken = token;
    }

    String getLastToken() {
        return lastToken;
    }

    void reset() {
        this.lastToken = null;
    }
}

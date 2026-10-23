package uy.miga.users;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.stereotype.Service;

// Fallback: activo cuando no hay ResendEmailService (sin API key configurada).
@Service
@ConditionalOnMissingBean(EmailService.class)
class LogEmailService implements EmailService {

    private static final Logger log = LoggerFactory.getLogger(LogEmailService.class);

    private final String baseUrl;

    LogEmailService(@Value("${app.base-url}") String baseUrl) {
        this.baseUrl = baseUrl;
    }

    @Override
    public void sendVerificationEmail(String to, String token) {
        String link = baseUrl + "/verificar-email?token=" + token;
        log.info("=== VERIFICACIÓN EMAIL ===");
        log.info("Para: {}", to);
        log.info("Link: {}", link);
        log.info("=========================");
    }
}

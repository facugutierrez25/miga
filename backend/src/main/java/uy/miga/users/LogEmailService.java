package uy.miga.users;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

// Fallback para desarrollo local: activo solo en perfil "local" cuando no hay ResendEmailService.
@Service
@Profile("local")
@ConditionalOnMissingBean(EmailService.class)
class LogEmailService implements EmailService {

    private static final Logger log = LoggerFactory.getLogger(LogEmailService.class);

    private final String baseUrl;
    private final boolean logLinks;

    LogEmailService(@Value("${app.base-url}") String baseUrl,
                    @Value("${app.mail.log-links:false}") boolean logLinks) {
        this.baseUrl = baseUrl;
        this.logLinks = logLinks;
    }

    // Sin proveedor de correo, el enlace (que contiene el token) solo se muestra si se
    // activa app.mail.log-links en desarrollo; nunca se registra el email del usuario.
    @Override
    public void sendVerificationEmail(String to, String token) {
        if (logLinks) {
            log.info("Enlace de verificación (solo desarrollo): {}/verificar-email?token={}", baseUrl, token);
        } else {
            log.info("Email de verificación preparado; activá app.mail.log-links para ver el enlace en desarrollo");
        }
    }
}

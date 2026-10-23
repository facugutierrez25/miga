package uy.miga.users;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

// Activo cuando resend.api-key tiene valor, en cualquier entorno excepto test.
@Service
@Profile("!test")
@ConditionalOnExpression("T(org.springframework.util.StringUtils).hasText('${resend.api-key:}')")
class ResendEmailService implements EmailService {

    private final RestClient restClient;
    private final String from;
    private final String baseUrl;

    ResendEmailService(
            @Value("${resend.api-key}") String apiKey,
            @Value("${app.mail.from}") String from,
            @Value("${app.base-url}") String baseUrl) {
        this.from = from;
        this.baseUrl = baseUrl;
        this.restClient = RestClient.builder()
                .baseUrl("https://api.resend.com")
                .defaultHeader("Authorization", "Bearer " + apiKey)
                .defaultHeader("Content-Type", "application/json")
                .build();
    }

    @Override
    public void sendVerificationEmail(String to, String token) {
        String link = baseUrl + "/verificar-email?token=" + token;
        String html = """
                <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
                  <p style="font-size:22px;font-weight:700;margin:0 0 8px">Verificá tu email</p>
                  <p style="color:#555;margin:0 0 28px">
                    Hacé clic en el botón para confirmar tu cuenta en Miga.
                  </p>
                  <a href="%s"
                     style="display:inline-block;background:#2e7d32;color:#fff;padding:12px 28px;
                            text-decoration:none;border-radius:8px;font-weight:700">
                    Verificar email
                  </a>
                  <p style="color:#999;font-size:13px;margin:28px 0 0">
                    El link expira en 24 horas. Si no creaste una cuenta en Miga, ignorá este email.
                  </p>
                </div>
                """.formatted(link);

        restClient.post()
                .uri("/emails")
                .body(Map.of(
                        "from", from,
                        "to", List.of(to),
                        "subject", "Verificá tu email en Miga",
                        "html", html))
                .retrieve()
                .toBodilessEntity();
    }
}

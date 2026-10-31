package uy.miga;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.function.Supplier;

import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.authorization.AuthorizationManager;
import org.springframework.security.authorization.AuthorizationResult;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.access.intercept.RequestAuthorizationContext;

// Autoriza los endpoints operativos solo si el encabezado X-Ops-Key coincide con la clave configurada.
class OpsKeyAuthorizationManager implements AuthorizationManager<RequestAuthorizationContext> {

    static final String HEADER = "X-Ops-Key";

    private final byte[] expected;

    OpsKeyAuthorizationManager(String apiKey) {
        this.expected = apiKey == null ? new byte[0] : apiKey.getBytes(StandardCharsets.UTF_8);
    }

    @Override
    public AuthorizationResult authorize(Supplier<? extends Authentication> authentication,
                                         RequestAuthorizationContext context) {
        String provided = context.getRequest().getHeader(HEADER);
        if (expected.length == 0 || provided == null) return new AuthorizationDecision(false);
        return new AuthorizationDecision(
            MessageDigest.isEqual(expected, provided.getBytes(StandardCharsets.UTF_8)));
    }
}

package uy.miga.users;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;

@Service
@Profile("test")
public class MockEmailService implements EmailService {

    private String lastToken;
    private final Map<String, String> tokensByRecipient = new ConcurrentHashMap<>();
    private final List<Boolean> transactionStates = new ArrayList<>();
    private final List<String> recipients = new ArrayList<>();
    private Consumer<String> onSend = recipient -> {};

    @Override
    public void sendVerificationEmail(String to, String token) {
        transactionStates.add(TransactionSynchronizationManager.isActualTransactionActive());
        recipients.add(to);
        onSend.accept(to);
        this.lastToken = token;
        tokensByRecipient.put(to, token);
    }

    List<Boolean> getTransactionStates() { return List.copyOf(transactionStates); }
    List<String> getRecipients() { return List.copyOf(recipients); }
    void setOnSend(Consumer<String> onSend) { this.onSend = onSend; }

    public String getLastToken() {
        return lastToken;
    }

    // Token del último email enviado a esa dirección. Procesa lotes hasta encontrarlo, porque los emails
    // que otros tests registran sin procesar se acumulan y pueden ocupar el primer lote.
    public String tokenAfterProcessing(EmailOutboxWorker worker, String recipient) {
        for (int i = 0; i < 20 && tokensByRecipient.get(recipient) == null; i++) {
            worker.processJobs();
        }
        return tokensByRecipient.get(recipient);
    }

    public void reset() {
        this.lastToken = null;
        tokensByRecipient.clear();
        transactionStates.clear();
        recipients.clear();
        onSend = recipient -> {};
    }
}

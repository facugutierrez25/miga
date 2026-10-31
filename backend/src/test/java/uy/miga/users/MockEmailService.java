package uy.miga.users;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

@Service
@Profile("test")
public class MockEmailService implements EmailService {

    private String lastToken;
    private final List<Boolean> transactionStates = new ArrayList<>();
    private final List<String> recipients = new ArrayList<>();
    private Consumer<String> onSend = recipient -> {};

    @Override
    public void sendVerificationEmail(String to, String token) {
        transactionStates.add(TransactionSynchronizationManager.isActualTransactionActive());
        recipients.add(to);
        onSend.accept(to);
        this.lastToken = token;
    }

    List<Boolean> getTransactionStates() { return List.copyOf(transactionStates); }
    List<String> getRecipients() { return List.copyOf(recipients); }
    void setOnSend(Consumer<String> onSend) { this.onSend = onSend; }

    public String getLastToken() {
        return lastToken;
    }

    public void reset() {
        this.lastToken = null;
        transactionStates.clear();
        recipients.clear();
        onSend = recipient -> {};
    }
}

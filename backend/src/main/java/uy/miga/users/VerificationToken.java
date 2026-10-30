package uy.miga.users;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "email_verification_tokens")
class VerificationToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, unique = true)
    private String token;

    @Column(name = "expires_at", nullable = false)
    private OffsetDateTime expiresAt;

    Long getId() { return id; }

    VerificationToken() {}

    VerificationToken(User user, String token, OffsetDateTime expiresAt) {
        this.user = user;
        this.token = token;
        this.expiresAt = expiresAt;
    }

    User getUser() { return user; }
    String getToken() { return token; }
    OffsetDateTime getExpiresAt() { return expiresAt; }
}

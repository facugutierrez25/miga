package uy.miga.users;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "refresh_tokens")
class RefreshToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "token_hash", nullable = false, unique = true, length = 64)
    private String tokenHash;

    @Column(name = "family_id", nullable = false)
    private UUID familyId;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "expires_at", nullable = false)
    private OffsetDateTime expiresAt;

    @Column(name = "used_at")
    private OffsetDateTime usedAt;

    @Column(name = "revoked_at")
    private OffsetDateTime revokedAt;

    RefreshToken() {}

    RefreshToken(User user, String tokenHash, UUID familyId, OffsetDateTime createdAt, OffsetDateTime expiresAt) {
        this.user = user;
        this.tokenHash = tokenHash;
        this.familyId = familyId;
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
    }

    User getUser() { return user; }
    UUID getFamilyId() { return familyId; }
    OffsetDateTime getExpiresAt() { return expiresAt; }
    OffsetDateTime getUsedAt() { return usedAt; }
    OffsetDateTime getRevokedAt() { return revokedAt; }
    void markUsed(OffsetDateTime when) { this.usedAt = when; }
}

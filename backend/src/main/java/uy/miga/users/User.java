package uy.miga.users;

import jakarta.persistence.*;

import java.time.LocalDate;
import java.time.OffsetDateTime;

@Entity
@Table(name = "users")
class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private Role role;

    @Column(name = "email_verified", nullable = false)
    private boolean emailVerified;

    @Column(name = "first_name")
    private String firstName;

    @Column(name = "last_name")
    private String lastName;

    @Column(name = "birth_date")
    private LocalDate birthDate;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Version
    private Long version;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = OffsetDateTime.now();
    }

    Long getId() { return id; }
    String getEmail() { return email; }
    String getPasswordHash() { return passwordHash; }
    Role getRole() { return role; }
    boolean isEmailVerified() { return emailVerified; }
    String getFirstName() { return firstName; }
    String getLastName() { return lastName; }
    LocalDate getBirthDate() { return birthDate; }

    void setEmail(String email) { this.email = email; }
    void setPasswordHash(String hash) { this.passwordHash = hash; }
    void setRole(Role role) { this.role = role; }
    void setEmailVerified(boolean emailVerified) { this.emailVerified = emailVerified; }
    void setFirstName(String firstName) { this.firstName = firstName; }
    void setLastName(String lastName) { this.lastName = lastName; }
    void setBirthDate(LocalDate birthDate) { this.birthDate = birthDate; }
}

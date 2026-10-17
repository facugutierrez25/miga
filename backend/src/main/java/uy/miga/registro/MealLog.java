package uy.miga.registro;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.OffsetDateTime;

@Entity
@Table(name = "meal_logs")
class MealLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "meal_id", nullable = false)
    private Long mealId;

    @Column(name = "logged_date", nullable = false)
    private LocalDate loggedDate;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    void prePersist() {
        createdAt = OffsetDateTime.now();
    }

    Long getId() { return id; }
    Long getUserId() { return userId; }
    Long getMealId() { return mealId; }
    LocalDate getLoggedDate() { return loggedDate; }

    void setUserId(Long userId) { this.userId = userId; }
    void setMealId(Long mealId) { this.mealId = mealId; }
    void setLoggedDate(LocalDate loggedDate) { this.loggedDate = loggedDate; }
}

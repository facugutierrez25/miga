package uy.miga.habitos;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

@Entity
@Table(name = "habit_logs",
    uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "plan_habit_id", "log_date"}))
class HabitLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "plan_habit_id", nullable = false)
    private Long planHabitId;

    @Column(name = "log_date", nullable = false)
    private LocalDate logDate;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal value = BigDecimal.ZERO;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @PrePersist
    void prePersist() { createdAt = updatedAt = OffsetDateTime.now(); }

    @PreUpdate
    void preUpdate() { updatedAt = OffsetDateTime.now(); }

    Long getId() { return id; }
    Long getUserId() { return userId; }
    Long getPlanHabitId() { return planHabitId; }
    LocalDate getLogDate() { return logDate; }
    BigDecimal getValue() { return value; }

    void setUserId(Long userId) { this.userId = userId; }
    void setPlanHabitId(Long planHabitId) { this.planHabitId = planHabitId; }
    void setLogDate(LocalDate logDate) { this.logDate = logDate; }
    void setValue(BigDecimal value) { this.value = value; }
}

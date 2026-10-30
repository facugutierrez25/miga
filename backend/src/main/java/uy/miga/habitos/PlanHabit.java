package uy.miga.habitos;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "plan_habits")
class PlanHabit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, updatable = false)
    private UUID uid = UUID.randomUUID();

    @Column(name = "archived_at")
    private OffsetDateTime archivedAt;

    @Column(name = "plan_id", nullable = false)
    private Long planId;

    @Column(nullable = false, length = 100)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "habit_type", nullable = false, length = 20)
    private HabitType habitType;

    @Column(length = 40)
    private String unit;

    @Column(name = "daily_goal", precision = 8, scale = 2)
    private BigDecimal dailyGoal;

    @Column(precision = 8, scale = 2)
    private BigDecimal step = BigDecimal.ONE;

    @Column(nullable = false, length = 10)
    private String period = "DIA";

    @Column(name = "display_order", nullable = false)
    private short displayOrder = 1;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    void prePersist() { createdAt = OffsetDateTime.now(); }

    Long getId() { return id; }
    UUID getUid() { return uid; }
    OffsetDateTime getArchivedAt() { return archivedAt; }
    Long getPlanId() { return planId; }
    String getName() { return name; }
    HabitType getHabitType() { return habitType; }
    String getUnit() { return unit; }
    BigDecimal getDailyGoal() { return dailyGoal; }
    BigDecimal getStep() { return step; }
    String getPeriod() { return period; }
    short getDisplayOrder() { return displayOrder; }

    void setUid(UUID uid) { this.uid = uid; }
    void setArchivedAt(OffsetDateTime archivedAt) { this.archivedAt = archivedAt; }
    void setPlanId(Long planId) { this.planId = planId; }
    void setName(String name) { this.name = name; }
    void setHabitType(HabitType habitType) { this.habitType = habitType; }
    void setUnit(String unit) { this.unit = unit; }
    void setDailyGoal(BigDecimal dailyGoal) { this.dailyGoal = dailyGoal; }
    void setStep(BigDecimal step) { this.step = step; }
    void setPeriod(String period) { this.period = period; }
    void setDisplayOrder(short displayOrder) { this.displayOrder = displayOrder; }
}

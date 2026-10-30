package uy.miga.registro;

import jakarta.persistence.*;

import java.time.LocalDate;
import java.time.OffsetDateTime;

@Entity
@Table(name = "meal_notes",
       uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "fecha", "meal_id"}))
class MealNote {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "fecha", nullable = false)
    private LocalDate date;

    @Column(name = "meal_id", nullable = false)
    private Long mealId;

    @Column(name = "texto", nullable = false, columnDefinition = "text")
    private String text;

    @Column(name = "plan_id")
    private Long planId;

    @Column(name = "actualizado", nullable = false)
    private OffsetDateTime updatedAt;

    @PrePersist
    @PreUpdate
    void touch() { updatedAt = OffsetDateTime.now(); }

    Long getId()                  { return id; }
    Long getUserId()              { return userId; }
    LocalDate getDate()           { return date; }
    Long getMealId()              { return mealId; }
    String getText()              { return text; }
    Long getPlanId()              { return planId; }
    OffsetDateTime getUpdatedAt() { return updatedAt; }

    void setUserId(Long userId)   { this.userId = userId; }
    void setDate(LocalDate date)  { this.date = date; }
    void setMealId(Long mealId)   { this.mealId = mealId; }
    void setText(String text)     { this.text = text; }
    void setPlanId(Long planId)   { this.planId = planId; }
}

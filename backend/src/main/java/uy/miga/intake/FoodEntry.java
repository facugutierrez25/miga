package uy.miga.intake;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "food_entries")
class FoodEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "user_email", nullable = false)
    private String userEmail;

    @Column(name = "meal_id", nullable = false)
    private Long mealId;

    @Column(nullable = false)
    private LocalDate date;

    @Column(nullable = false, length = 10000)
    private String food;

    @Column(nullable = false)
    private Double quantity;

    @Column(length = 20)
    private String unit;

    @Column(name = "food_group_id")
    private Long foodGroupId;

    @Column(nullable = false)
    private boolean consumed = false;

    @Column(name = "dish_id")
    private Long dishId;

    // Campos añadidos en V17 (nullable para entradas antiguas del formulario)
    @Column(name = "meal_note_id")
    private Long mealNoteId;

    @Column(name = "texto_original", length = 10000)
    private String textoOriginal;

    @Column(length = 10)
    private String origen;

    private Boolean supuesto;

    @Column(precision = 8, scale = 3)
    private BigDecimal porciones;

    @Column(name = "applied_rule", columnDefinition = "text")
    private String appliedRule;

    @Column(name = "occurrence_id")
    private UUID occurrenceId;

    // Tipo y origen de la regla aplicada (V36).
    @Column(name = "rule_type", length = 12)
    private String ruleType;

    @Column(name = "rule_source", length = 10)
    private String ruleSource;

    @Column(nullable = false)
    private boolean resolved;

    @Column(name = "resolved_rule_uid")
    private UUID resolvedRuleUid;

    UUID getResolvedRuleUid() { return resolvedRuleUid; }
    void setResolvedRuleUid(UUID uid) { this.resolvedRuleUid = uid; }

    boolean isResolved() { return resolved; }
    void setResolved(boolean resolved) { this.resolved = resolved; }

    FoodEntry() {}

    FoodEntry(Long userId, String userEmail, Long mealId, LocalDate date,
              String food, Double quantity, String unit, Long foodGroupId) {
        this.userId = userId;
        this.userEmail = userEmail;
        this.mealId = mealId;
        this.date = date;
        this.food = food;
        this.quantity = quantity;
        this.unit = unit;
        this.foodGroupId = foodGroupId;
    }

    Long getId()             { return id; }
    Long getUserId()         { return userId; }
    String getUserEmail()    { return userEmail; }
    Long getMealId()         { return mealId; }
    LocalDate getDate()      { return date; }
    String getFood()         { return food; }
    Double getQuantity()     { return quantity; }
    String getUnit()         { return unit; }
    Long getFoodGroupId()    { return foodGroupId; }
    boolean isConsumed()     { return consumed; }
    Long getDishId()         { return dishId; }
    Long getMealNoteId()     { return mealNoteId; }
    String getTextoOriginal(){ return textoOriginal; }
    String getOrigen()       { return origen; }
    Boolean getSupuesto()    { return supuesto; }
    BigDecimal getPorciones(){ return porciones; }
    String getAppliedRule()  { return appliedRule; }
    UUID getOccurrenceId() { return occurrenceId; }
    String getRuleType()     { return ruleType; }
    String getRuleSource()   { return ruleSource; }

    void setMealId(Long mealId)                    { this.mealId = mealId; }
    void setQuantity(Double quantity)              { this.quantity = quantity; }
    void setUnit(String unit)                      { this.unit = unit; }
    void setFoodGroupId(Long foodGroupId)          { this.foodGroupId = foodGroupId; }
    void setConsumed(boolean consumed)             { this.consumed = consumed; }
    void setMealNoteId(Long mealNoteId)       { this.mealNoteId = mealNoteId; }
    void setTextoOriginal(String textoOriginal){ this.textoOriginal = textoOriginal; }
    void setOrigen(String origen)             { this.origen = origen; }
    void setSupuesto(Boolean supuesto)        { this.supuesto = supuesto; }
    void setPorciones(BigDecimal porciones)   { this.porciones = porciones; }
    void setAppliedRule(String appliedRule)   { this.appliedRule = appliedRule; }
    void setOccurrenceId(UUID id)   { this.occurrenceId = id; }
    void setRuleType(String ruleType)         { this.ruleType = ruleType; }
    void setRuleSource(String ruleSource)     { this.ruleSource = ruleSource; }
}

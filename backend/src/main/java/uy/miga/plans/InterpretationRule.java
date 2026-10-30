package uy.miga.plans;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "interpretation_rules")
class InterpretationRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "plan_id", nullable = false)
    private Plan plan;

    @Column(nullable = false, length = 200)
    private String pattern;

    @Column(name = "food_group_id", nullable = false)
    private Long foodGroupId;

    @Column(name = "default_unit", length = 20)
    private String defaultUnit;

    @Column(nullable = false, precision = 3, scale = 2)
    private BigDecimal confidence = BigDecimal.ONE;

    InterpretationRule() {}

    Long getId()              { return id; }
    Plan getPlan()            { return plan; }
    String getPattern()       { return pattern; }
    Long getFoodGroupId()     { return foodGroupId; }
    String getDefaultUnit()   { return defaultUnit; }
    BigDecimal getConfidence() { return confidence; }

    void setPlan(Plan plan)             { this.plan = plan; }
    void setPattern(String pattern)     { this.pattern = pattern; }
    void setFoodGroupId(Long id)        { this.foodGroupId = id; }
    void setDefaultUnit(String unit)    { this.defaultUnit = unit; }
    void setConfidence(BigDecimal c)    { this.confidence = c; }
}

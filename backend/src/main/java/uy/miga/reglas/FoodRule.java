package uy.miga.reglas;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "food_rules")
class FoodRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, updatable = false)
    private UUID uid = UUID.randomUUID();

    @Column(name = "overrides_rule_uid")
    private UUID overridesRuleUid;

    @Column(name = "alcance", nullable = false, length = 10)
    private String scope;

    @Column(name = "plan_id")
    private Long planId;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "alimento", nullable = false, length = 200)
    private String food;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "sinonimos", columnDefinition = "text[]")
    private List<String> synonyms;

    @Column(name = "tipo", nullable = false, length = 20)
    private String type;

    @Column(name = "standard_group_key", length = 50)
    private String standardGroupKey;

    @Column(name = "food_group_id")
    private Long foodGroupId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "componentes", columnDefinition = "jsonb")
    private List<RuleComponent> components;

    @Column(name = "cantidad_por_porcion", precision = 8, scale = 3)
    private BigDecimal amountPerPortion;

    @Column(name = "unidad", length = 20)
    private String unit;

    @Column(name = "porcion_por_defecto", nullable = false, precision = 8, scale = 3)
    private BigDecimal defaultPortions = BigDecimal.ONE;

    @Column(name = "maybe_flexible", nullable = false)
    private boolean maybeFlexible;

    boolean isMaybeFlexible() { return maybeFlexible; }

    FoodRule() {}

    Long getId()                    { return id; }
    UUID getUid()                   { return uid; }
    UUID getOverridesRuleUid()      { return overridesRuleUid; }
    String getScope()             { return scope; }
    Long getPlanId()                { return planId; }
    Long getUserId()                { return userId; }
    String getFood()            { return food; }
    List<String> getSynonyms()     { return synonyms; }
    String getType()                { return type; }
    String getStandardGroupKey()    { return standardGroupKey; }
    Long getFoodGroupId()           { return foodGroupId; }
    List<RuleComponent> getComponents() { return components; }
    BigDecimal getAmountPerPortion() { return amountPerPortion; }
    String getUnit()              { return unit; }
    BigDecimal getDefaultPortions() { return defaultPortions; }

    void setUid(UUID uid)                       { this.uid = uid; }
    void setOverridesRuleUid(UUID u)            { this.overridesRuleUid = u; }
    void setScope(String scope)             { this.scope = scope; }
    void setPlanId(Long planId)                 { this.planId = planId; }
    void setUserId(Long userId)                 { this.userId = userId; }
    void setFood(String food)           { this.food = food; }
    void setSynonyms(List<String> synonyms)   { this.synonyms = synonyms; }
    void setType(String type)                   { this.type = type; }
    void setStandardGroupKey(String k)          { this.standardGroupKey = k; }
    void setFoodGroupId(Long foodGroupId)       { this.foodGroupId = foodGroupId; }
    void setComponents(List<RuleComponent> c)     { this.components = c; }
    void setAmountPerPortion(BigDecimal c)    { this.amountPerPortion = c; }
    void setUnit(String unit)               { this.unit = unit; }
    void setDefaultPortions(BigDecimal p)     { this.defaultPortions = p; }

}

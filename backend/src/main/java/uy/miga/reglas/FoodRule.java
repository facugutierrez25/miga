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

    @Column(nullable = false, length = 10)
    private String alcance;

    @Column(name = "plan_id")
    private Long planId;

    @Column(name = "user_id")
    private Long userId;

    @Column(nullable = false, length = 200)
    private String alimento;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(columnDefinition = "text[]")
    private List<String> sinonimos;

    @Column(nullable = false, length = 20)
    private String tipo;

    @Column(name = "standard_group_key", length = 50)
    private String standardGroupKey;

    @Column(name = "food_group_id")
    private Long foodGroupId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<Componente> componentes;

    @Column(name = "cantidad_por_porcion", precision = 8, scale = 3)
    private BigDecimal cantidadPorPorcion;

    @Column(length = 20)
    private String unidad;

    @Column(name = "porcion_por_defecto", nullable = false, precision = 8, scale = 3)
    private BigDecimal porcionPorDefecto = BigDecimal.ONE;

    FoodRule() {}

    Long getId()                    { return id; }
    UUID getUid()                   { return uid; }
    UUID getOverridesRuleUid()      { return overridesRuleUid; }
    String getAlcance()             { return alcance; }
    Long getPlanId()                { return planId; }
    Long getUserId()                { return userId; }
    String getAlimento()            { return alimento; }
    List<String> getSinonimos()     { return sinonimos; }
    String getTipo()                { return tipo; }
    String getStandardGroupKey()    { return standardGroupKey; }
    Long getFoodGroupId()           { return foodGroupId; }
    List<Componente> getComponentes() { return componentes; }
    BigDecimal getCantidadPorPorcion() { return cantidadPorPorcion; }
    String getUnidad()              { return unidad; }
    BigDecimal getPorcionPorDefecto() { return porcionPorDefecto; }

    void setUid(UUID uid)                       { this.uid = uid; }
    void setOverridesRuleUid(UUID u)            { this.overridesRuleUid = u; }
    void setAlcance(String alcance)             { this.alcance = alcance; }
    void setPlanId(Long planId)                 { this.planId = planId; }
    void setUserId(Long userId)                 { this.userId = userId; }
    void setAlimento(String alimento)           { this.alimento = alimento; }
    void setSinonimos(List<String> sinonimos)   { this.sinonimos = sinonimos; }
    void setTipo(String tipo)                   { this.tipo = tipo; }
    void setStandardGroupKey(String k)          { this.standardGroupKey = k; }
    void setFoodGroupId(Long foodGroupId)       { this.foodGroupId = foodGroupId; }
    void setComponentes(List<Componente> c)     { this.componentes = c; }
    void setCantidadPorPorcion(BigDecimal c)    { this.cantidadPorPorcion = c; }
    void setUnidad(String unidad)               { this.unidad = unidad; }
    void setPorcionPorDefecto(BigDecimal p)     { this.porcionPorDefecto = p; }

}

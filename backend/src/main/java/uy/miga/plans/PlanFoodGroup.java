package uy.miga.plans;

import jakarta.persistence.*;

@Entity
@Table(name = "plan_food_groups")
class PlanFoodGroup {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "plan_id", nullable = false)
    private Plan plan;

    @Column(nullable = false, length = 60)
    private String name;

    @Column(nullable = false, length = 10)
    private String abbreviation;

    @Column(name = "display_order", nullable = false)
    private short displayOrder;

    @Column(length = 7)
    private String color;

    @Column(length = 50)
    private String clave;

    @Column(name = "meta_diaria", precision = 8, scale = 3)
    private java.math.BigDecimal metaDiaria;

    @Column(name = "preguntar_si_falta", nullable = false)
    private boolean preguntarSiFalta = false;

    @Column(nullable = false)
    private boolean opcional = false;

    PlanFoodGroup() {}

    PlanFoodGroup(Plan plan, String name, String abbreviation, short displayOrder) {
        this.plan = plan;
        this.name = name;
        this.abbreviation = abbreviation;
        this.displayOrder = displayOrder;
    }

    Long getId()             { return id; }
    Plan getPlan()           { return plan; }
    String getName()         { return name; }
    String getAbbreviation() { return abbreviation; }
    int getDisplayOrder()    { return displayOrder; }
    String getColor()        { return color; }
    String getClave()        { return clave; }
    java.math.BigDecimal getMetaDiaria()  { return metaDiaria; }
    boolean isPreguntarSiFalta()          { return preguntarSiFalta; }
    boolean isOpcional()                  { return opcional; }

    void setPlan(Plan plan)        { this.plan = plan; }
    void setColor(String color)    { this.color = color; }
    void setClave(String clave)    { this.clave = clave; }
}

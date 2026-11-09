package uy.miga.plans;

import jakarta.persistence.*;

import java.util.UUID;

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

    @Column(nullable = false, updatable = false)
    private UUID uid = UUID.randomUUID();

    @Column(name = "display_order", nullable = false)
    private short displayOrder;

    @Column(length = 7)
    private String color;

    @Column(name = "clave", length = 50)
    private String standardKey;

    // La columna meta_diaria se elimina en una migración posterior; el total sale de las comidas.

    @Column(name = "preguntar_si_falta", nullable = false)
    private boolean askIfMissing = false;

    @Column(name = "opcional", nullable = false)
    private boolean optional = false;

    PlanFoodGroup() {}

    PlanFoodGroup(Plan plan, String name, String abbreviation, short displayOrder) {
        this.plan = plan;
        this.name = name;
        this.abbreviation = abbreviation;
        this.displayOrder = displayOrder;
    }

    Long getId()             { return id; }
    UUID getUid()            { return uid; }
    Plan getPlan()           { return plan; }
    String getName()         { return name; }
    String getAbbreviation() { return abbreviation; }
    int getDisplayOrder()    { return displayOrder; }
    String getColor()        { return color; }
    String getStandardKey()        { return standardKey; }
    boolean isAskIfMissing()          { return askIfMissing; }
    boolean isOptional()                  { return optional; }

    void setName(String name) { this.name = name; }
    void setAbbreviation(String abbreviation) { this.abbreviation = abbreviation; }
    void setDisplayOrder(short order) { this.displayOrder = order; }
    void setUid(UUID uid) { this.uid = uid; }
    void setAskIfMissing(boolean askIfMissing) { this.askIfMissing = askIfMissing; }
    void setOptional(boolean optional) { this.optional = optional; }
    void setPlan(Plan plan)        { this.plan = plan; }
    void setColor(String color)    { this.color = color; }
    void setStandardKey(String standardKey)    { this.standardKey = standardKey; }
}

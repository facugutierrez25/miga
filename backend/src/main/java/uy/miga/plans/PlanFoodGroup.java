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

    @Column(name = "display_order", nullable = false, columnDefinition = "SMALLINT")
    private int displayOrder;

    @Column(length = 7)
    private String color;

    PlanFoodGroup() {}

    PlanFoodGroup(Plan plan, String name, String abbreviation, int displayOrder) {
        this.plan = plan;
        this.name = name;
        this.abbreviation = abbreviation;
        this.displayOrder = displayOrder;
    }

    Long getId()           { return id; }
    Plan getPlan()         { return plan; }
    String getName()       { return name; }
    String getAbbreviation() { return abbreviation; }
    int getDisplayOrder()  { return displayOrder; }
    String getColor()      { return color; }

    void setPlan(Plan plan)               { this.plan = plan; }
    void setColor(String color)           { this.color = color; }
}

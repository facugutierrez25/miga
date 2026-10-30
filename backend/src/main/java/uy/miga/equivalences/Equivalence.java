package uy.miga.equivalences;

import jakarta.persistence.*;

@Entity
@Table(name = "equivalences")
class Equivalence {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_email", nullable = false)
    private String userEmail;

    @Column(name = "plan_id", nullable = false)
    private Long planId;

    @Column(name = "food_group_id", nullable = false)
    private Long foodGroupId;

    @Column(nullable = false, length = 120)
    private String food;

    @Column(nullable = false)
    private Double quantity;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Unit unit;

    Equivalence() {}

    Equivalence(String userEmail, Long planId, Long foodGroupId, String food, Double quantity, Unit unit) {
        this.userEmail = userEmail;
        this.planId = planId;
        this.foodGroupId = foodGroupId;
        this.food = food;
        this.quantity = quantity;
        this.unit = unit;
    }

    Long getId()          { return id; }
    String getUserEmail() { return userEmail; }
    Long getPlanId()      { return planId; }
    Long getFoodGroupId() { return foodGroupId; }
    String getFood()      { return food; }
    Double getQuantity()  { return quantity; }
    Unit getUnit()        { return unit; }
}

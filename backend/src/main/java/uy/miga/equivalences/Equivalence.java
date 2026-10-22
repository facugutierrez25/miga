package uy.miga.equivalences;

import jakarta.persistence.*;
import uy.miga.plans.FoodGroup;

@Entity
@Table(name = "equivalences")
class Equivalence {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_email", nullable = false)
    private String userEmail;

    @Enumerated(EnumType.STRING)
    @Column(name = "food_group", nullable = false)
    private FoodGroup foodGroup;

    @Column(nullable = false, length = 120)
    private String food;

    @Column(nullable = false)
    private Double quantity;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Unit unit;

    Equivalence() {}

    Equivalence(String userEmail, FoodGroup foodGroup, String food, Double quantity, Unit unit) {
        this.userEmail = userEmail;
        this.foodGroup = foodGroup;
        this.food = food;
        this.quantity = quantity;
        this.unit = unit;
    }

    Long getId()              { return id; }
    String getUserEmail()     { return userEmail; }
    FoodGroup getFoodGroup()  { return foodGroup; }
    String getFood()          { return food; }
    Double getQuantity()      { return quantity; }
    Unit getUnit()            { return unit; }
}

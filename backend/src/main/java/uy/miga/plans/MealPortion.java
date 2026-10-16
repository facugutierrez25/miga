package uy.miga.plans;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "meal_portions")
class MealPortion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "meal_id", nullable = false)
    private Meal meal;

    @Enumerated(EnumType.STRING)
    @Column(name = "food_group", nullable = false, length = 20)
    private FoodGroup foodGroup;

    @Column(nullable = false, precision = 3, scale = 1)
    private BigDecimal portions;

    FoodGroup getFoodGroup() { return foodGroup; }
    BigDecimal getPortions() { return portions; }

    void setMeal(Meal meal) { this.meal = meal; }
    void setFoodGroup(FoodGroup foodGroup) { this.foodGroup = foodGroup; }
    void setPortions(BigDecimal portions) { this.portions = portions; }
}

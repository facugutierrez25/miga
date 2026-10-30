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

    @Column(name = "food_group_id", nullable = false)
    private Long foodGroupId;

    @Column(nullable = false, precision = 3, scale = 1)
    private BigDecimal portions;

    Long getFoodGroupId()          { return foodGroupId; }
    BigDecimal getPortions()       { return portions; }

    void setMeal(Meal meal)        { this.meal = meal; }
    void setFoodGroupId(Long id)   { this.foodGroupId = id; }
    void setPortions(BigDecimal p) { this.portions = p; }
}

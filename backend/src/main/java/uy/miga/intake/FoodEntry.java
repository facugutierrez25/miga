package uy.miga.intake;

import jakarta.persistence.*;

import java.time.LocalDate;

@Entity
@Table(name = "food_entries")
class FoodEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_email", nullable = false)
    private String userEmail;

    @Column(name = "meal_id", nullable = false)
    private Long mealId;

    @Column(nullable = false)
    private LocalDate date;

    @Column(nullable = false, length = 120)
    private String food;

    @Column(nullable = false)
    private Double quantity;

    @Column(nullable = false, length = 20)
    private String unit;

    @Column(name = "food_group_id", nullable = false)
    private Long foodGroupId;

    @Column(nullable = false)
    private boolean consumed = false;

    @Column(name = "dish_id")
    private Long dishId;

    FoodEntry() {}

    FoodEntry(String userEmail, Long mealId, LocalDate date,
              String food, Double quantity, String unit, Long foodGroupId) {
        this.userEmail = userEmail;
        this.mealId = mealId;
        this.date = date;
        this.food = food;
        this.quantity = quantity;
        this.unit = unit;
        this.foodGroupId = foodGroupId;
    }

    Long getId()          { return id; }
    String getUserEmail() { return userEmail; }
    Long getMealId()      { return mealId; }
    LocalDate getDate()   { return date; }
    String getFood()      { return food; }
    Double getQuantity()  { return quantity; }
    String getUnit()      { return unit; }
    Long getFoodGroupId() { return foodGroupId; }
    boolean isConsumed()  { return consumed; }
    Long getDishId()      { return dishId; }
}

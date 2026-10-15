package uy.miga.plans;

import jakarta.persistence.*;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "meals")
class Meal {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "plan_id", nullable = false)
    private Plan plan;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "suggested_time")
    private LocalTime suggestedTime;

    @Column(name = "display_order", nullable = false)
    private int displayOrder;

    @OneToMany(mappedBy = "meal", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<MealPortion> portions = new ArrayList<>();

    Long getId() { return id; }
    Plan getPlan() { return plan; }
    String getName() { return name; }
    LocalTime getSuggestedTime() { return suggestedTime; }
    int getDisplayOrder() { return displayOrder; }
    List<MealPortion> getPortions() { return portions; }

    void setPlan(Plan plan) { this.plan = plan; }
    void setName(String name) { this.name = name; }
    void setSuggestedTime(LocalTime suggestedTime) { this.suggestedTime = suggestedTime; }
    void setDisplayOrder(int displayOrder) { this.displayOrder = displayOrder; }
    void setPortions(List<MealPortion> portions) { this.portions = portions; }
}

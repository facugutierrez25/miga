package uy.miga.plans;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "plans")
class Plan {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "is_current", nullable = false)
    private boolean current = true;

    @Column(name = "superseded_at")
    private OffsetDateTime supersededAt;

    @OneToMany(mappedBy = "plan", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("displayOrder ASC")
    private List<PlanFoodGroup> foodGroups = new ArrayList<>();

    @OneToMany(mappedBy = "plan", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("displayOrder ASC")
    private List<Meal> meals = new ArrayList<>();

    @Column(name = "modo_registro", nullable = false, length = 20)
    private String modoRegistro = "PORCIONES";

    @Column(name = "margen_porciones", nullable = false)
    private java.math.BigDecimal margenPorciones = new java.math.BigDecimal("0.5");

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @Version
    private Long version;

    @PrePersist
    void prePersist() {
        createdAt = updatedAt = OffsetDateTime.now();
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = OffsetDateTime.now();
    }

    Long getId() { return id; }
    Long getUserId() { return userId; }
    boolean isCurrent() { return current; }
    OffsetDateTime getSupersededAt() { return supersededAt; }
    OffsetDateTime getCreatedAt() { return createdAt; }
    List<PlanFoodGroup> getFoodGroups() { return foodGroups; }
    List<Meal> getMeals() { return meals; }
    String getModoRegistro() { return modoRegistro; }
    java.math.BigDecimal getMargenPorciones() { return margenPorciones; }
    Long getVersion() { return version; }

    void setUserId(Long userId) { this.userId = userId; }
    void setCurrent(boolean current) { this.current = current; }
    void setSupersededAt(OffsetDateTime supersededAt) { this.supersededAt = supersededAt; }
}

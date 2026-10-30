package uy.miga.plans;

public record PlanFoodGroupDto(Long id, String name, String abbreviation, int displayOrder, String color,
                               String clave, Boolean preguntarSiFalta, Boolean opcional,
                               java.math.BigDecimal metaDiaria) {}

package uy.miga.plans;

import java.util.UUID;

public record PlanFoodGroupDto(Long id, String name, String abbreviation, int displayOrder, String color,
                               String clave, Boolean preguntarSiFalta, Boolean opcional,
                               UUID uid) {}

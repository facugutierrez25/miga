package uy.miga.plans;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.UUID;

public record PlanFoodGroupDto(Long id, String name, String abbreviation, int displayOrder, String color,
                               @JsonProperty("clave") String standardKey, @JsonProperty("preguntarSiFalta") Boolean askIfMissing, @JsonProperty("opcional") Boolean optional,
                               UUID uid) {}

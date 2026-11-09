package uy.miga.registro;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDate;

// Texto anotado que ninguna regla reconoció.
public record UnmatchedFoodDto(@JsonProperty("texto") String text, @JsonProperty("fecha") LocalDate date, @JsonProperty("comida") String meal) {}

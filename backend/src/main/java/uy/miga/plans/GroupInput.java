package uy.miga.plans;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
@JsonIgnoreProperties("metaDiaria")
public record GroupInput(String name, String abbreviation, @JsonProperty("clave") String standardKey, String color,
    @JsonProperty("preguntarSiFalta") boolean askIfMissing, @JsonProperty("opcional") boolean optional) {}

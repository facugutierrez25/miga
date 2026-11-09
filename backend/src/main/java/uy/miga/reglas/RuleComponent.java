package uy.miga.reglas;

import com.fasterxml.jackson.annotation.JsonProperty;

public record RuleComponent(Long foodGroupId, String standardGroupKey, @JsonProperty("porciones") double portions) {}

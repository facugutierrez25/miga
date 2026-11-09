package uy.miga.planrules;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.UUID;
import java.math.BigDecimal;
import uy.miga.plans.PlanFoodGroupDto;
import uy.miga.habitos.HabitConfigDto;
record PlanRulesDto(Long planId, Long planVersion, @JsonProperty("modoRegistro") String loggingMode, @JsonProperty("grupos") List<PlanFoodGroupDto> groups,
    @JsonProperty("alimentos") List<RuleDto> foods, @JsonProperty("habitos") List<HabitConfigDto> habits) {
    record ComponentDto(UUID groupUid, @JsonProperty("porciones") double portions) {}
    record RuleDto(UUID uid, @JsonProperty("alcance") String scope, @JsonProperty("alimento") String food, @JsonProperty("sinonimos") List<String> synonyms, @JsonProperty("tipo") String type, UUID groupUid,
        @JsonProperty("cantidadPorPorcion") BigDecimal amountPerPortion, @JsonProperty("unidad") String unit, @JsonProperty("porcionPorDefecto") BigDecimal defaultPortions, @JsonProperty("componentes") List<ComponentDto> components,
        UUID overridesRuleUid, @JsonProperty("textoRegla") String ruleText) {}
    record CatalogDto(UUID uid, @JsonProperty("alcance") String scope, @JsonProperty("alimento") String food, @JsonProperty("sinonimos") List<String> synonyms, @JsonProperty("tipo") String type,
        UUID groupUid, @JsonProperty("textoRegla") String ruleText, @JsonProperty("ajustadoPorUid") UUID adjustedByUid) {}
}

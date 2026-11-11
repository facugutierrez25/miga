package uy.miga.reglas;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record FoodRuleDto(
    Long id,
    @JsonProperty("alcance") String scope,
    Long planId,
    Long userId,
    @JsonProperty("alimento") String food,
    @JsonProperty("sinonimos") List<String> synonyms,
    @JsonProperty("tipo") String type,
    String standardGroupKey,
    Long foodGroupId,
    @JsonProperty("componentes") List<RuleComponent> components,
    @JsonProperty("cantidadPorPorcion") BigDecimal amountPerPortion,
    @JsonProperty("unidad") String unit,
    @JsonProperty("porcionPorDefecto") BigDecimal defaultPortions,
    UUID uid,
    UUID overridesRuleUid,
    boolean maybeFlexible,
    boolean countsFlexible
) {
    public FoodRuleDto(Long id, String scope, Long planId, Long userId, String food, List<String> synonyms,
        String type, String standardGroupKey, Long foodGroupId, List<RuleComponent> components,
        BigDecimal amountPerPortion, String unit, BigDecimal defaultPortions, UUID uid, UUID overridesRuleUid, boolean maybeFlexible) {
        this(id, scope, planId, userId, food, synonyms, type, standardGroupKey, foodGroupId, components,
            amountPerPortion, unit, defaultPortions, uid, overridesRuleUid, maybeFlexible, false);
    }
    public FoodRuleDto(Long id, String scope, Long planId, Long userId, String food, List<String> synonyms,
        String type, String standardGroupKey, Long foodGroupId, List<RuleComponent> components,
        BigDecimal amountPerPortion, String unit, BigDecimal defaultPortions, UUID uid, UUID overridesRuleUid) {
        this(id, scope, planId, userId, food, synonyms, type, standardGroupKey, foodGroupId, components,
            amountPerPortion, unit, defaultPortions, uid, overridesRuleUid, false);
    }

    public FoodRuleDto {
        synonyms = synonyms == null ? List.of() : List.copyOf(synonyms);
    }

    public FoodRuleDto(Long id, String scope, Long planId, Long userId, String food, List<String> synonyms,
        String type, String standardGroupKey, Long foodGroupId, List<RuleComponent> components,
        BigDecimal amountPerPortion, String unit, BigDecimal defaultPortions) {
        this(id, scope, planId, userId, food, synonyms, type, standardGroupKey, foodGroupId, components,
            amountPerPortion, unit, defaultPortions, null, null);
    }
}

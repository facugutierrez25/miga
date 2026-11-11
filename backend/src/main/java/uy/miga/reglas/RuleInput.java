package uy.miga.reglas;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
public record RuleInput(@JsonProperty("alimento") String food, @JsonProperty("sinonimos") List<String> synonyms, @JsonProperty("tipo") String type, Long foodGroupId,
    @JsonProperty("cantidadPorPorcion") BigDecimal amountPerPortion, @JsonProperty("unidad") String unit, @JsonProperty("porcionPorDefecto") BigDecimal defaultPortions,
    @JsonProperty("componentes") List<RuleComponent> components, UUID overridesRuleUid, boolean countsFlexible) {
    public RuleInput(String food, List<String> synonyms, String type, Long foodGroupId,
            BigDecimal amountPerPortion, String unit, BigDecimal defaultPortions,
            List<RuleComponent> components, UUID overridesRuleUid) {
        this(food, synonyms, type, foodGroupId, amountPerPortion, unit, defaultPortions, components, overridesRuleUid, false);
    }
}

package uy.miga.reglas;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
public record RuleInput(@JsonProperty("alimento") String food, @JsonProperty("sinonimos") List<String> synonyms, @JsonProperty("tipo") String type, Long foodGroupId,
    @JsonProperty("cantidadPorPorcion") BigDecimal amountPerPortion, @JsonProperty("unidad") String unit, @JsonProperty("porcionPorDefecto") BigDecimal defaultPortions,
    @JsonProperty("componentes") List<RuleComponent> components, UUID overridesRuleUid) {}

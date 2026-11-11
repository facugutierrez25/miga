package uy.miga.registro;

import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;

record PatchItemRequest(
    @Positive BigDecimal quantity,
    @Size(max = 20) String unit,
    Long foodGroupId,
    @DecimalMin("0") BigDecimal portions,
    @JsonProperty("grupos") @Valid @Size(min = 2, max = 10) List<GroupPortion> groups,
    Boolean saveAsRule,
    Boolean flexible
) {
    PatchItemRequest(BigDecimal quantity, String unit, Long foodGroupId, BigDecimal portions,
            List<GroupPortion> groups, Boolean saveAsRule) {
        this(quantity, unit, foodGroupId, portions, groups, saveAsRule, null);
    }

    boolean makesFlexible() { return Boolean.TRUE.equals(flexible); }

    boolean savesRule() { return Boolean.TRUE.equals(saveAsRule); }

    record GroupPortion(@NotNull Long foodGroupId, @JsonProperty("porciones") @NotNull @Positive BigDecimal portions) {}
}

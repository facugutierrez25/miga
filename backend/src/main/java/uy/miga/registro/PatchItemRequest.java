package uy.miga.registro;

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
    @Valid @Size(min = 2, max = 10) List<GroupPortion> grupos,
    Boolean saveAsRule
) {
    boolean savesRule() { return Boolean.TRUE.equals(saveAsRule); }

    record GroupPortion(@NotNull Long foodGroupId, @NotNull @Positive BigDecimal porciones) {}
}

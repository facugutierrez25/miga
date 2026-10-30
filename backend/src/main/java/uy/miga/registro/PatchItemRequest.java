package uy.miga.registro;

import java.math.BigDecimal;

record PatchItemRequest(
    BigDecimal quantity,
    String unit,
    Long foodGroupId,
    BigDecimal portions,
    boolean saveAsRule
) {}

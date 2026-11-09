package uy.miga.registro;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

record ResolveItemRequest(@NotNull(message = "Elegí cómo reconocer el alimento.") Kind kind, UUID ruleUid,
                          @Size(min = 1, max = 10, message = "Indicá entre uno y diez grupos.")
                          List<@NotNull(message = "Indicá un grupo válido.") @Valid GroupPortion> groups,
                          Boolean remember) {
    boolean remembers() { return Boolean.TRUE.equals(remember); }

    enum Kind { SAME_AS, GROUPS, FLEXIBLE, NOT_COUNTED }
    record GroupPortion(@NotNull(message = "Indicá el grupo.") Long foodGroupId,
                        @NotNull(message = "Indicá las porciones.")
                        @DecimalMin(value = "0", inclusive = false, message = "Las porciones deben ser mayores a cero.")
                        BigDecimal portions) {}
}

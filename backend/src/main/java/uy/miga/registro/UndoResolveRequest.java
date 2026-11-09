package uy.miga.registro;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

record UndoResolveRequest(@NotNull(message = "Indicá la mención que querés restaurar.") UUID occurrenceId, UUID ruleUid) {}

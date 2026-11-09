package uy.miga.registro;

import java.util.List;
import java.util.UUID;

record ResolveItemResultDto(List<Long> replacedItemIds, List<DayRegistroDto.EntryItemDto> items, Undo undo) {
    record Undo(UUID occurrenceId, UUID ruleUid) {}
}

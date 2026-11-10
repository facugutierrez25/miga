package uy.miga.registro;

import java.util.List;
import java.util.UUID;

record ResolveItemResultDto(List<Long> replacedItemIds, List<DayLogDto.EntryItemDto> items, Undo undo, String status) {
    record Undo(UUID occurrenceId, UUID ruleUid) {}
}

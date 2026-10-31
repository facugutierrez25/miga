package uy.miga.registro;

import java.util.List;

record PatchItemResultDto(List<Long> replacedItemIds, List<DayRegistroDto.EntryItemDto> items) {}

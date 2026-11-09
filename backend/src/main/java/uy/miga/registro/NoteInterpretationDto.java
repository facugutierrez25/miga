package uy.miga.registro;

import java.time.LocalDate;
import java.util.List;

record NoteInterpretationDto(
    Long noteId,
    Long version,
    String text,
    LocalDate date,
    Long mealId,
    List<InterpretedItemDto> items,
    List<DayLogDto.EntryItemDto> entries,
    List<GroupStatusDto> comparison,
    String status
) {}

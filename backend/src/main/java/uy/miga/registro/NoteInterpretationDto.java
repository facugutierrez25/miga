package uy.miga.registro;

import java.time.LocalDate;
import java.util.List;

record NoteInterpretationDto(
    Long noteId,
    String text,
    LocalDate date,
    Long mealId,
    List<InterpretedItemDto> items,
    List<GroupStatusDto> comparison
) {}

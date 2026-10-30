package uy.miga.registro;

import java.time.LocalDate;

record NoteDto(Long id, Long mealId, LocalDate date, String text) {}

package uy.miga.habitos;

import java.time.LocalDate;
import java.util.List;

record WeekSummaryDto(
    LocalDate weekStart,
    LocalDate weekEnd,
    List<HabitDto> habits,
    List<WeekDayDto> days
) {}

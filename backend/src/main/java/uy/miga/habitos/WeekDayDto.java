package uy.miga.habitos;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

record WeekDayDto(
    LocalDate date,
    boolean hasData,
    BigDecimal totalRecorded,
    BigDecimal totalGoal,
    List<HabitLogDto> habitLogs
) {}

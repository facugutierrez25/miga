package uy.miga.habitos;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import uy.miga.registro.WeekMealData;

record WeekDayDto(
    LocalDate date,
    boolean hasData,
    BigDecimal totalRecorded,
    BigDecimal totalGoal,
    List<HabitLogDto> habitLogs,
    List<WeekMealData> meals,
    List<Long> habitIds
) {}

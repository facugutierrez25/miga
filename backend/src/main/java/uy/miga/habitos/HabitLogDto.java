package uy.miga.habitos;

import java.math.BigDecimal;
import java.time.LocalDate;

record HabitLogDto(Long habitId, LocalDate date, BigDecimal value) {}

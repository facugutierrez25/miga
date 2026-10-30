package uy.miga.habitos;
import java.math.BigDecimal;
public record HabitInput(String name, String habitType, String unit, BigDecimal goal, String period, BigDecimal step) {}

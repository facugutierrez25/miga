package uy.miga.habitos;
import java.math.BigDecimal;
import java.util.UUID;
public record HabitConfigDto(UUID uid, Long id, String name, String habitType, String unit,
    BigDecimal goal, String period, BigDecimal step, short displayOrder) {}

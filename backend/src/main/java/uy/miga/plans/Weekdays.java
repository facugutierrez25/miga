package uy.miga.plans;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

// Días de una comida como máscara de bits: lunes = 1, martes = 2, … domingo = 64.
// null (o los siete días) significa que la comida toca todos los días.
final class Weekdays {
    static final int ALL = 0b111_1111;

    private Weekdays() {}

    static Short toMask(Collection<Integer> days) {
        if (days == null || days.isEmpty()) return null;
        int mask = 0;
        for (Integer day : days) {
            if (day == null || day < 1 || day > 7) throw new IllegalArgumentException("Día de la semana inválido.");
            mask |= 1 << (day - 1);
        }
        return mask == ALL ? null : (short) mask;
    }

    static List<Integer> toList(Short mask) {
        if (mask == null) return null;
        List<Integer> days = new ArrayList<>();
        for (int day = 1; day <= 7; day++) if ((mask & (1 << (day - 1))) != 0) days.add(day);
        return List.copyOf(days);
    }
}

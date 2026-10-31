package uy.miga.habitos;

import java.math.BigDecimal;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

final class HabitValidation {
    private static final BigDecimal MAX = new BigDecimal("100000");

    private HabitValidation() {}

    static void configuration(HabitInput in) {
        if (in.name() == null || in.name().isBlank() || in.name().length() > 100 ||
            in.habitType() == null || !List.of("CONTADOR", "SI_NO", "CANTIDAD").contains(in.habitType()) ||
            in.period() == null || !List.of("DIA", "SEMANA").contains(in.period()) ||
            (in.unit() != null && in.unit().length() > 40))
            throw invalid("Configuración de hábito inválida.");
        if (in.goal() != null && (in.goal().signum() < 0 || in.goal().compareTo(MAX) > 0))
            throw invalid("La meta debe estar entre 0 y 100000, o quedar vacía.");
        if (in.step() != null && (in.step().signum() <= 0 || in.step().compareTo(MAX) > 0 ||
            in.step().compareTo(new BigDecimal("0.01")) < 0))
            throw invalid("El paso debe ser positivo, de al menos 0,01 y hasta 100000.");
    }

    static void log(HabitType type, BigDecimal value) {
        if (value == null || value.signum() < 0 || value.compareTo(MAX) > 0)
            throw invalid("El valor debe estar entre 0 y 100000.");
        if (type == HabitType.SI_NO && value.compareTo(BigDecimal.ZERO) != 0 && value.compareTo(BigDecimal.ONE) != 0)
            throw invalid("Para un hábito sí/no, ingresá 0 o 1.");
    }

    private static ResponseStatusException invalid(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}

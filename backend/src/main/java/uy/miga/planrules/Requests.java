package uy.miga.planrules;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;
import java.util.UUID;
import java.math.BigDecimal;
import uy.miga.plans.GroupInput;
import uy.miga.habitos.HabitInput;
final class Requests {
    private Requests() {}
    record Version(@NotNull @PositiveOrZero Long planVersion) {}
    record Order(@NotNull @PositiveOrZero Long planVersion, @NotNull List<@NotNull UUID> uids) {}
    record Group(@NotNull @PositiveOrZero Long planVersion, @NotBlank @Size(max=60) String name,
        @Size(max=10) String abbreviation, @Size(max=50) String clave, @Pattern(regexp="#[0-9a-fA-F]{6}") String color,
        BigDecimal metaDiaria, Boolean preguntarSiFalta, Boolean opcional) {
        GroupInput input() {
            return new GroupInput(name, abbreviation, clave, color, metaDiaria,
                Boolean.TRUE.equals(preguntarSiFalta), Boolean.TRUE.equals(opcional));
        }
    }
    record Component(@NotNull UUID groupUid, @Positive double porciones) {}
    record Rule(@NotNull @PositiveOrZero Long planVersion, @NotBlank @Size(max=200) String alimento,
        List<@NotBlank String> sinonimos, @NotBlank String tipo, UUID groupUid, @Positive BigDecimal cantidadPorPorcion,
        @Size(max=20) String unidad, @Positive BigDecimal porcionPorDefecto, List<@NotNull @Valid Component> componentes, UUID overridesRuleUid) {}
    record Habit(@NotNull @PositiveOrZero Long planVersion, @NotBlank @Size(max=100) String name, @NotBlank String habitType,
        @Size(max=40) String unit, @Positive BigDecimal goal, @NotBlank String period, @Positive BigDecimal step, Boolean countsFlexibleMeals) {
        HabitInput input() {
            return new HabitInput(name, habitType, unit, goal, period, step, Boolean.TRUE.equals(countsFlexibleMeals));
        }
    }
}

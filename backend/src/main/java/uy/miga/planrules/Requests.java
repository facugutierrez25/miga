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
    @com.fasterxml.jackson.annotation.JsonIgnoreProperties("metaDiaria")
    record Group(@NotNull @PositiveOrZero Long planVersion, @NotBlank @Size(max=60) String name,
        @Size(max=10) String abbreviation, @Size(max=50) String clave, @Pattern(regexp="#[0-9a-fA-F]{6}") String color,
        Boolean preguntarSiFalta, Boolean opcional) {
        GroupInput input() {
            return new GroupInput(name, abbreviation, clave, color,
                Boolean.TRUE.equals(preguntarSiFalta), Boolean.TRUE.equals(opcional));
        }
    }
    record Component(@NotNull UUID groupUid, @Positive double porciones) {}
    interface CreateRule {}
    record Rule(@NotNull @PositiveOrZero Long planVersion, @NotBlank @Size(max=100, groups=CreateRule.class, message="El alimento admite hasta 100 caracteres.") String alimento,
        @Size(max=20, groups=CreateRule.class, message="Podés indicar hasta 20 sinónimos.") List<@NotBlank @Size(max=100, groups=CreateRule.class, message="Cada sinónimo admite hasta 100 caracteres.") String> sinonimos, @NotBlank String tipo, UUID groupUid, @Positive BigDecimal cantidadPorPorcion,
        @Size(max=20) String unidad, @Positive BigDecimal porcionPorDefecto, List<@NotNull @Valid Component> componentes, UUID overridesRuleUid) {}
    record Habit(@NotNull @PositiveOrZero Long planVersion, @NotBlank @Size(max=100) String name, @NotBlank String habitType,
        @Size(max=40) String unit, @PositiveOrZero(message="La meta no puede ser negativa.") @DecimalMax(value="100000", message="La meta admite hasta 100000.") BigDecimal goal, @NotBlank String period, @Positive(message="El paso debe ser positivo.") @DecimalMax(value="100000", message="El paso admite hasta 100000.") BigDecimal step, Boolean countsFlexibleMeals) {
        HabitInput input() {
            return new HabitInput(name, habitType, unit, goal, period, step, Boolean.TRUE.equals(countsFlexibleMeals));
        }
    }
}

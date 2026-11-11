package uy.miga.planrules;

import com.fasterxml.jackson.annotation.JsonProperty;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import uy.miga.habitos.HabitInput;
import uy.miga.plans.GroupInput;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

final class Requests {
    private Requests() {}

    record Version(@NotNull @PositiveOrZero Long planVersion) {}

    record Order(@NotNull @PositiveOrZero Long planVersion, @NotNull List<@NotNull UUID> uids) {}

    @JsonIgnoreProperties("metaDiaria")
    record Group(@NotNull @PositiveOrZero Long planVersion,
                 @NotBlank @Size(max = 60) String name,
                 @Size(max = 10) String abbreviation,
                 @JsonProperty("clave") @Size(max = 50) String standardKey,
                 String color,
                 @JsonProperty("preguntarSiFalta") Boolean askIfMissing,
                 @JsonProperty("opcional") Boolean optional) {
        GroupInput input() {
            return new GroupInput(name, abbreviation, standardKey, color,
                Boolean.TRUE.equals(askIfMissing), Boolean.TRUE.equals(optional));
        }
    }

    record Component(@NotNull UUID groupUid, @JsonProperty("porciones") @Positive double portions) {}

    // Grupo de validación que solo se aplica al crear un alimento.
    interface CreateRule {}

    record Rule(@NotNull @PositiveOrZero Long planVersion,
                @JsonProperty("alimento") @NotBlank
                @Size(max = 100, groups = CreateRule.class, message = "El alimento admite hasta 100 caracteres.")
                String food,
                @JsonProperty("sinonimos") @Size(max = 20, groups = CreateRule.class, message = "Podés indicar hasta 20 sinónimos.")
                List<@NotBlank @Size(max = 100, groups = CreateRule.class,
                    message = "Cada sinónimo admite hasta 100 caracteres.") String> synonyms,
                @JsonProperty("tipo") @NotBlank String type,
                UUID groupUid,
                @JsonProperty("cantidadPorPorcion") @Positive BigDecimal amountPerPortion,
                @JsonProperty("unidad") @Size(max = 20) String unit,
                @JsonProperty("porcionPorDefecto") @Positive BigDecimal defaultPortions,
                @JsonProperty("componentes") List<@NotNull @Valid Component> components,
                UUID overridesRuleUid, Boolean countsFlexible) {
        Rule {
            countsFlexible = Boolean.TRUE.equals(countsFlexible);
        }

        Rule(Long planVersion, String food, List<String> synonyms, String type, UUID groupUid,
                BigDecimal amountPerPortion, String unit, BigDecimal defaultPortions,
                List<Component> components, UUID overridesRuleUid) {
            this(planVersion, food, synonyms, type, groupUid, amountPerPortion, unit, defaultPortions, components, overridesRuleUid, false);
        }
    }

    record Habit(@NotNull @PositiveOrZero Long planVersion,
                 @NotBlank @Size(max = 100) String name,
                 @NotBlank String habitType,
                 @Size(max = 40) String unit,
                 @PositiveOrZero(message = "La meta no puede ser negativa.")
                 @DecimalMax(value = "100000", message = "La meta admite hasta 100000.") BigDecimal goal,
                 @NotBlank String period,
                 @Positive(message = "El paso debe ser positivo.")
                 @DecimalMax(value = "100000", message = "El paso admite hasta 100000.") BigDecimal step,
                 Boolean countsFlexibleMeals) {
        HabitInput input() {
            return new HabitInput(name, habitType, unit, goal, period, step, Boolean.TRUE.equals(countsFlexibleMeals));
        }
    }
}

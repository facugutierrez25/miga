package uy.miga.intake;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class FoodEntryFacadeTest {
    private final FoodEntryRepository repository = mock(FoodEntryRepository.class);
    private final FoodEntryFacade facade = new FoodEntryFacade(repository);
    private final LocalDate date = LocalDate.of(2026, 10, 30);

    @Test
    void repeatedResponseDoesNotCreateAnotherEntry() {
        when(repository.existsByUserIdAndDateAndMealIdAndFoodGroupIdAndOrigen(
            1L, date, 2L, 3L, "RESPUESTA")).thenReturn(true);
        facade.createResponseEntry(1L, "user", 2L, date, "food", 3L);
        verify(repository, never()).save(any());
    }

    @Test
    void newResponseHasResponseOriginAndOnePortion() {
        facade.createResponseEntry(1L, "user", 2L, date, "food", 3L);
        ArgumentCaptor<FoodEntry> entry = ArgumentCaptor.forClass(FoodEntry.class);
        verify(repository).save(entry.capture());
        assertThat(entry.getValue().getOrigen()).isEqualTo("RESPUESTA");
        assertThat(entry.getValue().getPorciones()).isEqualByComparingTo(BigDecimal.ONE);
        assertThat(entry.getValue().getUserId()).isEqualTo(1L);
        assertThat(entry.getValue().getMealId()).isEqualTo(2L);
        assertThat(entry.getValue().getFoodGroupId()).isEqualTo(3L);
        assertThat(entry.getValue().getDate()).isEqualTo(date);
    }

    @Test
    void negativeResponseOnlyDeletesResponsesForTheSameUserDateMealAndGroup() {
        facade.deleteResponseEntries(1L, date, 2L, 3L);
        verify(repository).deleteByUserIdAndDateAndMealIdAndFoodGroupIdAndOrigen(
            1L, date, 2L, 3L, "RESPUESTA");
        verifyNoMoreInteractions(repository);
    }

    @Test void correctionReplacesStaleRuleExplanation() {
        var entry = new FoodEntry(1L, "user", 2L, date, "Mandarina", 2.0, "u", 3L);
        entry.setAppliedRule("mandarina = 2 porciones");
        entry.setSupuesto(true);
        when(repository.findById(1L)).thenReturn(java.util.Optional.of(entry));
        facade.correctEntry(1L, 2.0, "u", null, BigDecimal.ONE);
        assertThat(entry.getAppliedRule()).isEqualTo("Corrección del usuario: 1 porción");
        assertThat(entry.getSupuesto()).isFalse();
        assertThat(entry.getOrigen()).isEqualTo("USUARIO");
    }
}

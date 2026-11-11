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
        when(repository.existsByUserIdAndDateAndMealIdAndFoodGroupIdAndOrigin(
            1L, date, 2L, 3L, "RESPUESTA")).thenReturn(true);
        facade.createResponseEntry(1L, "user", 2L, date, "food", 3L);
        verify(repository, never()).save(any());
    }

    @Test
    void newResponseHasResponseOriginAndOnePortion() {
        facade.createResponseEntry(1L, "user", 2L, date, "food", 3L);
        ArgumentCaptor<FoodEntry> entry = ArgumentCaptor.forClass(FoodEntry.class);
        verify(repository).save(entry.capture());
        assertThat(entry.getValue().getOrigin()).isEqualTo("RESPUESTA");
        assertThat(entry.getValue().getPortions()).isEqualByComparingTo(BigDecimal.ONE);
        assertThat(entry.getValue().getUserId()).isEqualTo(1L);
        assertThat(entry.getValue().getMealId()).isEqualTo(2L);
        assertThat(entry.getValue().getFoodGroupId()).isEqualTo(3L);
        assertThat(entry.getValue().getDate()).isEqualTo(date);
    }

    @Test
    void negativeResponseOnlyDeletesResponsesForTheSameUserDateMealAndGroup() {
        facade.deleteResponseEntries(1L, date, 2L, 3L);
        verify(repository).deleteByUserIdAndDateAndMealIdAndFoodGroupIdAndOrigin(
            1L, date, 2L, 3L, "RESPUESTA");
        verifyNoMoreInteractions(repository);
    }

    @Test void correctionReplacesStaleRuleExplanation() {
        var entry = new FoodEntry(1L, "user", 2L, date, "Mandarina", 2.0, "u", 3L);
        entry.setAppliedRule("mandarina = 2 porciones");
        entry.setEstimated(true);
        when(repository.findById(1L)).thenReturn(java.util.Optional.of(entry));
        facade.correctEntry(1L, 2.0, "u", null, BigDecimal.ONE);
        assertThat(entry.getAppliedRule()).isEqualTo("Corrección del usuario: 1 porción");
        assertThat(entry.getEstimated()).isFalse();
        assertThat(entry.getOrigin()).isEqualTo("USUARIO");
    }
    @Test
    void flexibleCorrectionClearsGroupAndCanBeCorrectedBack() {
        var entry = new FoodEntry(1L, "user", 2L, date, "leche", 1.0, "u", 3L);
        entry.setPortions(BigDecimal.ONE);
        when(repository.findById(1L)).thenReturn(java.util.Optional.of(entry));
        facade.makeFlexible(1L);
        assertThat(entry.getRuleType()).isEqualTo("FLEXIBLE");
        assertThat(entry.getFoodGroupId()).isNull();
        assertThat(entry.getPortions()).isNull();
        assertThat(entry.getAppliedRule()).isEqualTo("leche: cuenta como comida flexible");
        assertThat(entry.getRuleSource()).isEqualTo("USUARIO");
        facade.correctEntry(1L, null, null, 3L, BigDecimal.ONE);
        assertThat(entry.getRuleType()).isEqualTo("NORMAL");
        assertThat(entry.getFoodGroupId()).isEqualTo(3L);
        assertThat(entry.getPortions()).isEqualByComparingTo(BigDecimal.ONE);
    }
}

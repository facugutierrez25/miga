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
    void reusedRuleRevokesAllEarlierEntriesWithoutChangingResolution() {
        var uid = java.util.UUID.randomUUID();
        var first = new FoodEntry(1L, "user", 2L, date, "food", 1.0, "u", 3L);
        var second = new FoodEntry(1L, "user", 2L, date.minusDays(1), "food", 1.0, "u", 3L);
        for (var entry : java.util.List.of(first, second)) {
            entry.setResolved(true);
            entry.setResolvedRuleUid(uid);
        }
        when(repository.findByUserIdAndResolvedRuleUid(1L, uid)).thenReturn(java.util.List.of(first, second));
        facade.onUserRuleReused(new uy.miga.reglas.UserRuleReused(1L, uid));
        assertThat(first.getResolvedRuleUid()).isNull();
        assertThat(second.getResolvedRuleUid()).isNull();
        assertThat(first.isResolved()).isTrue();
        assertThat(second.isResolved()).isTrue();
        verify(repository).findByUserIdAndResolvedRuleUid(1L, uid);
    }

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
}

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
        org.springframework.test.util.ReflectionTestUtils.setField(entry, "id", 1L);
        entry.setPortions(BigDecimal.ONE);
        when(repository.findById(1L)).thenReturn(java.util.Optional.of(entry));
        assertThat(facade.makeFlexible(1L)).containsExactly(1L);
        verify(repository, never()).findByUserIdAndDateAndMealIdAndOccurrenceIdOrderByIdAsc(any(), any(), any(), any());
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

    @Test
    void flexibleCorrectionCollapsesAllRowsOfTheScopedOccurrence() {
        var occurrence = java.util.UUID.randomUUID();
        var siblings = java.util.stream.LongStream.rangeClosed(1, 3).mapToObj(id -> {
            var entry = new FoodEntry(1L, "user", 2L, date, "Sticks de pollo", 1.0, "u", id);
            org.springframework.test.util.ReflectionTestUtils.setField(entry, "id", id);
            entry.setOccurrenceId(occurrence);
            entry.setPortions(BigDecimal.ONE);
            return entry;
        }).toList();
        var selected = siblings.get(1);
        when(repository.findById(2L)).thenReturn(java.util.Optional.of(selected));
        when(repository.findByUserIdAndDateAndMealIdAndOccurrenceIdOrderByIdAsc(1L, date, 2L, occurrence))
            .thenReturn(siblings);

        assertThat(facade.makeFlexible(2L)).containsExactly(1L, 2L, 3L);

        verify(repository).deleteAll(java.util.List.of(siblings.get(0), siblings.get(2)));
        assertThat(selected.getRuleType()).isEqualTo("FLEXIBLE");
        assertThat(selected.getFoodGroupId()).isNull();
        assertThat(selected.getPortions()).isNull();
        assertThat(selected.getOccurrenceId()).isEqualTo(occurrence);
    }

    @Test
    void returningToGroupsCollapsesRemainingSiblingRows() {
        var occurrence = java.util.UUID.randomUUID();
        var selected = new FoodEntry(1L, "user", 2L, date, "Sticks de pollo", 1.0, "u", null);
        org.springframework.test.util.ReflectionTestUtils.setField(selected, "id", 1L);
        selected.setOccurrenceId(occurrence);
        selected.setRuleType("FLEXIBLE");
        var sibling = new FoodEntry(1L, "user", 2L, date, "Sticks de pollo", 1.0, "u", 3L);
        org.springframework.test.util.ReflectionTestUtils.setField(sibling, "id", 2L);
        sibling.setOccurrenceId(occurrence);
        when(repository.findById(1L)).thenReturn(java.util.Optional.of(selected));
        when(repository.findByUserIdAndDateAndMealIdAndOccurrenceIdOrderByIdAsc(1L, date, 2L, occurrence))
            .thenReturn(java.util.List.of(selected, sibling));

        assertThat(facade.collapseOccurrence(1L)).containsExactly(1L, 2L);
        facade.correctEntry(1L, null, null, 4L, BigDecimal.ONE);

        verify(repository).deleteAll(java.util.List.of(sibling));
        assertThat(selected.getRuleType()).isEqualTo("NORMAL");
        assertThat(selected.getFoodGroupId()).isEqualTo(4L);
    }
}

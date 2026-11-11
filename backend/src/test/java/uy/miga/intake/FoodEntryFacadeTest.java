package uy.miga.intake;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
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

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void splitComponentsShareAnOccurrenceAndCanBecomeFlexible(boolean hasOccurrence) {
        var source = new FoodEntry(1L, "user", 2L, date, "Sticks de pollo", 1.0, "u", 3L);
        org.springframework.test.util.ReflectionTestUtils.setField(source, "id", 1L);
        var originalOccurrence = hasOccurrence ? java.util.UUID.randomUUID() : null;
        source.setOccurrenceId(originalOccurrence);
        when(repository.findById(1L)).thenReturn(java.util.Optional.of(source));
        var nextId = new java.util.concurrent.atomic.AtomicLong(2);
        when(repository.save(any())).thenAnswer(invocation -> {
            FoodEntry entry = invocation.getArgument(0);
            org.springframework.test.util.ReflectionTestUtils.setField(entry, "id", nextId.getAndIncrement());
            return entry;
        });
        var groups = new java.util.LinkedHashMap<Long, BigDecimal>();
        groups.put(3L, BigDecimal.ONE);
        groups.put(4L, BigDecimal.ONE);
        groups.put(5L, BigDecimal.ONE);

        assertThat(facade.splitEntry(1L, groups)).containsExactly(2L, 3L, 4L);

        var saved = ArgumentCaptor.forClass(FoodEntry.class);
        verify(repository, times(3)).save(saved.capture());
        var components = saved.getAllValues();
        var occurrence = components.getFirst().getOccurrenceId();
        assertThat(occurrence).isNotNull();
        if (hasOccurrence) assertThat(occurrence).isEqualTo(originalOccurrence);
        assertThat(components).allSatisfy(entry -> assertThat(entry.getOccurrenceId()).isEqualTo(occurrence));
        verify(repository).delete(source);
        var selected = components.get(1);
        when(repository.findById(3L)).thenReturn(java.util.Optional.of(selected));
        when(repository.findByUserIdAndDateAndMealIdAndOccurrenceIdOrderByIdAsc(1L, date, 2L, occurrence))
            .thenReturn(components);

        assertThat(facade.makeFlexible(3L)).containsExactly(2L, 3L, 4L);
        verify(repository).deleteAll(java.util.List.of(components.get(0), components.get(2)));
        assertThat(selected.getFoodGroupId()).isNull();
        assertThat(selected.getPortions()).isNull();
        assertThat(selected.getRuleType()).isEqualTo("FLEXIBLE");
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void ambiguousLegacyOccurrenceRejectsCorrectionBeforeChangingAnything(boolean alreadyFlexible) {
        var entry = new FoodEntry(1L, "user", 2L, date, "Sticks de pollo", 1.0, "u", 3L);
        org.springframework.test.util.ReflectionTestUtils.setField(entry, "id", 1L);
        entry.setMealNoteId(4L);
        entry.setOriginalText("Sticks de pollo");
        entry.setPortions(BigDecimal.ONE);
        entry.setRuleType(alreadyFlexible ? "FLEXIBLE" : "COMPUESTO");
        when(repository.findById(1L)).thenReturn(java.util.Optional.of(entry));
        when(repository.existsByUserIdAndDateAndMealIdAndMealNoteIdAndFoodAndOriginalTextAndOccurrenceIdIsNullAndIdNot(
            1L, date, 2L, 4L, "Sticks de pollo", "Sticks de pollo", 1L)).thenReturn(true);

        assertThatThrownBy(() -> {
            if (alreadyFlexible) facade.collapseOccurrence(1L);
            else facade.makeFlexible(1L);
        }).isInstanceOfSatisfying(org.springframework.web.server.ResponseStatusException.class, exception -> {
            assertThat(exception.getStatusCode().value()).isEqualTo(409);
            assertThat(exception.getReason()).isEqualTo(
                "Este alimento se anotó en una versión anterior; editá la nota para corregirlo");
        });

        assertThat(entry.getFoodGroupId()).isEqualTo(3L);
        assertThat(entry.getPortions()).isEqualByComparingTo(BigDecimal.ONE);
        assertThat(entry.getRuleType()).isEqualTo(alreadyFlexible ? "FLEXIBLE" : "COMPUESTO");
        assertThat(entry.getOccurrenceId()).isNull();
        verify(repository, never()).deleteAll(any(Iterable.class));
        verify(repository, never()).save(any());
    }
}

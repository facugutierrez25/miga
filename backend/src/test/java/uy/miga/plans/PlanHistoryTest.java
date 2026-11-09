package uy.miga.plans;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class PlanHistoryTest {
    @Test void historyLoadsAllVersionsInBatches() {
        var repository = mock(PlansRepository.class);
        var users = mock(uy.miga.users.UserService.class);
        when(users.findUserIdByEmail("user")).thenReturn(1L);
        var service = new PlanService(repository, mock(PlanFoodGroupRepository.class), mock(MealRepository.class),
            users, mock(org.springframework.context.ApplicationEventPublisher.class), mock(jakarta.persistence.EntityManager.class), java.time.Clock.system(java.time.ZoneId.of("America/Montevideo")));
        assertThat(service.getPlanHistory("user")).isEmpty();
        verify(repository).findHistoryWithGroups(1L);
        verify(repository).fetchHistoryMeals(1L);
    }
    @Test void equivalentVersionsMergeByUidAndCurrentRunIsHidden() {
        var uid = java.util.UUID.randomUUID();
        var versions = new java.util.ArrayList<Plan>();
        for (int i = 1; i <= 5; i++) {
            Plan plan = mock(Plan.class);
            when(plan.getId()).thenReturn((long) i);
            when(plan.isCurrent()).thenReturn(i == 5);
            var start = java.time.OffsetDateTime.parse("2026-01-01T12:00:00-03:00").plusDays(i - 1);
            when(plan.getCreatedAt()).thenReturn(start);
            when(plan.getSupersededAt()).thenReturn(start.plusDays(1));
            var group = mock(PlanFoodGroup.class);
            when(group.getId()).thenReturn((long) i);
            when(group.getUid()).thenReturn(uid);
            when(group.getName()).thenReturn("Group");
            when(group.getAbbreviation()).thenReturn("GRP");
            when(plan.getFoodGroups()).thenReturn(java.util.List.of(group));
            Meal meal = new Meal();
            meal.setName(i <= 2 ? "A" : i == 3 ? "B" : "C");
            MealPortion portion = new MealPortion();
            portion.setFoodGroupId((long) i);
            portion.setPortions(new java.math.BigDecimal(i % 2 == 0 ? "1.000" : "1.0"));
            meal.getPortions().add(portion);
            when(plan.getMeals()).thenReturn(java.util.List.of(meal));
            versions.add(plan);
        }
        var history = PlanHistory.collapse(versions, java.time.ZoneId.of("America/Montevideo"));
        assertThat(history).hasSize(2);
        assertThat(history.get(0).meals().getFirst().name()).isEqualTo("B");
        assertThat(history.get(1).createdAt()).isEqualTo(java.time.LocalDate.of(2026, 1, 1));
        assertThat(history.get(1).supersededAt()).isEqualTo(java.time.LocalDate.of(2026, 1, 3));
    }
}

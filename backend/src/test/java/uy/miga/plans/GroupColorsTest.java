package uy.miga.plans;

import org.junit.jupiter.api.Test;
import java.util.ArrayList;
import java.util.List;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class GroupColorsTest {
    @Test void choosesFirstFreeThenCycles() {
        var used = new ArrayList<String>();
        for (int i = 0; i < 23; i++) {
            String expected = GroupColors.PALETTE.get(i % 10).hex();
            assertThat(GroupColors.next(used)).isEqualTo(expected);
            used.add(expected);
        }
        assertThat(GroupColors.next(List.of("#c0704a"))).isEqualTo("#A8822E");
    }

    @Test void createsWithAutomaticColorAndRejectsNewInvalidColorsButPreservesLegacy() {
        var plans = mock(PlansRepository.class);
        var groups = mock(PlanFoodGroupRepository.class);
        var plan = new Plan();
        when(plans.findById(1L)).thenReturn(java.util.Optional.of(plan));
        var existing = new PlanFoodGroup(plan, "Existing", "EX", (short) 1);
        existing.setColor("#C0704A");
        when(groups.findByPlanIdOrderByDisplayOrderAsc(any())).thenReturn(List.of(existing));
        var service = new PlanService(plans, groups, mock(MealRepository.class), mock(uy.miga.users.UserService.class),
            mock(org.springframework.context.ApplicationEventPublisher.class), mock(jakarta.persistence.EntityManager.class), java.time.Clock.systemUTC());
        assertThat(service.createGroup(1L, input(null)).color()).isEqualTo("#A8822E");
        assertThat(service.createGroup(1L, input("#0e6e6b")).color()).isEqualTo("#A8822E");
        assertThatThrownBy(() -> service.updateGroup(1L, existing.getUid(), input("#FFFFFF")))
            .isInstanceOf(org.springframework.web.server.ResponseStatusException.class).hasMessageContaining("400");
        existing.setColor("#0e6e6b");
        assertThat(service.updateGroup(1L, existing.getUid(), input("#0e6e6b")).color()).isEqualTo("#0e6e6b");
    }

    @Test void defaultsUseStandardKeysAndVersionCopyKeepsLegacyColor() throws Exception {
        var plans = mock(PlansRepository.class);
        var service = new PlanService(plans, mock(PlanFoodGroupRepository.class), mock(MealRepository.class),
            mock(uy.miga.users.UserService.class), mock(org.springframework.context.ApplicationEventPublisher.class),
            mock(jakarta.persistence.EntityManager.class), java.time.Clock.systemUTC());
        when(plans.saveAndFlush(any(Plan.class))).thenAnswer(call -> call.getArgument(0));
        var copy = PlanService.class.getDeclaredMethod("copyPlan", Long.class, java.util.Optional.class);
        copy.setAccessible(true);
        Plan first = (Plan) copy.invoke(service, 1L, java.util.Optional.empty());
        assertThat(first.getFoodGroups()).hasSize(6).allSatisfy(g ->
            assertThat(g.getColor()).isEqualTo(GroupColors.forKey(g.getClave())));
        first.getFoodGroups().getFirst().setColor("#0e6e6b");
        Plan next = (Plan) copy.invoke(service, 1L, java.util.Optional.of(first));
        assertThat(next.getFoodGroups()).extracting(PlanFoodGroup::getColor)
            .containsExactlyElementsOf(first.getFoodGroups().stream().map(PlanFoodGroup::getColor).toList());
    }

    private GroupInput input(String color) {
        return new GroupInput("Custom", "CUS", null, color, false, false);
    }
}

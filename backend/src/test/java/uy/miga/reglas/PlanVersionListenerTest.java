package uy.miga.reglas;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import uy.miga.plans.PlanVersionCreated;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class PlanVersionListenerTest {
    @Test
    void copiesUpsertedUserRuleAndPlanRulesKeepingVersionIdentities() {
        FoodRuleRepository repository = mock(FoodRuleRepository.class);
        FoodRuleService service = new FoodRuleService(repository, mock(org.springframework.context.ApplicationEventPublisher.class));
        when(repository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        var first = service.createUserRule(2L, 1L, 3L, "Zanahoria", List.of(), BigDecimal.ONE, "u", null);
        ArgumentCaptor<FoodRule> saved = ArgumentCaptor.forClass(FoodRule.class);
        verify(repository).save(saved.capture());
        FoodRule source = saved.getValue();
        when(repository.findByUserIdAndPlanIdAndScope(2L, 1L, "USUARIO")).thenReturn(List.of(source));
        service.upsertUserRule(2L, 1L, new RuleInput(" ZANAHORIA ", List.of(), "NORMAL", 3L,
            BigDecimal.TEN, "g", null, List.of(), null));
        FoodRule planRule = new FoodRule();
        planRule.setScope("PLAN");
        planRule.setPlanId(1L);
        planRule.setFood("Zanahoria");
        planRule.setType("LIBRE");
        when(repository.findByPlanIdAndScopeIn(1L, List.of("PLAN", "USUARIO")))
            .thenReturn(List.of(planRule, source));
        clearInvocations(repository);

        new PlanVersionListener(repository).copyRules(new PlanVersionCreated(2L, 1L, 4L,
            Map.of(3L, 5L), Map.of(), LocalDate.now()));

        verify(repository, times(2)).save(saved.capture());
        List<FoodRule> copies = saved.getAllValues().subList(1, 3);
        assertThat(copies).allMatch(rule -> rule.getPlanId().equals(4L));
        assertThat(copies).filteredOn(rule -> "USUARIO".equals(rule.getScope())).singleElement()
            .satisfies(rule -> {
                assertThat(rule.getUid()).isEqualTo(first.uid());
                assertThat(rule.getFoodGroupId()).isEqualTo(5L);
                assertThat(rule.getAmountPerPortion()).isEqualByComparingTo(BigDecimal.TEN);
            });
        assertThat(copies.getFirst().getUid()).isEqualTo(planRule.getUid());
        assertThat(source.getPlanId()).isEqualTo(1L);
        assertThat(source.getFoodGroupId()).isEqualTo(3L);
    }
}

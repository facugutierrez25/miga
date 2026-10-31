package uy.miga.plans;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class PlanHistoryTest {
    @Test void historyUsesLimitedQueryAndPreservesListContract() {
        var repository = mock(PlansRepository.class);
        var users = mock(uy.miga.users.UserService.class);
        when(users.findUserIdByEmail("user")).thenReturn(1L);
        var service = new PlanService(repository, mock(PlanFoodGroupRepository.class), mock(MealRepository.class),
            users, mock(org.springframework.context.ApplicationEventPublisher.class), mock(jakarta.persistence.EntityManager.class));
        assertThat(service.getPlanHistory("user")).isEmpty();
        verify(repository).findTop50ByUserIdAndCurrentFalseOrderBySupersededAtDescIdDesc(1L);
        verifyNoMoreInteractions(repository);
    }
}

package uy.miga.habitos;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

interface PlanHabitRepository extends JpaRepository<PlanHabit, Long> {
    List<PlanHabit> findByPlanIdOrderByDisplayOrderAsc(Long planId);
}

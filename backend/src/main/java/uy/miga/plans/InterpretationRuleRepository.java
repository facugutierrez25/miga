package uy.miga.plans;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

interface InterpretationRuleRepository extends JpaRepository<InterpretationRule, Long> {
    List<InterpretationRule> findByPlanIdOrderByConfidenceDesc(Long planId);
}

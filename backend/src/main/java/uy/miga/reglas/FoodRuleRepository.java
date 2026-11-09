package uy.miga.reglas;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

interface FoodRuleRepository extends JpaRepository<FoodRule, Long> {

    // Carga las reglas aplicables para un usuario y plan, ordenadas por alcance
    // para que USUARIO > PLAN > GLOBAL y dentro del mismo alcance por id ASC
    // (desempate determinístico).
    @Query("""
        SELECT r FROM FoodRule r
        WHERE
            (r.scope = 'GLOBAL')
            OR (r.scope = 'PLAN'    AND r.planId = :planId)
            OR (r.scope = 'USUARIO' AND r.userId = :userId AND r.planId = :planId)
        ORDER BY
            CASE r.scope
                WHEN 'USUARIO' THEN 1
                WHEN 'PLAN'    THEN 2
                WHEN 'GLOBAL'  THEN 3
            END ASC,
            r.id ASC
        """)
    List<FoodRule> findApplicable(@Param("planId") Long planId,
                                  @Param("userId") Long userId);

    List<FoodRule> findByUserIdAndPlanIdAndScope(Long userId, Long planId, String scope);

    List<FoodRule> findByPlanIdAndScopeIn(Long planId, List<String> scopes);

    @Query("SELECT r FROM FoodRule r WHERE r.uid = :uid AND (r.scope = 'GLOBAL' OR (r.scope = 'PLAN' AND r.planId = :planId))")
    Optional<FoodRule> findForAdjust(@Param("uid") UUID uid, @Param("planId") Long planId);

    void deleteByIdAndUserId(Long id, Long userId);
}

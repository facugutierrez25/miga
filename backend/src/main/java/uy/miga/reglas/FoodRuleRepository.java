package uy.miga.reglas;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

interface FoodRuleRepository extends JpaRepository<FoodRule, Long> {

    // Carga las reglas aplicables para un usuario y plan, ordenadas por alcance
    // para que USUARIO > PLAN > GLOBAL y dentro del mismo alcance por id ASC
    // (desempate determinístico).
    @Query("""
        SELECT r FROM FoodRule r
        WHERE
            (r.alcance = 'GLOBAL')
            OR (r.alcance = 'PLAN'    AND r.planId = :planId)
            OR (r.alcance = 'USUARIO' AND r.userId = :userId AND r.planId = :planId)
        ORDER BY
            CASE r.alcance
                WHEN 'USUARIO' THEN 1
                WHEN 'PLAN'    THEN 2
                WHEN 'GLOBAL'  THEN 3
            END ASC,
            r.id ASC
        """)
    List<FoodRule> findApplicable(@Param("planId") Long planId,
                                  @Param("userId") Long userId);

    List<FoodRule> findByUserIdAndPlanIdAndAlcance(Long userId, Long planId, String alcance);

    List<FoodRule> findByPlanIdAndAlcanceIn(Long planId, List<String> alcances);

    void deleteByIdAndUserId(Long id, Long userId);
}

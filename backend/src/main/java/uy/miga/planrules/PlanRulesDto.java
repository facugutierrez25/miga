package uy.miga.planrules;
import java.util.List;
import java.util.UUID;
import java.math.BigDecimal;
import uy.miga.plans.PlanFoodGroupDto;
import uy.miga.habitos.HabitConfigDto;
record PlanRulesDto(Long planId, Long planVersion, String modoRegistro, List<PlanFoodGroupDto> grupos,
    List<RuleDto> alimentos, List<HabitConfigDto> habitos) {
    record ComponentDto(UUID groupUid, double porciones) {}
    record RuleDto(UUID uid, String alcance, String alimento, List<String> sinonimos, String tipo, UUID groupUid,
        BigDecimal cantidadPorPorcion, String unidad, BigDecimal porcionPorDefecto, List<ComponentDto> componentes,
        UUID overridesRuleUid, String textoRegla) {}
    record CatalogDto(UUID uid, String alcance, String alimento, List<String> sinonimos, String tipo,
        UUID groupUid, String textoRegla, UUID ajustadoPorUid) {}
}

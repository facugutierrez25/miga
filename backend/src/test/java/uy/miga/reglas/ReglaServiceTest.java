package uy.miga.reglas;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.math.BigDecimal;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class ReglaServiceTest {
    final FoodRuleRepository repository = mock(FoodRuleRepository.class);
    final ReglaService service = new ReglaService(repository);
    FoodRule rule(String scope, String name) {
        FoodRule r = new FoodRule(); r.setAlcance(scope); r.setAlimento(name); r.setTipo("NORMAL"); r.setPorcionPorDefecto(BigDecimal.ONE); return r;
    }
    @Test void adjustmentReplacesOriginalIncludingItsAliases() {
        FoodRule global = rule("GLOBAL", "sintético"); global.setSinonimos(List.of("alias global"));
        FoodRule adjustment = rule("USUARIO", "otro nombre"); adjustment.setOverridesRuleUid(global.getUid()); adjustment.setFoodGroupId(7L);
        FoodRule unrelated = rule("PLAN", "otro");
        when(repository.findApplicable(1L, 2L)).thenReturn(List.of(adjustment, unrelated, global));
        var applicable = service.findApplicable(1L, 2L);
        assertThat(applicable).hasSize(2);
        assertThat(applicable.getFirst().foodGroupId()).isEqualTo(7L);
        assertThat(applicable.getFirst().sinonimos()).contains("alias global", "sintético");
        assertThat(applicable).noneMatch(r -> r.uid().equals(global.getUid()));
    }
    @Test void catalogSearchIgnoresAccentsAndCaseAndCapsResults() {
        List<FoodRule> all = new ArrayList<>();
        for(int i=0;i<40;i++) { var r=rule("GLOBAL","Nombre"+i); r.setSinonimos(List.of("SINTÉTICO")); all.add(r); }
        all.add(rule("USUARIO","sintetico"));
        when(repository.findApplicable(1L,2L)).thenReturn(all);
        assertThat(service.searchCatalog("sintetico",1L,2L,100)).hasSize(30).allMatch(r -> r.alcance().equals("GLOBAL"));
    }
    @ParameterizedTest @ValueSource(strings={"NORMAL","COMPUESTO","LIBRE","FLEXIBLE","NO_CUENTA","INVALIDO"})
    void invalidStructureIsRejected(String type) {
        var input = new RuleInput("Nombre", List.of(), type, type.equals("NORMAL") || type.equals("COMPUESTO") ? null : 3L,
            null,null,BigDecimal.ONE,List.of(),null);
        assertThatThrownBy(() -> service.createUserRule(2L,1L,input)).isInstanceOf(InvalidRuleException.class);
        verify(repository,never()).save(any());
    }
    @Test void duplicatedCompoundGroupsAreRejected() {
        var in=new RuleInput("Compuesto",List.of(),"COMPUESTO",null,null,null,null,List.of(new Componente(3L,null,1),new Componente(3L,null,0.5)),null);
        assertThatThrownBy(() -> service.createUserRule(2L,1L,in)).isInstanceOf(InvalidRuleException.class);
    }
    @Test void textUsesCommaAndReadableGroupNames() {
        FoodRule r=rule("USUARIO","barrita"); r.setTipo("COMPUESTO"); r.setComponentes(List.of(new Componente(3L,null,0.5),new Componente(4L,null,1)));
        when(repository.findApplicable(1L,2L)).thenReturn(List.of(r));
        assertThat(RuleText.describe(service.findApplicable(1L,2L).getFirst(),Map.of(3L,"Proteínas",4L,"Cereales")))
            .isEqualTo("1 barrita = 0,5 Proteínas + 1 Cereales");
    }
    @Test
    void upsertMatchesNormalizedNameAndPreservesIdentityAndOverride() {
        FoodRule existing = rule("USUARIO", "  ÁRBOL ");
        existing.setUserId(2L);
        existing.setPlanId(1L);
        UUID uid = existing.getUid();
        UUID override = UUID.randomUUID();
        existing.setOverridesRuleUid(override);
        when(repository.findByUserIdAndPlanIdAndAlcance(2L, 1L, "USUARIO")).thenReturn(List.of(existing));
        FoodRuleDto result = service.upsertUserRule(2L, 1L, new RuleInput("arbol", List.of(), "NORMAL",
            7L, BigDecimal.valueOf(2), "u", BigDecimal.ONE, List.of(), null));
        assertThat(result.uid()).isEqualTo(uid);
        assertThat(result.overridesRuleUid()).isEqualTo(override);
        assertThat(result.cantidadPorPorcion()).isEqualByComparingTo("2");
        verify(repository, never()).save(any());
    }

    @Test
    void upsertCreatesMissingRuleAndNullSynonymsAreEmpty() {
        when(repository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        FoodRuleDto result = service.upsertUserRule(2L, 1L, new RuleInput("Nuevo", null, "LIBRE",
            null, null, null, null, List.of(), null));
        assertThat(result.alimento()).isEqualTo("Nuevo");
        assertThat(result.sinonimos()).isEmpty();
        FoodRule persisted = rule("PLAN", "Sin alias");
        persisted.setSinonimos(null);
        when(repository.findApplicable(1L, 2L)).thenReturn(List.of(persisted));
        assertThat(service.findApplicable(1L, 2L).getFirst().sinonimos()).isEmpty();
    }

    @Test
    void upsertUnionsSynonymsUsingNormalizedComparison() {
        FoodRule existing = rule("USUARIO", "yogur");
        existing.setSinonimos(List.of("yogurt", "Álias"));
        when(repository.findByUserIdAndPlanIdAndAlcance(2L, 1L, "USUARIO")).thenReturn(List.of(existing));

        FoodRuleDto result = service.upsertUserRule(2L, 1L, new RuleInput("yogur",
            List.of(" YOGURT ", "alias", "nuevo"), "NORMAL", 7L, new BigDecimal("0.667"),
            "u", BigDecimal.ONE, List.of(), null));

        assertThat(result.sinonimos()).containsExactly("yogurt", "Álias", "nuevo");
        result = service.upsertUserRule(2L, 1L, new RuleInput("yogur", null, "NORMAL", 7L,
            BigDecimal.ONE, "u", BigDecimal.ONE, List.of(), null));
        assertThat(result.sinonimos()).containsExactly("yogurt", "Álias", "nuevo");
    }

    @Test
    void updateRejectsNormalizedDuplicateButAllowsOwnName() {
        FoodRule first = rule("USUARIO", "Árbol");
        FoodRule second = rule("USUARIO", "Otro");
        when(repository.findByUserIdAndPlanIdAndAlcance(2L, 1L, "USUARIO"))
            .thenReturn(List.of(first, second));
        RuleInput input = new RuleInput(" ARBOL ", List.of(), "LIBRE", null, null, null,
            BigDecimal.ONE, List.of(), null);

        assertThatThrownBy(() -> service.updateUserRule(2L, 1L, second.getUid(), input))
            .isInstanceOfSatisfying(org.springframework.web.server.ResponseStatusException.class,
                exception -> assertThat(exception.getStatusCode().value()).isEqualTo(409));
        assertThat(second.getAlimento()).isEqualTo("Otro");
        assertThat(service.updateUserRule(2L, 1L, first.getUid(), input).alimento()).isEqualTo("ARBOL");
    }

}

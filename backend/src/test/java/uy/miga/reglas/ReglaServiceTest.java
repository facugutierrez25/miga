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
}

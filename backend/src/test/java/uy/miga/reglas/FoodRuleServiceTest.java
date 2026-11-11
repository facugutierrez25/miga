package uy.miga.reglas;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.math.BigDecimal;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class FoodRuleServiceTest {
    final FoodRuleRepository repository = mock(FoodRuleRepository.class);
    final org.springframework.context.ApplicationEventPublisher events = mock(org.springframework.context.ApplicationEventPublisher.class);
    final FoodRuleService service = new FoodRuleService(repository, events);
    FoodRule rule(String scope, String name) {
        FoodRule r = new FoodRule(); r.setScope(scope); r.setFood(name); r.setType("NORMAL"); r.setDefaultPortions(BigDecimal.ONE); return r;
    }
    @Test void adjustmentReplacesOriginalIncludingItsAliases() {
        FoodRule global = rule("GLOBAL", "sintético"); global.setSynonyms(List.of("alias global"));
        FoodRule adjustment = rule("USUARIO", "otro nombre"); adjustment.setOverridesRuleUid(global.getUid()); adjustment.setFoodGroupId(7L);
        FoodRule unrelated = rule("PLAN", "otro");
        when(repository.findApplicable(1L, 2L)).thenReturn(List.of(adjustment, unrelated, global));
        var applicable = service.findApplicable(1L, 2L);
        assertThat(applicable).hasSize(2);
        assertThat(applicable.getFirst().foodGroupId()).isEqualTo(7L);
        assertThat(applicable.getFirst().synonyms()).contains("alias global", "sintético");
        assertThat(applicable).noneMatch(r -> r.uid().equals(global.getUid()));
    }
    @Test void catalogSearchIgnoresAccentsAndCaseAndCapsResults() {
        List<FoodRule> all = new ArrayList<>();
        for(int i=0;i<40;i++) { var r=rule("GLOBAL","Nombre"+i); r.setSynonyms(List.of("SINTÉTICO")); all.add(r); }
        all.add(rule("USUARIO","sintetico"));
        when(repository.findApplicable(1L,2L)).thenReturn(all);
        assertThat(service.searchCatalog("sintetico",1L,2L,100)).hasSize(30).allMatch(r -> r.scope().equals("GLOBAL"));
    }
    @ParameterizedTest @ValueSource(strings={"NORMAL","COMPUESTO","LIBRE","FLEXIBLE","NO_CUENTA","INVALIDO"})
    void invalidStructureIsRejected(String type) {
        var input = new RuleInput("Nombre", List.of(), type, type.equals("NORMAL") || type.equals("COMPUESTO") ? null : 3L,
            null,null,BigDecimal.ONE,List.of(),null);
        assertThatThrownBy(() -> service.createUserRule(2L,1L,input)).isInstanceOf(InvalidRuleException.class);
        verify(repository,never()).save(any());
    }
    @Test void duplicatedCompoundGroupsAreRejected() {
        var in=new RuleInput("Compuesto",List.of(),"COMPUESTO",null,null,null,null,List.of(new RuleComponent(3L,null,1),new RuleComponent(3L,null,0.5)),null);
        assertThatThrownBy(() -> service.createUserRule(2L,1L,in)).isInstanceOf(InvalidRuleException.class);
    }
    @Test void textUsesCommaAndReadableGroupNames() {
        FoodRule r=rule("USUARIO","barrita"); r.setType("COMPUESTO"); r.setComponents(List.of(new RuleComponent(3L,null,0.5),new RuleComponent(4L,null,1)));
        when(repository.findApplicable(1L,2L)).thenReturn(List.of(r));
        assertThat(RuleText.describe(service.findApplicable(1L,2L).getFirst(),Map.of(3L,"Proteínas",4L,"Cereales")))
            .isEqualTo("1 barrita = 0,5 porciones de Proteínas + 1 porción de Cereales");
    }
    @Test
    void upsertMatchesNormalizedNameAndPreservesIdentityAndOverride() {
        FoodRule existing = rule("USUARIO", "  ÁRBOL ");
        existing.setUserId(2L);
        existing.setPlanId(1L);
        UUID uid = existing.getUid();
        UUID override = UUID.randomUUID();
        existing.setOverridesRuleUid(override);
        when(repository.findByUserIdAndPlanIdAndScope(2L, 1L, "USUARIO")).thenReturn(List.of(existing));
        FoodRuleDto result = service.upsertUserRule(2L, 1L, new RuleInput("arbol", List.of(), "NORMAL",
            7L, BigDecimal.valueOf(2), "u", BigDecimal.ONE, List.of(), null));
        verify(events).publishEvent(new UserRuleReused(2L, uid));
        assertThat(result.uid()).isEqualTo(uid);
        assertThat(result.overridesRuleUid()).isEqualTo(override);
        assertThat(result.amountPerPortion()).isEqualByComparingTo("2");
        verify(repository, never()).save(any());
    }

    @Test
    void upsertCreatesMissingRuleAndNullSynonymsAreEmpty() {
        when(repository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        FoodRuleDto result = service.upsertUserRule(2L, 1L, new RuleInput("Nuevo", null, "LIBRE",
            null, null, null, null, List.of(), null));
        verifyNoInteractions(events);
        assertThat(result.food()).isEqualTo("Nuevo");
        assertThat(result.synonyms()).isEmpty();
        FoodRule persisted = rule("PLAN", "Sin alias");
        persisted.setSynonyms(null);
        when(repository.findApplicable(1L, 2L)).thenReturn(List.of(persisted));
        assertThat(service.findApplicable(1L, 2L).getFirst().synonyms()).isEmpty();
    }

    @Test
    void upsertUnionsSynonymsUsingNormalizedComparison() {
        FoodRule existing = rule("USUARIO", "yogur");
        existing.setSynonyms(List.of("yogurt", "Álias"));
        when(repository.findByUserIdAndPlanIdAndScope(2L, 1L, "USUARIO")).thenReturn(List.of(existing));

        FoodRuleDto result = service.upsertUserRule(2L, 1L, new RuleInput("yogur",
            List.of(" YOGURT ", "alias", "nuevo"), "NORMAL", 7L, new BigDecimal("0.667"),
            "u", BigDecimal.ONE, List.of(), null));

        assertThat(result.synonyms()).containsExactly("yogurt", "Álias", "nuevo");
        result = service.upsertUserRule(2L, 1L, new RuleInput("yogur", null, "NORMAL", 7L,
            BigDecimal.ONE, "u", BigDecimal.ONE, List.of(), null));
        assertThat(result.synonyms()).containsExactly("yogurt", "Álias", "nuevo");
    }

    @Test
    void updateRejectsNormalizedDuplicateButAllowsOwnName() {
        FoodRule first = rule("USUARIO", "Árbol");
        FoodRule second = rule("USUARIO", "Otro");
        when(repository.findByUserIdAndPlanIdAndScope(2L, 1L, "USUARIO"))
            .thenReturn(List.of(first, second));
        RuleInput input = new RuleInput(" ARBOL ", List.of(), "LIBRE", null, null, null,
            BigDecimal.ONE, List.of(), null);

        assertThatThrownBy(() -> service.updateUserRule(2L, 1L, second.getUid(), input))
            .isInstanceOfSatisfying(org.springframework.web.server.ResponseStatusException.class,
                exception -> assertThat(exception.getStatusCode().value()).isEqualTo(409));
        assertThat(second.getFood()).isEqualTo("Otro");
        assertThat(service.updateUserRule(2L, 1L, first.getUid(), input).food()).isEqualTo("ARBOL");
        verify(events).publishEvent(new UserRuleReused(2L, first.getUid()));
        verify(events, never()).publishEvent(new UserRuleReused(2L, second.getUid()));
    }


    @Test void missingCatalogRuleUsesScopedLookupAndReturns404() {
        UUID uid = UUID.randomUUID();
        when(repository.findForAdjust(uid, 1L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.getRuleForAdjust(uid, 1L))
            .isInstanceOfSatisfying(org.springframework.web.server.ResponseStatusException.class,
                e -> assertThat(e.getStatusCode().value()).isEqualTo(404));
        verify(repository).findForAdjust(uid, 1L);
        verifyNoMoreInteractions(repository);
    }

    @Test void serviceRejectsOversizedFoodNamesOnBothWritePaths() {
        String name = "a".repeat(101);
        assertThatThrownBy(() -> service.createUserRule(2L, 1L, 3L, name, List.of(), null, null, null))
            .isInstanceOf(InvalidRuleException.class);
        assertThatThrownBy(() -> service.createUserRule(2L, 1L,
            new RuleInput(name, List.of(), "LIBRE", null, null, null, null, List.of(), null)))
            .isInstanceOf(InvalidRuleException.class);
        verify(repository, never()).save(any());
    }

    @Test void serviceRejectsOversizedSynonymsOnBothWritePaths() {
        for (var aliases : List.of(List.of("a".repeat(101)), Collections.nCopies(21, "alias"))) {
            assertThatThrownBy(() -> service.createUserRule(2L, 1L, 3L, "Arroz", aliases, null, null, null))
                .isInstanceOf(InvalidRuleException.class);
            assertThatThrownBy(() -> service.createUserRule(2L, 1L,
                new RuleInput("Arroz", aliases, "LIBRE", null, null, null, null, List.of(), null)))
                .isInstanceOf(InvalidRuleException.class);
        }
        verify(repository, never()).save(any());
    }
    @Test void updatePreservesLegacyValuesWhenChangingPortion() {
        FoodRule existing = rule("USUARIO", "a".repeat(150));
        var aliases = new ArrayList<>(java.util.stream.IntStream.range(0, 21).mapToObj(i -> "alias" + i).toList());
        aliases.add("b".repeat(150));
        existing.setSynonyms(aliases);
        when(repository.findByUserIdAndPlanIdAndScope(2L, 1L, "USUARIO")).thenReturn(List.of(existing));
        var input = new RuleInput(existing.getFood(), aliases, "NORMAL", 7L, null, null,
            BigDecimal.valueOf(2), List.of(), null);
        var result = service.updateUserRule(2L, 1L, existing.getUid(), input);
        assertThat(result.defaultPortions()).isEqualByComparingTo("2");
        assertThat(result.food()).hasSize(150);
        assertThat(result.synonyms()).containsExactlyElementsOf(aliases);
        assertThat(service.upsertUserRule(2L, 1L, input).synonyms()).containsExactlyElementsOf(aliases);
        var added = new ArrayList<>(aliases);
        added.add("nuevo");
        assertThatThrownBy(() -> service.updateUserRule(2L, 1L, existing.getUid(),
            new RuleInput(existing.getFood(), added, "LIBRE", null, null, null, null, List.of(), null)))
            .isInstanceOf(InvalidRuleException.class);
    }

    @Test void updateRejectsNewOversizedNamesAndSynonyms() {
        FoodRule existing = rule("USUARIO", "a".repeat(150));
        when(repository.findByUserIdAndPlanIdAndScope(2L, 1L, "USUARIO")).thenReturn(List.of(existing));
        assertThatThrownBy(() -> service.updateUserRule(2L, 1L, existing.getUid(),
            new RuleInput("b".repeat(101), List.of(), "LIBRE", null, null, null, null, List.of(), null)))
            .isInstanceOf(InvalidRuleException.class);
        assertThatThrownBy(() -> service.updateUserRule(2L, 1L, existing.getUid(),
            new RuleInput(existing.getFood(), List.of("b".repeat(101)), "LIBRE", null, null, null, null, List.of(), null)))
            .isInstanceOf(InvalidRuleException.class);
    }


    @Test void compoundAcceptsQuantityAndUnitOrNeither() {
        when(repository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        for (boolean measured : List.of(true, false)) {
            var result = service.createUserRule(2L, 1L, new RuleInput("Tarta", List.of(), "COMPUESTO", null,
                measured ? new BigDecimal("150") : null, measured ? "g" : null, BigDecimal.ONE,
                List.of(new RuleComponent(3L, null, 1), new RuleComponent(4L, null, 1)), null));
            assertThat(result.amountPerPortion()).isEqualTo(measured ? new BigDecimal("150") : null);
            assertThat(result.unit()).isEqualTo(measured ? "g" : null);
            assertThat(RuleText.describe(result, Map.of(3L, "Cereales", 4L, "Verduras")))
                .isEqualTo("1 Tarta" + (measured ? " (150 g)" : "") + " = 1 porción de Cereales + 1 porción de Verduras");
        }
    }

    @Test void legacyCompoundWithUnitButNoQuantityKeepsWorkingWithoutUnit() {
        when(repository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        var result = service.createUserRule(2L, 1L, new RuleInput("Barrita", List.of(), "COMPUESTO", null,
            null, "u", BigDecimal.ONE, List.of(new RuleComponent(3L, null, 1), new RuleComponent(4L, null, 1)), null));
        assertThat(result.amountPerPortion()).isNull();
        assertThat(result.unit()).isNull();
    }

    @Test void compoundRejectsIncompleteOrInvalidQuantityUnitPair() {
        for (var pair : List.of(
            new Object[]{new BigDecimal("150"), null},
            new Object[]{new BigDecimal("150"), " "}, new Object[]{BigDecimal.ZERO, "g"},
            new Object[]{new BigDecimal("-1"), "g"})) {
            var input = new RuleInput("Tarta", List.of(), "COMPUESTO", null,
                (BigDecimal) pair[0], (String) pair[1], BigDecimal.ONE,
                List.of(new RuleComponent(3L, null, 1), new RuleComponent(4L, null, 1)), null);
            assertThatThrownBy(() -> service.createUserRule(2L, 1L, input))
                .isInstanceOf(InvalidRuleException.class).hasMessageContaining("cantidad positiva y unidad juntas");
        }
        verify(repository, never()).save(any());
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void explicitCreationRejectsDuplicatesAndImplicitUpsertPreservesUid(boolean legacy) {
        List<FoodRule> stored = new ArrayList<>();
        when(repository.findByUserIdAndPlanIdAndScope(2L, 1L, "USUARIO")).thenAnswer(invocation -> stored);
        when(repository.save(any())).thenAnswer(invocation -> {
            FoodRule saved = invocation.getArgument(0);
            stored.add(saved);
            return saved;
        });
        FoodRuleDto first;
        Runnable duplicate;
        if (legacy) {
            first = service.createUserRule(2L, 1L, 3L, "Árbol", List.of(), BigDecimal.ONE, "u", null);
            duplicate = () -> service.createUserRule(2L, 1L, 7L, " ARBOL ", List.of(), BigDecimal.TEN, "g", null);
        } else {
            first = service.createUserRule(2L, 1L, new RuleInput("Árbol", List.of(), "NORMAL", 3L,
                BigDecimal.ONE, "u", null, List.of(), null));
            duplicate = () -> service.createUserRule(2L, 1L, new RuleInput(" ARBOL ", List.of(), "NORMAL", 7L,
                BigDecimal.TEN, "g", null, List.of(), null));
        }
        assertThatThrownBy(duplicate::run)
            .isInstanceOfSatisfying(org.springframework.web.server.ResponseStatusException.class, exception -> {
                assertThat(exception.getStatusCode().value()).isEqualTo(409);
                assertThat(exception.getReason())
                    .isEqualTo("Ya tenés un alimento con ese nombre. Editalo en lugar de crear otro.");
            });
        assertThat(stored).hasSize(1);
        assertThat(stored.getFirst().getUid()).isEqualTo(first.uid());
        assertThat(stored.getFirst().getFood()).isEqualTo("Árbol");
        assertThat(stored.getFirst().getFoodGroupId()).isEqualTo(3L);
        assertThat(stored.getFirst().getAmountPerPortion()).isEqualByComparingTo(BigDecimal.ONE);

        FoodRuleDto second = service.upsertUserRule(2L, 1L, new RuleInput(" ARBOL ", List.of(), "NORMAL", 7L,
            BigDecimal.TEN, "g", null, List.of(), null));
        assertThat(stored).hasSize(1);
        assertThat(second.uid()).isEqualTo(first.uid());
        assertThat(second.foodGroupId()).isEqualTo(7L);
        assertThat(second.amountPerPortion()).isEqualByComparingTo(BigDecimal.TEN);
        verify(repository, times(3)).lockUserRules(2L, 1L);
        verify(repository, times(1)).save(any());
    }

}

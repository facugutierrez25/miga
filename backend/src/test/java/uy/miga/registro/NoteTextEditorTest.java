package uy.miga.registro;

import org.junit.jupiter.api.Test;
import uy.miga.reglas.FoodRuleDto;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.*;

class NoteTextEditorTest {
    @Test
    void removesFirstMiddleLastAndRepeatedMentions() {
        var mentions = List.of("leche", "manzana", "leche");
        assertThat(NoteTextEditor.removeMention("Leche, manzana; leche", mentions, 0)).isEqualTo("manzana; leche");
        assertThat(NoteTextEditor.removeMention("Leche, manzana; leche", mentions, 1)).isEqualTo("Leche; leche");
        assertThat(NoteTextEditor.removeMention("Leche, manzana; leche", mentions, 2)).isEqualTo("Leche, manzana");
        assertThat(NoteTextEditor.removeMention("leche,, pan; manzana", List.of("leche", "pan", "manzana"), 2))
            .isEqualTo("leche, pan");
        assertThat(NoteTextEditor.removeMention(" Leche. ", List.of("leche"), 0)).isEmpty();
    }

    @Test
    void preservesOriginalAccentsCaseAndCompoundConnectors() {
        assertThat(NoteTextEditor.removeMention("Milanesa con puré Y una manzana",
            List.of("milanesa", "pure", "una manzana"), 2)).isEqualTo("Milanesa con puré");
        assertThat(NoteTextEditor.removeMention("Café con leche + pan",
            List.of("cafe con leche", "pan"), 1)).isEqualTo("Café con leche");
    }

    @Test
    void findsTheMentionEvenIfMentionsComeInAnotherOrder() {
        // Al repartir un ítem en grupos, sus entradas nuevas quedan al final por id.
        assertThat(NoteTextEditor.removeMention("leche, pan, manzana", List.of("pan", "manzana", "leche"), 2))
            .isEqualTo("pan, manzana");
        assertThat(NoteTextEditor.removeMention("leche, pan, manzana", List.of("pan", "manzana", "leche"), 0))
            .isEqualTo("leche, manzana");
    }

    @Test
    void rejectsRepeatedMentionsWhenTheOrderIsUnknown() {
        // "leche" repetida y la primera repartida en grupos: sus ítems quedan al final.
        assertThatIllegalArgumentException().isThrownBy(() ->
            NoteTextEditor.removeMention("Leche con pan, leche", List.of("pan", "leche", "leche"), 1));
    }

    @Test
    void rejectsMismatchedOrMissingMentions() {
        assertThatIllegalArgumentException().isThrownBy(() ->
            NoteTextEditor.removeMention("leche, pan", List.of("leche", "manzana"), 1));
        assertThatIllegalArgumentException().isThrownBy(() ->
            NoteTextEditor.removeMention("leche", List.of("leche"), -1));
    }

    @Test
    void remainingTextProducesSameMentionsWithRealInterpreter() {
        var interpreter = new InterpreterService();
        var rules = List.of(rule(1L, "leche"), rule(2L, "manzana"), rule(3L, "milanesa"), rule(4L, "pure"));
        for (String text : List.of("leche, manzana", "milanesa con puré y una manzana")) {
            var before = interpreter.interpret(text, rules);
            var originals = before.stream().map(InterpretedItem::originalText).toList();
            String result = NoteTextEditor.removeMention(text, originals, originals.size() - 1);
            assertThat(interpreter.interpret(result, rules)).isEqualTo(before.subList(0, before.size() - 1));
        }
    }

    private FoodRuleDto rule(Long id, String food) {
        return new FoodRuleDto(id, "GLOBAL", null, null, food, List.of(), "NORMAL",
            null, id, null, BigDecimal.ONE, "u", BigDecimal.ONE);
    }
}

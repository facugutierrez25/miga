package uy.miga.plans;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class InterpretadorService {

    private static final Pattern CANTIDAD = Pattern.compile("(\\d+[,.]?\\d*)");

    private final InterpretationRuleRepository ruleRepository;

    InterpretadorService(InterpretationRuleRepository ruleRepository) {
        this.ruleRepository = ruleRepository;
    }

    @Transactional(readOnly = true)
    public InterpretationResult interpret(Long planId, String rawText) {
        if (rawText == null || rawText.isBlank()) {
            return noMatch();
        }
        String normalized = normalize(rawText);
        List<InterpretationRule> rules = ruleRepository.findByPlanIdOrderByConfidenceDesc(planId);

        for (InterpretationRule rule : rules) {
            Pattern p;
            try {
                p = Pattern.compile(rule.getPattern(), Pattern.CASE_INSENSITIVE);
            } catch (Exception e) {
                continue;
            }
            if (p.matcher(normalized).find()) {
                Double qty = extractQuantity(normalized);
                String unit = rule.getDefaultUnit();
                return new InterpretationResult(
                    rule.getFoodGroupId(),
                    qty,
                    unit,
                    rule.getConfidence().doubleValue(),
                    true
                );
            }
        }
        return noMatch();
    }

    private String normalize(String text) {
        return text.toLowerCase()
            .replace('á', 'a').replace('é', 'e').replace('í', 'i')
            .replace('ó', 'o').replace('ú', 'u').replace('ü', 'u')
            .replaceAll("\\s+", " ")
            .trim();
    }

    private Double extractQuantity(String text) {
        Matcher m = CANTIDAD.matcher(text);
        if (m.find()) {
            try {
                return Double.parseDouble(m.group(1).replace(',', '.'));
            } catch (NumberFormatException ignored) {}
        }
        return 1.0;
    }

    private InterpretationResult noMatch() {
        return new InterpretationResult(null, null, null, 0.0, false);
    }
}

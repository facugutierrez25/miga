package uy.miga.registro;

import org.springframework.stereotype.Service;
import uy.miga.reglas.FoodRuleDto;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.Normalizer;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
class InterpreterService {

    static final Pattern HARD_SEP = Pattern.compile(",|;|\\+|(?<=\\S)\\.(?=\\s|$)");

    // Separadores blandos: "y" / "con" como delimitadores de ítems cuando el
    // segmento completo no coincide con ninguna regla.
    static final Pattern SOFT_SEP = Pattern.compile("\\s+(?:y|con)\\s+", Pattern.CASE_INSENSITIVE);

    private static final Pattern QUANTITY_PREFIX = Pattern.compile(
        "^(\\d+(?:[.,]\\d+)?|medios?|medias?|un[ao]?)\\s+",
        Pattern.CASE_INSENSITIVE
    );

    // Handles "200g yogur" — number immediately followed by unit letters, then space
    private static final Pattern QUANTITY_UNIT_NOSPACE = Pattern.compile(
        "^(\\d+(?:[.,]\\d+)?)([a-z]+)\\s+",
        Pattern.CASE_INSENSITIVE
    );

    private static final Map<String, String> UNIT_DIMENSION = new LinkedHashMap<>();
    private static final Map<String, String> UNIT_CANONICAL = new LinkedHashMap<>();

    static {
        for (String u : List.of("ml", "cc", "mililitro", "mililitros"))
            { UNIT_DIMENSION.put(u, "VOL"); UNIT_CANONICAL.put(u, "ml"); }
        for (String u : List.of("l", "litro", "litros"))
            { UNIT_DIMENSION.put(u, "VOL"); UNIT_CANONICAL.put(u, "l"); }
        for (String u : List.of("taza", "tazas"))
            { UNIT_DIMENSION.put(u, "VOL"); UNIT_CANONICAL.put(u, "taza"); }
        for (String u : List.of("vaso", "vasos"))
            { UNIT_DIMENSION.put(u, "VOL"); UNIT_CANONICAL.put(u, "vaso"); }
        for (String u : List.of("cucharada", "cucharadas", "cda"))
            { UNIT_DIMENSION.put(u, "VOL"); UNIT_CANONICAL.put(u, "cucharada"); }
        for (String u : List.of("cucharadita", "cucharaditas", "cdita"))
            { UNIT_DIMENSION.put(u, "VOL"); UNIT_CANONICAL.put(u, "cucharadita"); }
        for (String u : List.of("g", "gr", "gramo", "gramos"))
            { UNIT_DIMENSION.put(u, "MASS"); UNIT_CANONICAL.put(u, "g"); }
        for (String u : List.of("kg", "kilo", "kilos", "kilogramo", "kilogramos"))
            { UNIT_DIMENSION.put(u, "MASS"); UNIT_CANONICAL.put(u, "kg"); }
        for (String u : List.of("unidad", "unidades", "u", "porcion", "porciones", "porcion"))
            { UNIT_DIMENSION.put(u, "COUNT"); UNIT_CANONICAL.put(u, "u"); }
        for (String u : List.of("rebanada", "rebanadas", "tajada", "tajadas",
                                 "rodaja", "rodajas", "feta", "fetas"))
            { UNIT_DIMENSION.put(u, "COUNT"); UNIT_CANONICAL.put(u, "rebanada"); }
    }

    private static final Map<String, Double> TO_BASE = Map.of(
        "ml", 1.0, "l", 1000.0, "taza", 240.0, "vaso", 200.0,
        "cucharada", 15.0, "cucharadita", 5.0,
        "g", 1.0, "kg", 1000.0,
        "u", 1.0, "rebanada", 1.0
    );

    List<InterpretedItem> interpret(String text, List<FoodRuleDto> rules) {
        if (text == null || text.isBlank()) return List.of();

        String normalized = normalize(text);
        String[] hardSegments = HARD_SEP.split(normalized);

        List<InterpretedItem> result = new ArrayList<>();
        for (String seg : hardSegments) {
            String s = seg.strip();
            if (!s.isBlank()) result.addAll(interpretWithSoftSplit(s, rules));
        }
        return result;
    }

    private List<InterpretedItem> interpretWithSoftSplit(String segment, List<FoodRuleDto> rules) {
        InterpretedItem item = interpretSegment(segment, rules);
        if (item.recognized()) return List.of(item);

        // Segmento no reconocido: intentar separarlo por "y"/"con"
        String[] parts = SOFT_SEP.split(segment);
        if (parts.length <= 1) return List.of(item);

        List<InterpretedItem> result = new ArrayList<>();
        boolean anyRecognized = false;
        for (String part : parts) {
            String p = part.strip();
            if (p.isBlank()) continue;
            InterpretedItem partItem = interpretSegment(p, rules);
            result.add(partItem);
            if (partItem.recognized()) anyRecognized = true;
        }
        // Si ninguna parte se reconoció tampoco, devolver el ítem original sin split
        return anyRecognized ? result : List.of(item);
    }

    private InterpretedItem interpretSegment(String segment, List<FoodRuleDto> rules) {
        double rawQty = 1.0;
        String remaining = segment;
        String detectedUnit = null;

        Matcher m = QUANTITY_PREFIX.matcher(segment);
        if (m.find()) {
            rawQty = parseQuantity(m.group(1));
            remaining = segment.substring(m.end()).strip();
        } else {
            Matcher m2 = QUANTITY_UNIT_NOSPACE.matcher(segment);
            if (m2.find()) {
                rawQty = Double.parseDouble(m2.group(1).replace(",", "."));
                String unitToken = m2.group(2).toLowerCase();
                if (UNIT_CANONICAL.containsKey(unitToken)) {
                    detectedUnit = UNIT_CANONICAL.get(unitToken);
                    remaining = segment.substring(m2.end()).strip();
                }
            }
        }

        String foodName = remaining;

        if (detectedUnit == null) {
            for (Map.Entry<String, String> entry : UNIT_CANONICAL.entrySet()) {
                String key = entry.getKey();
                if (remaining.startsWith(key + " ")) {
                    detectedUnit = entry.getValue();
                    foodName = remaining.substring(key.length()).strip();
                    break;
                }
                if (remaining.equals(key)) {
                    detectedUnit = entry.getValue();
                    foodName = "";
                    break;
                }
            }
        }

        // Admite también la unidad al final: "2 yogur u".
        if (detectedUnit == null) {
            for (Map.Entry<String, String> entry : UNIT_CANONICAL.entrySet()) {
                String suffix = " " + entry.getKey();
                if (foodName.endsWith(suffix)) {
                    detectedUnit = entry.getValue();
                    foodName = foodName.substring(0, foodName.length() - suffix.length()).strip();
                    break;
                }
            }
        }

        // Strip preposition "de" after a unit: "un vaso de leche" → foodName = "leche"
        if (foodName.startsWith("de ")) {
            foodName = foodName.substring(3).strip();
        }

        if (foodName.isBlank()) return InterpretedItem.unrecognized(segment);

        FoodRuleDto rule = findRule(foodName, rules);
        if (rule == null) return InterpretedItem.unrecognized(segment);

        return computePortions(segment, rawQty, detectedUnit, rule);
    }

    FoodRuleDto findRule(String name, List<FoodRuleDto> rules) {
        // 1. Exact match on food name
        for (FoodRuleDto r : rules) {
            if (normalize(r.alimento()).equals(name)) return r;
        }
        // 2. Exact match on synonyms
        for (FoodRuleDto r : rules) {
            if (r.sinonimos() != null)
                for (String s : r.sinonimos())
                    if (normalize(s).equals(name)) return r;
        }
        // 3. Plural normalization: try stripping trailing -s / -es
        for (String stem : depluralize(name)) {
            for (FoodRuleDto r : rules) {
                if (normalize(r.alimento()).equals(stem)) return r;
            }
            for (FoodRuleDto r : rules) {
                if (r.sinonimos() != null)
                    for (String s : r.sinonimos())
                        if (normalize(s).equals(stem)) return r;
            }
        }
        if (name.length() < 4) return null;
        List<FoodRuleDto> candidates = new ArrayList<>();
        int bestDist = 3;
        for (FoodRuleDto r : rules) {
            String rName = normalize(r.alimento());
            if (rName.length() < 4) continue;
            int d = levenshtein(name, rName);
            if (d < bestDist) { bestDist = d; candidates.clear(); candidates.add(r); }
            else if (d == bestDist) candidates.add(r);
            if (r.sinonimos() != null) {
                for (String s : r.sinonimos()) {
                    String ns = normalize(s);
                    if (ns.length() < 4) continue;
                    d = levenshtein(name, ns);
                    if (d < bestDist) { bestDist = d; candidates.clear(); candidates.add(r); }
                    else if (d == bestDist && !candidates.contains(r)) candidates.add(r);
                }
            }
        }
        return (candidates.size() == 1 && bestDist <= 2) ? candidates.get(0) : null;
    }

    private InterpretedItem computePortions(String originalText, double qty,
                                            String unit, FoodRuleDto rule) {
        boolean uncertain = false;
        BigDecimal portions;
        String appliedRule;

        switch (rule.tipo()) {
            case "NO_CUENTA" -> {
                portions = BigDecimal.ZERO;
                appliedRule = rule.alimento() + " = no cuenta";
            }
            case "LIBRE" -> {
                portions = BigDecimal.ZERO;
                appliedRule = rule.alimento() + " = libre (sin porcion asignada)";
            }
            case "FLEXIBLE" -> {
                portions = BigDecimal.ZERO;
                appliedRule = rule.alimento() + " = flexible (sin porcion fija)";
            }
            case "COMPUESTO" -> {
                portions = rule.porcionPorDefecto().multiply(BigDecimal.valueOf(qty))
                    .setScale(3, RoundingMode.HALF_UP);
                appliedRule = rule.alimento() + " (compuesto)";
            }
            default -> {
                if (rule.cantidadPorPorcion() != null && rule.unidad() != null && unit != null) {
                    BigDecimal converted = convert(BigDecimal.valueOf(qty), unit, rule.unidad());
                    if (converted != null) {
                        portions = converted.divide(rule.cantidadPorPorcion(), 3, RoundingMode.HALF_UP);
                        appliedRule = rule.cantidadPorPorcion() + " " + rule.unidad()
                            + " de " + rule.alimento() + " = 1 porcion";
                    } else {
                        portions = rule.porcionPorDefecto().multiply(BigDecimal.valueOf(qty))
                            .setScale(3, RoundingMode.HALF_UP);
                        uncertain = true;
                        appliedRule = rule.alimento() + " = " + rule.porcionPorDefecto() + " porcion (supuesto)";
                    }
                } else {
                    portions = rule.porcionPorDefecto().multiply(BigDecimal.valueOf(qty))
                        .setScale(3, RoundingMode.HALF_UP);
                    appliedRule = rule.alimento() + " = " + rule.porcionPorDefecto() + " porcion";
                }
            }
        }

        return new InterpretedItem(
            originalText, rule.alimento(),
            BigDecimal.valueOf(qty),
            unit != null ? unit : (rule.unidad() != null ? rule.unidad() : "u"),
            rule.foodGroupId(), rule.standardGroupKey(),
            portions, appliedRule, uncertain, rule.id(),
            "COMPUESTO".equals(rule.tipo()) ? rule.componentes() : null,
            rule.tipo()
        );
    }

    BigDecimal convert(BigDecimal qty, String from, String to) {
        String dimFrom = UNIT_DIMENSION.get(canonical(from));
        String dimTo   = UNIT_DIMENSION.get(canonical(to));
        if (dimFrom == null || dimTo == null || !dimFrom.equals(dimTo)) return null;
        Double factorFrom = TO_BASE.get(canonical(from));
        Double factorTo   = TO_BASE.get(canonical(to));
        if (factorFrom == null || factorTo == null) return null;
        return BigDecimal.valueOf(qty.doubleValue() * factorFrom / factorTo)
            .setScale(3, RoundingMode.HALF_UP);
    }

    private String canonical(String unit) {
        if (unit == null) return null;
        return UNIT_CANONICAL.getOrDefault(unit.toLowerCase(), unit.toLowerCase());
    }

    static String normalize(String s) {
        if (s == null) return "";
        return Normalizer.normalize(s.toLowerCase().strip(), Normalizer.Form.NFD)
            .replaceAll("\\p{InCombiningDiacriticalMarks}", "")
            .replaceAll("\\s+", " ");
    }

    private double parseQuantity(String s) {
        return switch (s.toLowerCase()) {
            case "medio", "media", "medios", "medias" -> 0.5;
            case "un", "una", "uno" -> 1.0;
            default -> Double.parseDouble(s.replace(",", "."));
        };
    }

    // Returns candidate stems after removing simple Spanish plural suffixes (-s, -es).
    // Only used when exact match fails; never modifies canonical rule names.
    static List<String> depluralize(String name) {
        List<String> stems = new ArrayList<>();
        if (name.endsWith("es") && name.length() > 3) stems.add(name.substring(0, name.length() - 2));
        if (name.endsWith("s") && name.length() > 2)  stems.add(name.substring(0, name.length() - 1));
        return stems;
    }

    int levenshtein(String a, String b) {
        int la = a.length(), lb = b.length();
        if (Math.abs(la - lb) > 3) return 99;
        int[] prev = new int[lb + 1];
        for (int j = 0; j <= lb; j++) prev[j] = j;
        for (int i = 1; i <= la; i++) {
            int[] curr = new int[lb + 1];
            curr[0] = i;
            for (int j = 1; j <= lb; j++) {
                int cost = a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1;
                curr[j] = Math.min(curr[j - 1] + 1, Math.min(prev[j] + 1, prev[j - 1] + cost));
            }
            prev = curr;
        }
        return prev[lb];
    }
}

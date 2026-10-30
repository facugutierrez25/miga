package uy.miga.habitos;

import org.dhatim.fastexcel.Workbook;
import java.io.IOException;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;

final class WeekExport {
    private WeekExport() {}

    static List<List<String>> grid(WeekSummaryDto week) {
        var mealNames = week.days().stream().flatMap(d -> d.meals().stream())
            .map(uy.miga.registro.WeekMealData::name).distinct().toList();
        List<List<String>> rows = new ArrayList<>();
        List<String> header = new ArrayList<>(List.of("Fecha"));
        header.addAll(mealNames);
        week.habits().forEach(h -> header.add(h.name()));
        rows.add(header);
        for (var day : week.days()) {
            List<String> row = new ArrayList<>(List.of(day.date().toString()));
            for (String name : mealNames) {
                row.add(day.meals().stream().filter(m -> name.equals(m.name()))
                    .map(m -> m.noteText() == null ? "" : m.noteText()).collect(java.util.stream.Collectors.joining("\n")));
            }
            for (var habit : week.habits()) {
                row.add(day.habitLogs().stream().filter(l -> l.habitId().equals(habit.id()))
                    .map(l -> l.value().stripTrailingZeros().toPlainString().replace('.', ','))
                    .findFirst().orElse(day.habitIds().contains(habit.id()) ? "0" : ""));
            }
            rows.add(row);
        }
        return rows;
    }

    static String safe(String value) {
        return !value.isEmpty() && "=+-@\t\r".indexOf(value.charAt(0)) >= 0 ? "'" + value : value;
    }

    static String csv(WeekSummaryDto week) {
        StringBuilder csv = new StringBuilder("\ufeff");
        for (var row : grid(week)) {
            csv.append(row.stream().map(WeekExport::safe)
                .map(v -> "\"" + v.replace("\"", "\"\"") + "\"")
                .collect(java.util.stream.Collectors.joining(";"))).append("\r\n");
        }
        return csv.toString();
    }

    static void writeXlsx(WeekSummaryDto week, OutputStream out) throws IOException {
        try (Workbook workbook = new Workbook(out, "Miga", "1.0")) {
            var sheet = workbook.newWorksheet("Semana");
            var rows = grid(week);
            for (int r = 0; r < rows.size(); r++) {
                for (int c = 0; c < rows.get(r).size(); c++) sheet.value(r, c, safe(rows.get(r).get(c)));
            }
        }
    }
}

package uy.miga.habitos;

import com.lowagie.text.Document;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import org.dhatim.fastexcel.Workbook;
import uy.miga.registro.SinReglaDto;
import uy.miga.registro.WeekMealData;

import java.io.IOException;
import java.io.OutputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

final class WeekExport {
    private WeekExport() {}

    // Secciones que se pueden incluir (parámetro `incluir`).
    static final String TEXTO = "texto";
    static final String PORCIONES = "porciones";
    static final String HABITOS = "habitos";
    static final String SIN_REGLA = "sinregla";
    static final Set<String> SECCIONES = Set.of(TEXTO, PORCIONES, HABITOS, SIN_REGLA);
    // Sin `incluir`, la planilla sale como antes: lo escrito y los hábitos.
    static final Set<String> POR_DEFECTO = Set.of(TEXTO, HABITOS);

    record Data(WeekSummaryDto week, Set<String> incluir, List<String> groupNames,
                Map<LocalDate, Map<String, BigDecimal>> portions, List<SinReglaDto> sinRegla) {
        static Data of(WeekSummaryDto week) {
            return new Data(week, POR_DEFECTO, List.of(), Map.of(), List.of());
        }
    }

    static Set<String> parseIncluir(String raw) {
        if (raw == null || raw.isBlank()) return POR_DEFECTO;
        Set<String> result = new LinkedHashSet<>();
        for (String part : raw.split(",")) {
            String value = part.strip().toLowerCase(Locale.ROOT);
            if (value.isEmpty()) continue;
            if (!SECCIONES.contains(value)) throw new IllegalArgumentException("Sección inválida: " + value);
            result.add(value);
        }
        return result.isEmpty() ? POR_DEFECTO : Set.copyOf(result);
    }

    static List<List<String>> grid(WeekSummaryDto week) {
        return grid(Data.of(week));
    }

    // Una fila por día y una columna por comida, como la planilla.
    static List<List<String>> grid(Data data) {
        var week = data.week();
        boolean texto = data.incluir().contains(TEXTO);
        boolean porciones = data.incluir().contains(PORCIONES);
        boolean habitos = data.incluir().contains(HABITOS);
        var mealNames = texto || porciones
            ? week.days().stream().flatMap(d -> d.meals().stream()).map(WeekMealData::name).distinct().toList()
            : List.<String>of();
        var groupNames = porciones ? data.groupNames() : List.<String>of();
        var habits = habitos ? week.habits() : List.<HabitDto>of();

        List<List<String>> rows = new ArrayList<>();
        List<String> header = new ArrayList<>(List.of("Fecha"));
        header.addAll(mealNames);
        header.addAll(groupNames);
        habits.forEach(h -> header.add(h.name()));
        rows.add(header);
        for (var day : week.days()) {
            List<String> row = new ArrayList<>(List.of(day.date().toString()));
            for (String name : mealNames) {
                row.add(day.meals().stream().filter(m -> name.equals(m.name()))
                    .map(m -> mealCell(m, texto, porciones)).collect(Collectors.joining("\n")));
            }
            var dayPortions = data.portions().getOrDefault(day.date(), Map.of());
            for (String group : groupNames) {
                BigDecimal value = dayPortions.get(group);
                row.add(value == null ? "" : number(value));
            }
            for (var habit : habits) {
                row.add(day.habitLogs().stream().filter(l -> l.habitId().equals(habit.id()))
                    .map(l -> number(l.value()))
                    .findFirst().orElse(day.habitIds().contains(habit.id()) ? "0" : ""));
            }
            rows.add(row);
        }
        return rows;
    }

    static List<List<String>> sinReglaGrid(Data data) {
        List<List<String>> rows = new ArrayList<>();
        rows.add(List.of("Fecha", "Comida", "Lo que escribiste"));
        for (var item : data.sinRegla()) rows.add(List.of(item.fecha().toString(), item.comida(), item.texto()));
        return rows;
    }

    private static boolean withSinRegla(Data data) {
        return data.incluir().contains(SIN_REGLA);
    }

    private static String mealCell(WeekMealData meal, boolean texto, boolean porciones) {
        List<String> parts = new ArrayList<>();
        if (texto && meal.noteText() != null && !meal.noteText().isBlank()) parts.add(meal.noteText());
        if (porciones) parts.add(statusLabel(meal));
        return String.join("\n", parts);
    }

    static String statusLabel(WeekMealData meal) {
        if (meal.flexibleCount() > 0) return "Flexible";
        return switch (meal.status() == null ? "" : meal.status()) {
            case "EN_PLAN" -> "Como el plan";
            case "CASI" -> "Faltó algo";
            case "DE_MAS" -> "De más";
            case "SIN_ANOTAR" -> "Sin anotar";
            case "PREGUNTAR" -> "Falta confirmar";
            case "REGISTRADA" -> "Anotada";
            default -> meal.status() == null ? "" : meal.status();
        };
    }

    private static String number(BigDecimal value) {
        return value.stripTrailingZeros().toPlainString().replace('.', ',');
    }

    static String safe(String value) {
        return !value.isEmpty() && "=+-@\t\r".indexOf(value.charAt(0)) >= 0 ? "'" + value : value;
    }

    static String csv(WeekSummaryDto week) {
        return csv(Data.of(week));
    }

    static String csv(Data data) {
        StringBuilder csv = new StringBuilder("﻿");
        appendCsv(csv, grid(data));
        if (withSinRegla(data)) {
            csv.append("\r\n");
            appendCsv(csv, sinReglaGrid(data));
        }
        return csv.toString();
    }

    private static void appendCsv(StringBuilder csv, List<List<String>> rows) {
        for (var row : rows) {
            csv.append(row.stream().map(WeekExport::safe)
                .map(v -> "\"" + v.replace("\"", "\"\"") + "\"")
                .collect(Collectors.joining(";"))).append("\r\n");
        }
    }

    static void writeXlsx(WeekSummaryDto week, OutputStream out) throws IOException {
        writeXlsx(Data.of(week), out);
    }

    static void writeXlsx(Data data, OutputStream out) throws IOException {
        try (Workbook workbook = new Workbook(out, "Miga", "1.0")) {
            writeSheet(workbook.newWorksheet("Planilla"), grid(data));
            if (withSinRegla(data)) writeSheet(workbook.newWorksheet("Sin regla"), sinReglaGrid(data));
        }
    }

    private static void writeSheet(org.dhatim.fastexcel.Worksheet sheet, List<List<String>> rows) {
        for (int r = 0; r < rows.size(); r++) {
            for (int c = 0; c < rows.get(r).size(); c++) sheet.value(r, c, safe(rows.get(r).get(c)));
        }
    }

    static void writePdf(Data data, OutputStream out) throws IOException {
        Document document = new Document(PageSize.A4.rotate(), 24, 24, 24, 24);
        try {
            PdfWriter.getInstance(document, out);
            document.open();
            Font title = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12);
            Font head = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8);
            Font body = FontFactory.getFont(FontFactory.HELVETICA, 8);
            document.add(new Paragraph("Miga · " + data.week().weekStart() + " a " + data.week().weekEnd(), title));
            document.add(new Paragraph(" ", body));
            document.add(table(grid(data), head, body));
            if (withSinRegla(data)) {
                document.add(new Paragraph(" ", body));
                document.add(new Paragraph("Sin regla", title));
                document.add(new Paragraph(" ", body));
                if (data.sinRegla().isEmpty()) document.add(new Paragraph("No hubo nada sin reconocer.", body));
                else document.add(table(sinReglaGrid(data), head, body));
            }
        } catch (Exception e) {
            throw e instanceof IOException io ? io : new IOException("No se pudo generar el PDF.", e);
        } finally {
            if (document.isOpen()) document.close();
        }
    }

    private static PdfPTable table(List<List<String>> rows, Font head, Font body) {
        PdfPTable table = new PdfPTable(rows.getFirst().size());
        table.setWidthPercentage(100);
        table.setHeaderRows(1);
        for (int r = 0; r < rows.size(); r++) {
            for (String value : rows.get(r)) {
                PdfPCell cell = new PdfPCell(new Phrase(value, r == 0 ? head : body));
                cell.setPadding(4);
                table.addCell(cell);
            }
        }
        return table;
    }
}

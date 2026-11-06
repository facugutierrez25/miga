package uy.miga.habitos;

import com.lowagie.text.Document;
import com.lowagie.text.Font;
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
                Map<LocalDate, Map<String, BigDecimal>> portions, List<SinReglaDto> sinRegla, String userName) {
        Data(WeekSummaryDto week, Set<String> incluir, List<String> groupNames,
             Map<LocalDate, Map<String, BigDecimal>> portions, List<SinReglaDto> sinRegla) {
            this(week, incluir, groupNames, portions, sinRegla, null);
        }
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
        var habits = habitos ? habitColumns(week.habits()) : List.<HabitColumn>of();

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
                Long activeId = habit.ids().stream().filter(day.habitIds()::contains)
                    .reduce((previous, current) -> current).orElse(null);
                row.add(activeId == null ? "" : day.habitLogs().stream()
                    .filter(log -> log.habitId().equals(activeId)).map(log -> number(log.value()))
                    .findFirst().orElse("0"));
            }
            rows.add(row);
        }
        return rows;
    }

    private record HabitColumn(String name, List<Long> ids) {}

    // Como las comidas, un hábito ocupa una columna aunque el plan tenga varias versiones.
    // El uid identifica el hábito; cada día conserva el id de la versión vigente para sus registros.
    private static List<HabitColumn> habitColumns(List<HabitDto> habits) {
        Map<Object, List<HabitDto>> versions = new java.util.LinkedHashMap<>();
        for (var habit : habits) {
            Object key = habit.uid() != null ? habit.uid() : habit.id();
            versions.computeIfAbsent(key, ignored -> new ArrayList<>()).add(habit);
        }
        return versions.values().stream().map(values -> new HabitColumn(
            values.getLast().name(), values.stream().map(HabitDto::id).distinct().toList())).toList();
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

    // Paleta clara de la app: papel salvia, tinta, oliva y acento amarillo.
    private static final String PAPER = "F2F1EA";
    private static final String SURFACE = "FBFAF5";
    private static final String INK = "040200";
    private static final String MUTED = "5E5A2E";
    private static final String BRAND = "7C773F";
    private static final String ACCENT = "F6C344";
    private static final String LINE = "E2E0D3";
    private static final String SITE = "https://miga.uy";
    private static final int TABLE_ROW = 5;

    static void writeXlsx(Data data, OutputStream out) throws IOException {
        var file = java.nio.file.Files.createTempFile("miga-export-", ".xlsx");
        try {
            try (var stream = java.nio.file.Files.newOutputStream(file);
                 Workbook workbook = new Workbook(stream, "Miga", "1.0")) {
                writeSheet(workbook.newWorksheet("Planilla"), grid(data), data, title(data));
                if (withSinRegla(data)) writeSheet(workbook.newWorksheet("Sin regla"), sinReglaGrid(data), data, "Sin regla");
            }
            ExportLogo.addToWorkbook(file, out, withSinRegla(data) ? 2 : 1, resource("miga-wordmark.png"));
        } finally {
            java.nio.file.Files.deleteIfExists(file);
        }
    }

    static String title(Data data) {
        boolean week = java.time.temporal.ChronoUnit.DAYS.between(data.week().weekStart(), data.week().weekEnd()) == 6;
        String name = data.userName() == null ? "" : data.userName().replaceAll("[\\r\\n]+", " ").strip();
        return name.isEmpty() ? week ? "Tu semana" : "Tu registro" : (week ? "Semana de " : "Registro de ") + name;
    }

    static String period(Data data) {
        var start = data.week().weekStart();
        var end = data.week().weekEnd();
        var locale = Locale.forLanguageTag("es-UY");
        var full = java.time.format.DateTimeFormatter.ofPattern("d 'de' MMMM yyyy", locale);
        if (start.equals(end)) return start.format(full);
        if (start.getYear() != end.getYear()) return start.format(full) + " al " + end.format(full);
        if (start.getMonth() == end.getMonth()) return start.getDayOfMonth() + " al " + end.format(full);
        return start.format(java.time.format.DateTimeFormatter.ofPattern("d 'de' MMMM", locale)) + " al " + end.format(full);
    }

    private static void writeSheet(org.dhatim.fastexcel.Worksheet sheet, List<List<String>> rows,
                                   Data data, String title) {
        int lastCol = Math.max(1, rows.getFirst().size() - 1);
        sheet.hideGridLines();
        sheet.range(0, 0, TABLE_ROW + rows.size(), lastCol).style()
            .fontName("Onest").fontSize(11).fontColor(INK).fillColor(SURFACE).set();
        sheet.range(0, 0, 3, lastCol).style().fillColor(PAPER).set();
        sheet.range(0, 0, 0, lastCol).style().merge().fontName("Onest").fontSize(26).fontColor(BRAND).bold()
            .borderStyle(org.dhatim.fastexcel.BorderSide.BOTTOM, "medium")
            .borderColor(org.dhatim.fastexcel.BorderSide.BOTTOM, ACCENT).set();
        sheet.rowHeight(0, 44);
        sheet.value(1, 0, title);
        sheet.range(1, 0, 1, lastCol).style().merge().fontName("Onest").fontSize(16).bold().set();
        sheet.rowHeight(1, 30);
        sheet.value(2, 0, period(data));
        sheet.range(2, 0, 2, lastCol).style().merge().fontName("Onest").fontColor(MUTED).set();
        sheet.hyperlink(3, 0, org.dhatim.fastexcel.HyperLink.external(SITE, "Registrado con Miga"));
        sheet.range(3, 0, 3, lastCol).style().merge().fontName("Onest").fontColor(BRAND).underlined().set();
        sheet.rowHeight(3, 26);
        for (int c = 0; c <= lastCol; c++) sheet.width(c, c == 0 ? 17 : 29);
        for (int r = 0; r < rows.size(); r++) {
            int row = TABLE_ROW + r;
            for (int c = 0; c < rows.get(r).size(); c++) sheet.value(row, c, safe(rows.get(r).get(c)));
            var style = sheet.range(row, 0, row, lastCol).style().fontName("Onest").wrapText(true).verticalAlignment("top");
            if (r == 0) {
                style.fillColor(BRAND).fontColor(SURFACE).bold();
                sheet.rowHeight(row, 32);
            } else {
                style.fillColor(r % 2 == 0 ? PAPER : SURFACE)
                    .borderStyle(org.dhatim.fastexcel.BorderSide.BOTTOM, "thin")
                    .borderColor(org.dhatim.fastexcel.BorderSide.BOTTOM, LINE);
                int lines = rows.get(r).stream().mapToInt(value -> value.lines()
                    .mapToInt(line -> Math.max(1, (line.length() + 26) / 27)).sum()).max().orElse(1);
                sheet.rowHeight(row, Math.min(409, Math.max(48, 16 * lines + 16)));
            }
            style.set();
        }
        sheet.freezePane(1, TABLE_ROW + 1);
        sheet.pageOrientation("landscape");
        sheet.paperSize(org.dhatim.fastexcel.PaperSize.A4_PAPER);
        sheet.fitToWidth((short) 1);
        sheet.fitToHeight((short) 0);
        sheet.repeatRows(0, TABLE_ROW);
        sheet.footer("Registrado con Miga · miga.uy", org.dhatim.fastexcel.Position.LEFT);
        sheet.footer("Página &P de &N", org.dhatim.fastexcel.Position.RIGHT);
    }

    private static java.awt.Color color(String hex) {
        return java.awt.Color.decode("#" + hex);
    }

    private static byte[] resource(String name) throws IOException {
        try (var stream = WeekExport.class.getResourceAsStream("/export/" + name)) {
            if (stream == null) throw new IOException("Falta el recurso de exportación: " + name);
            return stream.readAllBytes();
        }
    }

    static void writePdf(Data data, OutputStream out) throws IOException {
        // Columnas completas, texto seleccionable y filas que continúan en la página siguiente.
        // Para planes muy anchos se repite Fecha en bloques, sin reducir la letra a un tamaño ilegible.
        Document document = new Document(grid(data).getFirst().size() > 8 ? PageSize.A3.rotate() : PageSize.A4.rotate(),
            28, 28, 78, 40);
        try {
            var face = com.lowagie.text.pdf.BaseFont.createFont("Onest.ttf", com.lowagie.text.pdf.BaseFont.IDENTITY_H,
                true, false, resource("Onest.ttf"), null);
            Font head = new Font(face, 9, Font.BOLD, color(SURFACE));
            Font body = new Font(face, 9, Font.NORMAL, color(INK));
            PdfWriter writer = PdfWriter.getInstance(document, out);
            writer.setPageEvent(new ExportPage(data, face));
            document.addTitle(title(data) + " · Miga · " + period(data));
            document.addAuthor("Miga");
            document.addCreator("Miga · " + SITE);
            document.open();
            addTables(document, grid(data), head, body, title(data));
            if (withSinRegla(data)) {
                document.newPage();
                addTables(document, sinReglaGrid(data), head, body, "Sin regla");
            }
        } catch (Exception e) {
            throw e instanceof IOException io ? io : new IOException("No se pudo generar el PDF.", e);
        } finally {
            if (document.isOpen()) document.close();
        }
    }

    private static void addTables(Document document, List<List<String>> rows, Font head, Font body,
                                  String title) throws com.lowagie.text.DocumentException {
        int columns = rows.getFirst().size();
        int blockSize = document.getPageSize().getWidth() > 1000 ? 12 : 7;
        for (int start = 1; start < Math.max(2, columns); start += blockSize) {
            if (start > 1) document.newPage();
            int end = Math.min(columns, start + blockSize);
            List<List<String>> block = new ArrayList<>();
            for (var row : rows) {
                List<String> cells = new ArrayList<>(List.of(row.getFirst()));
                cells.addAll(row.subList(Math.min(start, row.size()), end));
                block.add(cells);
            }
            var heading = new Paragraph(title + (columns > blockSize + 1 ? " · columnas " + start + "–" + (end - 1) : ""),
                new Font(body.getBaseFont(), 13, Font.BOLD, color(INK)));
            heading.setSpacingAfter(12);
            document.add(heading);
            document.add(table(block, head, body));
        }
    }

    private static PdfPTable table(List<List<String>> rows, Font head, Font body) {
        int columns = rows.getFirst().size();
        PdfPTable table = new PdfPTable(columns);
        table.setWidthPercentage(100);
        float[] widths = new float[columns];
        java.util.Arrays.fill(widths, 1);
        widths[0] = 0.85f;
        table.setWidths(widths);
        table.setHeaderRows(1);
        table.setSplitRows(true);
        table.setSplitLate(false);
        for (int r = 0; r < rows.size(); r++) {
            for (String value : rows.get(r)) {
                PdfPCell cell = new PdfPCell(new Phrase(value.isEmpty() ? "—" : value, r == 0 ? head : body));
                cell.setPadding(8);
                cell.setLeading(0, 1.4f);
                cell.setVerticalAlignment(com.lowagie.text.Element.ALIGN_TOP);
                cell.setBackgroundColor(color(r == 0 ? BRAND : r % 2 == 0 ? PAPER : SURFACE));
                cell.setBorder(com.lowagie.text.Rectangle.BOTTOM);
                cell.setBorderWidth(0.5f);
                cell.setBorderColor(color(LINE));
                table.addCell(cell);
            }
        }
        return table;
    }

    private static final class ExportPage extends com.lowagie.text.pdf.PdfPageEventHelper {
        private final Data data;
        private final com.lowagie.text.pdf.BaseFont face;
        private final com.lowagie.text.Image logo;

        ExportPage(Data data, com.lowagie.text.pdf.BaseFont face) throws IOException {
            this.data = data;
            this.face = face;
            this.logo = com.lowagie.text.Image.getInstance(resource("miga-wordmark.png"));
            logo.scaleToFit(84, 36);
        }

        @Override
        public void onEndPage(PdfWriter writer, Document document) {
            var canvas = writer.getDirectContent();
            float width = document.getPageSize().getWidth();
            float height = document.getPageSize().getHeight();
            var under = writer.getDirectContentUnder();
            under.setColorFill(color(PAPER));
            under.rectangle(0, 0, width, height);
            under.fill();
            try {
                logo.setAbsolutePosition(document.left(), height - 58);
                canvas.addImage(logo);
            } catch (com.lowagie.text.DocumentException e) {
                throw new IllegalStateException("No se pudo dibujar el logo de Miga.", e);
            }
            com.lowagie.text.pdf.ColumnText.showTextAligned(canvas, com.lowagie.text.Element.ALIGN_RIGHT,
                new Phrase(period(data), new Font(face, 10, Font.NORMAL, color(MUTED))), document.right(), height - 43, 0);
            canvas.setColorStroke(color(ACCENT));
            canvas.setLineWidth(2);
            canvas.moveTo(document.left(), height - 66);
            canvas.lineTo(document.right(), height - 66);
            canvas.stroke();
            float y = 19;
            var footer = new Phrase("Registrado con Miga · miga.uy", new Font(face, 9, Font.NORMAL, color(BRAND)));
            com.lowagie.text.pdf.ColumnText.showTextAligned(canvas, com.lowagie.text.Element.ALIGN_LEFT,
                footer, document.left(), y, 0);
            var link = com.lowagie.text.pdf.PdfAnnotation.createLink(writer,
                new com.lowagie.text.Rectangle(document.left(), y - 2, document.left() + 180, y + 11),
                com.lowagie.text.pdf.PdfAnnotation.HIGHLIGHT_INVERT, new com.lowagie.text.pdf.PdfAction(SITE));
            link.setBorder(new com.lowagie.text.pdf.PdfBorderArray(0, 0, 0));
            writer.addAnnotation(link);
            com.lowagie.text.pdf.ColumnText.showTextAligned(canvas, com.lowagie.text.Element.ALIGN_RIGHT,
                new Phrase("Página " + writer.getPageNumber(), new Font(face, 9, Font.NORMAL, color(MUTED))),
                document.right(), y, 0);
        }
    }
}

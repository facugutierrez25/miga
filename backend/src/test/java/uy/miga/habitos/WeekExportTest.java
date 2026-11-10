package uy.miga.habitos;

import org.junit.jupiter.api.Test;
import org.dhatim.fastexcel.reader.ReadableWorkbook;
import uy.miga.registro.WeekMealData;
import java.io.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import static org.assertj.core.api.Assertions.*;

class WeekExportTest {
    @Test
    void statusLabelsUseOnlyTheMealStatus() {
        assertThat(WeekExport.statusLabel(new WeekMealData(1L, "Cena", "pizza", "MIXED", 0, true)))
            .isEqualTo("Falt\u00f3 y de m\u00e1s");
        assertThat(WeekExport.statusLabel(new WeekMealData(1L, "Cena", "pizza", "FLEXIBLE", 0, true)))
            .isEqualTo("Flexible");
        assertThat(WeekExport.statusLabel(new WeekMealData(1L, "Cena", "pizza", "EN_PLAN", 1, true)))
            .isEqualTo("Como el plan");
    }

    @Test
    void csvAndXlsxContainTheSameNotesAndDecimalComma() throws Exception {
        var date = LocalDate.of(2026, 10, 26);
        var week = new WeekSummaryDto(date, date.plusDays(6),
            List.of(new HabitDto(1L, "Agua", "CANTIDAD", "l", null, BigDecimal.ONE, "DIA", false, (short)1, java.util.UUID.randomUUID())),
            List.of(new WeekDayDto(date, true, BigDecimal.ZERO, BigDecimal.ZERO,
                List.of(new HabitLogDto(1L, date, new BigDecimal("1.5"))),
                List.of(new WeekMealData(10L, "Desayuno", "=caf\u00e9; \"pan\"\nfruta", "REGISTRADA", 0, true)), List.of(1L))));
        assertThat(WeekExport.csv(week)).startsWith("\ufeff").contains("'", "1,5", "caf\u00e9", "\"\"pan\"\"");
        var out = new ByteArrayOutputStream();
        WeekExport.writeXlsx(week, out);
        try (var workbook = new ReadableWorkbook(new ByteArrayInputStream(out.toByteArray()))) {
            var rows = workbook.getFirstSheet().read();
            assertThat(rows.get(6).getCellText(1)).isEqualTo("'=caf\u00e9; \"pan\"\nfruta");
            assertThat(rows.get(6).getCellText(2)).isEqualTo("1,5");
        }
    }

    @Test
    void neutralizesEveryFormulaPrefix() {
        for (String prefix : List.of("=", "+", "-", "@", "\t", "\r")) {
            assertThat(WeekExport.safe(prefix + "text")).isEqualTo("'" + prefix + "text");
        }
        assertThat(WeekExport.safe("normal")).isEqualTo("normal");
    }

    private static WeekExport.Data rangeData(java.util.Set<String> includedSections) {
        var date = LocalDate.of(2026, 11, 2);
        var week = new WeekSummaryDto(date, date.plusDays(1),
            List.of(new HabitDto(1L, "Agua", "CANTIDAD", "l", null, BigDecimal.ONE, "DIA", false, (short)1, java.util.UUID.randomUUID())),
            List.of(
                new WeekDayDto(date, true, new BigDecimal("2.5"), BigDecimal.TEN, List.of(),
                    List.of(new WeekMealData(10L, "Desayuno", "yogur y banana", "EN_PLAN", 0, true),
                        new WeekMealData(11L, "Cena", "pizza", "FLEXIBLE", 1, true)), List.of(1L)),
                new WeekDayDto(date.plusDays(1), false, BigDecimal.ZERO, BigDecimal.TEN, List.of(),
                    List.of(new WeekMealData(10L, "Desayuno", null, "SIN_ANOTAR", 0, true)), List.of(1L))));
        return new WeekExport.Data(week, includedSections, List.of("Lácteos", "Frutas"),
            java.util.Map.of(date, java.util.Map.of("Lácteos", new BigDecimal("1.5"), "Frutas", BigDecimal.ONE)),
            List.of(new uy.miga.registro.UnmatchedFoodDto("torta frita", date, "Desayuno")), "Facundo");
    }

    @Test
    void parsesIncluirAndRejectsUnknownSections() {
        assertThat(WeekExport.parseIncludedSections(null)).isEqualTo(WeekExport.DEFAULT_SECTIONS);
        assertThat(WeekExport.parseIncludedSections(" Texto , sinregla,")).containsExactlyInAnyOrder("texto", "sinregla");
        assertThatThrownBy(() -> WeekExport.parseIncludedSections("texto,fotos")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void porcionesAddsStatusAndGroupColumnsWithoutText() {
        var rows = WeekExport.grid(rangeData(java.util.Set.of("porciones")));
        assertThat(rows.get(0)).containsExactly("Fecha", "Desayuno", "Cena", "Lácteos", "Frutas");
        assertThat(rows.get(1)).containsExactly("2026-11-02", "Como el plan", "Flexible", "1,5", "1");
        assertThat(rows.get(2)).containsExactly("2026-11-03", "Sin anotar", "", "", "");
    }

    @Test
    void textoYHabitosKeepTheOriginalLayout() {
        var rows = WeekExport.grid(rangeData(java.util.Set.of("texto", "habitos")));
        assertThat(rows.get(0)).containsExactly("Fecha", "Desayuno", "Cena", "Agua");
        assertThat(rows.get(1)).containsExactly("2026-11-02", "yogur y banana", "pizza", "0");
    }

    @Test
    void sinReglaGoesToItsOwnSheetAndCsvSection() throws Exception {
        var data = rangeData(java.util.Set.of("texto", "sinregla"));
        assertThat(WeekExport.csv(data)).contains("\"Lo que escribiste\"", "\"torta frita\"");
        var out = new ByteArrayOutputStream();
        WeekExport.writeXlsx(data, out);
        try (var workbook = new ReadableWorkbook(new ByteArrayInputStream(out.toByteArray()))) {
            var sheets = workbook.getSheets().toList();
            assertThat(sheets).hasSize(2);
            var rows = sheets.get(1).read();
            assertThat(rows.get(6).getCellText(1)).isEqualTo("Desayuno");
            assertThat(rows.get(6).getCellText(2)).isEqualTo("torta frita");
        }
        var withoutSection = new ByteArrayOutputStream();
        WeekExport.writeXlsx(rangeData(java.util.Set.of("texto")), withoutSection);
        try (var workbook = new ReadableWorkbook(new ByteArrayInputStream(withoutSection.toByteArray()))) {
            assertThat(workbook.getSheets().count()).isEqualTo(1);
        }
    }

    @Test
    void pdfIsGeneratedForEveryCombination() throws Exception {
        for (var includedSections : List.of(java.util.Set.of("texto"), java.util.Set.of("porciones", "habitos", "sinregla"))) {
            var out = new ByteArrayOutputStream();
            WeekExport.writePdf(rangeData(includedSections), out);
            assertThat(new String(out.toByteArray(), 0, 5, java.nio.charset.StandardCharsets.US_ASCII)).isEqualTo("%PDF-");
        }
    }
    private static java.util.Map<String, String> xmlEntries(byte[] zip) throws IOException {
        var entries = new java.util.HashMap<String, String>();
        var file = java.nio.file.Files.createTempFile("miga-export-test", ".xlsx");
        try {
            java.nio.file.Files.write(file, zip);
            try (var archive = new java.util.zip.ZipFile(file.toFile())) {
                for (var entry : archive.stream().toList()) {
                    if (entry.getName().endsWith(".xml") || entry.getName().endsWith(".rels")) {
                        try (var input = archive.getInputStream(entry)) {
                            entries.put(entry.getName(), new String(input.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8));
                        }
                    }
                }
            }
        } finally {
            java.nio.file.Files.deleteIfExists(file);
        }
        return entries;
    }

    @Test
    void xlsxHasAppPaletteBrandingLiveLinkAndLandscapePrintSetupOnEverySheet() throws Exception {
        var out = new ByteArrayOutputStream();
        WeekExport.writeXlsx(rangeData(java.util.Set.of("texto", "sinregla")), out);
        var xml = xmlEntries(out.toByteArray());
        assertThat(xml.get("xl/drawings/miga1.xml")).contains("Logo oficial de Miga", "rIdLogo");
        assertThat(xml.get("xl/drawings/miga2.xml")).contains("Logo oficial de Miga", "rIdLogo");
        assertThat(xml.get("xl/drawings/_rels/miga1.xml.rels")).contains("../media/miga-wordmark.png");
        assertThat(xml.get("xl/styles.xml")).contains("F2F1EA", "7C773F", "F6C344", "wrapText=\"true\"");
        for (int sheet = 1; sheet <= 2; sheet++) {
            assertThat(xml.get("xl/worksheets/sheet" + sheet + ".xml"))
                .contains("orientation=\"landscape\"", "fitToWidth=\"1\"", "state=\"frozen\"", "<hyperlink ", "<drawing r:id=\"rIdMigaLogo\"");
            assertThat(xml.get("xl/worksheets/_rels/sheet" + sheet + ".xml.rels"))
                .contains("https://miga.uy", "TargetMode=\"External\"");
        }
        try (var workbook = new ReadableWorkbook(new ByteArrayInputStream(out.toByteArray()))) {
            for (var sheet : workbook.getSheets().toList()) {
                var rows = sheet.read();
                assertThat(rows.get(2).getCellText(0)).isEqualTo("2 al 3 de noviembre 2026");
                assertThat(rows.get(3).getCellText(0)).isEqualTo("Registrado con Miga");
                assertThat(rows.get(5).getCellText(0)).isEqualTo("Fecha");
            }
        }
    }

    @Test
    void pdfHasLandscapePagesEmbeddedLogoTextAndClickableAttribution() throws Exception {
        var out = new ByteArrayOutputStream();
        WeekExport.writePdf(rangeData(WeekExport.SECTIONS), out);
        try (var reader = new org.openpdf.text.pdf.PdfReader(out.toByteArray())) {
            var extractor = new org.openpdf.text.pdf.parser.PdfTextExtractor(reader);
            StringBuilder text = new StringBuilder();
            for (int page = 1; page <= reader.getNumberOfPages(); page++) {
                var size = reader.getPageSizeWithRotation(page);
                assertThat(size.getWidth()).isGreaterThan(size.getHeight());
                var pageText = extractor.getTextFromPage(page);
                text.append(pageText);
                assertThat(pageText).contains("Registrado con Miga", "miga.uy", "Página " + page);
                var annotations = reader.getPageN(page).getAsArray(org.openpdf.text.pdf.PdfName.ANNOTS);
                assertThat(annotations).isNotNull();
                assertThat(annotations.getAsDict(0).getAsDict(org.openpdf.text.pdf.PdfName.A)
                    .getAsString(org.openpdf.text.pdf.PdfName.URI).toUnicodeString()).isEqualTo("https://miga.uy");
                var images = reader.getPageN(page).getAsDict(org.openpdf.text.pdf.PdfName.RESOURCES)
                    .getAsDict(org.openpdf.text.pdf.PdfName.XOBJECT);
                assertThat(images).isNotNull();
                assertThat(images.getKeys()).isNotEmpty();
            }
            assertThat(text.toString()).contains("Registro de Facundo", "2 al 3 de noviembre 2026", "yogur y banana", "pizza", "Lácteos", "torta frita");
        }
    }

    @Test
    void pdfKeepsEveryColumnAndTheEndOfNotesAcrossPages() throws Exception {
        var date = LocalDate.of(2026, 11, 2);
        var meals = new java.util.ArrayList<WeekMealData>();
        for (int i = 0; i < 16; i++) meals.add(new WeekMealData((long) i, "Comida " + i,
            i == 0 ? "Alimento áéíóú ñ. ".repeat(1200) + "FIN NOTA EXTENSA" : "NOTA COLUMNA " + i, "EN_PLAN", 0, true));
        var week = new WeekSummaryDto(date, date, List.of(), List.of(
            new WeekDayDto(date, true, BigDecimal.ZERO, BigDecimal.ZERO, List.of(), meals, List.of())));
        var out = new ByteArrayOutputStream();
        WeekExport.writePdf(WeekExport.Data.of(week), out);
        try (var reader = new org.openpdf.text.pdf.PdfReader(out.toByteArray())) {
            assertThat(reader.getNumberOfPages()).isGreaterThan(2);
            var extractor = new org.openpdf.text.pdf.parser.PdfTextExtractor(reader);
            StringBuilder text = new StringBuilder();
            for (int page = 1; page <= reader.getNumberOfPages(); page++) text.append(extractor.getTextFromPage(page));
            assertThat(text.toString().replaceAll("\\s+", " ")).contains("FIN NOTA EXTENSA", "2026-11-02");
            for (int i = 1; i < 16; i++) assertThat(text.toString().replaceAll("\\s+", " ")).contains("NOTA COLUMNA " + i);
        }
    }

    @Test
    void personalizedWeekTitleAndDateRangesUseNaturalSpanish() throws Exception {
        var start = LocalDate.of(2026, 11, 2);
        var week = new WeekSummaryDto(start, start.plusDays(6), List.of(), List.of());
        var data = new WeekExport.Data(week, WeekExport.DEFAULT_SECTIONS, List.of(), java.util.Map.of(), List.of(), "Facundo");
        assertThat(WeekExport.title(data)).isEqualTo("Semana de Facundo");
        assertThat(WeekExport.period(data)).isEqualTo("2 al 8 de noviembre 2026");
        var out = new ByteArrayOutputStream();
        WeekExport.writeXlsx(data, out);
        try (var workbook = new ReadableWorkbook(new ByteArrayInputStream(out.toByteArray()))) {
            var rows = workbook.getFirstSheet().read();
            assertThat(rows.get(1).getCellText(0)).isEqualTo("Semana de Facundo");
            assertThat(rows.get(2).getCellText(0)).isEqualTo("2 al 8 de noviembre 2026");
        }
        out.reset();
        WeekExport.writePdf(data, out);
        try (var reader = new org.openpdf.text.pdf.PdfReader(out.toByteArray())) {
            assertThat(new org.openpdf.text.pdf.parser.PdfTextExtractor(reader).getTextFromPage(1))
                .contains("Semana de Facundo", "2 al 8 de noviembre 2026");
        }
        var crossYear = new WeekSummaryDto(LocalDate.of(2026, 12, 28), LocalDate.of(2027, 1, 3), List.of(), List.of());
        assertThat(WeekExport.period(WeekExport.Data.of(crossYear))).isEqualTo("28 de diciembre 2026 al 3 de enero 2027");
        var crossMonth = new WeekSummaryDto(LocalDate.of(2026, 10, 26), LocalDate.of(2026, 11, 1), List.of(), List.of());
        assertThat(WeekExport.period(WeekExport.Data.of(crossMonth))).isEqualTo("26 de octubre al 1 de noviembre 2026");
        assertThat(WeekExport.title(WeekExport.Data.of(week))).isEqualTo("Tu semana");
    }

    private static WeekSummaryDto weekWithHabitVersions() {
        var date = LocalDate.of(2026, 11, 2);
        var water = java.util.UUID.randomUUID();
        var fruit = java.util.UUID.randomUUID();
        return new WeekSummaryDto(date, date.plusDays(3), List.of(
            new HabitDto(1L, "Agua anterior", "CONTADOR", "vasos", BigDecimal.TEN, BigDecimal.ONE, "DIA", false, (short) 1, water),
            new HabitDto(2L, "Fruta", "CONTADOR", "unidades", BigDecimal.TEN, BigDecimal.ONE, "DIA", false, (short) 2, fruit),
            new HabitDto(3L, "Agua", "CONTADOR", "vasos", BigDecimal.TEN, BigDecimal.ONE, "DIA", false, (short) 1, water)),
            List.of(
                new WeekDayDto(date, true, BigDecimal.ZERO, BigDecimal.ZERO,
                    List.of(new HabitLogDto(1L, date, new BigDecimal("2")), new HabitLogDto(2L, date, BigDecimal.ONE)),
                    List.of(), List.of(1L, 2L)),
                new WeekDayDto(date.plusDays(1), true, BigDecimal.ZERO, BigDecimal.ZERO,
                    List.of(new HabitLogDto(3L, date.plusDays(1), new BigDecimal("3.5")),
                        new HabitLogDto(1L, date.plusDays(1), new BigDecimal("99"))), List.of(), List.of(3L, 2L)),
                new WeekDayDto(date.plusDays(2), false, BigDecimal.ZERO, BigDecimal.ZERO, List.of(), List.of(), List.of(3L, 2L)),
                new WeekDayDto(date.plusDays(3), false, BigDecimal.ZERO, BigDecimal.ZERO, List.of(), List.of(), List.of())));
    }

    @Test
    void oneColumnPerHabitAcrossPlanVersionsPreservesEachDaysValues() {
        var grid = WeekExport.grid(weekWithHabitVersions());
        assertThat(grid.get(0)).containsExactly("Fecha", "Agua", "Fruta");
        assertThat(grid.get(1)).containsExactly("2026-11-02", "2", "1");
        assertThat(grid.get(2)).containsExactly("2026-11-03", "3,5", "0");
        assertThat(grid.get(3)).containsExactly("2026-11-04", "0", "0");
        assertThat(grid.get(4)).containsExactly("2026-11-05", "", "");
    }

    @Test
    void excelCsvAndPdfDoNotRepeatTheHabitsOfPreviousPlanVersions() throws Exception {
        var week = weekWithHabitVersions();
        var csv = WeekExport.csv(week);
        assertThat(csv).contains("\"Fecha\";\"Agua\";\"Fruta\"").doesNotContain("Agua anterior", "99");
        var out = new ByteArrayOutputStream();
        WeekExport.writeXlsx(week, out);
        try (var workbook = new ReadableWorkbook(new ByteArrayInputStream(out.toByteArray()))) {
            var rows = workbook.getFirstSheet().read();
            assertThat(rows.get(5).getCellCount()).isEqualTo(3);
            assertThat(rows.get(5).getCellText(1)).isEqualTo("Agua");
            assertThat(rows.get(6).getCellText(1)).isEqualTo("2");
            assertThat(rows.get(7).getCellText(1)).isEqualTo("3,5");
        }
        out.reset();
        WeekExport.writePdf(WeekExport.Data.of(week), out);
        try (var reader = new org.openpdf.text.pdf.PdfReader(out.toByteArray())) {
            var text = new org.openpdf.text.pdf.parser.PdfTextExtractor(reader).getTextFromPage(1);
            assertThat(text).contains("Agua", "Fruta", "3,5").doesNotContain("Agua anterior", "99");
            assertThat(text.indexOf("Agua")).isEqualTo(text.lastIndexOf("Agua"));
        }
    }

    @Test
    void separateHabitsWithTheSameNameAreNotMerged() {
        var date = LocalDate.of(2026, 11, 2);
        var week = new WeekSummaryDto(date, date, List.of(
            new HabitDto(1L, "Agua", "CONTADOR", "vasos", BigDecimal.ONE, BigDecimal.ONE, "DIA", false, (short) 1, java.util.UUID.randomUUID()),
            new HabitDto(2L, "Agua", "CONTADOR", "litros", BigDecimal.ONE, BigDecimal.ONE, "DIA", false, (short) 2, java.util.UUID.randomUUID())),
            List.of(new WeekDayDto(date, true, BigDecimal.ZERO, BigDecimal.ZERO,
                List.of(new HabitLogDto(1L, date, BigDecimal.TEN), new HabitLogDto(2L, date, BigDecimal.ONE)),
                List.of(), List.of(1L, 2L))));
        assertThat(WeekExport.grid(week).get(0)).containsExactly("Fecha", "Agua", "Agua");
        assertThat(WeekExport.grid(week).get(1)).containsExactly("2026-11-02", "10", "1");
    }
}

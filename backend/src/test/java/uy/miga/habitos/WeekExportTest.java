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
    void csvAndXlsxContainTheSameNotesAndDecimalComma() throws Exception {
        var date = LocalDate.of(2026, 10, 26);
        var week = new WeekSummaryDto(date, date.plusDays(6),
            List.of(new HabitDto(1L, "Agua", "CANTIDAD", "l", null, BigDecimal.ONE, "DIA", false, (short)1, java.util.UUID.randomUUID())),
            List.of(new WeekDayDto(date, true, BigDecimal.ZERO, BigDecimal.ZERO,
                List.of(new HabitLogDto(1L, date, new BigDecimal("1.5"))),
                List.of(new WeekMealData(10L, "Desayuno", "=caf\u00e9; \"pan\"\nfruta", "REGISTRADA", 0)), List.of(1L))));
        assertThat(WeekExport.csv(week)).startsWith("\ufeff").contains("'", "1,5", "caf\u00e9", "\"\"pan\"\"");
        var out = new ByteArrayOutputStream();
        WeekExport.writeXlsx(week, out);
        try (var workbook = new ReadableWorkbook(new ByteArrayInputStream(out.toByteArray()))) {
            var rows = workbook.getFirstSheet().read();
            assertThat(rows.get(1).getCellText(1)).isEqualTo("'=caf\u00e9; \"pan\"\nfruta");
            assertThat(rows.get(1).getCellText(2)).isEqualTo("1,5");
        }
    }

    @Test
    void neutralizesEveryFormulaPrefix() {
        for (String prefix : List.of("=", "+", "-", "@", "\t", "\r")) {
            assertThat(WeekExport.safe(prefix + "text")).isEqualTo("'" + prefix + "text");
        }
        assertThat(WeekExport.safe("normal")).isEqualTo("normal");
    }

    private static WeekExport.Data rangeData(java.util.Set<String> incluir) {
        var date = LocalDate.of(2026, 11, 2);
        var week = new WeekSummaryDto(date, date.plusDays(1),
            List.of(new HabitDto(1L, "Agua", "CANTIDAD", "l", null, BigDecimal.ONE, "DIA", false, (short)1, java.util.UUID.randomUUID())),
            List.of(
                new WeekDayDto(date, true, new BigDecimal("2.5"), BigDecimal.TEN, List.of(),
                    List.of(new WeekMealData(10L, "Desayuno", "yogur y banana", "EN_PLAN", 0),
                        new WeekMealData(11L, "Cena", "pizza", "REGISTRADA", 1)), List.of(1L)),
                new WeekDayDto(date.plusDays(1), false, BigDecimal.ZERO, BigDecimal.TEN, List.of(),
                    List.of(new WeekMealData(10L, "Desayuno", null, "SIN_ANOTAR", 0)), List.of(1L))));
        return new WeekExport.Data(week, incluir, List.of("Lácteos", "Frutas"),
            java.util.Map.of(date, java.util.Map.of("Lácteos", new BigDecimal("1.5"), "Frutas", BigDecimal.ONE)),
            List.of(new uy.miga.registro.SinReglaDto("torta frita", date, "Desayuno")));
    }

    @Test
    void parsesIncluirAndRejectsUnknownSections() {
        assertThat(WeekExport.parseIncluir(null)).isEqualTo(WeekExport.POR_DEFECTO);
        assertThat(WeekExport.parseIncluir(" Texto , sinregla,")).containsExactlyInAnyOrder("texto", "sinregla");
        assertThatThrownBy(() -> WeekExport.parseIncluir("texto,fotos")).isInstanceOf(IllegalArgumentException.class);
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
            assertThat(rows.get(1).getCellText(1)).isEqualTo("Desayuno");
            assertThat(rows.get(1).getCellText(2)).isEqualTo("torta frita");
        }
        var withoutSection = new ByteArrayOutputStream();
        WeekExport.writeXlsx(rangeData(java.util.Set.of("texto")), withoutSection);
        try (var workbook = new ReadableWorkbook(new ByteArrayInputStream(withoutSection.toByteArray()))) {
            assertThat(workbook.getSheets().count()).isEqualTo(1);
        }
    }

    @Test
    void pdfIsGeneratedForEveryCombination() throws Exception {
        for (var incluir : List.of(java.util.Set.of("texto"), java.util.Set.of("porciones", "habitos", "sinregla"))) {
            var out = new ByteArrayOutputStream();
            WeekExport.writePdf(rangeData(incluir), out);
            assertThat(new String(out.toByteArray(), 0, 5, java.nio.charset.StandardCharsets.US_ASCII)).isEqualTo("%PDF-");
        }
    }
}

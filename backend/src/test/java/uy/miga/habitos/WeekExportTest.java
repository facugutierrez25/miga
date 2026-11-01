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
}

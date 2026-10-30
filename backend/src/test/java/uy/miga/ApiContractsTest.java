package uy.miga;

import tools.jackson.databind.json.JsonMapper;
import org.junit.jupiter.api.Test;

import java.lang.reflect.ParameterizedType;
import java.lang.reflect.Type;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class ApiContractsTest {
    private final JsonMapper mapper = JsonMapper.builder().findAndAddModules().build();

    @Test
    void serializedDtosMatchVersionedFrontendFixtures() throws Exception {
        var contracts = Map.of(
            "day-registro", "uy.miga.registro.DayRegistroDto",
            "plan", "uy.miga.plans.PlanDto",
            "plan-rules", "uy.miga.planrules.PlanRulesDto",
            "week-summary", "uy.miga.habitos.WeekSummaryDto");
        for (var contract : contracts.entrySet()) {
            var dto = sample(Class.forName(contract.getValue()), "");
            var actual = mapper.readTree(mapper.writeValueAsString(dto));
            Path fixture = Path.of("../frontend/src/test/contracts/" + contract.getKey() + ".json");
            // La actualización es explícita: revisar el diff y correr los tests del frontend.
            if (Boolean.getBoolean("contracts.update")) {
                Files.createDirectories(fixture.getParent());
                Files.writeString(fixture, mapper.writerWithDefaultPrettyPrinter().writeValueAsString(dto) + "\n");
            }
            assertThat(actual).as(contract.getKey()).isEqualTo(mapper.readTree(Files.readString(fixture)));
        }
    }

    private Object sample(Type type, String name) throws Exception {
        if (type instanceof ParameterizedType list) {
            return List.of(sample(list.getActualTypeArguments()[0], name));
        }
        Class<?> cls = (Class<?>) type;
        if (cls == String.class) return switch (name) {
            case "tipo" -> "NORMAL";
            case "habitType" -> "CANTIDAD";
            case "period" -> "DIA";
            case "status" -> "OK";
            default -> "Sintético";
        };
        if (cls == UUID.class) return UUID.fromString("00000000-0000-0000-0000-000000000001");
        if (cls == LocalDate.class) return LocalDate.of(2026, 1, 5);
        if (cls == LocalTime.class) return LocalTime.of(8, 30);
        if (cls == BigDecimal.class) return new BigDecimal("1.5");
        if (cls == Long.class || cls == long.class) return 1L;
        if (cls == Integer.class || cls == int.class) return 1;
        if (cls == Short.class || cls == short.class) return (short) 1;
        if (cls == Double.class || cls == double.class) return 1.5;
        if (cls == Boolean.class || cls == boolean.class) return true;
        var components = cls.getRecordComponents();
        assertThat(components).as("Tipo de contrato soportado: %s", cls).isNotNull();
        Class<?>[] types = new Class<?>[components.length];
        Object[] values = new Object[components.length];
        for (int i = 0; i < components.length; i++) {
            types[i] = components[i].getType();
            values[i] = sample(components[i].getGenericType(), components[i].getName());
        }
        var constructor = cls.getDeclaredConstructor(types);
        constructor.setAccessible(true);
        return constructor.newInstance(values);
    }
}

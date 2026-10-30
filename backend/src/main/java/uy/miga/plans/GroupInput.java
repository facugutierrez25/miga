package uy.miga.plans;
import java.math.BigDecimal;
public record GroupInput(String name, String abbreviation, String clave, String color,
    BigDecimal metaDiaria, boolean preguntarSiFalta, boolean opcional) {}

package uy.miga.plans;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
@JsonIgnoreProperties("metaDiaria")
public record GroupInput(String name, String abbreviation, String clave, String color,
    boolean preguntarSiFalta, boolean opcional) {}

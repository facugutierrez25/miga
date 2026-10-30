package uy.miga.plans;

public record InterpretationResult(
    Long foodGroupId,
    Double quantity,
    String unit,
    double confidence,
    boolean matched
) {}

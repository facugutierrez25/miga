package uy.miga.reglas;

import java.util.UUID;

/** Published synchronously inside the upsert transaction to revoke earlier undo authority. */
public record UserRuleReused(Long userId, UUID ruleUid) {}

-- Refresh tokens para mantener la sesión (ADR 0004, issue #296).
-- Solo se guarda el hash SHA-256 del token; el valor viaja en una cookie HttpOnly.
-- Cada uso rota el token dentro de la misma familia; reusar uno ya usado revoca la familia.
CREATE TABLE refresh_tokens (
    id          BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(64)  NOT NULL UNIQUE,
    family_id   UUID         NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ  NOT NULL,
    used_at     TIMESTAMPTZ,
    revoked_at  TIMESTAMPTZ
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_family_id ON refresh_tokens(family_id);

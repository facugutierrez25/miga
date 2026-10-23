-- Verificación de email y datos personales opcionales.
-- Usuarios existentes quedan verificados para no bloquearlos.
-- Nuevos usuarios arrancan con FALSE y deben verificar antes de iniciar sesión.
ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ALTER COLUMN email_verified SET DEFAULT FALSE;

ALTER TABLE users ADD COLUMN first_name VARCHAR(100);
ALTER TABLE users ADD COLUMN last_name  VARCHAR(100);
ALTER TABLE users ADD COLUMN birth_date DATE;

CREATE TABLE email_verification_tokens (
    id         BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      VARCHAR(36) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_evt_user_id ON email_verification_tokens(user_id);

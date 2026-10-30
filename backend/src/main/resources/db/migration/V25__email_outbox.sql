-- Outbox para entrega desacoplada de emails de verificación.
-- Los trabajos se crean en la misma transacción que persiste el token;
-- un worker en background los entrega con reintentos y backoff.
CREATE TABLE email_outbox (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT        NOT NULL REFERENCES users(id),
    recipient       VARCHAR(320)  NOT NULL,
    job_type        VARCHAR(50)   NOT NULL DEFAULT 'VERIFY_EMAIL',
    status          VARCHAR(20)   NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
    attempts        INT           NOT NULL DEFAULT 0,
    max_attempts    INT           NOT NULL DEFAULT 3,
    next_attempt_at TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    processed_at    TIMESTAMPTZ
);

CREATE INDEX idx_email_outbox_pending
    ON email_outbox (next_attempt_at)
    WHERE status = 'PENDING';

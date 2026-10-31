ALTER TABLE email_outbox
    ADD COLUMN locked_until TIMESTAMPTZ,
    DROP CONSTRAINT email_outbox_status_check,
    ADD CONSTRAINT email_outbox_status_check
        CHECK (status IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED'));

CREATE INDEX idx_email_outbox_processing_lease
    ON email_outbox (locked_until)
    WHERE status = 'PROCESSING';

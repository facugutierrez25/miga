-- Cada trabajo de verificación queda asociado al token que debe enviar: si se generó
-- uno nuevo (reenvío), el trabajo anterior se descarta en lugar de enviar el token nuevo dos veces.
ALTER TABLE email_outbox ADD COLUMN token_id BIGINT;

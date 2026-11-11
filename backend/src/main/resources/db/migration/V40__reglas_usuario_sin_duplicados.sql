-- NFD + removal of Unicode marks mirrors FoodRuleService.normalize, including
-- accents, diaeresis and n with tilde, in precomposed and decomposed spellings.
-- Explicit Unicode Mark ranges (generated from Java 21 Character.getType) keep the expression immutable;
-- unlike unaccent, it does not depend on an editable dictionary.
CREATE FUNCTION canonical_user_rule_name(value text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
AS $canonical$
    SELECT lower(btrim(regexp_replace(normalize(value, NFD),
        U&'[\0300-\036F\0483-\0489\0591-\05BD\05BF\05C1-\05C2\05C4-\05C5\05C7\0610-\061A\064B-\065F\0670\06D6-\06DC\06DF-\06E4\06E7-\06E8\06EA-\06ED\0711\0730-\074A\07A6-\07B0\07EB-\07F3\07FD\0816-\0819\081B-\0823\0825-\0827\0829-\082D\0859-\085B\0898-\089F\08CA-\08E1\08E3-\0903\093A-\093C\093E-\094F\0951-\0957\0962-\0963\0981-\0983\09BC\09BE-\09C4\09C7-\09C8\09CB-\09CD\09D7\09E2-\09E3\09FE\0A01-\0A03\0A3C\0A3E-\0A42\0A47-\0A48\0A4B-\0A4D\0A51\0A70-\0A71\0A75\0A81-\0A83\0ABC\0ABE-\0AC5\0AC7-\0AC9\0ACB-\0ACD\0AE2-\0AE3\0AFA-\0AFF\0B01-\0B03\0B3C\0B3E-\0B44\0B47-\0B48\0B4B-\0B4D\0B55-\0B57\0B62-\0B63\0B82\0BBE-\0BC2\0BC6-\0BC8\0BCA-\0BCD\0BD7\0C00-\0C04\0C3C\0C3E-\0C44\0C46-\0C48\0C4A-\0C4D\0C55-\0C56\0C62-\0C63\0C81-\0C83\0CBC\0CBE-\0CC4\0CC6-\0CC8\0CCA-\0CCD\0CD5-\0CD6\0CE2-\0CE3\0CF3\0D00-\0D03\0D3B-\0D3C\0D3E-\0D44\0D46-\0D48\0D4A-\0D4D\0D57\0D62-\0D63\0D81-\0D83\0DCA\0DCF-\0DD4\0DD6\0DD8-\0DDF\0DF2-\0DF3\0E31\0E34-\0E3A\0E47-\0E4E\0EB1\0EB4-\0EBC\0EC8-\0ECE\0F18-\0F19\0F35\0F37\0F39\0F3E-\0F3F\0F71-\0F84\0F86-\0F87\0F8D-\0F97\0F99-\0FBC\0FC6\102B-\103E\1056-\1059\105E-\1060\1062-\1064\1067-\106D\1071-\1074\1082-\108D\108F\109A-\109D\135D-\135F\1712-\1715\1732-\1734\1752-\1753\1772-\1773\17B4-\17D3\17DD\180B-\180D\180F\1885-\1886\18A9\1920-\192B\1930-\193B\1A17-\1A1B\1A55-\1A5E\1A60-\1A7C\1A7F\1AB0-\1ACE\1B00-\1B04\1B34-\1B44\1B6B-\1B73\1B80-\1B82\1BA1-\1BAD\1BE6-\1BF3\1C24-\1C37\1CD0-\1CD2\1CD4-\1CE8\1CED\1CF4\1CF7-\1CF9\1DC0-\1DFF\20D0-\20F0\2CEF-\2CF1\2D7F\2DE0-\2DFF\302A-\302F\3099-\309A\A66F-\A672\A674-\A67D\A69E-\A69F\A6F0-\A6F1\A802\A806\A80B\A823-\A827\A82C\A880-\A881\A8B4-\A8C5\A8E0-\A8F1\A8FF\A926-\A92D\A947-\A953\A980-\A983\A9B3-\A9C0\A9E5\AA29-\AA36\AA43\AA4C-\AA4D\AA7B-\AA7D\AAB0\AAB2-\AAB4\AAB7-\AAB8\AABE-\AABF\AAC1\AAEB-\AAEF\AAF5-\AAF6\ABE3-\ABEA\ABEC-\ABED\FB1E\FE00-\FE0F\FE20-\FE2F\+0101FD\+0102E0\+010376-\+01037A\+010A01-\+010A03\+010A05-\+010A06\+010A0C-\+010A0F\+010A38-\+010A3A\+010A3F\+010AE5-\+010AE6\+010D24-\+010D27\+010EAB-\+010EAC\+010EFD-\+010EFF\+010F46-\+010F50\+010F82-\+010F85\+011000-\+011002\+011038-\+011046\+011070\+011073-\+011074\+01107F-\+011082\+0110B0-\+0110BA\+0110C2\+011100-\+011102\+011127-\+011134\+011145-\+011146\+011173\+011180-\+011182\+0111B3-\+0111C0\+0111C9-\+0111CC\+0111CE-\+0111CF\+01122C-\+011237\+01123E\+011241\+0112DF-\+0112EA\+011300-\+011303\+01133B-\+01133C\+01133E-\+011344\+011347-\+011348\+01134B-\+01134D\+011357\+011362-\+011363\+011366-\+01136C\+011370-\+011374\+011435-\+011446\+01145E\+0114B0-\+0114C3\+0115AF-\+0115B5\+0115B8-\+0115C0\+0115DC-\+0115DD\+011630-\+011640\+0116AB-\+0116B7\+01171D-\+01172B\+01182C-\+01183A\+011930-\+011935\+011937-\+011938\+01193B-\+01193E\+011940\+011942-\+011943\+0119D1-\+0119D7\+0119DA-\+0119E0\+0119E4\+011A01-\+011A0A\+011A33-\+011A39\+011A3B-\+011A3E\+011A47\+011A51-\+011A5B\+011A8A-\+011A99\+011C2F-\+011C36\+011C38-\+011C3F\+011C92-\+011CA7\+011CA9-\+011CB6\+011D31-\+011D36\+011D3A\+011D3C-\+011D3D\+011D3F-\+011D45\+011D47\+011D8A-\+011D8E\+011D90-\+011D91\+011D93-\+011D97\+011EF3-\+011EF6\+011F00-\+011F01\+011F03\+011F34-\+011F3A\+011F3E-\+011F42\+013440\+013447-\+013455\+016AF0-\+016AF4\+016B30-\+016B36\+016F4F\+016F51-\+016F87\+016F8F-\+016F92\+016FE4\+016FF0-\+016FF1\+01BC9D-\+01BC9E\+01CF00-\+01CF2D\+01CF30-\+01CF46\+01D165-\+01D169\+01D16D-\+01D172\+01D17B-\+01D182\+01D185-\+01D18B\+01D1AA-\+01D1AD\+01D242-\+01D244\+01DA00-\+01DA36\+01DA3B-\+01DA6C\+01DA75\+01DA84\+01DA9B-\+01DA9F\+01DAA1-\+01DAAF\+01E000-\+01E006\+01E008-\+01E018\+01E01B-\+01E021\+01E023-\+01E024\+01E026-\+01E02A\+01E08F\+01E130-\+01E136\+01E2AE\+01E2EC-\+01E2EF\+01E4EC-\+01E4EF\+01E8D0-\+01E8D6\+01E944-\+01E94A\+0E0100-\+0E01EF]', '', 'g')));
$canonical$;

-- Comparar con la fila de menor id antes de modificar referencias.
CREATE TEMP TABLE user_rule_replacements ON COMMIT DROP AS
SELECT r.id, r.uid, r.user_id, r.plan_id, k.uid AS kept_uid
FROM (
    SELECT *, first_value(id) OVER (
        PARTITION BY user_id, plan_id, canonical_user_rule_name(alimento) ORDER BY id
    ) AS kept_id
    FROM food_rules
    WHERE alcance = 'USUARIO'
) r
JOIN food_rules k ON k.id = r.kept_id
WHERE r.id <> k.id
  AND ROW(canonical_user_rule_name(r.alimento), r.sinonimos, r.tipo, r.standard_group_key, r.food_group_id,
          r.componentes, r.cantidad_por_porcion, r.unidad, r.porcion_por_defecto,
          r.overrides_rule_uid)
      IS NOT DISTINCT FROM
      ROW(canonical_user_rule_name(k.alimento), k.sinonimos, k.tipo, k.standard_group_key, k.food_group_id,
          k.componentes, k.cantidad_por_porcion, k.unidad, k.porcion_por_defecto,
          k.overrides_rule_uid);

-- La igualdad de contenido permite conservar el ajuste del catálogo.
UPDATE food_rules r
SET overrides_rule_uid = d.kept_uid
FROM user_rule_replacements d
WHERE r.overrides_rule_uid = d.uid
  AND r.plan_id IS NOT DISTINCT FROM d.plan_id;

-- Revocar undo del duplicado y de la regla conservada: representan varias creaciones.
-- El uid puede corresponder a una versión posterior al plan de la comida.
UPDATE food_entries e
SET resolved_rule_uid = NULL
WHERE EXISTS (
    SELECT 1 FROM user_rule_replacements d
    WHERE e.resolved_rule_uid IN (d.uid, d.kept_uid) AND d.user_id = e.user_id
);

DELETE FROM food_rules r
USING user_rule_replacements d
WHERE r.id = d.id;

DO $$
DECLARE
    divergent_groups bigint;
BEGIN
    SELECT count(*) INTO divergent_groups
    FROM (
        SELECT user_id, plan_id, canonical_user_rule_name(alimento)
        FROM food_rules
        WHERE alcance = 'USUARIO'
        GROUP BY user_id, plan_id, canonical_user_rule_name(alimento)
        HAVING count(*) > 1
    ) duplicates;

    IF divergent_groups > 0 THEN
        RAISE EXCEPTION 'V40 abortada: % grupos de reglas de usuario duplicadas con contenido divergente requieren reconciliación manual.', divergent_groups;
    END IF;
END $$;

CREATE UNIQUE INDEX uq_food_rules_user_plan_food
    ON food_rules (user_id, plan_id, canonical_user_rule_name(alimento))
    WHERE alcance = 'USUARIO';

-- Consentimento destacado para dado sensível de saúde (LGPD art. 11, I).
--
-- Peso, altura, % de gordura, diabetes tipo 1, doença renal, gestação/lactação,
-- uso de GLP-1 e rastreio de transtorno alimentar são dados referentes à saúde
-- (art. 5º, II). O art. 11, I exige para eles consentimento "específico e
-- destacado" — não basta estarem cobertos pelo escopo genérico `privacy`.
--
-- Isolado numa migration própria: o valor não pode ser usado na mesma transação
-- em que é criado (mesmo padrão de 0069_onboarding_reminder_enums.sql).

ALTER TYPE public.consent_scope ADD VALUE IF NOT EXISTS 'health_data';

-- M6 operational telemetry. No raw input or user dimension is stored here.

CREATE TABLE public.pipeline_events (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  request_id    text NOT NULL,
  meal_id       uuid,
  source        text NOT NULL,
  stage         text NOT NULL,
  provider      text NOT NULL DEFAULT 'none',
  model         text NOT NULL DEFAULT 'none',
  duration_ms   integer NOT NULL CHECK (duration_ms >= 0),
  success       boolean NOT NULL,
  cache_hit     boolean,
  confidence    numeric(3,2) CHECK (
    confidence IS NULL OR confidence BETWEEN 0 AND 1
  ),
  error_code    text,
  CONSTRAINT pipeline_events_source_check
    CHECK (source IN ('text', 'audio', 'photo', 'barcode', 'system')),
  CONSTRAINT pipeline_events_stage_check
    CHECK (stage IN ('transcription', 'extraction', 'catalog', 'persistence', 'total'))
);

CREATE INDEX pipeline_events_aggregate_idx
  ON public.pipeline_events (occurred_at, source, stage, provider, model);

ALTER TABLE public.pipeline_events ENABLE ROW LEVEL SECURITY;
-- service_role only; no app policies.

CREATE TABLE public.metrics_daily (
  day          date NOT NULL,
  metric       text NOT NULL,
  source       text NOT NULL DEFAULT 'all',
  stage        text NOT NULL DEFAULT 'all',
  provider     text NOT NULL DEFAULT 'all',
  model        text NOT NULL DEFAULT 'all',
  value        numeric NOT NULL,
  sample_count bigint NOT NULL DEFAULT 0,
  computed_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (day, metric, source, stage, provider, model)
);

CREATE INDEX metrics_daily_metric_day_idx
  ON public.metrics_daily (metric, day DESC);

ALTER TABLE public.metrics_daily ENABLE ROW LEVEL SECURITY;
-- Operational data is backend-only.

CREATE OR REPLACE FUNCTION public.fitbrother_compute_metrics_daily(p_day date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from timestamptz := p_day::timestamp AT TIME ZONE 'UTC';
  v_to timestamptz := (p_day + 1)::timestamp AT TIME ZONE 'UTC';
  v_count integer;
BEGIN
  DELETE FROM public.metrics_daily WHERE day = p_day;

  INSERT INTO public.metrics_daily (
    day, metric, source, stage, provider, model, value, sample_count
  )
  SELECT
    p_day,
    m.metric,
    e.source,
    e.stage,
    e.provider,
    e.model,
    CASE m.metric
      WHEN 'requests_total' THEN count(*)::numeric
      WHEN 'success_rate' THEN avg(e.success::int)::numeric
      WHEN 'low_confidence_rate' THEN
        avg((e.confidence < 0.6)::int) FILTER (WHERE e.confidence IS NOT NULL)::numeric
      WHEN 'confidence_success_rate' THEN
        avg((e.confidence >= 0.6)::int) FILTER (WHERE e.confidence IS NOT NULL)::numeric
      WHEN 'cache_hit_rate' THEN
        avg(e.cache_hit::int) FILTER (WHERE e.cache_hit IS NOT NULL)::numeric
      WHEN 'latency_p50_ms' THEN percentile_cont(0.50) WITHIN GROUP (ORDER BY e.duration_ms)
      WHEN 'latency_p95_ms' THEN percentile_cont(0.95) WITHIN GROUP (ORDER BY e.duration_ms)
    END,
    count(*)
  FROM public.pipeline_events e
  CROSS JOIN (
    VALUES
      ('requests_total'),
      ('success_rate'),
      ('low_confidence_rate'),
      ('confidence_success_rate'),
      ('cache_hit_rate'),
      ('latency_p50_ms'),
      ('latency_p95_ms')
  ) AS m(metric)
  WHERE e.occurred_at >= v_from AND e.occurred_at < v_to
  GROUP BY m.metric, e.source, e.stage, e.provider, e.model
  HAVING CASE m.metric
    WHEN 'low_confidence_rate' THEN count(e.confidence)
    WHEN 'confidence_success_rate' THEN count(e.confidence)
    WHEN 'cache_hit_rate' THEN count(e.cache_hit)
    ELSE count(*)
  END > 0;

  INSERT INTO public.metrics_daily (
    day, metric, provider, model, value, sample_count
  )
  SELECT p_day, 'cost_cents',
         CASE WHEN model LIKE 'gemini%' THEN 'gemini' ELSE 'openai' END,
         model, sum(cost_cents), count(*)
  FROM public.ai_extractions
  WHERE created_at >= v_from AND created_at < v_to
  GROUP BY model
  ON CONFLICT (day, metric, source, stage, provider, model)
  DO UPDATE SET value = EXCLUDED.value,
                sample_count = EXCLUDED.sample_count,
                computed_at = now();

  INSERT INTO public.metrics_daily (
    day, metric, provider, model, value, sample_count
  )
  SELECT p_day, 'cost_cents', 'openai', model, sum(cost_cents), count(*)
  FROM public.transcriptions
  WHERE created_at >= v_from AND created_at < v_to
  GROUP BY model
  ON CONFLICT (day, metric, source, stage, provider, model)
  DO UPDATE SET value = metrics_daily.value + EXCLUDED.value,
                sample_count = metrics_daily.sample_count + EXCLUDED.sample_count,
                computed_at = now();

  INSERT INTO public.metrics_daily (
    day, metric, provider, model, value, sample_count
  )
  SELECT p_day, 'input_tokens',
         CASE WHEN model LIKE 'gemini%' THEN 'gemini' ELSE 'openai' END,
         model, sum(tokens_input), count(*)
  FROM public.ai_extractions
  WHERE created_at >= v_from AND created_at < v_to
  GROUP BY model;

  INSERT INTO public.metrics_daily (
    day, metric, provider, model, value, sample_count
  )
  SELECT p_day, 'output_tokens',
         CASE WHEN model LIKE 'gemini%' THEN 'gemini' ELSE 'openai' END,
         model, sum(tokens_output), count(*)
  FROM public.ai_extractions
  WHERE created_at >= v_from AND created_at < v_to
  GROUP BY model;

  INSERT INTO public.metrics_daily (
    day, metric, source, stage, provider, model, value, sample_count
  )
  SELECT p_day, 'transcription_seconds', 'audio', 'transcription',
         'openai', model, sum(duration_s), count(*)
  FROM public.transcriptions
  WHERE created_at >= v_from AND created_at < v_to
  GROUP BY model;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  SELECT count(*) INTO v_count FROM public.metrics_daily WHERE day = p_day;
  DELETE FROM public.pipeline_events
  WHERE occurred_at < now() - interval '90 days';
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.fitbrother_compute_metrics_daily(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fitbrother_compute_metrics_daily(date) TO service_role;

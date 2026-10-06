-- /api/metrics/conversion-rate counts sessions created in the last 7 days.
-- Without an index that is a full scan of the sessions table, which grows by
-- every visit, so the admin Overview (and the AI-SRE collector) slow down over time.
CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created_at);

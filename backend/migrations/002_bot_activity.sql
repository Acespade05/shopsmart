CREATE TABLE bot_activity (
    id SERIAL PRIMARY KEY,
    bot_id INTEGER NOT NULL,
    action VARCHAR(50) NOT NULL,
    detail VARCHAR(200),
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_bot_activity_created ON bot_activity(created_at DESC);
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY,
    customer_id TEXT NOT NULL CHECK (length(customer_id) BETWEEN 1 AND 100),
    items JSONB NOT NULL CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

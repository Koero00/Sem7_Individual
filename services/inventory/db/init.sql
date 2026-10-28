CREATE TABLE inventory (
    product_id TEXT PRIMARY KEY,
    quantity INTEGER NOT NULL CHECK (quantity >= 0)
);

INSERT INTO inventory (product_id, quantity) VALUES
    ('1', 25),
    ('2', 30),
    ('3', 20),
    ('circuit-nova-phone', 12),
    ('circuit-atlas-laptop', 8),
    ('circuit-arc-mouse', 25),
    ('circuit-velocity-ssd', 35),
    ('circuit-core-processor', 16),
    ('circuit-flux-memory', 40),
    ('circuit-prism-graphics', 7),
    ('circuit-link-dock', 28),
    ('circuit-focus-webcam', 22),
    ('circuit-wave-speakers', 18),
    ('circuit-vector-controller', 32),
    ('circuit-slate-tablet', 14);

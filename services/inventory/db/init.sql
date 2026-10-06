CREATE TABLE inventory (
    product_id TEXT PRIMARY KEY,
    quantity INTEGER NOT NULL CHECK (quantity >= 0)
);

INSERT INTO inventory (product_id, quantity) VALUES
    ('1', 25),
    ('2', 30),
    ('3', 20);

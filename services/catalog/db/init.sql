CREATE TABLE products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    price INTEGER NOT NULL,
    image_url TEXT
);

INSERT INTO products (id, name, description, price, image_url) VALUES
    ('1', 'Appel', 'Een heerlijke appel', 100, 'https://via.placeholder.com/150'),
    ('2', 'Banaan', 'Een heerlijke banaan', 200, 'https://via.placeholder.com/150'),
    ('3', 'Peer', 'Een heerlijke peer', 300, 'https://via.placeholder.com/150');

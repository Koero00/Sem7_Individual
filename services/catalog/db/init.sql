CREATE TABLE products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    price INTEGER NOT NULL,
    image_url TEXT
);

INSERT INTO products (id, name, description, price, image_url) VALUES
    ('1', 'Horizon 32 OLED Monitor', '32-inch widescreen · 3840 × 2160 4K OLED · 240 Hz · HDMI 2.1', 239900, NULL),
    ('2', 'Pulse Mechanical Keyboard', '75% layout · Hot-swappable linear switches · RGB · USB-C', 14900, NULL),
    ('3', 'Echo Wireless Headphones', 'Active noise cancellation · Bluetooth · 40-hour battery · Graphite', 19900, NULL),
    ('circuit-nova-phone', 'Nova Phone', '128 GB · Midnight · 6.1-inch smartphone', 69900, NULL),
    ('circuit-atlas-laptop', 'Atlas Laptop 14', '16 GB RAM · 512 GB SSD · 14-inch display', 109900, NULL),
    ('circuit-arc-mouse', 'Arc Wireless Mouse', 'Bluetooth · Graphite · Wireless mouse', 4900, NULL),
    ('circuit-velocity-ssd', 'Velocity NVMe SSD 2 TB', 'PCIe 4.0 · M.2 2280 · Up to 7,000 MB/s read speed', 15900, NULL),
    ('circuit-core-processor', 'Core X8 Desktop Processor', '8 cores · 16 threads · Up to 5.2 GHz · AM5 socket', 32900, NULL),
    ('circuit-flux-memory', 'Flux DDR5 Memory 32 GB', '2 × 16 GB kit · 6,000 MT/s · CL30 · Low-profile heat spreaders', 11900, NULL),
    ('circuit-prism-graphics', 'Prism G16 Graphics Card', '16 GB GDDR6 · Triple-fan cooling · DisplayPort 2.1 · HDMI 2.1', 79900, NULL),
    ('circuit-link-dock', 'Link USB-C Dock', '8-in-1 hub · 4K HDMI · Gigabit Ethernet · 100 W power delivery', 8900, NULL),
    ('circuit-focus-webcam', 'Focus 4K Webcam', '3840 × 2160 at 30 fps · Autofocus · Dual microphones · Privacy shutter', 12900, NULL),
    ('circuit-wave-speakers', 'Wave Desktop Speakers', 'Stereo pair · 40 W RMS · Bluetooth · USB-C audio', 9900, NULL),
    ('circuit-vector-controller', 'Vector Wireless Controller', 'Hall-effect sticks · Bluetooth · USB-C charging · PC compatible', 6900, NULL),
    ('circuit-slate-tablet', 'Slate Tablet 11', '11-inch 2560 × 1600 display · 128 GB · Wi-Fi 6 · Stylus included', 44900, NULL);

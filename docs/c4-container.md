# C4 container view: asynchronous order reservation

```mermaid
C4Container
    title Webshop - container diagram

    Person(customer, "Customer")
    Container(frontend, "Catalog Frontend", "Next.js, React, TypeScript", "Cobalt storefront, basket, and order status")
    Container(gateway, "API Gateway", "Python, FastAPI", "Public HTTP entry point")
    Container(catalogApi, "Catalog API", "Python, FastAPI", "Reads and manages products")
    ContainerDb(catalogDb, "Catalog Database", "PostgreSQL", "Products, descriptions, prices, and images")
    Container(orderApi, "Order API", "Python, FastAPI", "Creates and reads orders")
    Container(orderWorkers, "Order Workers", "Python, Pika", "Publishes commands and applies inventory results")
    ContainerDb(orderDb, "Order Database", "PostgreSQL", "Orders, inbox, and outbox")
    Container(broker, "Message Broker", "RabbitMQ", "Durable commands, events, retries, and dead letters")
    Container(inventoryApi, "Inventory API", "Python, FastAPI", "Manages stock")
    Container(inventoryWorkers, "Inventory Workers", "Python, Pika", "Reserves stock and publishes outcomes")
    ContainerDb(inventoryDb, "Inventory Database", "PostgreSQL", "Stock, reservations, inbox, and outbox")

    Rel(customer, frontend, "Browses products and places orders", "HTTPS")
    Rel(frontend, gateway, "Reads products/stock; creates and checks orders", "HTTP/JSON")
    Rel(gateway, catalogApi, "Forwards product requests", "HTTP/JSON")
    Rel(catalogApi, catalogDb, "Reads and manages products", "SQL")
    Rel(gateway, orderApi, "Forwards order requests", "HTTP/JSON")
    Rel(gateway, inventoryApi, "Forwards inventory management requests", "HTTP/JSON")
    Rel(orderApi, orderDb, "Stores pending order and outbox command", "SQL")
    Rel(orderWorkers, orderDb, "Reads outbox and applies results", "SQL")
    Rel(orderWorkers, broker, "Publishes ReserveInventory; consumes results", "AMQP")
    Rel(inventoryWorkers, broker, "Consumes reservations; publishes results", "AMQP")
    Rel(inventoryWorkers, inventoryDb, "Atomically reserves stock and writes outbox", "SQL")
    Rel(inventoryApi, inventoryDb, "Reads and manages stock", "SQL")
```

RabbitMQ provides at-least-once delivery. The inbox tables, unique reservation
per order, and idempotent state transitions provide exactly-once business
effects. Infrastructure failures leave an order pending for recovery.

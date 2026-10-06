# Order service

This FastAPI service stores orders in PostgreSQL. Creating an order atomically
stores a pending order and a RabbitMQ outbox command. Inventory later confirms
or rejects the reservation, and the result consumer updates the order status.

Via the API gateway on port 8000:

```http
POST /orders
Content-Type: application/json

{"customer_id":"customer-1","items":[{"product_id":"1","quantity":2}]}
```

The response has status `202`, includes a `Location` header, and returns the
generated order with status `pending`. Read it with `GET /orders/{id}` until it
becomes `confirmed` or `rejected`. A missing order returns `404`.

There is no authentication in this iteration, so the order ID alone is enough
to read an order. Add authentication and ownership checks before exposing
customer orders publicly.

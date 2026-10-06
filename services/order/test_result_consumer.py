from types import SimpleNamespace
from unittest.mock import Mock

from messaging import DEAD_LETTER_EXCHANGE, RESULT_DEAD_KEY, RESULT_RETRY_KEY
from result_consumer import republish


def properties(headers=None):
    return SimpleNamespace(
        headers=headers or {},
        message_id="message-1",
        correlation_id="order-1",
    )


def test_transient_failure_preserves_result_routing_key():
    channel = Mock()
    method = SimpleNamespace(routing_key="inventory.reserved.v1")

    republish(channel, method, properties(), b"message", permanent=False)

    kwargs = channel.basic_publish.call_args.kwargs
    assert kwargs["routing_key"] == (f"{RESULT_RETRY_KEY}.inventory.reserved.v1")
    assert kwargs["properties"].headers["x-retry-count"] == 1


def test_permanent_failure_routes_to_dead_letter_queue():
    channel = Mock()
    method = SimpleNamespace(routing_key="inventory.rejected.v1")

    republish(channel, method, properties(), b"message", permanent=True)

    kwargs = channel.basic_publish.call_args.kwargs
    assert kwargs["exchange"] == DEAD_LETTER_EXCHANGE
    assert kwargs["routing_key"] == RESULT_DEAD_KEY

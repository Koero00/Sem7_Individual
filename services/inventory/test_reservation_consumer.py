from types import SimpleNamespace
from unittest.mock import Mock

from messaging import DEAD_LETTER_EXCHANGE, RESERVE_DEAD_KEY, RESERVE_RETRY_KEY
from reservation_consumer import republish


def properties(headers=None):
    return SimpleNamespace(
        headers=headers or {},
        message_id="message-1",
        correlation_id="order-1",
    )


def test_transient_failure_routes_to_retry_queue():
    channel = Mock()

    republish(channel, properties(), b"message", permanent=False)

    kwargs = channel.basic_publish.call_args.kwargs
    assert kwargs["routing_key"] == RESERVE_RETRY_KEY
    assert kwargs["properties"].headers["x-retry-count"] == 1


def test_exhausted_retry_routes_to_dead_letter_queue(monkeypatch):
    monkeypatch.setenv("MESSAGE_RETRY_LIMIT", "3")
    channel = Mock()

    republish(
        channel,
        properties({"x-retry-count": 3}),
        b"message",
        permanent=False,
    )

    kwargs = channel.basic_publish.call_args.kwargs
    assert kwargs["exchange"] == DEAD_LETTER_EXCHANGE
    assert kwargs["routing_key"] == RESERVE_DEAD_KEY

import json
from datetime import UTC, datetime
from unittest.mock import Mock
from uuid import UUID

import pytest

from reservation_handler import DuplicateOrderMismatch, process_reservation

ORDER_ID = UUID("00000000-0000-0000-0000-000000000001")
MESSAGE_ID = UUID("00000000-0000-0000-0000-000000000002")


def cursor(*, one=None, all=None):
    result = Mock()
    result.fetchone.return_value = one
    result.fetchall.return_value = all
    return result


def reservation_message(items=None, message_id=MESSAGE_ID):
    return json.dumps(
        {
            "message_id": str(message_id),
            "message_type": "inventory.reserve.requested",
            "schema_version": 1,
            "occurred_at": datetime.now(UTC).isoformat(),
            "correlation_id": str(ORDER_ID),
            "payload": {
                "order_id": str(ORDER_ID),
                "items": items or [{"product_id": "1", "quantity": 2}],
            },
        }
    ).encode()


def test_successful_reservation_decrements_stock_and_emits_event():
    connection = Mock()
    connection.execute.side_effect = [
        cursor(one=None),
        cursor(one=None),
        cursor(all=[{"product_id": "1", "quantity": 5}]),
        cursor(),
        cursor(),
        cursor(),
        cursor(),
    ]

    assert process_reservation(connection, reservation_message()) == "reserved"

    assert "quantity = quantity -" in connection.execute.call_args_list[3].args[0]
    connection.commit.assert_called_once()


def test_shortage_rejects_without_decrementing_stock():
    connection = Mock()
    connection.execute.side_effect = [
        cursor(one=None),
        cursor(one=None),
        cursor(all=[{"product_id": "1", "quantity": 1}]),
        cursor(),
        cursor(),
        cursor(),
    ]

    assert process_reservation(connection, reservation_message()) == "rejected"

    statements = [call.args[0] for call in connection.execute.call_args_list]
    assert not any("quantity = quantity -" in statement for statement in statements)


def test_duplicate_message_is_no_op():
    connection = Mock()
    connection.execute.side_effect = [cursor(one={"exists": 1})]

    assert process_reservation(connection, reservation_message()) == "duplicate_message"
    assert connection.execute.call_count == 1


def test_duplicate_order_replays_original_result():
    connection = Mock()
    previous = {
        "request_items": [{"product_id": "1", "quantity": 2}],
        "result_type": "inventory.reserved",
        "result_payload": {
            "order_id": str(ORDER_ID),
            "items": [{"product_id": "1", "quantity": 2}],
        },
    }
    connection.execute.side_effect = [
        cursor(one=None),
        cursor(one=previous),
        cursor(),
        cursor(),
    ]

    assert process_reservation(connection, reservation_message()) == "duplicate_order"
    assert connection.execute.call_count == 4


def test_duplicate_order_with_different_items_is_dead_letter_error():
    connection = Mock()
    previous = {
        "request_items": [{"product_id": "1", "quantity": 1}],
        "result_type": "inventory.reserved",
        "result_payload": {},
    }
    connection.execute.side_effect = [cursor(one=None), cursor(one=previous)]

    with pytest.raises(DuplicateOrderMismatch):
        process_reservation(connection, reservation_message())
    connection.rollback.assert_called_once()


def test_duplicate_product_lines_are_combined_before_reservation():
    connection = Mock()
    connection.execute.side_effect = [
        cursor(one=None),
        cursor(one=None),
        cursor(all=[{"product_id": "1", "quantity": 5}]),
        cursor(),
        cursor(),
        cursor(),
        cursor(),
    ]
    body = reservation_message(
        [
            {"product_id": "1", "quantity": 1},
            {"product_id": "1", "quantity": 2},
        ]
    )

    assert process_reservation(connection, body) == "reserved"
    update_params = connection.execute.call_args_list[3].args[1]
    assert update_params == (3, "1")

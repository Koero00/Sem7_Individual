import json
from datetime import UTC, datetime
from unittest.mock import Mock
from uuid import UUID

import pytest

from result_handler import PermanentMessageError, process_result

ORDER_ID = UUID("00000000-0000-0000-0000-000000000001")
MESSAGE_ID = UUID("00000000-0000-0000-0000-000000000002")


def cursor(*, one=None):
    result = Mock()
    result.fetchone.return_value = one
    return result


def message(message_type="inventory.reserved", payload=None):
    return json.dumps(
        {
            "message_id": str(MESSAGE_ID),
            "message_type": message_type,
            "schema_version": 1,
            "occurred_at": datetime.now(UTC).isoformat(),
            "correlation_id": str(ORDER_ID),
            "payload": payload
            or {
                "order_id": str(ORDER_ID),
                "items": [{"product_id": "1", "quantity": 2}],
            },
        }
    ).encode()


def test_reserved_result_confirms_pending_order():
    connection = Mock()
    connection.execute.side_effect = [
        cursor(one=None),
        cursor(one={"status": "pending"}),
        cursor(),
        cursor(),
    ]

    assert process_result(connection, message()) == "processed"

    assert "status = 'confirmed'" in connection.execute.call_args_list[2].args[0]
    connection.commit.assert_called_once()


def test_rejected_result_records_reason():
    connection = Mock()
    connection.execute.side_effect = [
        cursor(one=None),
        cursor(one={"status": "pending"}),
        cursor(),
        cursor(),
    ]
    payload = {
        "order_id": str(ORDER_ID),
        "reason": "insufficient_stock",
        "items": [
            {
                "product_id": "1",
                "requested_quantity": 4,
                "available_quantity": 2,
            }
        ],
    }

    assert (
        process_result(connection, message("inventory.rejected", payload))
        == "processed"
    )

    assert "status = 'rejected'" in connection.execute.call_args_list[2].args[0]


def test_duplicate_result_is_a_no_op():
    connection = Mock()
    connection.execute.side_effect = [cursor(one={"exists": 1})]

    assert process_result(connection, message()) == "duplicate"
    assert connection.execute.call_count == 1


def test_terminal_order_is_not_overwritten():
    connection = Mock()
    connection.execute.side_effect = [
        cursor(one=None),
        cursor(one={"status": "rejected"}),
        cursor(),
    ]

    assert process_result(connection, message()) == "processed"
    assert connection.execute.call_count == 3


def test_unknown_order_is_permanent_failure():
    connection = Mock()
    connection.execute.side_effect = [cursor(one=None), cursor(one=None)]

    with pytest.raises(PermanentMessageError):
        process_result(connection, message())
    connection.rollback.assert_called_once()

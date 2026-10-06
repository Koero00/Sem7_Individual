from unittest.mock import Mock

from outbox_publisher import claim_messages, mark_published, release_claim


def test_claim_messages_commits_claimed_batch(monkeypatch):
    monkeypatch.setenv("OUTBOX_BATCH_SIZE", "25")
    connection = Mock()
    messages = [{"id": "message-1"}]
    connection.execute.return_value.fetchall.return_value = messages

    claim_token, claimed = claim_messages(connection)

    assert claimed == messages
    assert connection.execute.call_args.args[1][0] == 25
    assert connection.execute.call_args.args[1][1] == claim_token
    connection.commit.assert_called_once()


def test_mark_published_clears_claim():
    connection = Mock()

    mark_published(connection, "message-1", "claim-1")

    assert connection.execute.call_args.args[1] == ("message-1", "claim-1")
    connection.commit.assert_called_once()


def test_release_claim_makes_entire_batch_retryable():
    connection = Mock()

    release_claim(connection, "claim-1", "broker unavailable")

    assert connection.execute.call_args.args[1] == ("broker unavailable", "claim-1")
    connection.commit.assert_called_once()

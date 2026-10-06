"""Add inventory reservations, outbox, and inbox tables."""

from alembic import op

revision = "20261005_01_inventory"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS reservations (
            order_id UUID PRIMARY KEY,
            request_items JSONB NOT NULL,
            status TEXT NOT NULL CHECK (status IN ('reserved', 'rejected')),
            result_type TEXT NOT NULL,
            result_payload JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS outbox_messages (
            id UUID PRIMARY KEY,
            aggregate_id UUID NOT NULL,
            message_type TEXT NOT NULL,
            routing_key TEXT NOT NULL,
            payload JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            published_at TIMESTAMPTZ,
            attempts INTEGER NOT NULL DEFAULT 0,
            last_error TEXT,
            claim_token UUID,
            claimed_at TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS inventory_outbox_unpublished_idx
            ON outbox_messages (created_at) WHERE published_at IS NULL;
        CREATE INDEX IF NOT EXISTS inventory_outbox_claim_idx
            ON outbox_messages (claimed_at) WHERE published_at IS NULL;

        CREATE TABLE IF NOT EXISTS processed_messages (
            message_id UUID PRIMARY KEY,
            message_type TEXT NOT NULL,
            processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DROP TABLE IF EXISTS processed_messages;
        DROP TABLE IF EXISTS outbox_messages;
        DROP TABLE IF EXISTS reservations;
        """
    )

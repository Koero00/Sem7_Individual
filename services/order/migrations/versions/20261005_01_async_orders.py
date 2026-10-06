"""Add asynchronous order status, outbox, and inbox tables."""

from alembic import op

revision = "20261005_01_order"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE orders
            ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'confirmed',
            ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
            ADD COLUMN IF NOT EXISTS rejection_details JSONB,
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

        UPDATE orders SET updated_at = created_at WHERE updated_at IS NULL;
        ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'pending';

        DO $$ BEGIN
            ALTER TABLE orders ADD CONSTRAINT orders_status_check
                CHECK (status IN ('pending', 'confirmed', 'rejected'));
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;

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
        CREATE INDEX IF NOT EXISTS order_outbox_unpublished_idx
            ON outbox_messages (created_at) WHERE published_at IS NULL;
        CREATE INDEX IF NOT EXISTS order_outbox_claim_idx
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
        ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
        ALTER TABLE orders
            DROP COLUMN IF EXISTS updated_at,
            DROP COLUMN IF EXISTS rejection_details,
            DROP COLUMN IF EXISTS rejection_reason,
            DROP COLUMN IF EXISTS status;
        """
    )

-- Support live-chat bridge metadata for Telegram replies.
-- Lets an admin reply to a Telegram bot message and map that reply back to
-- the correct support ticket/message on the customer's chatbot screen.

ALTER TABLE public.support_messages
  ADD COLUMN IF NOT EXISTS telegram_message_id BIGINT,
  ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT,
  ADD COLUMN IF NOT EXISTS telegram_from JSONB;

CREATE INDEX IF NOT EXISTS idx_support_msg_telegram_message
  ON public.support_messages (telegram_message_id)
  WHERE telegram_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_support_msg_ticket_created
  ON public.support_messages (ticket_id, created_at DESC);

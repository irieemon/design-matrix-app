-- migration:    20260408170000_add_past_due_since_to_subscriptions
-- phase:        06 (hotfix)
-- summary:      Phase 06-01's billing_schema migration used CREATE TABLE IF NOT
--               EXISTS for `public.subscriptions`, but the table pre-existed
--               (created by an earlier unrelated scaffolding pass) without the
--               `past_due_since` column that D-17 requires for the 7-day grace
--               anchor. The CREATE was a no-op, so the column never landed and
--               every webhook subscription_update 500'd with:
--                 Could not find the 'past_due_since' column of 'subscriptions'
--                 in the schema cache
--               Fix: add the column explicitly via ALTER TABLE.
--
-- forward:
alter table public.subscriptions
  add column if not exists past_due_since timestamptz;

-- rollback:
-- alter table public.subscriptions drop column if exists past_due_since;

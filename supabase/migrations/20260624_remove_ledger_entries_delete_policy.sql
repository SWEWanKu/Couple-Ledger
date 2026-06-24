-- Record Mutation V1 uses soft void for ledger correction.
-- Hard delete is intentionally disabled for ledger entries.

drop policy if exists "Household members can delete ledger entries"
on public.ledger_entries;

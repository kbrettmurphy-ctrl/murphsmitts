-- Custom add-on: an admin-only, per-order manual split for negotiated one-off
-- work (e.g. a web-hole re-pattern) that isn't one of the structured add-ons
-- (palm pad / loop) and has no fixed price. The amount is carved out of the
-- order price so it doesn't contaminate the base service's pricing intelligence;
-- the matching labor is timed under the existing "Custom Work" phase.
-- Additive only. NULL amount = no custom add-on (unchanged behavior).

alter table public.orders add column if not exists custom_addon_amount numeric;
alter table public.orders add column if not exists custom_addon_label  text;

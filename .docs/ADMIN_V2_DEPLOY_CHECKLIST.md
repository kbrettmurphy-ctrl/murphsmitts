# Admin v2 Deploy Checklist

> Historical checklist for the lace-alert release. It is not a complete current deployment checklist. Use `DEPLOYMENT.md` and the full migration ledger in `DATABASE.md` for present-day deployments; confirm actual production migration state outside Git.

Before merging Admin v2 changes to the live branch:

## Supabase migrations

Run this migration in Supabase before relying on the new Lace Inventory alert/no-alert feature:

- `supabase/migrations/20260701000000_add_lace_inventory_alert_enabled.sql`

This migration adds alert-enabled support so lace colors can have a normal "Reorder at" number while alerts are disabled separately.

Do not deploy/use the live Admin v2 Lace Inventory management tools until this migration has been applied.

## Quick live checks after deploy

- Lace Inventory loads.
- Alert / No Alert works.
- Needs Order excludes No Alert colors.
- Add Lace Color works.
- Set Quantity works.
- Orders still load.
- Order workflow still works.

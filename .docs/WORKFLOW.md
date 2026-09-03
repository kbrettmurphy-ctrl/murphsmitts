# MurphOS Workflows

As-built baseline reviewed 2026-08-04.

## Order creation

Public intake accepts one customer submission containing one or more gloves. It validates contact/delivery/acknowledgement fields and each glove's type, services, primary lace, and fielder web. The browser keeps one idempotency key while retrying unchanged request data. A transaction-serialized RPC assigns a consecutive number range, inserts every glove, and records the key atomically; a retry returns those orders instead of inserting duplicates.

Created orders use status `Received`, unpaid state, independent tracking tokens, and shared customer/delivery data. Customer email, opt-in SMS, optional owner email, Web Push, and optional Pushover run after the order transaction. Their structured outcomes are recorded and returned. A provider failure is an explicit partial success—the order remains authoritative and the customer is told not to resubmit. The submitting browser may then upload photos using the returned order UUID.

Admins can also create orders using the order editor and templates.

## Statuses and workflow

The selectable statuses are:

1. `Received`
2. `Estimate Sent`
3. `Pending Response`
4. `Customer Approved`
5. `In Transit to Me`
6. `In Progress`
7. `Waiting on Lace/Parts`
8. `Ready to Go`
9. `On Hold`
10. `Completed`
11. `Picked Up`

This is not a server-enforced transition graph: an authenticated admin can select statuses directly. The UI groups them into Received, Estimate, Work, Ready, and Completed progress stages. `Completed` automatically receives today's completion date when blank. A shipped order cannot be completed while unpaid unless `allow_ship_without_payment` is true.

`Picked Up`, `Customer Approved`, `Pending Response`, and `In Transit to Me` are internal-only for automatic status email. Other statuses, including `On Hold` and `Waiting on Lace/Parts`, are email-eligible. Only `Estimate Sent`, `In Progress`, `Ready to Go`, and `Completed` are eligible for status SMS when the customer opted in; `Received` SMS is handled during intake. Delivery stamps prevent duplicate automatic sends, and admin actions can explicitly resend eligible email/text.

Inbound Twilio requests must pass `X-Twilio-Signature` HMAC validation against the exact webhook URL and all form fields before any lookup or side effect. Valid messages are associated with the newest matching order among the 100 most recent orders by the sender's last 10 phone digits. Exact YES/Y while `Estimate Sent` changes the order to `Customer Approved`; NO/N changes it to `On Hold`. MMS photos are fetched with Twilio account authentication only from trusted HTTPS Twilio API hosts, streamed with a 10 MB limit, copied to `order-photos`, appended to `orders.glove_photos`, and recorded in `sms_messages`. Other messages are stored for the admin inbox.

## Labor sessions

Supported phases are Tear down, Cleaning, Relacing, Conditioning, Palm Pad, Custom Work, Photos, Packing/Shipping, Admin/Messaging, and Other.

- Starting requires an order and valid phase. The API prevents another open session for that order; the dashboard also warns about an active timer on another job.
- Pausing freezes elapsed time and stores optional notes.
- Resuming adds the just-finished pause interval to `pause_accumulated_seconds`.
- Stopping computes active minutes from start to end minus accumulated and current paused time, then stores status `stopped` and `duration_minutes`.
- Only stopped sessions contribute to order economics, measured job times, summaries, and phase-hour reporting.
- The client updates a running display every second; server timestamps/calculation are authoritative at state changes.

## Bench Focus

`Start Bench Work` records which In Progress glove is physically on the bench without changing workflow status or sending notifications. Customer Approved, In Transit to Me, Received, and Waiting on Lace/Parts require explicit confirmation; inactive/customer-waiting/finished statuses are prohibited. Exactly one Bench Focus may be active globally.

Bench elapsed time is context, not labor. After 90 seconds without an open linked timer, the Clubhouse offers an exact backdate from the authoritative Bench start, a current-time start, or a ten-minute snooze. The first labor choice consumes backdating; later phases use current database time. A running same-order timer attaches automatically, while a paused one requires Resume and Attach, Leave Paused, or Cancel. A paused session deliberately left open is shown separately and must be resumed-and-attached atomically or stopped before new Bench labor can start or the full interval can be assigned. Ending with running labor requires explicit pause-or-stop disposition. Untracked ended intervals remain visible until assigned to an exact stopped labor interval or discarded.

## Money, expenses, and economics

Current and nonterminal order economics are computed in the admin client; terminal historical actuals resolve from durable database snapshots. Revenue is `price_quoted`; customer-charged `shipping_cost` is deliberately excluded as pass-through. Materials include lace, palm pad, cleaning consumables, and per-order packaging. Default lace usage is 3 pieces for a fielder (plus one for trapeze/modified trapeze), 4 for a catcher's mitt, and 5 for first base, unless `lace_pieces_used` overrides it. Special-order lace records the actual supplier color and piece count for costing without adjusting stocked-color inventory.

Effective rate is `(quote - materials) / stopped labor hours`. Money rollups include only `Ready to Go`, `Completed`, or `Picked Up` jobs as applicable and require at least one logged minute for measured-job rate rollups. Views include service/glove/month/referral summaries, measured times, phase hours, best/worst jobs, expenses, monthly P&L, and customer reach/maintenance signals.

Expense rows are manual. Valid lace-piece purchases use cumulative weighted-average landed cost: total qualifying expense amount divided by total qualifying quantity. Other recognized unit kinds retain their latest-valid-purchase unit cost. The lace fallback is used only after expenses load successfully and contain no valid lace-piece purchases. Monthly P&L subtracts materials and recorded expenses from job revenue; it is an operating estimate, not accounting software.

When an order first becomes Completed or Picked Up, the database locks an economics snapshot containing its charged price, stopped labor and phase totals, lace-piece basis and unit cost, material components, net, and effective hourly rate. Order Detail, Money, pricing intelligence, service allocations, and monthly history resolve terminal historical actuals from that snapshot. A later service-price correction updates only the snapshot price, net, and effective rate; its labor, materials, and original lock time remain fixed. Shipping remains excluded. The additive migration backfills existing terminal orders once from the data available at deployment and labels those snapshots `backfill`.

Hard deletion is one transaction: matching stocked lace is restored; labor is deleted before Bench Work; activity and legacy order-owned usage are removed; SMS and gallery links are unlinked; then the order is deleted. Gallery and order-photo Storage objects are retained.

## Inventory

The public services/contact interfaces read active lace colors and quantities. Admins can add, edit, deactivate/restore, set reorder thresholds, and enable/disable alerts. Order changes adjust stock by lace-usage deltas, so edits are reversible; gallery/store operations do not change lace stock.

## Gallery and tracking linkage

Gallery uploads choose a section and may link directly to an order. Existing photos can be linked to an order or described without one, moved between sections, hidden/restored, deleted, and designated as an album cover. Public gallery photos sharing an order number collapse into one album; public search matches order data for linked photos and stored descriptors for orderless photos.

Maintenance-due customer cards use the most recent service record and, after ten months without an active shop order, open the device's SMS composer with a personal reminder prefilled. The reminder is not sent automatically and does not currently open a MurphOS message thread.

The public tracking URL uses `?t=<64-hex token>`. It maps internal statuses to six customer stages and may show an estimate/completion date, shipment carrier/tracking link, and only gallery photos explicitly linked to the order. It never returns address, contact details, price, payment state, or internal notes.

## Notifications and PWA

Authenticated admins can subscribe a browser to Web Push and send a test notification. New intake orders, inbound texts, and accepted invites trigger push fan-out when VAPID is configured. The service worker does not cache files. Push clicks focus/navigate the admin, and push messages prompt an open inbox to refresh. Unsupported browsers or absent VAPID configuration simply leave notification enablement unavailable.

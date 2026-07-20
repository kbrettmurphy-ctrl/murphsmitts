# MurphOS Feature Inventory

As-built baseline reviewed 2026-07-19.

| Surface | Implemented features |
| --- | --- |
| Public marketing | Responsive Jekyll pages, shared navigation/footer, lightboxes, FAQ/service/process content |
| Service request | Multi-glove intake, conditional shipping address, live active lace choices, SMS consent, post-submit multi-photo upload |
| Public inventory | Active lace availability with in/out-of-stock display |
| Public gallery | Sectioned photos, order albums, covers, lightbox, descriptor/order-backed search, query deep links |
| Public store | Non-hidden glove listings, sold state, primary/hover photos, detail slider, purchase/contact action |
| Public tracking | Token lookup, six-stage timeline, exception notes, promise/completion date, carrier links, curated finished photos |
| Clubhouse | New/on-deck/bench/attention lists, timer controls, finance snapshot, unread/new badges |
| Orders | Search and status filters, create/templates, detail editing, photos, activity, workflow menus, swipe/context actions, delivery resend, shipping/payment guard |
| Customers | Contact grouping, order/glove history, linked gallery photos, maintenance-due view |
| Calendar | Received/estimated/completed scheduling with unscheduled work |
| Map | Shipped-order markers, persisted/fallback geocoding, quality handling, unmapped errors, detail deep links |
| Labor | Phase timers, one open session per order, pause/resume/stop, notes, history, dashboard controls, summaries |
| Money | Job economics, effective rate, suggested pricing from measured work, rollups, labor coverage, phase hours, expenses, monthly P&L |
| Inventory admin | Add/edit/deactivate/restore, thresholds/alerts, low-stock banner, usage-delta adjustments |
| Gallery admin | Upload/link/describe/cover/move/hide/restore/delete and search/filter |
| Store admin | Listing CRUD, status/featured/order, photo upload and primary/hover roles |
| Messaging | Twilio inbox/threading/read state, compose/reply, photo attachments, message/thread deletion, inbound MMS |
| Authentication | Email/password, owner PIN fallback, owner passkey, signed 14-day sessions, admin/demo roles, invites and user administration |
| Demo | Seeded browser-only sandbox; API backstop denies demo access to real-data actions |
| PWA/push | Installable admin manifest, no-cache service worker, Web Push subscription/test/fan-out, notification navigation, build-change reload |

Not implemented as repository-managed infrastructure: a complete baseline database schema, Storage policies/bucket creation, automated test suite, CI workflow, dependency-managed admin build, or offline application caching.

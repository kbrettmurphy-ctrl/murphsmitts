# Workflow

## Order lifecycle

1. **Received**
   - Created in `functions/api/intake.js` when a new customer request is submitted.
   - Initial order values:
     - `status = "Received"`
     - `paid = "Unpaid"`
     - `allow_ship_without_payment = false`
     - `glove_photos = []`
   - Triggers customer notification:
     - Email via `sendStatusEmail(..., "Received")`
     - SMS via `sendReceivedText(...)` when `sms_opt_in` is true.
   - Updates `last_status_emailed` and `last_status_texted` in the order row.

2. **Estimate Sent**
   - Intended status after the estimate is prepared and sent to the customer.
   - Customer notification logic:
     - Email is sent on status change if not internal-only.
     - SMS is sent when `sms_opt_in` is true and status is one of `estimate sent`, `in progress`, `ready to go`, or `completed`.
   - SMS copy invites reply with YES/NO to approve or place the request on hold.

3. **Customer Approved**
   - Set by inbound SMS when a customer replies YES to an order whose normalized status is `estimate sent`.
   - Marked in `functions/api/sms-reply.js` and stored in `customer_approved_at`.
   - Code treats this as an internal-only status; customer email/SMS are skipped.

4. **On Hold**
   - Set by inbound SMS when a customer replies NO while the order is `estimate sent`.
   - Also used by other flows if the order needs to pause.
   - Not explicitly marked internal-only in status logic, so status changes may still trigger email notifications, but not SMS unless the status appears in `shouldSendTextForStatus`.

5. **In Progress**
   - Indicates work has begun on the glove.
   - Customer receives email and SMS if opted in.

6. **Waiting on Lace/Parts**
   - Indicates the order is temporarily delayed due to materials.
   - Customer receives email on status change.
   - SMS is not sent for this status because `shouldSendTextForStatus()` excludes it.

7. **Ready to Go**
   - Indicates the glove work is finished and the order is ready for pickup or shipping.
   - Customer receives email and SMS if opted in.
   - The message depends on payment and drop-off method.

8. **Completed**
   - Order is finalized.
   - Customer receives email and SMS if opted in.
   - For shipped orders, tracking details are included if present.
   - The code prevents marking a shipped order completed unless it is paid or `allow_ship_without_payment` is true.

9. **Picked Up**
   - Internal-only status.
   - No customer email or SMS is sent by the status delivery helpers.

10. **Pending Response**
    - Internal-only status.
    - No customer email or SMS is sent by the status delivery helpers.

11. **In Transit to Me**
    - Internal-only status.
    - No customer email or SMS is sent by the status delivery helpers.

## Status meaning summary

- `Received`: request checked in and queued.
- `Estimate Sent`: estimate delivered; customer can reply YES or NO.
- `Customer Approved`: customer approved the estimate; internal tracking only.
- `On Hold`: order paused until customer or materials are ready.
- `In Progress`: work is actively underway.
- `Waiting on Lace/Parts`: materials are pending.
- `Ready to Go`: glove is finished and awaiting pickup/shipping.
- `Completed`: service is done; shipped or pickup finished.
- `Picked Up`: internal pickup confirmation.
- `Pending Response`: internal follow-up state.
- `In Transit to Me`: internal transit state when the glove is being returned to the shop.

## Notification triggers

- **Received**
  - Email always sent when the order is created.
  - SMS sent if `sms_opt_in === true`.

- **Estimate Sent**
  - Email sent if status changes to `Estimate Sent`.
  - SMS sent if `sms_opt_in === true`.

- **In Progress**
  - Email sent on status change.
  - SMS sent if `sms_opt_in === true`.

- **Ready to Go**
  - Email sent on status change.
  - SMS sent if `sms_opt_in === true`.

- **Completed**
  - Email sent on status change.
  - SMS sent if `sms_opt_in === true`.

- **Customer Approved**, `Picked Up`, `Pending Response`, `In Transit to Me`
  - Treated as internal-only statuses by `isInternalOnlyStatus()`.
  - No customer email or SMS is sent by the status helpers.

- **Waiting on Lace/Parts**
  - Email is sent on status change.
  - SMS is not sent, because `shouldSendTextForStatus()` does not include it.

## SMS reply behavior

- Incoming SMS is handled by `functions/api/sms-reply.js`.
- The app finds the customer order by matching the last 10 digits of the sender phone number against recent orders.
- If the text is `YES` or `Y` and the current status is `Estimate Sent`, the order updates to `Customer Approved`.
- If the text is `NO` or `N` and the current status is `Estimate Sent`, the order updates to `On Hold`.
- Inbound media is saved to the `order-photos` storage bucket and added to `orders.glove_photos`.
- All incoming texts also update `last_customer_text` and `last_customer_text_at`.

## Local drop-off vs shipped behavior

- The code uses `looksLikeShipMethod(drop_off_method)` to detect shipping when the drop-off method string includes `ship`.
- For shipping orders:
  - address fields are preserved in the order row.
  - shipping-related fields are surfaced in the admin UI (`shippingCost`, `totalDue`, `trackingNumber`, `carrier`).
  - `Ready to Go` and `Completed` messages include shipping/payment/shipping tracking language.
  - `Completed` cannot be set for shipped orders unless `paid` is `paid` or `allow_ship_without_payment` is true.

- For local drop-off orders:
  - shipping fields are hidden in the admin UI.
  - address/shipping inputs are cleared before saving.
  - `Ready to Go` and `Completed` messages focus on pickup coordination.

## Notes and TODOs

- TODO: the code does not define every allowed admin status transition explicitly; the admin UI includes controls for status selection, but the full valid transition graph is not codified in one place.
- TODO: the exact behavior for `Customer Approved` in email history is internal-only and not customer-notified by the status helpers.

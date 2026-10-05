# AO / AR — Admin: orders and returns

**Status: built with Claude's defaults during the away-run (2026-10-05), to be reviewed.** Choices made by the owner before leaving: to-do tabs first, a printable packing slip. Business rules are the backend's (`deserver/docs/scenarios/05-orders.md` O-xx, `06-returns.md` R-xx); these scenarios cover what the screens do.

## Orders

### AO-01 · Orders list starts with what needs work
When   the admin opens **Orders**
Then   the tab **To handle** (New, Confirmed, Packed) is open; the other tabs are Shipped, Delivered, Cancelled / returned, All; every tab shows how many orders it has
And    each row shows number, date, customer, phone, total, payment (method, paid or not), status, and a "Refund needed" badge when it applies; search finds by number, phone, name or email
Auto:  ✅ e2e: AO-01 (to-handle tab with counts, search, Shipped tab in the URL)

### AO-02 · The order page shows everything
When   the admin opens order #1001
Then   they see customer (phone and email clickable), delivery city and branch, the customer's note, items with SKU, options, price, discount and line total, subtotal, discount, delivery, total, the chosen offer or promo code, payment method / status / reference / paid at, house, waybill, returns, and the full history with who did each step
Auto:  ✅ e2e: AO-02 AO-03 AO-05 (customer, address, note, options, total)

### AO-03 · One clear next step
Then   the page offers the next step for the current status:
       New → **Confirm** · Confirmed → **Pack** (choose the house) · Packed → **Ship** (waybill number) and **Unpack** · Shipped → **Delivered** and **Returned to sender** (choose the house) · Delivered → **Create return**
And    a refused step shows the backend's reason (e.g. packing from a house without the stock)
Auto:  ✅ e2e: AO-02 AO-03 AO-05 (every step) · AO-03 AO-04 (refused pack shows the reason)

### AO-04 · Cancelling
Given  the order is New, Confirmed or Packed
When   the admin clicks **Cancel order**, writes a note and confirms
Then   it is Cancelled; a paid order shows **Refund needed**; after shipping the button is not offered
Auto:  ✅ e2e: AO-03 AO-04 (paid → refund needed, reason in history)

### AO-05 · Internal note
When   the admin writes "deliver after 18:00" in the internal note and saves
Then   it stays on the order (never shown to the customer)
Auto:  ✅ e2e: AO-02 AO-03 AO-05 (note kept after reload)

### AO-06 · Sending the order link again
When   the admin clicks **New customer link**
Then   a new link is shown with a copy button, with the warning that the old link stops working
Auto:  ✅ e2e: AO-06 AO-07 (new link works, old one stops)

### AO-07 · Packing slip
When   the admin clicks **Print packing slip**
Then   a clean page opens with the order number and date, customer name, phone, delivery city and branch, the customer's note, items with SKU, options and quantity, and the payment to collect (cash on delivery: total) — ready for the browser's Print
Auto:  ✅ e2e: AO-06 AO-07 (items, quantity, Collect 1.300 MDL, no sidebar)

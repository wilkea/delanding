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

## Returns

### AR-01 · Returns list
When   the admin opens **Returns**
Then   returns are listed newest first with number (R-1), order (#1001), status, number of items, what those items were paid and what was refunded; filter by status, search by order number
Auto:  ✅ e2e: AR-01 (search by order number, paid for items)

### AR-02 · Creating a return from a delivered order
Given  #1001 is Delivered (2× XL paid 520 each, 1× M paid 450)
When   the admin clicks **Create return** on the order and enters 1× XL, reason "Wrong size"
Then   each line shows how many can still be returned and what one item was paid; the form shows "paid for these items: 520"; after saving return R-n opens as **Open**
And    "Other" needs a note; returning more than is left shows the backend's reason at that line
Auto:  ✅ e2e: AR-02 AR-03 AR-04 AR-06 (can still be returned, paid total, opens Open) · AR-02 (more than left refused at the line)

### AR-03 · Receiving the parcel
Given  R-n is Open
When   the admin clicks **Receive** and marks each item **Resellable** (place list offers only sellable houses) or **Damaged** (only B-grade places)
Then   R-n is **Received**; the items are back in stock at that place
Auto:  ✅ e2e: AR-02 AR-03 AR-04 AR-06 (resellable → house, stock +1) · damaged only offers B-grade places

### AR-04 · Refund by hand closes the return
Given  R-n is Received
When   the admin clicks **Mark refunded**; the amount is prefilled with what the items were paid (520), they keep or change it and add a note "bank transfer 05.10"
Then   R-n is **Closed**; the order shows the return and "Refunded 520"
Auto:  ✅ e2e: AR-02 AR-03 AR-04 AR-06 (prefilled 650, refunded 600, order shows it)

### AR-05 · Cancelling an open return
Given  R-n is Open
When   the admin cancels it
Then   it is **Cancelled** and its items can be returned again
Auto:  ✅ e2e: AR-02 AR-03 AR-05 (cancel an open return)

### AR-06 · The return page
When   the admin opens R-n
Then   they see the order link, the lines with reason and note, what was received and where, the refund and its note, and the history with who did each step
Auto:  ✅ e2e: AR-02 AR-03 AR-04 AR-06 (lines, received, refund, history of 3 steps)

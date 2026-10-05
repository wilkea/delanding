# AP / AS — Admin: discounts and checkout settings

**Status: built with Claude's defaults during the away-run (2026-10-05), to be reviewed.** Business rules are the backend's (`deserver/docs/scenarios/04-pricing.md` P-xx, `05-orders.md` O-10, O-62); these scenarios cover what the screens do.

## Discounts

### AP-01 · Discounts list
When   the admin opens **Discounts**
Then   every discount is listed with name, what it gives (−10 % or 2+1), how it starts (Automatic, or the code e.g. DEPAD10), what it applies to, dates, how many orders used it, and its state: **Active**, **Scheduled** (starts later), **Ended**, or **Off**; filter Automatic / Codes
Auto:  ✅ e2e: AP-02 AP-01 AP-05 (gives, applies, target, state, code)

### AP-02 · Creating a discount
When   the admin clicks **New discount**, names it RO "Reducere toamnă", chooses −10 %, Automatic, applies it to brand Depad, from today with no end
Then   it is saved and listed as Active
And    for a code the code field appears (typed in any case, saved as DEPAD10) with limits "total uses" and "uses per customer"; for 2+1 the fields "buy" and "get free" appear instead of the percent
Auto:  ✅ e2e: AP-02 AP-01 AP-05 (automatic −10 % on a product)

### AP-03 · Every problem at once
When   the admin saves 150 %, code "x" and an end before the start
Then   nothing is saved and the "Not saved" box lists every problem; the fields are marked
Auto:  ✅ e2e: AP-03 (percent, code and dates listed at once, values kept)

### AP-04 · Switching off and deleting
When   the admin switches a discount off
Then   it shows **Off** and stops applying at once
When   they delete an unused discount
Then   it is gone; a discount used in orders cannot be deleted and the reason is shown
Auto:  ✅ e2e: AP-04 (switch off, delete unused, used one refused with the reason)

### AP-05 · Try a cart
When   the admin opens **Try a cart** on the discounts page, adds 1× XL + 1× M and types code "depad10"
Then   they see every offer the customer would get (e.g. Sales 970, DEPAD10 990), which one is preselected, the line prices of the chosen offer, and why a code does not work ("not found", "minimum not met"…)
Auto:  ✅ e2e: AP-02 AP-01 AP-05 (Sales 585, code 520 best, choose another, unknown code explained)

## Checkout settings

### AS-01 · Payment and delivery methods
When   the admin opens **Settings**
Then   payment methods (Cash on delivery, Test card) can be switched on or off and ordered; delivery methods (Nova Post branch) have on/off, fee (50 MDL) and "free from" (400 MDL)
And    a change applies to new orders only (O-62); a wrong value (negative fee) shows the reason
Auto:  ✅ e2e: AS-01 (negative fee explained, 60 / 500 saved)

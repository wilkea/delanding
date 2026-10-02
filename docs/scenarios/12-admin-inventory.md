# AI — Admin: inventory

**Status: built with Claude's defaults during the long run (2026-10-02), to be reviewed.** Business rules are the backend's (`deserver/docs/scenarios/03-inventory.md` I-xx); these scenarios cover what the screens do.

Sidebar group **Inventory**: Stock, Documents, Locations. Stock is never edited in place: every change is a numbered document.

## Locations

### AI-01 · Locations
When   the admin opens **Inventory → Locations**
Then   locations are listed with contact, city, "Sellable" and "Inactive" badges; "New location" opens a dialog (name, contact, phone, city, address, sellable)
And    deactivating a location that holds stock shows the backend's reason; an inactive one can be activated again
Auto:  ✅ e2e: AI-01 locations (add, deactivate refused with stock, deactivate and activate an empty one)

## Stock

### AI-02 · Stock overview
When   the admin opens **Inventory → Stock**
Then   every variant is listed with SKU, product, on hand per location, total, reserved (in open orders) and available; search by SKU or product, filter by location, "only in stock"
Auto:  ✅ e2e: AI-13 AI-02 AI-03 (per-location columns, total)

### AI-03 · History of one variant
When   the admin clicks a variant in the stock list
Then   a side panel shows its movements newest first: document number and type, location, +/− quantity, reason, cost, note, who and when; the document number opens the document
Auto:  ✅ e2e: AI-13 AI-02 AI-03 (history newest first, link to the document)

## Documents

### AI-10 · Receiving stock
When   the admin clicks **Receive**, picks House 1, supplier "AliExpress", and adds lines by searching SKU or product: 20× XL at 210 MDL, 30× M at 140 MDL
Then   the form shows the total cost (8.400 MDL — Romanian number format); after saving, the receipt opens with its number and the stock shows 20 XL and 30 M at House 1
And    a bad line (quantity 0, the same variant twice) is pointed at in that line and listed in the "Not saved" box
Auto:  ✅ e2e: AI-10 AI-14 receiving (bad line, total 8.400 MDL, opens the receipt, stock filled)

### AI-11 · Adjusting stock
When   the admin clicks **Adjust**, picks a reason, and enters quantities
Then   Damaged, Lost and Gift / Sample **remove** stock, Found **adds** it, Other lets the admin choose and requires a note; "Count correction" is not offered
And    taking more than there is shows "Only 2 in stock at this location." at that line
Auto:  ✅ e2e: AI-11 adjustments (more than in stock, Other needs a note, Gift / Sample)

### AI-12 · Counting stock
When   the admin clicks **Count**, picks House 1 and adds the variants they counted
Then   each line shows what the system expects and the difference (e.g. expected 10, counted 8 → −2); only differences are recorded, unlisted variants stay as they are
Auto:  ✅ e2e: AI-12 count (expected, difference, only differences recorded)

### AI-13 · Moving stock between locations
When   the admin clicks **Transfer**, picks from House 1 to House 2 and 3× XL
Then   each line shows how many the source has; after saving House 1 has 3 fewer and House 2 3 more; the same location on both sides cannot be chosen
Auto:  ✅ e2e: AI-13 AI-02 AI-03 transfer (same location not offered, stock moved)

### AI-14 · Documents list and detail
When   the admin opens **Inventory → Documents**
Then   documents are listed newest first with number, type, location(s), supplier, number of lines, who and when; filter by type and location; a document shows all its lines with +/− quantities and costs
Auto:  ✅ e2e: AI-10 AI-14 (type filter, newest first, detail)

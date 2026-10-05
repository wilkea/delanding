# AD — Admin foundation

Built in slice A1.

The admin lives at `/admin` in this app. Texts are English, kept in a translation file so Romanian can be added without code changes.

## Access

### AD-01 · Login
When   the admin opens `/admin/login` and enters email and password
Then   they land on the dashboard
When   the password is wrong
Then   the form shows "Invalid email or password." and keeps the email filled in
When   the account is locked after 5 wrong attempts
Then   the form shows "Account is locked. Try again later."
Auto:  ✅ e2e: AD-01 wrong password · AD-01 / AD-20 invalid input · ⚠️ lockout message is shown from the backend's text (backend A-03 is a gap); not run in e2e because it would lock the dev admin for 15 minutes

### AD-02 · Admin pages need a login, and you come back where you wanted to go
Given  nobody is logged in
When   someone opens `/admin/products`
Then   they are sent to the login page; after logging in they land on `/admin/products`, not the dashboard
Auto:  ✅ e2e: AD-02 admin pages need a login

### AD-03 · Expired session
Given  the admin was logged in, but the session expired (8 hours without activity)
When   they click anything that loads data
Then   they are sent to the login page with "Your session expired, please log in again", and come back to the same page afterwards
Auto:  ✅ e2e: AD-03 expired session

### AD-04 · Logout
When   the admin clicks "Log out"
Then   they are on the login page, and the back button does not show admin data again
Auto:  ✅ e2e: AD-04 logout ends the session

## Layout

### AD-10 · Sidebar with the admin's sections
When   the admin is logged in
Then   a sidebar shows the sections that exist so far (later slices add more: Products, Inventory, Orders, Returns, Discounts, Settings), the current section highlighted, and the admin's email with "Log out" at the bottom
Auto:  ✅ e2e: AD-10 / AD-12 sidebar and dashboard

### AD-11 · Works on a phone
When   the admin opens the admin on a phone
Then   the sidebar becomes a menu button; every page is usable without zooming
Auto:  ✅ e2e: AD-11 on a phone

### AD-12 · Dashboard
When   the admin logs in
Then   the dashboard greets them and shows what needs attention: orders New / Confirmed / Packed (each opens the orders list), refunds needed, returns to receive and to refund, low stock (2 or fewer available, published products only) and the latest orders
Auto:  ✅ e2e: AD-10 / AD-12 sidebar and dashboard · ✅ AD-12 dashboard shows what needs attention (new orders +1, latest orders, low stock → Stock page filtered)

### AD-13 · Long text never hides the buttons
Given  an attribute named "Suprafață extrem de lungă …" (100+ characters) with long option names
When   the admin opens a list
Then   the text wraps inside its column; Edit and Delete stay visible without scrolling sideways
Auto:  ✅ e2e: AD-13 long text (buttons on screen, no sideways scroll)

### AD-14 · Every dropdown can be searched
When   the admin opens any dropdown (product type, category, location, …)
Then   a search box at the top filters the list as they type; picking works with mouse or keyboard
Auto:  ✅ e2e: AD-14 dropdowns (search, keyboard, nothing found)

## Errors

### AD-20 · Validation errors appear next to the field
When   the backend refuses a form with field errors (e.g. `name: Text in the default language (ro) is required.`)
Then   each message is shown under its field, and the form keeps everything that was typed
Auto:  ✅ e2e: AD-01 / AD-20 invalid input (client-side); server field errors use the same display — exercised by the first forms in A2

### AD-21 · Other errors appear as a message, never as a blank page
When   the backend refuses an action (e.g. "Category has products and cannot be deleted") or is not reachable
Then   a short message appears at the top; the page stays usable
Auto:  ⚠️ gap — wired (toast for API errors, "server cannot be reached"); exercised with the first screens that change data (A2)

### AD-22 · Saving shows that it worked
When   the admin saves anything successfully
Then   a short confirmation appears ("Saved")
Auto:  ⚠️ gap — wired ("Saved" toast); exercised with the first forms (A2)

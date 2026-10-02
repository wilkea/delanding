# Depad design reference

Captured on 2026-10-02 from the current Shopify shop (`depad.md`, theme **Horizon 4.1.3**, password-protected preview) — values read from the live page code, not estimated from pictures. Screenshots in [`screens/`](screens). This is the reference for the new storefront until the Figma file adds more.

## Design tokens

### Colors

| Token | Value | Used for |
|---|---|---|
| `background` | `#FFFFFF` | page |
| `foreground` | `#000000` | text, borders, dark buttons |
| `accent` | `#984AFE` | primary buttons, sale badge, quantity border, input focus, section accent bar, newsletter title |
| `accent-hover` | `#A663FE` | hover of accent outlines |
| `dark-button-hover` | `#262626` | hover of black buttons |
| `muted-text` | `rgb(0 0 0 / 0.6)` (approx.) | descriptions, strikethrough prices |
| `surface` | very light grey (≈ `#F6F6F6`) | feature cards, FAQ rows |
| `surface-strong` | light grey (≈ `#E5E5E5`) | contact form panel |
| `input-text` | `#333333` | form text |

### Typography

| Role | Font | Size / line | Weight | Notes |
|---|---|---|---|---|
| Body | **Kanit** | 16 / 25.6 | 400 | everything by default |
| Section title | Kanit | 24 / 31.2 | 500 | "Mousepaduri", with a purple bar on the left |
| Large title | Kanit | ≈ 36–40 | 400–500 | "De ce să alegi depad?", "Întrebări frecvente" |
| Hero title | Kanit | 40 | 700 | **UPPERCASE**, white on image |
| Product title (page) | Kanit | ≈ 32 | 700–800 | |
| Feature heading | Kanit | ≈ 24 | 800 | between two purple lines ("— Waterproof —") |
| Buttons / UI | **Inter** | 14–16 | 400 / 700 | add to cart, buy now, contact submit |
| Badge | Kanit | 12 | 400 | "Reducere" |

Fonts loaded: Kanit 100–900 (normal + italic), Inter 400/700. Both are free on Google Fonts.

### Shape and spacing

| Token | Value |
|---|---|
| Radius — buttons, cards, gallery, hero cards | **10px** |
| Radius — inputs | 4px |
| Radius — pill labels ("OWN YOUR SETUP", "FAQ") | fully rounded |
| Header height | 60px |
| Page width | normal 120rem, narrow 90rem |
| Hover | lift 4px, scale 1.03, 0.25s ease-out |
| Shadow (popover) | `0 4px 20px rgb(0 0 0 / 0.15)` |

### Brand elements

- **Logo** "depad" — custom lettering, the "p" as a map pin / mark.
- **Watermark** — a very large, light-grey Depad mark behind the page content on every page.
- **Pad corner mark** — the small "p" mark in the corner of every mousepad image.

## Global layout

**Header** — desktop: logo left · menu centre ("Mousepaduri", "Contacte") · search, account, cart right. Mobile: menu + search left · logo centre · account + cart right.

**Cart** — slide-in drawer from the right ("Coșul tău de cumpărături este gol", "Continuați cumpărăturile").

**Footer** — newsletter row ("Fii la curent cu ofertele noastre" in purple + e-mail field with a purple arrow button) · columns *Categorii* (Mousepad, Keyboard, Mouse, Stripes) and *Contacte* (068 60 50 12, depad.info@gmail.com, Chișinău, Moldova) · bottom bar: © 2026 DEPAD, "Termeni și politici" (privacy, refunds, shipping, terms), Facebook / Instagram / TikTok icons.

## Homepage — sections in order

| # | Section | Content | Becomes block kind |
|---|---|---|---|
| 1 | **Hero carousel** | cards side by side (3 visible on desktop, swipe on mobile): image, UPPERCASE title, purple button with arrow + link | **Hero carousel** (n slides) |
| 2 | **Product row** | purple bar + "Mousepaduri", "Vezi tot →" link, horizontal row of product cards (image, name, price, old price struck through, "Reducere" badge) | **Product row** |
| 3 | **Why Depad** | pill "OWN YOUR SETUP", title, text left; 2×2 feature cards right (icon, title, text) | **Features** (title, text, 2–6 items with icon) |
| 4 | **Featured product** | gallery with dots, name, prices, quantity, "Adaugă în coș", "Cumpără acum" | **Featured product** |
| 5 | **FAQ** | pill "FAQ", title, intro left; accordion right | **FAQ** (questions + answers) |
| 6 | **Contact** | photo with a floating card (email, location, phone) + form (name, email, phone, message, "TRIMITE") | **Contact** (photo + form; contacts from store settings) |
| — | Newsletter + footer | global, not a homepage block | store settings |

### Homepage texts (current, Romanian)

**Hero slides**
1. "Noua colecție Stripes este acum disponibilă" — *Vezi colecția* → `/collections`
2. "Livrare gratuită pentru comenzile de peste 300 MDL" — *Vezi produsele* → `/collections/all`
3. "Reducere de 25% la modelul Stripes Onyx" — *Comandă acum* → `/products/mousepad-stripes-negru`
4. (repeat of 1) — *Vezi colecția* → `/pages/mousepads`

**Why Depad** — "De ce să alegi depad?" / "Transformăm modul în care arată și se simte setup-ul tău prin design, precizie și stil modern."
- *Livrare rapidă* — Expediem comenzile prin Nova Post, cu livrare în 1-2 zile lucrătoare.
- *Plăți securizate* — Folosim platforme de plată verificate, pentru cumpărături în siguranță.
- *Suport clienți* — Oferim suport de luni până vineri între orele 09:00-18:00.
- *Livrare gratuită* — Livrare gratuită pe tot teritoriul Republicii Moldova.

**FAQ** — "Întrebări frecvente" / "Tot ce trebuie să știi despre produsele noastre, livrare și cum garantăm calitatea fiecărui produs."
- *În cât timp ajunge comanda mea?* — Livrările se fac prin Nova Post în 24-48 ore lucrătoare in toată Moldova.
- *Cum pot plăti?* — Poți plăti ramburs la livrare sau online cu cardul bancar.
- *Ce dimensiuni au mousepadurile?* — Toate mousepadurile vin cu mărimi de 80 cm lungime si 40 cm lățime, cu o grosime de 3 mm.
- *Marginile mousepadurilor sunt cusute?* — Da, toate marginile sunt cusute cu fir rezistent pentru o durabilitate crescută.
- *Mousepadurile sunt waterproof?* — Da, mousepadurile noastre au un strat hidrofob care respinge lichidele … evită detergenții agresivi și perii dure.

**Contact** — Email depad.info@gmail.com · Locație Chișinău, Moldova · Contact +373 68 605 012.

## Product page

- **Desktop:** gallery left (rounded, 10px), info right. **Mobile:** gallery on top.
- Title (large, bold) · price + old price struck through · divider.
- Quantity stepper (purple border) + **Adaugă în coș** (purple, cart icon) · **Cumpără acum** (black, full width).
- Description paragraph (centered).
- **Feature sections** with a heading between two purple lines: *Waterproof*, *Design*, *Dimensiuni*, *Calitate* — each a short text + an image, alternating sides.
- **"S-ar putea să-ți placă!"** — related products row.

## Catalog page (`/collections/all`)

- Filters: **Price**, **Color** · "14 articole" · **Sortează**.
- Grid: 5 columns desktop; card = image (10px radius, pad corner mark), name, price, old price, "Reducere" badge top-right.
- 14 products: Blue Horizon, Canvas, City Lights, Motel Drive, Overland, Sakura, and **Stripes** in Azure, Evergreen, Frost, Onyx, Quartz, Solar, Space Gray, Twilight.

## Findings that affect the backend or decisions

1. **Stripes are 8 separate products** (one per color). This is the parked **Collections / series** question — decide before building catalog pages: a *Stripes* collection of 8 products, or **one product "Stripes" with a color variant** (one page, color picker, one stock list).
2. **Product feature sections** (Waterproof / Design / Dimensiuni / Calitate) repeat on every mousepad → better stored once per **product type** (or collection) than per product.
3. **Contact form** and **newsletter** need backend features that do not exist yet: storing contact messages (and notifying the admin) and newsletter sign-ups.
4. **Content mismatch to fix:** hero says *free delivery over 300 MDL*, "Why Depad" says *free delivery everywhere*; the new backend's placeholder is *free from 400 MDL*. One rule must be chosen.
5. **Sale display:** Shopify shows "Preț obișnuit" (old price) struck through — matches our automatic-discount model (Sales offer).
6. FAQ promises **card payment** — needs maib (Phase 4) before launch, or the text changes.
7. Footer categories list **Keyboard** and **Mouse** — categories exist in navigation before products do.

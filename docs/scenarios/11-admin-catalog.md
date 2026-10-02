# AC — Admin: catalog, products, photos

**Status: approved. A2a built; A2b and A2c next.** Built in three steps: **A2a** setup, **A2b** products, **A2c** photos. Business rules are the backend's (`deserver/docs/scenarios/02-catalog.md` C-xx, `07-media.md` M-xx); these scenarios cover what the screens do.

Everywhere: texts that customers see have **RO | RU** tabs; RO is required and marked. Slugs and codes are filled in automatically from the Romanian name and can be edited.

When a save is refused, the dialog stays open and a red **"Not saved: N problems"** box above Save lists every reason from the backend (e.g. "Attributes: Variant attributes cannot change while products of this type exist.", "URL slug: This value is already used."); the fields it names are also marked. No refusal is ever silent. *(e2e: AC-03, AC-04 variants with products, AC-06 duplicate slug)*

## A2a — Catalog setup

### AC-01 · Attribute library
When   the admin opens **Catalog → Attributes**
Then   all attributes are listed (code, RO name, type, unit, filterable, options) with a search box that also finds Russian names
Auto:  ✅ e2e: AC-01 attribute library

### AC-02 · Creating an attribute in a dialog
When   the admin clicks "New attribute", types RO "Suprafață" / RU "Поверхность", chooses type **Option** and adds options Speed and Control
Then   the code `suprafata` is suggested, options get codes `speed` / `control`, and after saving the attribute appears in the list
And    for type Number a **unit** field appears; for Text/Number/Yes-No no options editor is shown
Auto:  ✅ e2e: AC-02 creating an attribute

### AC-03 · Editing options safely
Given  option Speed is used by products
When   the admin removes it and saves
Then   the backend's message appears ("Option 'speed' is used by products…") and nothing is lost; renaming its label is always allowed
And    a saved option's code is locked (products refer to it); only new options get a suggested code
Auto:  ✅ e2e: AC-03 removing a used option

### AC-04 · Product types
When   the admin creates type **Mousepad** and picks attributes from the library: Size (**variant**), Surface (**required**), Thickness
Then   the type shows them in the chosen order; only Option attributes can be switched to "variant"
Auto:  ✅ e2e: AC-04 product type

### AC-05 · Categories as a tree
When   the admin opens **Catalog → Categories**
Then   categories are shown as a tree (Periferice → Mousepad-uri); the admin can add a child, rename, change order, switch active, delete (refused with the backend's message if it has children or products)
Auto:  ✅ e2e: AC-05 categories (tree, add child, hide, delete refused with children, delete empty) · order and rename are the same edit dialog, not separately tested

### AC-06 · Brands
When   the admin adds brand "Depad"
Then   it appears in the list with slug `depad`; deleting a brand with products shows the backend's message
Auto:  ✅ e2e: AC-06 brands

## A2b — Products

### AC-10 · Product list
When   the admin opens **Products**
Then   products are listed with main photo, name, status (Draft / Active / Archived), type, category, number of variants and lowest price; the admin can search by name or SKU, filter by status, category and type, and page through
Auto:  🔜

### AC-11 · Creating a product starts from its type
When   the admin clicks "New product" and chooses type **Mousepad**
Then   the editor shows the type's attributes as fields (Surface as a choice, Thickness as a number with "mm"), required ones marked, and a **variants table** with one column per variant attribute (Size)
Auto:  🔜

### AC-12 · Variants table
When   the admin clicks "Add all sizes"
Then   one row per size option is created (M, XL), each with SKU (suggested from slug + size, e.g. `DEPAD-SHADOW-XL`), price, weight, dimensions and active switch; rows can be removed one by one
Auto:  🔜

### AC-13 · Extra attributes from the library, or new ones on the spot
When   the admin clicks "+ Attribute" in the editor
Then   a small dialog searches the library; picking one adds its field to this product
When   it does not exist yet, "Create new" opens the attribute dialog from AC-02; after saving it is added to the library **and** to this product
Auto:  🔜

### AC-14 · Custom attributes for one product
When   the admin adds a custom attribute RO "Colaborare: Ediție limitată" / RU "Коллаборация: Лимитированная серия"
Then   it is saved on this product only (shown on the product page, not a filter)
Auto:  🔜

### AC-15 · Saving shows every problem at once
When   the admin saves a product with an invalid option, two variants with the same size and an empty SKU
Then   each message appears at its field or table cell, the form keeps everything typed, and a summary at the top says how many problems there are
Auto:  🔜

### AC-16 · Publishing
Given  a saved draft
When   the admin clicks **Publish**
Then   it becomes Active — or, if something is missing (required attribute, price, weight, **photo**), the list of what is missing is shown and it stays a draft
And    **Unpublish** sets it back to Draft; **Archive** hides it for good; **Delete** is offered only for drafts
Auto:  🔜

### AC-17 · Leaving with unsaved changes
Given  the admin changed something and did not save
When   they click another section or close the tab
Then   they are asked "Leave without saving?"
Auto:  🔜

## A2c — Photos

### AC-20 · Image library
When   the admin opens **Media**
Then   uploaded images are shown as a grid with name, size and "used by"; the admin can search, upload several files at once by dragging them in, and delete unused ones (used ones show where they are used)
Auto:  🔜

### AC-21 · Adding photos to a product
When   in the product editor the admin drags in new photos or picks existing ones from the library
Then   they appear as thumbnails in order; the first is marked **Main**; they can be reordered by dragging, removed, given RO/RU alt text and linked to one variant
Auto:  🔜

### AC-22 · Crop editor
When   the admin clicks **Crop** on a product photo
Then   a dialog shows the image with a frame they can move and resize, ratio presets (Free, 1:1, 4:3, 16:9), rotate left/right, and a click sets the **focal point**; a preview shows the result
And    saving changes only this use of the image (M-15/M-16); "Reset" goes back to the whole image
Auto:  🔜

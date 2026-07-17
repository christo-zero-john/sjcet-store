---
meta:
  contentType: Reference
  title: Verify the product-first store-manager experience
  navLabel: Product-first UI acceptance
  category: Testing
---

# Verify the product-first store-manager experience

This reference converts approved store-manager user experience decisions into repeatable acceptance tests. Designers, developers, reviewers, and agents must use it to verify that implementation stays product-first and does not expose catalog internals during routine work.

## Test plan

- **Goal**: verify that a store manager can manage products and stock without learning the underlying database model
- **Audience**: store-manager module developers, reviewers, and browser-test authors
- **Coverage**: navigation, product grouping, variant inventory, inline category creation, reusable parameters, and reference-safe removal
- **Authority**: approved decisions in this document override older screen layouts that expose categories or variants as the starting point
- **Open questions**: add approved decisions to this document before implementation

## Product-first navigation

These tests verify that products remain the primary object throughout the manager interface.

### SM-UX-001: Open Products after login

**Given** an authenticated `store_manager` or `super_admin`

**When** the account opens `/store-manager`

**Then** the application opens or redirects to `/store-manager/products`

**And** it does not show a separate overview dashboard

### SM-UX-002: Keep daily operations visible

**Given** any store-manager page

**Then** the primary sidebar contains these daily destinations:

- **Products**
- **Inventory**
- **Orders**
- **Payments**
- **Counter Sale**

**And** the sidebar also contains **Catalog Settings** as a separate maintenance destination

### SM-UX-003: Show product groups on Products

**Given** a product with multiple sellable variants

**When** the manager views **Products**

**Then** the list shows one row for the product group

**And** the row displays its variant count and combined stock status

**And** the manager can expand or open the product to see its variants

### SM-UX-004: Keep the primary action visible

**Given** the manager is on **Products**

**Then** **Add Product** is the primary page action

**And** search is visible without opening another panel

**And** low-stock and out-of-stock filters remain available without replacing the product list

## Variant and inventory behavior

These tests verify that each sellable variant remains independent while retaining product-group context.

### SM-UX-005: Show variants as inventory rows

**Given** a product with multiple variants

**When** the manager views **Inventory**

**Then** each variant appears as an individual row

**And** each row shows its product name, option values, stock keeping unit (SKU), price, stock, and status

### SM-UX-006: Preserve sibling context on variant details

**Given** the manager opens one variant from **Inventory**

**Then** the page shows the parent product name and category

**And** a compact side panel lists the product’s other variants

**And** each sibling entry shows its option values, SKU, stock, and status

**And** the selected variant is visually distinct

**And** selecting a sibling opens that variant without returning to the inventory list

### SM-UX-007: Let managers create variants explicitly

**Given** a product supports multiple sellable variants

**When** the manager adds variants

**Then** the application does not generate variant combinations automatically

**And** the manager creates each variant explicitly

**And** each variant has its own option values, SKU, price, opening stock, low-stock threshold, and status

### SM-UX-008: Support grouped variant editing

**Given** a product has multiple variants

**When** the manager selects **Edit All Variants**

**Then** the application shows the variants in one grouped editor

**And** the manager can edit each row independently

**And** the manager can select multiple rows for supported bulk changes

## Inline category creation

These tests verify that category setup supports product entry instead of interrupting it.

### SM-UX-009: Choose or create a category from the product form

**Given** the manager is adding or editing a product

**Then** the category field appears as a standard dropdown

**And** the final dropdown action is **Add New Category**

### SM-UX-010: Preserve product input while creating a category

**Given** the manager has entered product information

**When** the manager selects **Add New Category**

**Then** a side panel opens without leaving the product form

**And** the product form retains every entered value

**When** the manager saves the category

**Then** the panel closes

**And** the product form automatically selects the new category

### SM-UX-011: Keep all category configuration in one panel

**Given** the manager opens the category creation panel

**Then** the panel contains:

- Category name
- Optional parent category
- Description
- Product parameters
- **Add Parameter**

**And** the manager does not need to visit another page to finish creating the category

### SM-UX-012: Reuse or create parameters inline

**Given** the manager selects **Add Parameter**

**Then** a searchable chooser lists existing reusable parameters

**And** the chooser offers **Create New Parameter**

**When** the manager creates a parameter

**Then** the same panel captures the parameter name, allowed values, required state, variant-defining state, and display order

### SM-UX-013: Keep variants owned by products

**Given** a category defines parameters such as Size or Color

**Then** the category owns only the reusable parameter configuration and allowed values

**And** the category does not own sellable variants

**When** a manager creates a product variant

**Then** that variant selects allowed category values and remains owned by the product

## Reference-safe parameter removal

These tests verify that managers cannot break existing products by changing category configuration.

### SM-UX-014: Disable removal when a parameter value is used

**Given** at least one product variant uses Size = S

**When** the manager edits the category’s Size parameter

**Then** the **Remove S** control is disabled

**And** the interface explains that product variants use the value

**And** the interface shows the number of referencing variants

**And** **View Products** opens the affected products

### SM-UX-015: Reject bypassed removal

**Given** at least one product variant references a parameter, allowed value, or category configuration

**When** any client attempts to remove that referenced data

**Then** the database rejects the operation

**And** existing product and variant data remains unchanged

### SM-UX-016: Allow removal after references are cleared

**Given** no product variant references a parameter or allowed value

**When** the manager selects **Remove**

**Then** the application allows removal after destructive-action confirmation

### SM-UX-017: Do not expose an archive state for parameters

**Given** the manager edits a category parameter or allowed value

**Then** the interface does not offer archive, hide, or unavailable-for-new-products states

**And** it offers removal only when no product references the data

## Product and variant images

These tests verify that images remain organized at the product level while allowing a sellable variant to show its own image.

### SM-UX-018: Manage product images as one gallery

**Given** the manager is adding or editing a product

**Then** the product form provides one primary image position

**And** the manager can add optional additional product images

**And** the product and all its variants share this product gallery

### SM-UX-019: Optionally assign an image to a variant

**Given** a product has multiple sellable variants

**When** the manager adds or edits a variant

**Then** assigning a variant-specific image is optional

**And** a variant with its own image displays that image in variant-specific inventory and product views

**And** a variant without its own image falls back to the product's primary image

## SKU entry

These tests verify that managers retain control over variant SKUs without having to construct every value manually.

### SM-UX-020: Enter or generate an editable SKU

**Given** the manager is adding or editing a sellable variant

**Then** the SKU field accepts a manually entered value

**And** the form provides an optional **Generate SKU** action

**When** the manager selects **Generate SKU**

**Then** the application suggests a unique SKU based on the available product and variant information

**And** the suggested SKU remains editable before the variant is saved

**And** saving is rejected with field-level feedback if the final SKU is already in use

## Products without options

These tests verify that the interface does not expose variant terminology when a product has only one sellable form.

### SM-UX-021: Present a single product without variant complexity

**Given** the manager creates a product without variant-defining options

**Then** the product form shows ordinary **Price**, **SKU**, **Stock**, and **Low-stock alert** fields

**And** the form does not require the manager to open or understand a variant editor

**When** the manager saves the product

**Then** the application creates the product and one default sellable variant

**And** inventory treats that default variant as the product's stock record

**And** the manager-facing interface continues to describe it as a product unless variant context is required

### SM-UX-022: Add an option without creating variants

**Given** a product already has one or more sellable variants

**When** the manager adds another product option

**Then** the application does not create, replace, split, or duplicate any variant

**And** every existing variant keeps its SKU, price, stock, low-stock threshold, status, and movement history

**And** the manager may assign one default value for the new option to existing variants

**And** applying a default updates the selected existing variants without creating new variants

**And** existing variants remain valid with a null value when the manager does not assign a default

### SM-UX-023: Require a newly added option on future variants

**Given** a manager adds a required option to a product that already has sellable variants

**And** the manager leaves that option null on one or more existing variants

**Then** those existing variants remain valid and retain their current data

**When** the manager creates a new variant after the required option was added

**Then** the new variant cannot be saved without selecting an allowed value for that option

**And** editing an existing grandfathered variant does not force the manager to fill the null option unless the manager is changing that option

## Focused product form

These tests verify that product entry remains one focused task and reveals optional controls only when the manager needs them.

### SM-UX-024: Add a product on one focused page

**Given** the manager opens **Add Product**

**Then** the application uses one page rather than a multi-step wizard

**And** the initial form emphasizes product name, category, description, primary image, price, SKU, stock, and low-stock alert

**And** optional additional images do not compete with the essential fields

**And** variant controls remain hidden until the manager chooses to add variants

**And** catalog configuration internals do not appear in the initial product form

**When** the manager chooses to add variants

**Then** the grouped variant editor appears within the same product workflow

**And** the application still requires the manager to create each sellable variant explicitly

## Stock adjustment

These tests verify that managers can set a higher intended stock count while the inventory module preserves an attributable adjustment history.

### SM-UX-025: Add stock from a synchronized input and slider

**Given** the manager opens **Add Stock** from Inventory or a product detail page

**Then** a focused panel shows the current stock count

**And** the panel provides an integer **New stock count** input whose minimum is the current stock count

**And** the panel provides a stock-count slider synchronized with that input

**And** the slider minimum is the current stock count

**When** the manager changes the input

**Then** the slider updates to the same stock count

**When** the manager changes the slider

**Then** the input updates to the same stock count

**And** neither control permits a value below the current stock count

**And** the panel previews the calculated stock increase

**And** the manager must enter a reason before confirming

**When** the manager confirms the adjustment

**Then** the inventory operation calculates the delta from the latest locked stock count

**And** the database records the quantity before, delta, quantity after, actor, reason, and time

**And** application code does not directly overwrite the stored current-stock value

### SM-UX-026: Record a stock reduction separately

**Given** stock must be reduced because it is damaged, missing, or incorrectly counted

**When** the manager opens **Record Stock Reduction**

**Then** the application opens a separate focused panel without a slider

**And** the manager enters a positive integer quantity to remove

**And** the panel shows the current stock and resulting stock

**And** the manager must enter a reason

**And** the manager must confirm the reduction before it is saved

**And** the application rejects a quantity greater than the latest available stock

**When** the manager confirms the reduction

**Then** the inventory operation applies a negative delta against the latest locked stock count

**And** the database records the quantity before, delta, quantity after, actor, reason, and time

**And** retries cannot apply the same reduction more than once

## Review checklist

Use this checklist before accepting the product-first manager interface:

- [ ] `/store-manager` opens **Products**
- [ ] **Products** shows product groups, not one top-level row per variant
- [ ] **Inventory** shows one row per sellable variant
- [ ] Variant details keep sibling variants visible
- [ ] Managers create variants explicitly
- [ ] Grouped variant editing supports individual and bulk changes
- [ ] Product forms use a category dropdown
- [ ] **Add New Category** opens an inline side panel
- [ ] Saving a category preserves product input and selects the category
- [ ] The category panel contains all category configuration
- [ ] **Add Parameter** supports reuse and inline creation
- [ ] Categories define allowed options but never own variants
- [ ] Referenced parameters and values cannot be removed
- [ ] The database rejects attempted removal of referenced data
- [ ] Parameter and value archive states do not exist
- [ ] Products support one primary image and optional additional images
- [ ] Variants can optionally use their own image
- [ ] Variants without their own image use the product's primary image
- [ ] Variant SKUs support manual entry and optional editable generation
- [ ] Duplicate SKUs are rejected with field-level feedback
- [ ] Products without options show direct price, SKU, stock, and low-stock fields
- [ ] Saving a product without options creates one default sellable variant
- [ ] Adding an option never creates or replaces variants
- [ ] Existing variants can receive a default option value or retain a null value
- [ ] Adding an option preserves existing SKU, price, stock, and movement history
- [ ] Required options may remain null only on variants that existed before the option was added
- [ ] Variants created after a required option was added must select an allowed value
- [ ] **Add Product** uses one focused page rather than a wizard
- [ ] Essential product and selling fields appear before optional controls
- [ ] Additional images and variant controls appear only when needed
- [ ] The focused product form does not expose catalog configuration internals
- [ ] **Add Stock** is available from Inventory and product details
- [ ] New stock input and slider remain synchronized
- [ ] Neither the input nor slider permits a value below current stock
- [ ] The panel previews the calculated stock increase
- [ ] Every adjustment requires a reason and creates an inventory movement
- [ ] Stock changes use the inventory operation rather than direct field updates
- [ ] **Record Stock Reduction** is separate from **Add Stock**
- [ ] Stock reduction uses a quantity input and never a slider
- [ ] Stock reduction previews the resulting count and requires confirmation
- [ ] Stock reduction rejects negative stock and duplicate application

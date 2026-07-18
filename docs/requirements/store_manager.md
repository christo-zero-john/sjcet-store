# Store Manager Requirements

## 1. Purpose

The store-manager module supports counter sales, inventory maintenance, payment
collection, billing, and order history for the college store. It uses the shared
authentication, authorization, database, audit, and payment foundations defined
in `docs/architecture/project-foundation.md`.

## 2. Roles and access

- A `store_manager` may manage the category hierarchy, attribute configuration,
  products, variants, stock, counter orders, payments, and store orders.
- A `super_admin` may perform every store-manager action.
- Students cannot access manager routes or mutate store inventory.
- Every manager action must be attributed to the authenticated user.
- Catalog visibility is not restricted by department, faculty, student, or
  staff audience. Department-related items are ordinary catalog items visible
  to every store customer.

## 3. Counter-sale flow

1. A student requests products at the physical store.
2. The manager searches or browses active, in-stock products.
3. The manager adds products and quantities to a basket.
4. The system validates current stock and calculates each line total and the
   final total on the server.
5. The manager may physically tick items as collected. This is a UI aid and
   does not change inventory.
6. The manager chooses exactly one payment method: `cash` or `online`.
7. The system creates an order containing immutable product-name, unit-price,
   quantity, and line-total snapshots.
8. The selected payment flow is completed:
   - Cash: enter the amount tendered, show the change due, and confirm receipt.
   - Online: create a Dodo Payments checkout session for the exact order total.
9. After successful payment confirmation, the order becomes `paid`, stock is
   deducted atomically, and the bill can be printed.
10. If payment is cancelled or fails, the order remains unpaid and stock is not
    deducted.

## 4. Inventory management

### 4.1 Dynamic categories

- Managers create, rename, move, reorder, and archive categories through the
  store-manager interface.
- Category names are data, not database enums or hardcoded application lists.
- The hierarchy supports root categories and one optional subcategory level.
  A subcategory cannot contain another category.
- A product belongs to exactly one active category.
- Archiving a category is rejected while active products or active
  subcategories still reference it.
- Moving a category must reject cycles and any result deeper than two levels.

### 4.2 Dynamic attributes

- Managers create reusable attribute types such as Size, Color, Material, or
  Brand through the interface. These names are examples only and are never
  seeded as fixed schema values.
- Managers create allowed values for each attribute type.
- A category configuration selects its applicable attributes and declares
  whether each attribute is required, defines a sellable variant, and where it
  appears on the product form.
- A subcategory inherits its parent category attributes. It may add attributes
  or override the inherited `required`, `variant-defining`, and display-order
  settings without changing the parent.
- The product form loads its fields from the selected category configuration.
  The server validates the same resolved configuration.
- An attribute value belongs to one attribute type and cannot be selected for a
  different type.
- Attribute types, values, and category configuration cannot be removed while
  products or variants reference them. The interface disables removal, shows
  the reference count, and links to affected products.
- Unreferenced attribute types, values, and category configuration may be
  deleted after confirmation. They do not use archive, hidden, or
  unavailable-for-new-products states.

### 4.3 Products and variants

- A product stores shared family information: category, name, optional brand,
  description, product specifications, product gallery, active/archived state,
  and audit fields.
- A product has one or more sellable variants. Each variant stores a unique
  SKU, optional globally unique barcode, selling price, current stock,
  low-stock threshold, optional image, and active state.
- The product entry form selects a parent category and optional subcategory
  separately. It can create either level inline without losing the product
  draft, and creating a subcategory can create its missing parent inline.
- Managers add variants explicitly. The application never generates the
  Cartesian product of option values.
- Each new variant selects one value for every required variant-defining
  attribute. The selected variant-defining combination must be unique within
  the product.
- Adding a required attribute to a product never creates, replaces, or splits
  existing variants. The manager may bulk-assign one default value; otherwise,
  variants that existed before the attribute was added may retain a null value.
  Variants created afterward must select an allowed value.
- Non-variant attributes may be stored once for the product when configured by
  its category.
- Edit product details without changing historical order-line snapshots.
- Archive products instead of hard-deleting products referenced by orders.
- List, search, filter, and sort products and variants.
- Display out-of-stock and low-stock indicators per variant.

### 4.4 Stock

- Add, remove, or correct stock for one variant through explicit stock
  adjustments.
- Require a reason for every adjustment.
- Store the quantity before, delta, quantity after, actor, reason, and time.
- Reject adjustments that would make stock negative.
- Deduct variant stock only once when an order is successfully paid.
- Provide a dedicated inventory view with search, stock-state filters, sorting,
  active-variant totals, low-stock totals, and out-of-stock totals.
- Show the immutable stock movement history for each product and variant.
- Reject manual stock changes for archived variants.

### 4.5 Inventory module boundary

- Catalog management owns categories, attributes, product families, variant
  definitions, prices, and archive/restore state.
- Inventory management owns current stock, low/out-of-stock classification,
  manual adjustments, and movement history.
- Product and variant removal is archive/restore, not destructive deletion.
- Order management may consume stock only through the inventory transaction
  contract. Payment management never writes product or stock data directly.
- The store-manager interface composes catalog, inventory, order, and payment
  capabilities while their business rules remain in their owning features.

## 5. Order management

- Create a counter order from a manager basket.
- View paginated order history with search and filters for date, payment method,
  payment state, and order state.
- View order details, line snapshots, payment details, and the activity trail.
- Print a bill for a paid order.
- Never silently edit a paid order. Refunds, returns, and voids are separate
  audited operations and are outside the first MVP.

## 6. Cash payments

- Accept whole-paise integer values; the UI displays Indian rupees.
- Require `cash_received >= order_total`.
- Calculate `change_due = cash_received - order_total` on both client and server.
- Mark the order paid only after the manager explicitly confirms cash receipt.
- Store cash received and change due on the payment record.

## 7. Online payments

- Use Dodo Payments Checkout Sessions with one reusable, one-time
  Pay-What-You-Want product configured in the Dodo dashboard.
- The server supplies the checkout amount in paise. The amount equals the
  server-calculated order total and is fixed for that checkout.
- The browser must never supply or override the payable amount.
- Store the Dodo checkout-session ID, checkout URL, and eventual payment ID.
- Include the internal order ID in Dodo metadata for reconciliation.
- Treat redirects as user experience only. A verified `payment.succeeded`
  webhook is authoritative for marking an order paid.
- Verify webhook signatures and process webhook events idempotently.
- Reject a success event if its currency or amount does not match the order.
- Do not allow partial payments or discount entry in the hosted checkout.

## 8. Order and payment states

### Order states

`draft -> awaiting_payment -> paid -> fulfilled`

Terminal exception states: `cancelled`, `voided`.

### Payment states

`pending -> processing -> succeeded`

Terminal exception states: `failed`, `cancelled`.

The MVP uses `paid` and `fulfilled` together for counter delivery, but keeps
them separate in the model so later modules can support collection workflows.

## 9. Business rules

- Money is stored as integer paise; floating-point values are forbidden.
- Product prices and totals cannot be negative.
- An empty basket cannot become an order.
- Quantity must be a positive integer and cannot exceed available stock.
- Totals are always recalculated on the server from database prices.
- Category, attribute, and attribute-value names are managed data and cannot be
  represented by fixed catalog enums.
- Category depth cannot exceed two levels.
- A product has exactly one category and at least one sellable variant.
- Department or audience membership never controls catalog visibility.
- Paid orders and processed payment webhooks are immutable.
- Every stock and payment transition must be safe to retry.

## 10. Acceptance scenarios

1. Given sufficient stock, a manager can complete a cash sale and see the exact
   change due.
2. Given an online sale, the generated Dodo checkout uses the exact server
   order total and the order stays unpaid until a valid webhook arrives.
3. Replaying the same webhook does not deduct stock or record payment twice.
4. A stale basket with insufficient stock cannot be paid.
5. Editing a product after a sale does not alter the historical bill.
6. A student account receives an authorization error on all manager mutations.
7. A manager can create a category, define a required variant attribute and its
   values, then create independently priced and stocked variants.
8. A subcategory product form includes inherited parent attributes and local
   additions or overrides.
9. A manager cannot create a third category level, a category cycle, a variant
   with missing required values, or a duplicate variant combination.
10. A department-related product remains visible without department or audience
    checks.
11. A manager can edit a product and its variants, add independently priced
    variants, archive and restore them, and review every stock movement.
12. Inventory search and stock-state filters correctly distinguish healthy,
    low-stock, out-of-stock, and archived variants.

## 11. Store-manager user experience acceptance

The store-manager interface follows the product-first acceptance contract in
`docs/testing/store-manager-product-first-ui-acceptance.md`. Implementations and
reviews must verify every applicable `SM-UX-*` scenario in that document.

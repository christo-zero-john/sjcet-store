# Store & Students Module

## Module Overview

The **Store & Students Module** is the student-facing module of the Campus Store Management System. It allows students to purchase products available in the campus store through a streamlined and organized workflow. The module focuses on providing a simple purchasing experience while integrating seamlessly with Inventory Management, Order Management, Billing, and Payment modules.

This module begins when a student visits the campus store and ends when the purchase is successfully completed. It does **not** handle inventory administration or product management directly; instead, it consumes data provided by other modules such as Inventory Management and Payment Services.

---

# Module Objectives

- Provide students with a quick and efficient purchasing experience.
- Allow students to purchase multiple products in a single transaction.
- Support both **Cash** and **Online Payment** methods.
- Generate accurate bills for every purchase.
- Maintain complete order records.
- Ensure stock availability before confirming purchases.
- Reduce manual billing errors.
- Integrate seamlessly with inventory and payment systems.

---

# Functional Workflow

## 1. Student Arrival

The workflow starts when a student visits the campus store.

The student communicates the list of required products to the store operator.

Example:

- Notebook
- Pen
- Record Book
- Calculator
- Lab Coat

At this stage, no order has been created.

---

## 2. Product Discovery

The system allows products to be searched from the available inventory.

### Functionalities

- Search products by name
- Browse products by category
- View product availability
- View current stock
- View selling price
- View product image (optional)

### Expected Behaviour

Only products that are currently available for sale should be displayed.

Products with zero stock should appear as:

> Out of Stock

and cannot be added to the purchase.

---

## 3. Product Selection

Once the requested products are identified, they are added to the student's purchase basket.

Each selected product contains:

- Product ID
- Product Name
- Unit Price
- Quantity
- Available Stock
- Line Total

### Supported Actions

- Add product
- Remove product
- Increase quantity
- Decrease quantity
- Update quantity
- Prevent quantity exceeding available stock

Every modification should immediately update the basket totals.

---

## 4. Basket Summary

The basket represents the student's current purchase before billing.

### Basket Information

- Number of products
- Total quantity
- Individual product totals
- Grand total
- Estimated payable amount

The basket should continuously update whenever products or quantities change.

If the basket becomes empty, billing cannot continue.

---

## 5. Product Verification

Before generating the bill, each selected product may optionally be verified.

Purpose:

- Confirm correct product
- Confirm quantity
- Confirm packaging
- Reduce billing mistakes

This verification is optional and should not affect pricing.

---

## 6. Bill Preview

Before payment, the system displays a complete summary.

The student should be able to verify:

- Purchased products
- Quantity
- Unit price
- Individual totals
- Grand total
- Taxes (if applicable)
- Discounts (future support)

At this stage no payment has been processed.

---

# Payment Module

After confirming the purchase, the payment process begins.

The system supports two payment methods.

---

## Cash Payment

### Workflow

1. Student pays cash.
2. Operator enters amount received.
3. System validates entered amount.
4. System calculates remaining balance.

### Formula

```
Change = Amount Received − Order Total
```

### Example

Order Total

₹420

Money Received

₹500

System Calculates

₹80 Return Balance

### Validation

If

Money Received < Order Total

Display

> Insufficient Amount

The bill cannot be completed until sufficient money is received.

After successful payment

Payment Status

```
Paid
```

---

## Online Payment

### Workflow

1. Student selects Online Payment.
2. System generates secure payment link.
3. QR Code may also be generated.
4. Student completes payment.
5. System waits for confirmation.
6. Payment gateway returns success.
7. Order becomes Paid.

### Payment States

- Pending
- Processing
- Successful
- Failed
- Cancelled

Billing should only continue when payment status becomes **Successful**.

---

# Bill Generation

Once payment is successful, the system generates a digital invoice.

## Invoice Information

- Bill Number
- Order Number
- Date
- Time
- Purchased Products
- Product Quantity
- Unit Price
- Total Amount
- Payment Method
- Payment Status
- Transaction Reference (Online)
- Amount Received (Cash)
- Balance Returned (Cash)

The bill can be

- Printed
- Downloaded
- Shared digitally

---

# Order Creation

After successful billing, an order is permanently created.

Each order contains

- Unique Order ID
- Student Purchase Details
- Product List
- Total Amount
- Payment Method
- Payment Status
- Order Timestamp

The order is then available in the Order Management module.

---

# Module Integrations

## Inventory Module

Used for:

- Product retrieval
- Stock availability
- Stock validation
- Stock deduction after purchase

---

## Payment Module

Responsible for:

- Payment processing
- Payment verification
- Payment confirmation
- Payment status updates

---

## Billing Module

Responsible for:

- Bill generation
- Invoice creation
- Bill printing
- Digital receipts

---

## Order Module

Responsible for:

- Order creation
- Order history
- Transaction records
- Purchase tracking

---

# Validation Rules

The module should enforce the following validations:

- Product must exist.
- Product must be available.
- Requested quantity cannot exceed stock.
- Basket cannot be empty.
- Cash received cannot be less than payable amount.
- Online payment must be successful before billing.
- Every completed purchase must generate exactly one invoice.
- Every invoice must correspond to one valid order.

---

# Future Enhancements

The module has been designed to support future features without major architectural changes, including:

- Student login and purchase history
- Student loyalty points
- Coupon and promotional discounts
- Membership pricing
- QR code student identification
- Digital wallet payments
- UPI AutoPay support
- Product recommendations
- Wishlist and frequently purchased items
- Email/SMS receipt delivery
- Refund and return requests
- Purchase analytics

---

# Module Summary

The **Store & Students Module** serves as the complete student purchasing workflow within the Campus Store Management System. It enables students to select products, review purchases, complete payments through cash or online methods, receive digital invoices, and create permanent transaction records. By integrating with Inventory, Payment, Billing, and Order modules, it ensures accurate billing, secure payment processing, real-time stock validation, and a smooth end-to-end purchasing experience.

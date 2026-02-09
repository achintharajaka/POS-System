# Universal POS System (v3.0)

A fully functional, offline-capable Point of Sale system running entirely in the browser using HTML5, Tailwind CSS, Javascript, and Dexie.js (IndexedDB).

## Features
- **Dashboard**: View daily sales, total orders, low stock alerts, and **Recent Transaction History**.
- **POS Terminal**: Fast checkout with product search, barcode scanning, and printable receipts.
- **Inventory Management**: Add, edit, and delete products with stock tracking and **Categories**.
- **Settings**:
    - **General**: Store Name, Address, Logo.
    - **Financials (New)**: **Global Order Adjustments**. Add dynamic rules for **Taxes, Fees, Discounts, or Vouchers** that apply to every order automatically.
    - **Theme**: Light and Dark Mode.
    - **Data**: Backup and Restore.
- **Data Persistence**: All data is stored locally in your browser using IndexedDB.

## How to Run
1. **Download** the project folder.
2. **Open** `index.html` in any modern web browser.

## v3.0 Updates: Order Modifiers
- **Dynamic Taxes**: Replaced fixed tax rate with a flexible modifier system.
- **Discounts & Fees**: You can now add multiple automatic adjustments.
    - Example: `VAT (+10%)`, `Service Fee (+$2.00)`, `Holiday Discount (-5%)`.
- **Receipts**: Receipts now show a breakdown of all applied Taxes, Discounts, and Fees.

## How to Configure Modifiers
1. Go to **Settings**.
2. Look for **Global Order Adjustments**.
3. Use the inputs to create a new rule:
    - **Name**: e.g., "Promo Discount"
    - **Type**: `%` (Percentage) or `Fixed` (Amount)
    - **Action**: `Add (+)` or `Deduct (-)`
    - **Value**: The number (e.g., `5`)
4. Click **+** to add it.
5. It will now apply to all future orders in the POS.

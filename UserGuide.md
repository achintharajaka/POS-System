# POS System User Guide

Welcome to the Point of Sale (POS) System! This guide will help you understand how to use the system effectively to manage your inventory, make sales, and track your business performance.

## Table of Contents
1.  [Getting Started](#getting-started)
2.  [Inventory Management](#inventory-management)
3.  [Point of Sale (Making Sales)](#point-of-sale-making-sales)
4.  [Reports & Finances](#reports--finances)
5.  [Settings & Data](#settings--data)

---

## 1. Getting Started

When you open the application, you will see the **Dashboard**. This is your command center.
- **Top Cards:** Show you a quick summary of today's sales, total revenue, expenses, and low stock warnings.
- **Recent Transactions:** View your order history. Click **View** on any order to open its receipt in a popup window for review or printing. Click **Delete** to permanently remove an order record.
- **Navigation Menu:** On the left (or top on mobile), use this to switch between different views:
    - **Dashboard:** Overview.
    - **POS:** The checkout terminal.
    - **Inventory:** Manage products.
    - **Reports:** View financial details.
    - **Settings:** Configure store details.

---

## 2. Inventory Management

Before making sales, you need products!

### Adding a Product
1.  Go to the **Inventory** tab.
2.  Click the **+ Add Product** button.
3.  Fill in the details:
    - **Name:** Product name (e.g., "Latte").
    - **Barcode:** optional unique code. You can scan a real barcode here. *Note: The system will prevent you from adding duplicate barcodes.*
    - **Price:** Selling price.
    - **Cost Price:** How much it costs you to buy/make. Important for profit calculation!
    - **Stock:** Current quantity.
    - **Category:** Group items (Manage categories in settings).
    - **Product Image:** Upload a small image to help identify the item.
4.  Click **Save**.

### Managing Stock
- **Low Stock Filter:** If an item's stock drops below 5, it will be highlighted in Red. Click the **Low Stock Items** card on the Dashboard to filter the inventory view to only these items.
- **Editing:** Click "Edit" on any item to update its price, stock, or image.
- **Deleting:** Click "Delete" to remove an item permanently.

---

## 3. Point of Sale (Making Sales)

This is where you'll spend most of your time.

### Processing an Order
1.  **Add Items:** Click on product cards in the grid.
    - You can **Search** by name or **Filter** by category.
    - Clicking multiple times increases quantity.
2.  **Manage Cart:**
    - The right side shows the current order.
    - Use **+ / -** buttons to adjust quantity.
    - Click **X** to remove an item.
3.  **Checkout:**
    - Click **Pay Now**.
    - **Taxes & Discounts:** Any global adjustments (configured in Settings) will be applied automatically.
    - **Payment Method:** Click the icon button for **Cash**, **Card**, or **Online**. 
    - Click **Complete Order**.
4.  **Receipt:** A receipt will automatically generate for printing.
5.  **Review Past Orders:** Go to the **Dashboard** and click **View** next to any order in the Recent Transactions table to open its receipt in a popup window.

---

## 4. Reports & Finances

Track how your business is doing.

### Financial Overview
- **Charts:** View Revenue vs. Expenses over the last 7 days.
    - **Revenue (Blue):** Total sales + Extra Revenue.
    - **Expenses (Orange):** Cost of Goods Sold (COGS) + Manual Expenses.
- **Cards:**
    - **Total Revenue:** Gross income.
    - **Net Profit:** Revenue - (COGS + Expenses).

### Recording Extra Data
- **Record Expense:** Log bills like Rent, Electricity, or Wages.
- **Record Extra Revenue:** Log income not from sales, like Tips or Service Fees.

### History
- **Order Profit History:** See the profit margin on every single individual order.
- **Recent Extra Revenue:** See a log of manual income entries.

---

## 5. Settings & Data

- **Store Profile:** specific your Store Name, Address, and Currency Symbol.
- **Receipt Settings:** Customize what appears on the receipt (Logo, Header, Footer, QR Code URL).
- **Data Management:**
    - **Export Data:** Download a backup of your entire database. **Do this regularly!**
    - **Import Data:** Restore from a backup file.
    - **Clear Data:** WIPE everything. Use with caution.

---

## 6. Troubleshooting & Debugging

If you encounter any issues or the system behaves unexpectedly:

1.  **Direct Execution:** Note that this system runs directly from your files. Simply double-click `index.html` to start.
2.  **Debug Report:** The system automatically logs errors in the background. If you need to report a bug:
    - Open your browser's **Developer Console** (usually by pressing `F12` or `Ctrl+Shift+I`).
    - Go to the **Console** tab.
    - Type `Utils.downloadDebugReport()` and press **Enter**.
    - This will download a `debug_report.txt` file which you can share with support to help identify the problem.
3.  **WIP:** A dedicated button for downloading this report is being added to the Settings page in a future update.

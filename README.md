# Universal POS System

A fully functional, offline-capable Point of Sale system running entirely in the browser using HTML5, Tailwind CSS, Javascript, and Dexie.js (IndexedDB).

## Features
- **Dashboard**: View daily sales, total orders, low stock alerts, and **Recent Transaction History**.
- **POS Terminal**: Fast checkout with product search, barcode scanning, and printable receipts.
- **Inventory Management**: Add, edit, and delete products with stock tracking and **Categories**.
- **Settings**:
    - **General**: Store Name, Address, Logo, **Receipt Header/Footer Text**.
    - **Financials**: **Global Order Adjustments** (Taxes, Fees, Discounts).
    - **Theme**: Light and Dark Mode.
    - **Data**: Backup, Restore, and **Factory Reset**.
- **Data Persistence**: All data is stored locally in your browser using IndexedDB.

## How to Run
1. **Download** the project folder.
2. **Open** `index.html` in any modern web browser.

## v3.1 Enhancements
- **Factory Reset**: A new red button in Settings > Data Management allows you to wipe all data and reset the system to fresh install state.
- **Receipt Header**: Fixed an issue where the custom Receipt Header text wasn't appearing on printed receipts.
- **Full Data Export**: The Export JSON feature includes all your Inventory (Products, Stock, Categories) as well as Sales History and Settings.

## How to Configure Modifiers (v3)
1. Go to **Settings** -> **Global Order Adjustments**.
2. Add dynamic rules:
    - **Name**: e.g., "VAT"
    - **Type**: `%` or `Fixed`
    - **Action**: `Add` or `Deduct`
    - **Value**: e.g., `20`
3. These apply automatically to every sale.

# Universal POS System (v2.0)

A fully functional, offline-capable Point of Sale system running entirely in the browser using HTML5, Tailwind CSS, Javascript, and Dexie.js (IndexedDB).

## Features
- **Dashboard**: View daily sales, total orders, low stock alerts, and **Recent Transaction History**.
- **POS Terminal**: Fast checkout with product search, barcode scanning, and printable receipts.
- **Inventory Management**: Add, edit, and delete products with stock tracking and **Customizable Categories**.
- **Settings**:
    - **General**: Store Name, Address, **Logo Upload**.
    - **Financials**: Currency Symbol, Tax Rate.
    - **Theme**: Toggle between **Light and Dark Mode**.
    - **Data**: Backup (Export JSON) and Restore (Import JSON).
- **Data Persistence**: All data is stored locally in your browser using IndexedDB.

## How to Run
1. **Download** the project folder.
2. **Open** `index.html` in any modern web browser (Chrome, Edge, Firefox).
   - *Note: Internet required for first run (Tailwind/Dexie CDN).*

## v2.0 Updates
- **Dark Mode**: Switch themes via the sun/moon icon in the top right.
- **Store Logo**: Upload your custom logo in Settings -> General. It will appear on the receipt.
- **Categories**: Create and delete custom product categories in Settings.
- **Order History**: View all past orders in the Dashboard. Click "View" to see details or reprint receipts. Delete old records if needed.
- **Receipts**: Now includes time of purchase and store logo.

## How to Test New Features
1. **Theme**: Click the Moon icon in the top right to switch to Dark Mode.
2. **Logo**: Go to Settings, upload an image file. Click Save. It should appear next to the store name.
3. **Categories**: Go to Settings -> Category Management. Type "Snacks" and click Add. Go to Inventory -> Add Product, and select "Snacks" as the category.
4. **History**: Make a sale. Go to Dashboard. See the sale in the "Recent Transactions" table. Click "View".

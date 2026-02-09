# Universal POS System

A fully functional, offline-capable Point of Sale system running entirely in the browser using HTML5, Tailwind CSS, Javascript, and Dexie.js (IndexedDB).

## Features
- **Dashboard**: View daily sales, total orders, and low stock alerts.
- **POS Terminal**: Fast checkout with product search, barcode scanning (via keyboard input), and printable receipts.
- **Inventory Management**: Add, edit, and delete products with stock tracking.
- **Settings**: Customize store name, address, currency symbol, tax rate, and receipt details.
- **Data Persistence**: All data is stored locally in your browser using IndexedDB. No server required.
- **Backup/Restore**: Export your data to JSON and import it on another device.

## How to Run
1. **Download** the project folder.
2. **Open** `index.html` in any modern web browser (Chrome, Edge, Firefox).
   - *Note: An internet connection is required for the first run to load Tailwind CSS and Dexie.js from the CDN. After that, if the browser caches them, it can work offline, but for true offline usage, you would need to download functionality.*

## Technologies Used
- **HTML5**: Semantic structure.
- **Tailwind CSS**: Utility-first styling.
- **Vanilla JavaScript**: Core logic and state management.
- **Dexie.js**: Wrapper for IndexedDB for easy database management.

## How to Test
1. **Inventory**: Go to the Inventory tab and click "Add Product". Enter details (e.g., Name: Apple, Price: 1.00, Stock: 100).
2. **Settings**: Go to Settings and configure your Currency ($/€) and Tax Rate.
3. **POS**:
    - Go to POS Terminal.
    - Click on the product you added to add it to the cart.
    - Adjust quantity or remove items.
    - Click "Pay Now" to complete the transaction and generate a receipt.
4. **Dashboard**: Check the Dashboard to see updated Sales figures.

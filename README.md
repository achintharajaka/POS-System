# POS System - Technical Documentation

## 1. System Overview
This Point of Sale (POS) system is a lightweight, offline-first web application designed for small businesses. It handles inventory management, sales processing, and financial reporting entirely within the browser using modern web technologies.

## 2. Architecture
The application follows a modular, client-side architecture using standard JavaScript (Global Scripts).

### Tech Stack
- **Core:** Vanilla JavaScript (ES6+). Modularized logic for maintainability.
- **UI/Styling:** Tailwind CSS (via CDN) for rapid, utility-first styling.
- **Database:** `Dexie.js` (Wrapper for IndexedDB) for robust, persistent client-side storage.
- **Visualization:** `Chart.js` for financial reporting charts.
- **Icons:** FontAwesome (via CDN).

### File Structure
```
/
├── index.html          # Main entry point, contains all Views and Modals
├── js/
│   ├── app.js          # Main Entry Point / Controller (Initializes modules)
│   ├── db.js           # Database Schema and Data Access Layer
│   ├── utils.js        # Helper functions & Global Error Logger
│   ├── constants.js    # Centralized DOM element IDs and constants
│   └── modules/        # Feature-specific modules
│       ├── dashboard.js
│       ├── inventory.js
│       ├── pos.js
│       ├── reports.js
│       └── settings.js
├── README.md           # Technical Documentation
└── UserGuide.md        # End-User Manual
```

## 3. Database Schema (Dexie.js)
The system uses `IndexedDB` for storage.

| Store | Schema | Description |
| :--- | :--- | :--- |
| **products** | `++id, name, barcode, price, costPrice, stock, categoryId` | Inventory items. Supports image (base64). |
| **categories** | `++id, name` | Product categories. |
| **orders** | `++id, timestamp, total, subtotal, modifiers, items, paymentMethod` | Sales logs. `modifiers` is a snapshot of applied adjustments (tax, discount, etc). |
| **expenses** | `++id, description, amount, date, category` | Manual expense entries. |
| **income** | `++id, description, amount, date` | Manual revenue entries. |
| **settings** | `key` | Key-value store for app configuration. |

## 4. Key Features & Implementation Details

### A. Inventory Management
- **CRUD Operations:** Managed in `app.js` requesting `db.js`.
- **Image Support:** Images are converted to Base64 strings and stored directly in the `products` store. Size limited to 500KB.
- **Validation:** Logic ensures `stock` cannot be negative and `barcode` must be unique across the inventory.

### B. Point of Sale (POS)
- **Cart Logic:** In-memory array (`state.cart`).
- **Stock Deduction:** Upon checkout, stock is deducted atomically from the `products` store.
- **Receipts:** Generated on-the-fly using `Utils.generateReceipt()` which creates a printable HTML window. Past order receipts can be reviewed from the Dashboard by clicking "View" on any order in the transaction history.

### C. Financial Reporting
- **Profit Calculation:**
    - `Gross Profit` (per order) = `Total Price` - `Total Cost Price`.
    - `Net Profit` (Overall) = `Total Revenue` (Sales + Extra Income) - `Total COGS` - `Total Expenses`.
- **Charts:** Renders a Bar chart comparing Revenue vs Expenses (COGS + Manual Expenses).

### D. Data Management
- **Import/Export:** The system exports the entire IndexedDB contents as a JSON file for backup/migration.

## 5. Setup & Deployment
Since this is a static web application:
1.  **Local:** Simply open `index.html` in any modern web browser (Chrome/Edge/Firefox).
2.  **Server:** Upload the files to any static host (GitHub Pages, Netlify, Vercel, or Apache/Nginx).
3.  **Requirements:** Internet connection is only initially required to load key libraries (Tailwind, Dexie, Chart.js) from CDNs. For offline support, these libraries would need to be downloaded locally.

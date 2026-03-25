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
- **PDF Generation:** `html2pdf.js` for on-the-fly digital receipts formatting.
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
│       ├── auth.js     # Authentication, role management & shift tracking
│       ├── dashboard.js
│       ├── inventory.js
│       ├── pos.js
│       ├── reports.js
│       ├── customers.js    # Customer Management & Loyalty Logic
│       ├── shortcuts.js # Keyboard shortcuts handling
│       └── settings.js
├── css/
│   └── styles.css      # Custom styles (login screen, animations)
├── README.md           # Technical Documentation
└── UserGuide.md        # End-User Manual
```

## 3. Database Schema (Dexie.js)
The system uses `IndexedDB` for storage.

| Store | Schema | Description |
| :--- | :--- | :--- |
| **products** | `++id, name, barcode, price, costPrice, stock, categoryId, supplierId, lowStockThreshold` | Inventory items. Supports image (base64). |
| **categories** | `++id, name` | Product categories. |
| **orders** | `++id, timestamp, total, subtotal, modifiers, items, paymentMethod, userId, userName, shiftId` | Sales logs with user attribution. |
| **expenses** | `++id, description, amount, date, category` | Manual expense entries. |
| **income** | `++id, description, amount, date` | Manual revenue entries. |
| **settings** | `key` | Key-value store for app configuration. |
| **users** | `++id, name, pin, role, active, createdAt` | User accounts. PINs stored as SHA-256 hashes. |
| **shifts** | `++id, userId, clockIn, clockOut, status` | Shift records (open/closed). |
| **suppliers** | `++id, name, contact, email, phone, address` | Supplier registry. |
| **purchaseOrders** | `++id, supplierId, date, status, totalCost, items, receivedDate` | Track stock arrivals from suppliers. |
| **stockLogs** | `++id, productId, changeAmount, reason, timestamp, note, userId` | Immutable history of all stock movements. |
| **customers** | `++id, name, phone, email, points, tier, totalSpent` | Customer database with loyalty info. |

## 4. Key Features & Implementation Details

### A. Inventory Management
- **CRUD Operations:** Managed in `app.js` requesting `db.js`.
- **Image Support:** Images are converted to Base64 strings and stored directly in the `products` store. Size limited to 500KB.
- **Validation:** Logic ensures `stock` cannot be negative and `barcode` must be unique across the inventory.
- **Barcode Printing:** Automatically generate and print Code128 barcode labels for products directly from the inventory table.

### B. Enhanced Stock Control
- **Suppliers:** Manage supplier details and link products to derived sources.
- **Purchase Orders:** Create and receive orders to automatically increment stock.
- **Stock Logs:** detailed audit trail of every stock change (Sales, POs, Adjustments).
- **Reorder Alerts:** Per-product configurable low stock thresholds.

### C. Point of Sale (POS)
- **Cart Logic:** In-memory array (`state.cart`).
- **Product Search:** Typo-tolerant fuzzy search matches names even with slight typos.
- **Quick Access:** Mark products as favorites (⭐) and quickly filter by "Favorites" or "Recently Sold" via the category dropdown.
- **Stock Deduction:** Upon checkout, stock is deducted atomically from the `products` store.
- **Receipts & Digital Receipts:** Generated on-the-fly using `Utils.generateReceipt()`. Printed automatically, but can also be exported as a PDF and shared via WhatsApp or Email if the customer's contact info is registered. Past order receipts can be reviewed from the Dashboard.

### D. Customer Management (CRM)
- **Customer Database:** Manage customer details (Name, Phone, Email).
- **Loyalty System:** Earn points on purchases (configurable rate). Redeem points for discounts (configurable rate). Manual adjustment of points is supported for admins/managers.
- **Order Linking:** Link sales to specific customers for purchase history tracking.

### E. Returns & Refunds
- **Process Returns:** Search by Order ID and select items to return.
- **Auto-Restock:** Option to automatically add returned items back to inventory.
- **Refund Tracking:** Refunds are deducted from daily revenue calculations.
- **History:** Order status updates to 'partially_refunded' or 'refunded'.

### F. Financial Reporting
- **Profit Calculation:**
    - `Gross Profit` (per order) = `Total Price` - `Total Cost Price`.
    - `Net Profit` (Overall) = `Total Revenue` (Sales + Extra Income) - `Total COGS` - `Total Expenses`.
- **Date-Range Filtering:** All reports (cards, lists, and charts) can be filtered by Today, This Week, This Month, or a Custom Range.
- **Charts:** Renders a dynamic Bar chart comparing Revenue vs Expenses (COGS + Manual Expenses) for the selected period.
- **Export:** Export comprehensive financial summaries, filtered by date range, to CSV for external analysis.

### F. User Authentication & Role Management
- **PIN-Based Login:** Users authenticate with a 4–6 digit numeric PIN (hashed with SHA-256 via `crypto.subtle`).
- **Roles:** Three roles — `admin` (full access), `manager` (no settings), `cashier` (POS only).
- **Role Enforcement:** Navigation items hidden per role. Unauthorized access redirects to the first allowed view.
- **User Management:** Admin can create/edit/delete users and reset PINs from Settings.
- **Default Admin:** Seeded on first run with PIN `1234`.

### G. Shift Management
- **Auto Clock-In:** A shift is automatically started when a user logs in.
- **Clock-Out:** Triggered on logout. Shift records stored in the `shifts` table.
- **Shift Timer:** Live HH:MM:SS timer displayed for cashiers in the nav bar.
- **Order Attribution:** Every order records `userId`, `userName`, and `shiftId`.
- **Shift History:** Admins can view all shift records in Settings.

### H. Data Management
- **Import/Export:** The system exports the entire IndexedDB contents (including users and shifts) as a JSON file for backup/migration.
- **Import:** The system imports the entire IndexedDB contents (including users and shifts) from a JSON file for backup/migration.
- **CSV Export:** The system supports exporting Orders, Inventory, and Financial Reports to CSV format for external analysis in spreadsheet software.

### I. Multi-language Support (Localization)
- **Multi-language:** The system supports multiple languages including English, Sinhala, and Tamil.
- **Implementation:** Uses a modular translation system where language-specific strings are stored in `js/lang/`. The `i18next`-like implementation allows for easy switching and persistence of the user's language preference.

### J. Keyboard Shortcuts
- **Implementation:** Global keydown listener in `shortcuts.js`. 
- **Features:** View navigation (F1-F5), Quick Checkout (F9/Enter), Modal control (Esc), and Quick Quantity Entry (Number keys).

### K. Multi-Store Support
- **Isolation:** Switch between different store databases directly from Settings.
- **Implementation:** Uses dynamic `IndexedDB` names based on `localStorage` to keep data isolated per store location.

### L. Google Drive Sync
- **Backup:** Uploads the complete JSON data dump directly to Google Drive as a backup.
- **Implementation:** Uses Google Identity Services (GSI) and the Drive API for secure OAuth authentication and file upload.
- **Setup:** See `GoogleDriveInstructions.md` for a step-by-step guide on how to configure your Google API credentials for this feature.

### M. AI Assistant (Gemini)
- **Integration:** Powered directly by the Google Gemini SDK (`gemini-2.5-flash`) handling fully client-side conversational AI.
- **System-Awareness:** The AI is injected with a real-time, comprehensive snapshot of the system (`IndexedDB` dump of active orders, inventory count, staff roster, configuration, and CRM data) acting as its context.
- **Support:** Users can chat with the assistant using natural language to query metrics (e.g., "What are my top selling items?", "Does John have an active shift?") without navigating away from their current view.

## 5. Setup & Deployment
Since this is a static web application:
1.  **Local:** Simply open `index.html` in any modern web browser (Chrome/Edge/Firefox).
2.  **Server:** Upload the files to any static host (GitHub Pages, Netlify, Vercel, or Apache/Nginx).
3.  **Requirements:** Internet connection is only initially required to load key libraries (Tailwind, Dexie, Chart.js) from CDNs. For offline support, these libraries would need to be downloaded locally.

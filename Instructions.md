# Instructions.md: Universal POS System (Client-Side)

## 1. Project Overview
**Goal:** Build a fully functional, offline-capable Point of Sale (POS) system that runs entirely in the browser.
**Core Philosophy:** "Complexity under the hood, simplicity on the screen." The system must be robust enough for any retail environment (grocery, electronics, clothing) but simple enough that a non-technical store owner can configure it without writing code.

---

## 2. Business Requirements

### A. Target Audience
* Small to medium business owners.
* Users with limited technical skills (no coding knowledge required).
* Users who need an instant setup (no server installation).

### B. Core Features (The "Must-Haves")
1.  **Dashboard & Analytics:**
    * Visual summary of daily sales, total revenue, and low-stock alerts.
    * Simple charts (Sales over time, Top selling items).
2.  **Checkout & Sales:**
    * Barcode scanner support (listening to keyboard input).
    * Manual product search/selection grid.
    * Cart management (adjust quantity, remove items, clear cart).
    * Dynamic receipt generation (printable view).
3.  **Inventory Management:**
    * Add/Edit/Delete products.
    * Categories management.
    * Stock level tracking.
4.  **User Settings (The "Customization" Layer):**
    * **Store Info:** Editable Store Name, Address, and Logo URL.
    * **Financials:** Configurable Tax Rate (%) and Currency Symbol ($, €, £, Rs, etc.).
    * **Receipts:** Customizable header/footer text.
    * **Data Management:** "Export Data" (JSON) and "Import Data" buttons to allow users to backup their shop data or move it to another computer.

---

## 3. Technical Requirements

### A. Tech Stack
* **Markup:** HTML5 (Semantic structure).
* **Styling:** Tailwind CSS (Utility-first styling for rapid UI development and responsiveness).
* **Logic:** Vanilla JavaScript (ES6+).
* **Database:** Dexie.js (Wrapper for IndexedDB to store all data locally in the browser).

### B. Architecture & Data Flow
* **Offline-First:** The app must work 100% without an internet connection after the initial load.
* **Single Page Application (SPA) feel:** Use JavaScript to swap "views" (e.g., hiding the Checkout div and showing the Inventory div) without reloading the page to maintain state.

### C. Database Schema (Dexie.js)
Define a database class `POSDatabase` with the following tables:
1.  **products:** `++id, name, barcode, price, costPrice, stock, categoryId`
2.  **categories:** `++id, name`
3.  **orders:** `++id, timestamp, total, tax, items, paymentMethod`
4.  **settings:** `key, value` (Key-value store for app configurations like 'currency', 'taxRate').

### D. UI/UX Specifications
* **Responsive:** Must work on Tablets (iPad) and Desktops.
* **Feedback:** Use "Toast" notifications for actions (e.g., "Product Added", "Saved Successfully").
* **Tailwind Config:** Use a consistent color palette (e.g., `slate-800` for sidebars, `emerald-500` for pay buttons).

---

## 4. Implementation Steps

### Phase 1: Skeleton & Database
1.  Set up `index.html` with Tailwind CDN.
2.  Initialize Dexie.js and define the schema.
3.  Create a `db.js` file to handle all CRUD operations (Create, Read, Update, Delete).

### Phase 2: Inventory & Settings
1.  Build the **Settings Panel** first. (If we can't set a currency, we can't display prices).
2.  Build the **Inventory Manager**. Create forms to add products with validation (Price cannot be negative).

### Phase 3: The POS Terminal (Checkout)
1.  Create the product grid on the left and the cart summary on the right.
2.  Implement the logic: Clicking a product adds it to the `cart` array.
3.  Calculate totals: `(Sum of items) + (Tax Rate * Sum)`.

### Phase 4: Final Polish
1.  Implement the "Pay" button which saves the `cart` array into the `orders` table in Dexie.
2.  Generate the printable receipt HTML.

---

## 5. File Structure
```text
/root
  ├── index.html       # The main entry point
  ├── css/
  │   └── styles.css   # Custom overrides (if Tailwind isn't enough)
  ├── js/
  │   ├── app.js       # Main UI logic and event listeners
  │   ├── db.js        # Dexie.js configuration and data methods
  │   └── utils.js     # Helpers (Currency formatting, Date formatting)
  └── assets/          # Icons and placeholder images
# POS System User Guide

Welcome to the Point of Sale (POS) System! This guide will help you understand how to use the system effectively to manage your inventory, make sales, and track your business performance.

## Table of Contents
1.  [Getting Started (Login)](#getting-started-login)
2.  [Inventory Management](#inventory-management)
3.  [Customer Management](#customer-management)
4.  [Point of Sale (Making Sales)](#point-of-sale-making-sales)
5.  [Returns & Refunds](#returns--refunds)
6.  [Reports & Finances](#reports--finances)
7.  [Settings & Data](#settings--data)
8.  [User Management (Admin)](#user-management-admin)
8.  [Keyboard Shortcuts](#keyboard-shortcuts)
9.  [Troubleshooting & Debugging](#troubleshooting--debugging)

---

## 1. Getting Started (Login)

When you open the application, you will see the **Login Screen** — a dark overlay with a PIN pad.

### Logging In
1.  Enter your **PIN** (4–6 digits) using the on-screen number pad or your keyboard.
2.  Click **Sign In** (or press **Enter**).
3.  The default admin PIN is **1234**.

### User Roles
Your role determines which sections you can access:

| Role | Access |
| :--- | :--- |
| **Admin** | Dashboard, POS, Inventory, Reports, Settings (full access) |
| **Manager** | Dashboard, POS, Inventory, Reports |
| **Cashier** | POS only |

### Shifts
- You are **automatically clocked in** when you log in.
- Cashiers see a **live shift timer** (HH:MM:SS) in the top navigation bar.
- When you **Logout**, your shift is closed and recorded.

### Logging Out
- **Desktop:** Click the logout icon (→) at the top-right of the navigation bar.
- **Mobile:** Tap the hamburger menu (☰), then tap **Logout**.

### After Login
- **Admins/Managers** land on the **Dashboard**.
- **Cashiers** land directly on the **POS Terminal**.
- **Top Cards:** Show you a quick summary of today's sales, total revenue, expenses, and low stock warnings.
- **Recent Transactions:** View your order history. Click **View** on any order to open its receipt.
- **Navigation Menu:** Use the top bar (desktop) or hamburger menu (mobile) to switch views.

---

## 2. Inventory Management

Before making sales, you need products!

### Inventory Tabs
The Inventory section is now divided into tabs for better organization:
- **Products:** Your main item list.
- **Suppliers:** Manage your vendors.
- **Purchase Orders:** Track incoming stock.
- **Stock Logs:** Audit trail of movements.

### Adding a Product
1.  Go to the **Inventory** tab (Products view).
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
- **Low Stock Filter:** If an item's stock drops below its **Low Stock Alert** threshold (default 5), it will be highlighted in Red. Click the **Low Stock Items** card on the Dashboard to filter the inventory view.
- **Editing:** Click "Edit" on any item to update its price, stock, threshold, or image.
- **Deleting:** Click "Delete" to remove an item permanently.

### Supplier Management
1.  Go to the **Inventory > Suppliers** tab.
2.  Click **+ Supplier** to add a new vendor.
3.  Enter details (Name, Contact, Phone, etc.) and Save.
4.  **Linking Products:** When adding/editing a product, select the supplier from the dropdown to link them.

### Purchase Orders (Restocking)
Use this to officially bring in new stock.
1.  Go to the **Inventory > Purchase Orders** tab.
2.  Click **+ Purchase Order**.
3.  Select the **Supplier** and add items + quantities.
4.  **Receive Stock:** When the shipment arrives, find the order in the list (Status: Ordered) and click **Receive**. This automatically adds the items to your current stock inventory.

### Stock History (Logs)
View a complete history of why stock changed.
1.  Go to the **Inventory > Stock Logs** tab.
2.  See every transaction: Sales (POS), Purchase Orders (Restock), and Manual Adjustments.

---

## 3. Customer Management

Build relationships with your customers and reward loyalty.

### Managing Customers
1.  Click **Customers** in the navigation menu.
2.  **Add Customer:** Click **+ Add Customer**, enter Name, Phone, and Email.
3.  **Search:** Use the search bar to find customers by name or phone.
4.  **Edit/Delete:** Use the action buttons in the list.

### Loyalty Points
- **Earning:** Customers earn points based on the configured rate (Default: 1 Point per $1 spent).
- **Redeeming:** Points can be redeemed for discounts based on the configured rate (Default: 100 Points = $1.00).
- **Manual Edit:** You can manually adjust a customer's points by clicking **Edit** on the customer list and changing the value in the **Loyalty Points** field.
- Points are tracked automatically and displayed in the customer list and POS.

---

## 4. Point of Sale (Making Sales)

This is where you'll spend most of your time.

### Processing an Order
1.  **Add Items:** Click on product cards in the grid.
    - You can **Search** by name or **Filter** by category.
    - Clicking multiple times increases quantity.
2.  **Manage Cart & Customers:**
    - **Select Customer:** Click **+ Select Customer** to link the order.
    - **Redeem Points:** If a customer has points, a **Redeem** button appears. Click it to apply a discount (e.g., Redeem 500 pts for $5 off).
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

---

## 5. Returns & Refunds

Handle customer returns smoothly.

1.  **Open Returns:**  
    Click the **Returns** button in the top navigation bar.
2.  **Find Order:**  
    Enter the **Order ID** (from the receipt) and click **Search**.
3.  **Select Items:**  
    - You will see the items in the order.
    - Enter the **Quantity** being returned for each item.
    - Select a **Reason** (e.g., Defective, Changed Mind).
4.  **Options:**  
    - **Restock Items:** Keep this checked (default) to add the items back to your inventory count. Uncheck it if the items are damaged and cannot be resold.
5.  **Process:**  
    - Click **Process Refund**. 
    - The Total Refund Amount will be recorded, and the order status updated.

---

## 6. Reports & Finances

Track how your business is doing.

### Financial Overview
- **Date Filtering:** Use the filter bar at the top of the Reports page to select a time period.
    - **Today:** Shows data for the current day only.
    - **This Week:** Shows data from the start of the current week.
    - **This Month:** Shows data for the entire current month (Default).
    - **Custom Range:** Select a specific **From** and **To** date and click **Filter**.
- **Charts:** View a Bar chart comparing Revenue vs. Expenses for the selected period.
    - **Revenue (Blue):** Total sales + Extra Revenue.
    - **Expenses (Orange):** Cost of Goods Sold (COGS) + Manual Expenses.
- **Cards:**
    - **Total Revenue:** Gross income for the selected period.
    - **Net Profit:** Revenue - (COGS + Expenses) for the selected period.

### Recording Extra Data
- **Record Expense:** Log bills like Rent, Electricity, or Wages.
- **Record Extra Revenue:** Log income not from sales, like Tips or Service Fees.

### History
- **Order Profit History:** See the profit margin on every single individual order.
- **Recent Extra Revenue:** See a log of manual income entries.

---

## 6. Settings & Data

- **Store Profile:** Specify your Store Name, Address, and Currency Symbol.
- **Language Settings:** Choose your preferred display language (English, Sinhala, or Tamil) from the dropdown menu and click **Save Settings** to apply.
- **Receipt Settings:** Customize what appears on the receipt (Logo, Header, Footer, QR Code URL).
- **Loyalty Program:** Configure the Earning Rate (points per currency unit) and Redemption Rate (points required for 1 currency unit discount).
- **Order Modifiers:** Configure taxes, discounts, and other adjustments that apply to every order.
- **Category Management:** Add or remove product categories.
- **Data Management:**
    - **Export Data:** Download a backup of your entire database (includes users and shifts). **Do this regularly!**
    - **Import Data:** Restore from a backup file.
    - **Reset System:** WIPE everything. Use with extreme caution.

---

## 7. User Management (Admin)

Only visible to Admin users, found at the bottom of the **Settings** page.

### Adding a User
1.  Go to **Settings** → scroll down to **User Management**.
2.  Fill in **Name**, select a **Role**, and set a **PIN** (4–6 digits, numbers only).
3.  Click **Add User**.

### Editing a User
- Click the ✏️ (edit) icon next to any user.
- Update name, role, or PIN (leave PIN blank to keep the existing one).
- Click **Update User**.

### Resetting a PIN
- Click the 🔑 icon to reset any user's PIN back to the default **1234**.

### Deleting a User
- Click the 🗑️ icon. You cannot delete your own account.

### Shift History
- Below user management, view the **Shift History** table showing all clock-in/clock-out records with duration.

---

## 8. Keyboard Shortcuts

Boost your efficiency with these shortcuts:

### Navigation
- **F1**: Go to Dashboard
- **F2**: Go to POS Terminal
- **F3**: Go to Inventory
- **F4**: Go to Reports
- **F5**: Go to Settings

### POS Operations
- **Number Keys (0-9)**: When in POS view, typing numbers will update the quantity of the **last added item** in the cart.
- **F9 / Enter**: Complete order (Checkout). *Note: Enter only works if not focusing a text box.*

### General
- **Esc**: Close any open popup or modal window.

---

## 9. Troubleshooting & Debugging

If you encounter any issues or the system behaves unexpectedly:

1.  **Direct Execution:** Note that this system runs directly from your files. Simply double-click `index.html` to start.
2.  **Debug Report:** The system automatically logs errors in the background. If you need to report a bug:
    - Open your browser's **Developer Console** (usually by pressing `F12` or `Ctrl+Shift+I`).
    - Go to the **Console** tab.
    - Type `Utils.downloadDebugReport()` and press **Enter**.
    - This will download a `debug_report.txt` file which you can share with support to help identify the problem.
3.  **WIP:** A dedicated button for downloading this report is being added to the Settings page in a future update.

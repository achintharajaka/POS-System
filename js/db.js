// DB Module (Global)
// Depends on: utils.js (loaded before this)

const db = new Dexie("POSDatabase");

db.version(1).stores({
    products: '++id, name, barcode, price, costPrice, stock, categoryId',
    categories: '++id, name',
    orders: '++id, timestamp, total, subtotal, modifiers, items, paymentMethod',
    settings: 'key',
    expenses: '++id, description, amount, date, category',
    income: '++id, description, amount, date, category'
});

// Version 2: Add users and shifts for authentication & role management
db.version(2).stores({
    products: '++id, name, barcode, price, costPrice, stock, categoryId',
    categories: '++id, name',
    orders: '++id, timestamp, total, subtotal, modifiers, items, paymentMethod, userId, shiftId',
    settings: 'key',
    expenses: '++id, description, amount, date, category',
    income: '++id, description, amount, date, category',
    users: '++id, name, pin, role, active',
    shifts: '++id, userId, clockIn, clockOut, status'
});

// Version 3: Enhanced Stock Management
db.version(3).stores({
    products: '++id, name, barcode, price, costPrice, stock, categoryId, supplierId, lowStockThreshold',
    categories: '++id, name',
    orders: '++id, timestamp, total, subtotal, modifiers, items, paymentMethod, userId, shiftId',
    settings: 'key',
    expenses: '++id, description, amount, date, category',
    income: '++id, description, amount, date, category',
    users: '++id, name, pin, role, active',
    shifts: '++id, userId, clockIn, clockOut, status',
    suppliers: '++id, name, contact, email, phone, address',
    purchaseOrders: '++id, supplierId, date, status, totalCost, items, receivedDate',
    stockLogs: '++id, productId, changeAmount, reason, timestamp, note, userId'
});

// Version 4: Customer Management (CRM)
db.version(4).stores({
    products: '++id, name, barcode, price, costPrice, stock, categoryId, supplierId, lowStockThreshold',
    categories: '++id, name',
    orders: '++id, timestamp, total, subtotal, modifiers, items, paymentMethod, userId, shiftId, customerId',
    settings: 'key',
    expenses: '++id, description, amount, date, category',
    income: '++id, description, amount, date, category',
    users: '++id, name, pin, role, active',
    shifts: '++id, userId, clockIn, clockOut, status',
    suppliers: '++id, name, contact, email, phone, address',
    purchaseOrders: '++id, supplierId, date, status, totalCost, items, receivedDate',
    stockLogs: '++id, productId, changeAmount, reason, timestamp, note, userId',
    customers: '++id, name, phone, email, points, tier, totalSpent'
});

// PIN hashing utility (SHA-256 via crypto.subtle)
async function hashPin(pin) {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin.toString());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Seed default settings if not exists
db.on("populate", async () => {
    db.settings.bulkAdd([
        { key: "storeName", value: "My POS Store" },
        { key: "storeAddress", value: "123 Main St" },
        { key: "currencySymbol", value: "$" },
        { key: "receiptHeader", value: "Thank you for shopping!" },
        { key: "receiptFooter", value: "Visit us again." },
        { key: "receiptShowLogo", value: true },
        { key: "receiptShowAddress", value: true },
        { key: "receiptShowDate", value: true },
        // New Modifiers System (Migrating from simple taxRate)
        { key: "maxModifierId", value: 1 },
        // Loyalty Settings
        { key: "loyaltyEnabled", value: true },
        { key: "loyaltyPointsPerCurrency", value: 1 }, // 1 point per $1
        { key: "loyaltyRedemptionRate", value: 0.05 }, // 100 points = $5
    ]);

    // Default Modifier (10% Tax)
    db.settings.put({
        key: "orderModifiers",
        value: [{ id: 1, name: "Tax", type: "percent", rate: "add", value: 10 }]
    });

    db.categories.bulkAdd([
        { name: "General" },
        { name: "Food" },
        { name: "Beverages" }
    ]);

    db.products.add({
        name: "Demo Product",
        barcode: "123456",
        price: 10.00,
        costPrice: 5.00,
        stock: 100,
        categoryId: 1,
        // New fields default
        supplierId: null,
        lowStockThreshold: 5
    });

    // Default Admin User (PIN: 1234)
    const adminPinHash = await hashPin('1234');
    db.users.add({
        name: 'Admin',
        pin: adminPinHash,
        role: 'admin',
        active: true,
        createdAt: Date.now()
    });
});

db.open().catch(err => {
    console.error("Failed to open db: " + (err.stack || err));
});

window.DB = {
    // --- PIN Hashing (exposed for auth module) ---
    hashPin,

    // Products
    async getProducts(page = null, limit = null, search = '', lowStock = false) {
        try {
            let collection = db.products.toCollection();

            // Search (Naive filter for now, but efficient enough for thousands)
            if (search) {
                const q = search.toLowerCase();
                collection = collection.filter(p => p.name.toLowerCase().includes(q) || (p.barcode && p.barcode.includes(q)));
            }

            if (lowStock) {
                // Filter by dynamic threshold if available, else default to 5
                collection = collection.filter(p => p.stock < (p.lowStockThreshold || 5));
            }

            if (page && limit) {
                const total = await collection.count();
                const offset = (page - 1) * limit;
                const data = await collection.offset(offset).limit(limit).toArray();
                return { data, total };
            }

            return await collection.toArray();
        } catch (e) { console.error(e); throw e; }
    },
    async addProduct(product) {
        try { return await db.products.add(product); } catch (e) { console.error(e); throw e; }
    },
    async updateProduct(id, updates) {
        try { return await db.products.update(id, updates); } catch (e) { console.error(e); throw e; }
    },
    async deleteProduct(id) {
        try { return await db.products.delete(id); } catch (e) { console.error(e); throw e; }
    },
    async getProduct(id) {
        try { return await db.products.get(id); } catch (e) { console.error(e); throw e; }
    },
    async getProductByBarcode(barcode) {
        try {
            if (!barcode) return null;
            return await db.products.where('barcode').equals(barcode).first();
        } catch (e) { console.error(e); throw e; }
    },

    // Categories
    async getCategories() {
        try { return await db.categories.toArray(); } catch (e) { console.error(e); throw e; }
    },

    // Orders
    async saveOrder(order) {
        try { return await db.orders.add(order); } catch (e) { console.error(e); throw e; }
    },
    async getOrders(page = null, limit = null) {
        try {
            let collection = db.orders.orderBy('timestamp').reverse();
            if (page && limit) {
                const total = await collection.count();
                const data = await collection.offset((page - 1) * limit).limit(limit).toArray();
                return { data, total };
            }
            return await collection.toArray();
        } catch (e) { console.error(e); throw e; }
    },

    async getOrdersSince(timestamp) {
        try {
            return await db.orders.where('timestamp').aboveOrEqual(timestamp).toArray();
        } catch (e) { console.error(e); throw e; }
    },

    async getOrdersByCustomer(customerId) {
        try {
            return await db.orders.where('customerId').equals(customerId).reverse().sortBy('timestamp');
        } catch (e) { console.error(e); throw e; }
    },

    async getLowStockCount() {
        try {
            // This is slightly more complex with dynamic thresholds.
            // For performance, we might want to just iterate correctly or use a simpler check.
            // Currently simplified:
            return await db.products.filter(p => p.stock < (p.lowStockThreshold || 5)).count();
        } catch (e) { console.error(e); throw e; }
    },

    // Expenses
    async addExpense(expense) {
        try { return await db.expenses.add(expense); } catch (e) { console.error(e); throw e; }
    },
    async getExpenses() {
        try { return await db.expenses.orderBy('date').reverse().toArray(); } catch (e) { console.error(e); throw e; }
    },
    async deleteExpense(id) {
        try { return await db.expenses.delete(id); } catch (e) { console.error(e); throw e; }
    },

    // Income (Extra Revenue)
    async addIncome(income) {
        try { return await db.income.add(income); } catch (e) { console.error(e); throw e; }
    },
    async getIncome() {
        try { return await db.income.orderBy('date').reverse().toArray(); } catch (e) { console.error(e); throw e; }
    },
    async deleteIncome(id) {
        try { return await db.income.delete(id); } catch (e) { console.error(e); throw e; }
    },

    // Settings
    async getSettings() {
        try {
            const all = await db.settings.toArray();
            const settings = {};
            all.forEach(s => settings[s.key] = s.value);
            return settings;
        } catch (e) { console.error(e); throw e; }
    },
    async updateSetting(key, value) {
        try { return await db.settings.put({ key, value }); } catch (e) { console.error(e); throw e; }
    },

    // Categories CRUD
    async addCategory(name) {
        try { return await db.categories.add({ name }); } catch (e) { console.error(e); throw e; }
    },
    async deleteCategory(id) {
        try { return await db.categories.delete(id); } catch (e) { console.error(e); throw e; }
    },

    async deleteOrder(id) {
        try { return await db.orders.delete(id); } catch (e) { console.error(e); throw e; }
    },

    // --- Users CRUD ---
    async getUsers() {
        try { return await db.users.toArray(); } catch (e) { console.error(e); throw e; }
    },
    async addUser(user) {
        try { return await db.users.add(user); } catch (e) { console.error(e); throw e; }
    },
    async updateUser(id, updates) {
        try { return await db.users.update(id, updates); } catch (e) { console.error(e); throw e; }
    },
    async deleteUser(id) {
        try { return await db.users.delete(id); } catch (e) { console.error(e); throw e; }
    },
    async getUser(id) {
        try { return await db.users.get(id); } catch (e) { console.error(e); throw e; }
    },
    async getUserByPin(hashedPin) {
        try {
            return await db.users.where('pin').equals(hashedPin).and(u => u.active).first();
        } catch (e) { console.error(e); throw e; }
    },
    async getUserCount() {
        try { return await db.users.count(); } catch (e) { console.error(e); throw e; }
    },

    // --- Shifts ---
    async startShift(userId) {
        try {
            return await db.shifts.add({
                userId,
                clockIn: Date.now(),
                clockOut: null,
                status: 'open'
            });
        } catch (e) { console.error(e); throw e; }
    },
    async endShift(shiftId) {
        try {
            return await db.shifts.update(shiftId, {
                clockOut: Date.now(),
                status: 'closed'
            });
        } catch (e) { console.error(e); throw e; }
    },
    async getActiveShift(userId) {
        try {
            return await db.shifts.where('userId').equals(userId).and(s => s.status === 'open').first();
        } catch (e) { console.error(e); throw e; }
    },
    async getShifts(page = null, limit = null) {
        try {
            let collection = db.shifts.orderBy('clockIn').reverse();
            if (page && limit) {
                const total = await collection.count();
                const data = await collection.offset((page - 1) * limit).limit(limit).toArray();
                return { data, total };
            }
            return await collection.toArray();
        } catch (e) { console.error(e); throw e; }
    },

    // --- Suppliers ---
    async getSuppliers() {
        try { return await db.suppliers.toArray(); } catch (e) { console.error(e); throw e; }
    },
    async addSupplier(supplier) {
        try { return await db.suppliers.add(supplier); } catch (e) { console.error(e); throw e; }
    },
    async updateSupplier(id, updates) {
        try { return await db.suppliers.update(id, updates); } catch (e) { console.error(e); throw e; }
    },
    async deleteSupplier(id) {
        try { return await db.suppliers.delete(id); } catch (e) { console.error(e); throw e; }
    },

    // --- Purchase Orders ---
    async getPurchaseOrders() {
        try { return await db.purchaseOrders.orderBy('date').reverse().toArray(); } catch (e) { console.error(e); throw e; }
    },
    async addPurchaseOrder(po) {
        try { return await db.purchaseOrders.add(po); } catch (e) { console.error(e); throw e; }
    },
    async updatePurchaseOrder(id, updates) {
        try { return await db.purchaseOrders.update(id, updates); } catch (e) { console.error(e); throw e; }
    },

    // --- Stock Logs ---
    async getStockLogs(productId = null) {
        try {
            let collection = db.stockLogs.orderBy('timestamp').reverse();
            if (productId) {
                collection = collection.filter(log => log.productId === productId);
            }
            return await collection.toArray();
        } catch (e) { console.error(e); throw e; }
    },
    async addStockLog(log) {
        try { return await db.stockLogs.add(log); } catch (e) { console.error(e); throw e; }
    },

    // --- Customers ---
    async getCustomers(page = null, limit = null, search = '') {
        try {
            let collection = db.customers.orderBy('name');

            if (search) {
                const q = search.toLowerCase();
                collection = collection.filter(c =>
                    c.name.toLowerCase().includes(q) ||
                    (c.phone && c.phone.includes(q)) ||
                    (c.email && c.email.toLowerCase().includes(q))
                );
            }

            if (page && limit) {
                const total = await collection.count();
                const data = await collection.offset((page - 1) * limit).limit(limit).toArray();
                return { data, total };
            }
            return await collection.toArray();
        } catch (e) { console.error(e); throw e; }
    },
    async addCustomer(customer) {
        try { return await db.customers.add(customer); } catch (e) { console.error(e); throw e; }
    },
    async updateCustomer(id, updates) {
        try { return await db.customers.update(id, updates); } catch (e) { console.error(e); throw e; }
    },
    async deleteCustomer(id) {
        try { return await db.customers.delete(id); } catch (e) { console.error(e); throw e; }
    },
    async getCustomer(id) {
        try { return await db.customers.get(id); } catch (e) { console.error(e); throw e; }
    },

    // --- Data Import/Export ---
    async importData(jsonData) {
        try {
            // Clear existing
            await db.products.clear();
            await db.categories.clear();
            await db.settings.clear();
            await db.orders.clear();
            await db.expenses.clear();
            await db.income.clear();
            await db.users.clear();
            await db.shifts.clear();
            // Clear new tables
            await db.suppliers.clear();
            await db.purchaseOrders.clear();
            await db.stockLogs.clear();
            await db.customers.clear();

            // Load new
            await db.products.bulkAdd(jsonData.products);
            await db.categories.bulkAdd(jsonData.categories);
            await db.settings.bulkAdd(jsonData.settings);
            if (jsonData.orders) await db.orders.bulkAdd(jsonData.orders);
            if (jsonData.expenses) await db.expenses.bulkAdd(jsonData.expenses);
            if (jsonData.income) await db.income.bulkAdd(jsonData.income);
            if (jsonData.users) await db.users.bulkAdd(jsonData.users);
            if (jsonData.shifts) await db.shifts.bulkAdd(jsonData.shifts);
            // Load new tables data if exists
            if (jsonData.suppliers) await db.suppliers.bulkAdd(jsonData.suppliers);
            if (jsonData.purchaseOrders) await db.purchaseOrders.bulkAdd(jsonData.purchaseOrders);
            if (jsonData.stockLogs) await db.stockLogs.bulkAdd(jsonData.stockLogs);
            if (jsonData.customers) await db.customers.bulkAdd(jsonData.customers);

        } catch (e) { console.error(e); throw e; }
    },
    async exportData() {
        try {
            const products = await db.products.toArray();
            const categories = await db.categories.toArray();
            const settings = await db.settings.toArray();
            const orders = await db.orders.toArray();
            const expenses = await db.expenses.toArray();
            const income = await db.income.toArray();
            const users = await db.users.toArray();
            const shifts = await db.shifts.toArray();
            const suppliers = await db.suppliers.toArray();
            const purchaseOrders = await db.purchaseOrders.toArray();
            const stockLogs = await db.stockLogs.toArray();
            const customers = await db.customers.toArray();

            return { products, categories, settings, orders, expenses, income, users, shifts, suppliers, purchaseOrders, stockLogs, customers };
        } catch (e) { console.error(e); throw e; }
    },

    async reset() {
        try {
            await db.delete();
            window.location.reload();
        } catch (e) { console.error(e); throw e; }
    }
};

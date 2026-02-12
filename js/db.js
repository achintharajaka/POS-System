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
        { key: "maxModifierId", value: 1 }
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
        categoryId: 1
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
                collection = collection.filter(p => p.stock < 5);
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

    async getLowStockCount() {
        try {
            return await db.products.where('stock').below(5).count();
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

            // Load new
            await db.products.bulkAdd(jsonData.products);
            await db.categories.bulkAdd(jsonData.categories);
            await db.settings.bulkAdd(jsonData.settings);
            if (jsonData.orders) await db.orders.bulkAdd(jsonData.orders);
            if (jsonData.expenses) await db.expenses.bulkAdd(jsonData.expenses);
            if (jsonData.income) await db.income.bulkAdd(jsonData.income);
            if (jsonData.users) await db.users.bulkAdd(jsonData.users);
            if (jsonData.shifts) await db.shifts.bulkAdd(jsonData.shifts);
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
            return { products, categories, settings, orders, expenses, income, users, shifts };
        } catch (e) { console.error(e); throw e; }
    },

    async reset() {
        try {
            await db.delete();
            window.location.reload();
        } catch (e) { console.error(e); throw e; }
    }
};

// db.js - Dexie Database Configuration

const db = new Dexie("POSDatabase");

db.version(1).stores({
    products: '++id, name, barcode, price, costPrice, stock, categoryId',
    categories: '++id, name',
    orders: '++id, timestamp, total, tax, items, paymentMethod',
    settings: 'key', // Key-value store
    expenses: '++id, description, amount, date, category',
    income: '++id, description, amount, date, category'
});

// Seed default settings if not exists
db.on("populate", () => {
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
});

db.open().catch(err => {
    console.error("Failed to open db: " + (err.stack || err));
});

const DB = {
    // Products
    async getProducts() {
        return await db.products.toArray();
    },
    async addProduct(product) {
        return await db.products.add(product);
    },
    async updateProduct(id, updates) {
        return await db.products.update(id, updates);
    },
    async deleteProduct(id) {
        return await db.products.delete(id);
    },

    // Categories
    async getCategories() {
        return await db.categories.toArray();
    },

    // Orders
    async saveOrder(order) {
        return await db.orders.add(order);
    },
    async getOrders() {
        return await db.orders.orderBy('timestamp').reverse().toArray();
    },

    // Expenses
    async addExpense(expense) {
        return await db.expenses.add(expense);
    },
    async getExpenses() {
        return await db.expenses.orderBy('date').reverse().toArray();
    },
    async deleteExpense(id) {
        return await db.expenses.delete(id);
    },

    // Income (Extra Revenue)
    async addIncome(income) {
        return await db.income.add(income);
    },
    async getIncome() {
        return await db.income.orderBy('date').reverse().toArray();
    },
    async deleteIncome(id) {
        return await db.income.delete(id);
    },

    // Settings
    async getSettings() {
        const all = await db.settings.toArray();
        const settings = {};
        all.forEach(s => settings[s.key] = s.value);
        return settings;
    },
    async updateSetting(key, value) {
        return await db.settings.put({ key, value });
    },

    // Categories CRUD
    async addCategory(name) {
        return await db.categories.add({ name });
    },
    async deleteCategory(id) {
        // Optional conflict check: check if products use this category
        return await db.categories.delete(id);
    },

    async deleteOrder(id) {
        return await db.orders.delete(id);
    },

    async importData(jsonData) {
        // Clear existing
        await db.products.clear();
        await db.categories.clear();
        await db.settings.clear();
        await db.orders.clear(); // Optional: maybe we don't want to clear working orders?
        await db.expenses.clear();
        await db.income.clear();

        // Load new
        await db.products.bulkAdd(jsonData.products);
        await db.categories.bulkAdd(jsonData.categories);
        await db.settings.bulkAdd(jsonData.settings);
        // We usually don't import orders for restore unless full backup
        if (jsonData.orders) await db.orders.bulkAdd(jsonData.orders);
        if (jsonData.expenses) await db.expenses.bulkAdd(jsonData.expenses);
        if (jsonData.income) await db.income.bulkAdd(jsonData.income);
    },
    async exportData() {
        const products = await db.products.toArray();
        const categories = await db.categories.toArray();
        const settings = await db.settings.toArray();
        const orders = await db.orders.toArray();
        const expenses = await db.expenses.toArray();
        const income = await db.income.toArray();
        return { products, categories, settings, orders, expenses, income };
    },

    async reset() {
        await db.delete();
        window.location.reload();
    }
};

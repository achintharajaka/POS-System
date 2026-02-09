// db.js - Dexie Database Configuration

const db = new Dexie("POSDatabase");

db.version(1).stores({
    products: '++id, name, barcode, price, costPrice, stock, categoryId',
    categories: '++id, name',
    orders: '++id, timestamp, total, tax, items, paymentMethod',
    settings: 'key' // Key-value store
});

// Seed default settings if not exists
db.on("populate", () => {
    db.settings.bulkAdd([
        { key: "storeName", value: "My POS Store" },
        { key: "storeAddress", value: "123 Main St" },
        { key: "currencySymbol", value: "$" },
        { key: "taxRate", value: 10 },
        { key: "receiptHeader", value: "Thank you for shopping!" },
        { key: "receiptFooter", value: "Visit us again." }
    ]);

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

        // Load new
        await db.products.bulkAdd(jsonData.products);
        await db.categories.bulkAdd(jsonData.categories);
        await db.settings.bulkAdd(jsonData.settings);
        // We usually don't import orders for restore unless full backup
        if (jsonData.orders) await db.orders.bulkAdd(jsonData.orders);
    },
    async exportData() {
        const products = await db.products.toArray();
        const categories = await db.categories.toArray();
        const settings = await db.settings.toArray();
        const orders = await db.orders.toArray();
        return { products, categories, settings, orders };
    }
};

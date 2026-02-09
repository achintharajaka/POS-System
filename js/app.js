// app.js - Main Application Logic

const app = {
    state: {
        cart: [],
        products: [],
        categories: [],
        settings: {},
        currentView: 'dashboard'
    },

    async init() {
        console.log("Initializing App...");

        // Load settings
        this.state.settings = await DB.getSettings();
        this.updateStoreDetails();

        // Load data
        await this.loadData();

        // Init Router/View
        this.navigate('dashboard');

        // Setup Search Listener
        document.getElementById('pos-search').addEventListener('input', (e) => this.filterProducts(e.target.value));
        document.getElementById('pos-category-filter').addEventListener('change', (e) => this.filterProducts(document.getElementById('pos-search').value, e.target.value));
    },

    async loadData() {
        this.state.products = await DB.getProducts();
        this.state.categories = await DB.getCategories();
        console.log("Loaded products:", this.state.products.length);
    },

    updateStoreDetails() {
        const { settings } = this.state;
        if (settings.storeName) document.getElementById('store-name').innerText = settings.storeName;

        // Populate settings form
        if (document.getElementById('setting-storeName')) {
            document.getElementById('setting-storeName').value = settings.storeName || '';
            document.getElementById('setting-storeAddress').value = settings.storeAddress || '';
            document.getElementById('setting-currencySymbol').value = settings.currencySymbol || '$';
            document.getElementById('setting-taxRate').value = settings.taxRate || 0;
            document.getElementById('setting-receiptHeader').value = settings.receiptHeader || '';
            document.getElementById('setting-receiptFooter').value = settings.receiptFooter || '';
        }
    },

    navigate(viewId) {
        // Update State
        this.state.currentView = viewId;

        // UI View Switching
        document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
        document.getElementById(`view-${viewId}`).classList.remove('hidden');

        // Render Refresh
        if (viewId === 'dashboard') this.renderDashboard();
        if (viewId === 'pos') this.renderPOS();
        if (viewId === 'inventory') this.renderInventory();
    },

    // --- POS Functions ---

    renderPOS() {
        this.renderProducts();
        this.renderCart();
        this.populateCategoryFilter();
    },

    populateCategoryFilter() {
        const select = document.getElementById('pos-category-filter');
        select.innerHTML = '<option value="">All Categories</option>';
        this.state.categories.forEach(cat => {
            select.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
        });
    },

    renderProducts(filteredProducts = null) {
        const grid = document.getElementById('pos-products-grid');
        grid.innerHTML = '';

        const products = filteredProducts || this.state.products;
        const { currencySymbol } = this.state.settings;

        products.forEach(prod => {
            const card = document.createElement('div');
            card.className = "bg-gray-50 p-4 rounded-lg cursor-pointer hover:bg-blue-50 hover:border-blue-200 border border-transparent transition-all flex flex-col items-center text-center";
            card.onclick = () => this.addToCart(prod);

            card.innerHTML = `
                <div class="h-12 w-12 bg-gray-200 rounded-full flex items-center justify-center text-xl font-bold text-gray-500 mb-2">
                    ${prod.name.charAt(0).toUpperCase()}
                </div>
                <h4 class="font-bold text-gray-800 line-clamp-2">${prod.name}</h4>
                <p class="text-blue-600 font-bold mt-1">${Utils.formatCurrency(prod.price, currencySymbol)}</p>
                <div class="text-xs text-gray-400 mt-1">Stock: ${prod.stock}</div>
            `;
            grid.appendChild(card);
        });
    },

    filterProducts(searchTerm, categoryId) {
        let results = this.state.products;

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            results = results.filter(p =>
                p.name.toLowerCase().includes(term) ||
                (p.barcode && p.barcode.includes(term))
            );
        }

        if (categoryId) {
            results = results.filter(p => p.categoryId == categoryId);
        }

        this.renderProducts(results);

        // Auto-add if exact barcode match
        if (searchTerm && results.length === 1 && results[0].barcode === searchTerm) {
            this.addToCart(results[0]);
            document.getElementById('pos-search').value = '';
            this.renderProducts(this.state.products); // Reset view
        }
    },

    addToCart(product) {
        if (product.stock <= 0) {
            Utils.showToast("Out of Stock!", "error");
            return;
        }

        const existingItem = this.state.cart.find(item => item.id === product.id);

        if (existingItem) {
            if (existingItem.qty >= product.stock) {
                Utils.showToast("Max stock reached!", "error");
                return;
            }
            existingItem.qty++;
        } else {
            this.state.cart.push({ ...product, qty: 1 });
        }

        this.renderCart();
        Utils.showToast("Added to Cart");
    },

    removeFromCart(productId) {
        this.state.cart = this.state.cart.filter(item => item.id !== productId);
        this.renderCart();
    },

    updateCartQty(productId, change) {
        const item = this.state.cart.find(i => i.id === productId);
        if (!item) return;

        const newQty = item.qty + change;

        if (newQty <= 0) {
            this.removeFromCart(productId);
        } else if (newQty > item.stock) {
            Utils.showToast("Exceeds available stock!", "error");
        } else {
            item.qty = newQty;
            this.renderCart();
        }
    },

    renderCart() {
        const container = document.getElementById('pos-cart-items');
        container.innerHTML = '';

        if (this.state.cart.length === 0) {
            container.innerHTML = '<div class="text-center text-gray-400 mt-10">Cart is empty</div>';
            this.updateTotals();
            return;
        }

        const { currencySymbol } = this.state.settings;

        this.state.cart.forEach(item => {
            const div = document.createElement('div');
            div.className = "flex justify-between items-center bg-gray-50 p-2 rounded-lg";
            div.innerHTML = `
                <div class="flex-1">
                    <h5 class="font-bold text-sm text-gray-800">${item.name}</h5>
                    <p class="text-xs text-gray-500">${Utils.formatCurrency(item.price, currencySymbol)} x ${item.qty}</p>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="app.updateCartQty(${item.id}, -1)" class="w-6 h-6 bg-gray-200 rounded flex items-center justify-center hover:bg-gray-300">-</button>
                    <span class="font-bold text-sm w-4 text-center">${item.qty}</span>
                    <button onclick="app.updateCartQty(${item.id}, 1)" class="w-6 h-6 bg-gray-200 rounded flex items-center justify-center hover:bg-gray-300">+</button>
                    <button onclick="app.removeFromCart(${item.id})" class="ml-2 text-red-500 hover:text-red-700">&times;</button>
                </div>
            `;
            container.appendChild(div);
        });

        this.updateTotals();
    },

    updateTotals() {
        let subtotal = 0;
        this.state.cart.forEach(item => subtotal += item.price * item.qty);

        const taxRate = parseFloat(this.state.settings.taxRate) || 0;
        const tax = subtotal * (taxRate / 100);
        const total = subtotal + tax;
        const { currencySymbol } = this.state.settings;

        document.getElementById('cart-subtotal').innerText = Utils.formatCurrency(subtotal, currencySymbol);
        document.getElementById('cart-tax').innerText = Utils.formatCurrency(tax, currencySymbol);
        document.getElementById('cart-tax-rate').innerText = taxRate;
        document.getElementById('cart-total').innerText = Utils.formatCurrency(total, currencySymbol);
    },

    async checkout() {
        if (this.state.cart.length === 0) {
            Utils.showToast("Cart is empty!", "error");
            return;
        }

        const subtotal = this.state.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const taxRate = parseFloat(this.state.settings.taxRate) || 0;
        const tax = subtotal * (taxRate / 100);
        const total = subtotal + tax;

        const order = {
            timestamp: Date.now(),
            subtotal: subtotal,
            tax: tax,
            total: total,
            items: [...this.state.cart], // shallow copy
            paymentMethod: 'cash' // dynamic later
        };

        // Save Order
        await DB.saveOrder(order);

        // Update Stock
        for (const item of this.state.cart) {
            const product = this.state.products.find(p => p.id === item.id);
            if (product) {
                product.stock -= item.qty;
                await DB.updateProduct(product.id, { stock: product.stock });
            }
        }

        // Print Receipt
        const receiptWindow = window.open('', '', 'width=340,height=600');
        receiptWindow.document.write(Utils.generateReceipt(
            this.state.settings.storeName,
            this.state.settings.storeAddress,
            order,
            this.state.settings
        ));

        // Clear Cart & Refresh
        this.state.cart = [];
        this.renderCart();
        await this.loadData();
        this.renderProducts();
        Utils.showToast("Order Completed!");
    },


    // --- Inventory Functions ---

    renderInventory() {
        const tbody = document.getElementById('inventory-table-body');
        tbody.innerHTML = '';

        const { currencySymbol } = this.state.settings;

        this.state.products.forEach(prod => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-gray-50 border-b border-gray-100";
            tr.innerHTML = `
                <td class="p-4 font-medium">${prod.name}</td>
                <td class="p-4 font-mono text-sm text-gray-500">${prod.barcode || '-'}</td>
                <td class="p-4">${Utils.formatCurrency(prod.price, currencySymbol)}</td>
                <td class="p-4 ${prod.stock < 5 ? 'text-red-500 font-bold' : ''}">${prod.stock}</td>
                <td class="p-4 flex gap-2">
                    <button onclick="app.openProductModal(${prod.id})" class="text-blue-600 hover:text-blue-800">Edit</button>
                    <button onclick="app.deleteProduct(${prod.id})" class="text-red-600 hover:text-red-800">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    openProductModal(productId = null) {
        const modal = document.getElementById('product-modal');
        const form = document.getElementById('product-form');
        const title = document.getElementById('modal-title');
        const categorySelect = document.getElementById('prod-category');

        // Populate Categories
        categorySelect.innerHTML = '';
        this.state.categories.forEach(cat => {
            categorySelect.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
        });

        if (productId) {
            const prod = this.state.products.find(p => p.id === productId);
            title.innerText = "Edit Product";
            document.getElementById('prod-id').value = prod.id;
            document.getElementById('prod-name').value = prod.name;
            document.getElementById('prod-barcode').value = prod.barcode;
            document.getElementById('prod-price').value = prod.price;
            document.getElementById('prod-costPrice').value = prod.costPrice;
            document.getElementById('prod-stock').value = prod.stock;
            document.getElementById('prod-category').value = prod.categoryId;
        } else {
            title.innerText = "Add Product";
            form.reset();
            document.getElementById('prod-id').value = '';
        }

        modal.classList.remove('hidden');
    },

    closeProductModal() {
        document.getElementById('product-modal').classList.add('hidden');
    },

    async saveProduct(event) {
        event.preventDefault();

        const id = document.getElementById('prod-id').value;
        const product = {
            name: document.getElementById('prod-name').value,
            barcode: document.getElementById('prod-barcode').value,
            price: parseFloat(document.getElementById('prod-price').value),
            costPrice: parseFloat(document.getElementById('prod-costPrice').value),
            stock: parseInt(document.getElementById('prod-stock').value),
            categoryId: parseInt(document.getElementById('prod-category').value)
        };

        if (product.price < 0) {
            Utils.showToast("Price cannot be negative", "error");
            return;
        }

        if (id) {
            await DB.updateProduct(parseInt(id), product);
            Utils.showToast("Product Updated");
        } else {
            await DB.addProduct(product);
            Utils.showToast("Product Added");
        }

        this.closeProductModal();
        await this.loadData();
        this.renderInventory();
    },

    async deleteProduct(id) {
        if (confirm("Are you sure you want to delete this product?")) {
            await DB.deleteProduct(id);
            await this.loadData();
            this.renderInventory();
            Utils.showToast("Product Deleted");
        }
    },

    // --- Settings Functions ---

    async saveSettings(event) {
        event.preventDefault();
        const form = document.getElementById('settings-form');
        const formData = new FormData(form);

        const updates = [];
        for (let [key, value] of formData.entries()) {
            updates.push(DB.updateSetting(key, value));
        }

        await Promise.all(updates);

        // Reload settings
        this.state.settings = await DB.getSettings();
        this.updateStoreDetails();
        Utils.showToast("Settings Saved");
    },

    // --- Dashboard Functions ---

    async renderDashboard() {
        const orders = await DB.getOrders();

        // Calculate Daily Sales (Simple approach: filters for today local time)
        const today = new Date().setHours(0, 0, 0, 0);
        const todayOrders = orders.filter(o => o.timestamp >= today);
        const dailySales = todayOrders.reduce((sum, o) => sum + o.total, 0);

        // Low stock
        const lowStock = this.state.products.filter(p => p.stock < 5).length;

        const { currencySymbol } = this.state.settings;
        document.getElementById('dash-daily-sales').innerText = Utils.formatCurrency(dailySales, currencySymbol);
        document.getElementById('dash-total-orders').innerText = todayOrders.length;
        document.getElementById('dash-low-stock').innerText = lowStock;
    },

    // --- Data Import/Export ---
    async exportData() {
        const data = await DB.exportData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pos_backup_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        Utils.showToast("Data Exported");
    },

    async importData(input) {
        const file = input.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                await DB.importData(data);
                await this.loadData();
                this.updateStoreDetails();
                Utils.showToast("Data Imported Successfully");
                setTimeout(() => location.reload(), 1500); // Reload to refresh everything
            } catch (err) {
                console.error(err);
                Utils.showToast("Invalid Data File", "error");
            }
        };
        reader.readAsText(file);
    }
};

// Initialize on load
window.addEventListener('DOMContentLoaded', () => app.init());

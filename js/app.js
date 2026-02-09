// app.js - Main Application Logic v2

const app = {
    state: {
        cart: [],
        products: [],
        categories: [],
        settings: {},
        currentView: 'dashboard',
        currentOrder: null // For modal
    },

    async init() {
        console.log("Initializing App v2...");

        // Load settings
        this.state.settings = await DB.getSettings();
        this.applyTheme();
        this.updateStoreDetails();

        // Load data
        await this.loadData();

        // Init Router/View
        this.navigate('dashboard');

        // Setup Search Listener
        document.getElementById('pos-search').addEventListener('input', (e) => this.filterProducts(e.target.value));
        document.getElementById('pos-category-filter').addEventListener('change', (e) => this.filterProducts(document.getElementById('pos-search').value, e.target.value));

        // Setup Logo Upload Listener
        document.getElementById('setting-logo-upload').addEventListener('change', (e) => this.handleLogoUpload(e));
    },

    async loadData() {
        this.state.products = await DB.getProducts();
        this.state.categories = await DB.getCategories();
        console.log("Loaded products:", this.state.products.length);
        this.renderCategoryList(); // Update settings list
    },

    // --- Theme & Settings ---

    applyTheme() {
        const theme = localStorage.getItem('pos_theme') || 'light';
        const html = document.querySelector('html');
        const iconMoon = document.getElementById('theme-icon-moon');
        const iconSun = document.getElementById('theme-icon-sun');

        if (theme === 'dark') {
            html.classList.add('dark');
            iconMoon.classList.remove('hidden');
            iconSun.classList.add('hidden');
        } else {
            html.classList.remove('dark');
            iconMoon.classList.add('hidden');
            iconSun.classList.remove('hidden');
        }
    },

    toggleTheme() {
        const current = localStorage.getItem('pos_theme') || 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        localStorage.setItem('pos_theme', next);
        this.applyTheme();
    },

    updateStoreDetails() {
        const { settings } = this.state;
        if (settings.storeName) document.getElementById('store-name').innerText = settings.storeName;

        // Logo
        const logoContainer = document.getElementById('nav-logo-container');
        const defaultLogo = document.getElementById('default-logo-text');
        const imgLogo = document.getElementById('nav-logo-img');

        if (settings.storeLogo) {
            imgLogo.src = settings.storeLogo;
            imgLogo.classList.remove('hidden');
            defaultLogo.classList.add('hidden');
        } else {
            imgLogo.classList.add('hidden');
            defaultLogo.classList.remove('hidden');
        }

        // Populate settings form
        if (document.getElementById('setting-storeName')) {
            document.getElementById('setting-storeName').value = settings.storeName || '';
            document.getElementById('setting-storeAddress').value = settings.storeAddress || '';
            document.getElementById('setting-currencySymbol').value = settings.currencySymbol || '$';
            document.getElementById('setting-taxRate').value = settings.taxRate || 0;
            document.getElementById('setting-receiptHeader').value = settings.receiptHeader || '';
            document.getElementById('setting-receiptFooter').value = settings.receiptFooter || '';
            document.getElementById('setting-storeLogo').value = settings.storeLogo || '';
        }
    },

    handleLogoUpload(event) {
        const file = event.target.files[0];
        if (file) {
            if (file.size > 1024 * 1024) { // 1MB limit
                Utils.showToast("Image too large (Max 1MB)", "error");
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                const base64 = e.target.result;
                document.getElementById('setting-storeLogo').value = base64; // Store in hidden field until save
                Utils.showToast("Logo selected. Click Save to apply.");
            };
            reader.readAsDataURL(file);
        }
    },

    async saveSettings(event) {
        event.preventDefault();
        const form = document.getElementById('settings-form');
        const formData = new FormData(form);

        const updates = [];
        for (let [key, value] of formData.entries()) {
            updates.push(DB.updateSetting(key, value));
        }

        await Promise.all(updates);

        this.state.settings = await DB.getSettings();
        this.updateStoreDetails();
        Utils.showToast("Settings Saved");

        // Refresh products and other views to apply currency changes
        this.renderProducts();
        this.renderInventory();
    },

    // --- Category Management ---

    async addCategory() {
        const input = document.getElementById('new-category-name');
        const name = input.value.trim();
        if (!name) return;

        await DB.addCategory(name);
        input.value = '';
        await this.loadData();
        Utils.showToast("Category Added");
    },

    async deleteCategory(id) {
        if (confirm("Delete this category?")) {
            await DB.deleteCategory(id);
            await this.loadData();
            Utils.showToast("Category Deleted");
        }
    },

    renderCategoryList() {
        // Settings List
        const list = document.getElementById('settings-category-list');
        list.innerHTML = '';
        this.state.categories.forEach(cat => {
            const li = document.createElement('li');
            li.className = "flex justify-between items-center bg-gray-50 dark:bg-gray-700 p-2 rounded";
            li.innerHTML = `
                <span class="dark:text-white">${cat.name}</span>
                <button onclick="app.deleteCategory(${cat.id})" class="text-red-500 hover:text-red-700">&times;</button>
            `;
            list.appendChild(li);
        });

        // POS Filter
        this.populateCategoryFilter();
    },

    navigate(viewId) {
        this.state.currentView = viewId;
        document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
        document.getElementById(`view-${viewId}`).classList.remove('hidden');

        if (viewId === 'dashboard') this.renderDashboard();
        if (viewId === 'pos') this.renderPOS();
        if (viewId === 'inventory') this.renderInventory();
    },

    // --- POS Functions ---

    renderPOS() {
        this.renderProducts();
        this.renderCart();
    },

    populateCategoryFilter() {
        const select = document.getElementById('pos-category-filter');
        select.innerHTML = '<option value="">All Categories</option>';
        this.state.categories.forEach(cat => {
            select.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
        });

        const prodSelect = document.getElementById('prod-category');
        prodSelect.innerHTML = '';
        this.state.categories.forEach(cat => {
            prodSelect.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
        });
    },

    renderProducts(filteredProducts = null) {
        const grid = document.getElementById('pos-products-grid');
        grid.innerHTML = '';

        const products = filteredProducts || this.state.products;
        const { currencySymbol } = this.state.settings;

        products.forEach(prod => {
            const card = document.createElement('div');
            card.className = "bg-white dark:bg-gray-800 p-4 rounded-lg cursor-pointer hover:bg-blue-50 dark:hover:bg-gray-700 border border-transparent transition-all flex flex-col items-center text-center shadow-sm";
            card.onclick = () => this.addToCart(prod);

            card.innerHTML = `
                <div class="h-12 w-12 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-xl font-bold text-gray-500 dark:text-gray-400 mb-2">
                    ${prod.name.charAt(0).toUpperCase()}
                </div>
                <h4 class="font-bold text-gray-800 dark:text-gray-200 line-clamp-2">${prod.name}</h4>
                <p class="text-blue-600 dark:text-blue-400 font-bold mt-1">${Utils.formatCurrency(prod.price, currencySymbol)}</p>
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

    clearCart() {
        if (confirm("Clear current cart?")) {
            this.state.cart = [];
            this.renderCart();
        }
    },

    renderCart() {
        const container = document.getElementById('pos-cart-items');
        container.innerHTML = '';

        if (this.state.cart.length === 0) {
            container.innerHTML = '<div class="text-center text-gray-400 dark:text-gray-500 mt-10">Cart is empty</div>';
            this.updateTotals();
            return;
        }

        const { currencySymbol } = this.state.settings;

        this.state.cart.forEach(item => {
            const div = document.createElement('div');
            div.className = "flex justify-between items-center bg-gray-50 dark:bg-gray-700 p-2 rounded-lg";
            div.innerHTML = `
                <div class="flex-1">
                    <h5 class="font-bold text-sm text-gray-800 dark:text-white">${item.name}</h5>
                    <p class="text-xs text-gray-500 dark:text-gray-400">${Utils.formatCurrency(item.price, currencySymbol)} x ${item.qty}</p>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="app.updateCartQty(${item.id}, -1)" class="w-6 h-6 bg-gray-200 dark:bg-gray-600 dark:text-white rounded flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-500">-</button>
                    <span class="font-bold text-sm w-4 text-center dark:text-white">${item.qty}</span>
                    <button onclick="app.updateCartQty(${item.id}, 1)" class="w-6 h-6 bg-gray-200 dark:bg-gray-600 dark:text-white rounded flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-500">+</button>
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
            items: [...this.state.cart],
            paymentMethod: 'cash'
        };

        await DB.saveOrder(order);

        // Update Stock
        for (const item of this.state.cart) {
            const product = this.state.products.find(p => p.id === item.id);
            if (product) {
                product.stock -= item.qty;
                await DB.updateProduct(product.id, { stock: product.stock });
            }
        }

        // Print Receipt (New requirements: Time & Date added in utils)
        const receiptWindow = window.open('', '', 'width=340,height=600');
        receiptWindow.document.write(Utils.generateReceipt(
            this.state.settings.storeName,
            this.state.settings.storeAddress,
            order,
            this.state.settings,
            this.state.settings.storeLogo
        ));

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
            tr.className = "hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 transition-colors";
            tr.innerHTML = `
                <td class="p-4 font-medium dark:text-white">${prod.name}</td>
                <td class="p-4 font-mono text-sm text-gray-500 dark:text-gray-400">${prod.barcode || '-'}</td>
                <td class="p-4 dark:text-white">${Utils.formatCurrency(prod.price, currencySymbol)}</td>
                <td class="p-4 ${prod.stock < 5 ? 'text-red-500 font-bold' : 'dark:text-white'}">${prod.stock}</td>
                <td class="p-4 flex gap-2">
                    <button onclick="app.openProductModal(${prod.id})" class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">Edit</button>
                    <button onclick="app.deleteProduct(${prod.id})" class="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    openProductModal(productId = null) {
        const modal = document.getElementById('product-modal');
        const form = document.getElementById('product-form');
        const title = document.getElementById('modal-title');

        // Ensure categories are refreshed
        const categorySelect = document.getElementById('prod-category');
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
        this.renderInventory(); // Refresh view
    },

    async deleteProduct(id) {
        if (confirm("Are you sure you want to delete this product?")) {
            await DB.deleteProduct(id);
            await this.loadData();
            this.renderInventory();
            Utils.showToast("Product Deleted");
        }
    },

    // --- Dashboard & History Functions ---

    async renderDashboard() {
        const orders = await DB.getOrders();

        // Stats
        const today = new Date().setHours(0, 0, 0, 0);
        const todayOrders = orders.filter(o => o.timestamp >= today);
        const dailySales = todayOrders.reduce((sum, o) => sum + o.total, 0);
        const lowStock = this.state.products.filter(p => p.stock < 5).length;
        const { currencySymbol } = this.state.settings;

        document.getElementById('dash-daily-sales').innerText = Utils.formatCurrency(dailySales, currencySymbol);
        document.getElementById('dash-total-orders').innerText = todayOrders.length;
        document.getElementById('dash-low-stock').innerText = lowStock;

        // History Table
        const tbody = document.getElementById('dashboard-history-body');
        tbody.innerHTML = '';

        // Show last 50 orders max for performance if list is huge
        orders.slice(0, 50).forEach(order => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 transition-colors";
            tr.innerHTML = `
                <td class="p-4 font-mono text-sm text-gray-500 dark:text-gray-400">#${order.id}</td>
                <td class="p-4 dark:text-gray-300">${Utils.formatDate(order.timestamp)}</td>
                <td class="p-4 dark:text-gray-300">${order.items.length} Items</td>
                <td class="p-4 font-bold dark:text-white">${Utils.formatCurrency(order.total, currencySymbol)}</td>
                <td class="p-4 flex gap-2">
                    <button onclick="app.viewOrder(${order.id})" class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">View</button>
                    <button onclick="app.deleteOrder(${order.id})" class="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    async viewOrder(id) {
        const orders = await DB.getOrders(); // Cache efficient? Maybe fetch single if needed
        const order = orders.find(o => o.id === id);
        if (!order) return;

        this.state.currentOrder = order;

        const modal = document.getElementById('order-modal');
        const content = document.getElementById('order-modal-content');
        const { currencySymbol } = this.state.settings;

        let itemsHtml = order.items.map(item => `
            <div class="flex justify-between py-2 border-b dark:border-gray-700">
                <div>
                    <span class="font-bold">${item.name}</span>
                    <div class="text-xs text-gray-500">${item.qty} x ${Utils.formatCurrency(item.price, currencySymbol)}</div>
                </div>
                <span>${Utils.formatCurrency(item.price * item.qty, currencySymbol)}</span>
            </div>
        `).join('');

        content.innerHTML = `
            <div class="mb-4">
                <p><strong>Order ID:</strong> #${order.id}</p>
                <p><strong>Date:</strong> ${Utils.formatDate(order.timestamp)}</p>
            </div>
            <div class="mb-4">
                ${itemsHtml}
            </div>
            <div class="border-t dark:border-gray-700 pt-2 space-y-1">
                <div class="flex justify-between"><span>Subtotal</span><span>${Utils.formatCurrency(order.subtotal, currencySymbol)}</span></div>
                <div class="flex justify-between"><span>Tax</span><span>${Utils.formatCurrency(order.tax, currencySymbol)}</span></div>
                <div class="flex justify-between font-bold text-lg mt-2"><span>Total</span><span>${Utils.formatCurrency(order.total, currencySymbol)}</span></div>
            </div>
        `;

        modal.classList.remove('hidden');
    },

    closeOrderModal() {
        document.getElementById('order-modal').classList.add('hidden');
        this.state.currentOrder = null;
    },

    async deleteOrder(id) {
        if (confirm("Delete this order record? This cannot be undone.")) {
            await DB.deleteOrder(id);
            this.renderDashboard();
            Utils.showToast("Order Deleted");
        }
    },

    printOrder() {
        if (!this.state.currentOrder) return;
        const receiptWindow = window.open('', '', 'width=340,height=600');
        receiptWindow.document.write(Utils.generateReceipt(
            this.state.settings.storeName,
            this.state.settings.storeAddress,
            this.state.currentOrder,
            this.state.settings,
            this.state.settings.storeLogo
        ));
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
                setTimeout(() => location.reload(), 1500);
            } catch (err) {
                console.error(err);
                Utils.showToast("Invalid Data File", "error");
            }
        };
        reader.readAsText(file);
    }
};

window.addEventListener('DOMContentLoaded', () => app.init());

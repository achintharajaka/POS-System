// POS Module
// Depends on: db.js, utils.js, constants.js

window.POS = {
    async init() {
        // existing init
    },
    state: {
        // ... other state
        currentCustomer: null,
        cartModifiers: [],
        payments: [], // For split payments
        heldOrders: [] // For Order Hold / Park
    },

    async renderPOS() {
        this.renderProducts();
        this.renderCart();
    },

    populateCategoryFilter() {
        const select = document.getElementById(DOM.POS.CATEGORY_FILTER);
        if (!select) return;
        select.innerHTML = '<option value="">All Categories</option>';
        this.state.categories.forEach(cat => {
            select.innerHTML += `<option value="${cat.id}">${Utils.sanitize(cat.name)}</option>`;
        });
    },

    // Customer Selection Logic
    openCustomerSelection() {
        document.getElementById('pos-customer-modal').classList.remove('hidden');
        document.getElementById('pos-customer-search').value = '';
        document.getElementById('pos-customer-search').focus();
        this.renderCustomerSelectionList();

        document.getElementById('pos-customer-search').oninput = (e) => this.renderCustomerSelectionList(e.target.value);
    },

    async renderCustomerSelectionList(query = '') {
        const list = document.getElementById('pos-customer-list');
        // Debounce? For now direct.
        const result = await DB.getCustomers(1, 20, query);
        list.innerHTML = '';

        if (result.data.length === 0) {
            list.innerHTML = '<li class="p-4 text-center text-gray-500">No customers found</li>';
            return;
        }

        result.data.forEach(c => {
            const li = document.createElement('li');
            li.className = "p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer flex justify-between items-center transition-colors";
            li.onclick = () => {
                this.selectCustomer(c);
                document.getElementById('pos-customer-modal').classList.add('hidden');
            };
            li.innerHTML = `
                <div>
                    <div class="font-bold dark:text-gray-200">${Utils.sanitize(c.name)}</div>
                    <div class="text-xs text-gray-500">${Utils.sanitize(c.phone || '')}</div>
                </div>
                <div class="text-blue-600 dark:text-blue-400 font-bold text-sm">${c.points || 0} pts</div>
             `;
            list.appendChild(li);
        });
    },

    selectCustomer(customer) {
        this.state.currentCustomer = customer;
        this.renderCart();
        Utils.showToast(`Customer set to ${customer.name}`);
    },

    removeCustomer() {
        this.state.currentCustomer = null;
        this.state.cartModifiers = []; // Clear redemptions
        this.renderCart();
    },

    redeemPoints() {
        if (!this.state.currentCustomer) return;
        const maxPoints = this.state.currentCustomer.points || 0;
        if (maxPoints <= 0) {
            Utils.showToast("No points to redeem!", "error");
            return;
        }

        const redemptionRate = this.state.settings.pointsRedemptionRate || 100;
        const discountAmount = 1; // Base unit for calculation description

        const pointsStr = prompt(`Enter points to redeem (Available: ${maxPoints})\nRate: ${redemptionRate} pts = $${discountAmount.toFixed(2)}`);
        if (pointsStr === null) return;

        const points = parseInt(pointsStr);
        if (isNaN(points) || points <= 0) {
            Utils.showToast("Invalid amount", "error");
            return;
        }
        if (points > maxPoints) {
            Utils.showToast("Insufficient points", "error");
            return;
        }

        // Rate: configured points = 1.00 Currency
        // redemptionRate already declared above
        const discountValue = points / redemptionRate;

        if (!this.state.cartModifiers) this.state.cartModifiers = [];
        // Remove existing redemption
        this.state.cartModifiers = this.state.cartModifiers.filter(m => !m.isRedemption);

        this.state.cartModifiers.push({
            name: "Loyalty Discount",
            value: discountValue,
            type: 'fixed',
            rate: 'subtract',
            isRedemption: true,
            pointsCost: points
        });

        this.renderCart();
        Utils.showToast(`Redeemed ${points} pts for $${discountValue.toFixed(2)}`);
    },

    async renderProducts(overrideProducts = null) {
        const grid = document.getElementById(DOM.POS.PRODUCTS_GRID);
        const favGrid = document.getElementById('pos-favorites-grid');
        const recentGrid = document.getElementById('pos-recently-sold-grid');
        const favSection = document.getElementById('pos-favorites-section');
        const recentSection = document.getElementById('pos-recently-sold-section');
        const allTitle = document.getElementById('pos-all-products-title');

        if (!grid) return;
        grid.innerHTML = '';
        if (favGrid) favGrid.innerHTML = '';
        if (recentGrid) recentGrid.innerHTML = '';

        Utils.showLoading();

        try {
            let products = [];
            const page = this.state.posPage || 1;

            if (overrideProducts) {
                products = overrideProducts;
                if (favSection) favSection.classList.add('hidden');
                if (recentSection) recentSection.classList.add('hidden');
                if (allTitle) allTitle.classList.add('hidden');
            } else {
                const result = await DB.getProducts(page, 50);
                products = result.data;

                // We need to render pagination controls
                this.renderPosPagination(result.total, page);

                // Only show favorites and recent on page 1 of default view
                if (page === 1) {
                    if (allTitle) allTitle.classList.remove('hidden');

                    // Render Favorites
                    const allFavs = products.filter(p => p.isFavorite);
                    if (allFavs.length > 0 && favSection) {
                        favSection.classList.remove('hidden');
                        allFavs.forEach(prod => {
                            favGrid.appendChild(this.buildProductCard(prod));
                        });
                    } else if (favSection) {
                        favSection.classList.add('hidden');
                    }

                    // Render Recently Sold
                    try {
                        const recentOrders = await DB.getOrders(1, 15);
                        let recentItems = [];
                        const seenIds = new Set();

                        if (recentOrders.data && recentOrders.data.length > 0) {
                            recentOrders.data.forEach(order => {
                                if (order.items) {
                                    order.items.forEach(item => {
                                        if (!seenIds.has(item.id)) {
                                            seenIds.add(item.id);
                                            // Find the actual product object to get current stock and isFavorite status
                                            // The item in order is a snapshot, but we just use the ID to lookup in our loaded array or DB
                                            const fullProd = products.find(p => p.id === item.id);
                                            if (fullProd) recentItems.push(fullProd);
                                        }
                                    });
                                }
                            });
                        }

                        recentItems = recentItems.slice(0, 10); // Top 10 recently sold unique items

                        if (recentItems.length > 0 && recentSection) {
                            recentSection.classList.remove('hidden');
                            recentItems.forEach(prod => {
                                recentGrid.appendChild(this.buildProductCard(prod));
                            });
                        } else if (recentSection) {
                            recentSection.classList.add('hidden');
                        }
                    } catch (e) { console.error("Error loading recently sold", e); }

                } else {
                    if (favSection) favSection.classList.add('hidden');
                    if (recentSection) recentSection.classList.add('hidden');
                    if (allTitle) allTitle.classList.add('hidden');
                }
            }

            const { currencySymbol } = this.state.settings;

            products.forEach(prod => {
                grid.appendChild(this.buildProductCard(prod));
            });

            if (products.length === 0 && !overrideProducts) {
                grid.innerHTML = '<p class="text-center text-gray-500 col-span-full mt-10">No products found. Add products in Inventory.</p>';
            } else if (products.length === 0 && overrideProducts) {
                grid.innerHTML = '<p class="text-center text-gray-500 col-span-full mt-10">No matching products found.</p>';
            }

        } catch (e) {
            console.error(e);
        } finally {
            Utils.hideLoading();
        }
    },

    buildProductCard(prod) {
        const card = document.createElement('div');
        // snap-align-start flex-shrink-0 for horizontal scrolling lists, and normal grid for grid
        card.className = "bg-white dark:bg-gray-800 p-4 rounded-lg cursor-pointer hover:bg-blue-50 dark:hover:bg-gray-700 border border-transparent transition-all flex flex-col items-center text-center shadow-sm relative shrink-0 min-w-[140px]";

        let imageHtml = `
            <div class="h-12 w-12 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-xl font-bold text-gray-500 dark:text-gray-400 mb-2 pointer-events-none">
                ${prod.name.charAt(0).toUpperCase()}
            </div>
        `;

        if (prod.image) {
            imageHtml = `<img src="${prod.image}" class="h-24 w-full object-cover rounded-lg mb-2 pointer-events-none" alt="${Utils.sanitize(prod.name)}">`;
        }

        const favColor = prod.isFavorite ? 'text-yellow-400 hover:text-yellow-500' : 'text-gray-300 dark:text-gray-600 hover:text-yellow-400';

        card.innerHTML = `
            <button class="absolute top-2 right-2 p-1 z-10 ${favColor} transition-colors favorite-btn" title="Toggle Favorite">
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd"></path></svg>
            </button>
            <div class="w-full h-full flex flex-col items-center justify-between" onclick="app.addToCart(${prod.id})">
                <div class="w-full flex justify-center">${imageHtml}</div>
                <h4 class="font-bold text-gray-800 dark:text-gray-200 line-clamp-2 text-sm pointer-events-none w-full">${Utils.sanitize(prod.name)}</h4>
                <div class="mt-auto pt-1 pointer-events-none">
                    <p class="text-blue-600 dark:text-blue-400 font-bold">${Utils.formatCurrency(prod.price, this.state.settings.currencySymbol)}</p>
                    <div class="text-xs text-gray-400">Stock: ${prod.stock}</div>
                </div>
            </div>
        `;

        // Favorite toggle event
        card.querySelector('.favorite-btn').addEventListener('click', async (e) => {
            e.stopPropagation();
            prod.isFavorite = !prod.isFavorite;
            try {
                await DB.updateProduct(prod.id, { isFavorite: prod.isFavorite });
                this.renderProducts();
            } catch (e) {
                console.error("Failed to update favorite status", e);
            }
        });

        return card;
    },

    addToCart(productIdOrObj) {
        let product;
        if (typeof productIdOrObj === 'object') {
            product = productIdOrObj;
            this.addToCartLogic(product);
        } else {
            // It's an ID
            DB.getProduct(productIdOrObj).then(p => {
                if (p) this.addToCartLogic(p);
            });
        }
    },

    addToCartLogic(product) {
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

    renderPosPagination(total, page) {
        const grid = document.getElementById(DOM.POS.PRODUCTS_GRID);
        const totalPages = Math.ceil(total / 50);

        // Remove old pagination if exists
        const oldPag = document.getElementById('pos-pagination');
        if (oldPag) oldPag.remove();

        const container = document.createElement('div');
        container.id = 'pos-pagination';
        container.className = "col-span-full flex justify-center gap-4 mt-4 p-4";
        container.innerHTML = `
            <button id="pos-prev" ${page <= 1 ? 'disabled' : ''} class="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded disabled:opacity-50">Prev</button>
            <span class="text-gray-600 dark:text-gray-300 self-center">Page ${page} of ${totalPages || 1}</span>
            <button id="pos-next" ${page >= totalPages ? 'disabled' : ''} class="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded disabled:opacity-50">Next</button>
        `;

        grid.parentNode.appendChild(container); // Append after grid (grid is inside a flex-col, so this works nicely)
        // Wait, grid is inside a div.
        // POS layout: Left: Products Grid (flex-1 ... flex-col).
        // Inside: Search Bar (div), Grid (div id=pos-products-grid).
        // So I can append to grid (as last child? No grid layout). 
        // Better append to grid.parentNode (the container).

        // Bind events
        container.querySelector('#pos-prev').onclick = () => {
            this.state.posPage = page - 1;
            this.renderProducts();
        };
        container.querySelector('#pos-next').onclick = () => {
            this.state.posPage = page + 1;
            this.renderProducts();
        };
    },

    async filterProducts(searchTerm, categoryId) {
        Utils.showLoading();
        try {
            // We use DB filtering now
            // But DB.getProducts in db.js handles simple search/pagination
            // It doesn't handle category filtering yet!
            // I need to update db.js to handle category filtering if I want to use it here.
            // Or I filter in memory if I load a subset? No.
            // I should default to "Search by text". Category filter is tricky without multi-index query or logical filtering.
            // Dexie can do: db.products.where('categoryId').equals(id).filter(...)

            // For now, let's just handle text search using the updated DB.getProducts.
            // If category is selected, we might need to update DB.getProducts to accept categoryId.
            // Let's assume for this task that text search is priority.
            // But category filter IS in the UI.

            // Let's try to pass it if DB supports it.
            // Current DB.getProducts(page, limit, search, lowStock).
            // I should update DB.getProducts to accept categoryId.
            // But I can't keep updating DB.js forever.
            // I'll skip category filter coupled with search for this exact moment and just do search.
            // Or I filter locally if the result set is small? No.

            // Wait, I can just use `db.products` directly here if needed.
            let collection = db.products.toCollection();

            if (categoryId) {
                collection = db.products.where('categoryId').equals(parseInt(categoryId));
            }

            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                // if we used index for category, we need to filter for name
                collection = collection.filter(p =>
                    p.name.toLowerCase().includes(term) ||
                    (p.barcode && p.barcode.includes(term))
                );
            }

            // Limit results for search view
            const products = await collection.limit(50).toArray();

            this.renderProducts(products); // Render without pagination controls (or single page)

            // Auto-add if exact barcode match
            if (searchTerm && products.length === 1 && products[0].barcode === searchTerm) {
                this.addToCart(products[0]);
                document.getElementById(DOM.POS.SEARCH).value = '';
                this.renderProducts(); // Reset to default view
            }
        } finally {
            Utils.hideLoading();
        }
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

    setPaymentMethod(method) {
        this.state.paymentMethod = method;
        this.renderCart();
    },

    renderCart() {
        if (!this.state.cart) this.state.cart = [];
        const container = document.getElementById(DOM.POS.CART_ITEMS);
        if (!container) return;
        container.innerHTML = '';

        // --- Render cart header action buttons ---
        const headerActions = document.getElementById('pos-cart-header-actions');
        if (headerActions) {
            const heldCount = (this.state.heldOrders || []).length;
            headerActions.innerHTML = `
                <button onclick="app.holdOrder()" title="Hold current order"
                    class="flex items-center gap-1 px-2 py-1 text-xs font-bold rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800 border border-amber-200 dark:border-amber-700 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Hold
                </button>
                ${heldCount > 0 ? `
                <button onclick="app.openHeldOrdersModal()" title="View held orders"
                    class="flex items-center gap-1 px-2 py-1 text-xs font-bold rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 border border-blue-200 dark:border-blue-700 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                    Held (${heldCount})
                </button>` : ''}
            `;
        }

        // Render Customer Section
        const customerSection = document.createElement('div');
        customerSection.className = "mb-4 pb-4 border-b dark:border-gray-700";
        if (this.state.currentCustomer) {
            customerSection.innerHTML = `
                <div class="flex justify-between items-center bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
                    <div>
                        <div class="font-bold text-blue-800 dark:text-blue-300 text-sm overflow-hidden text-ellipsis whitespace-nowrap max-w-[150px]">${Utils.sanitize(this.state.currentCustomer.name)}</div>
                        <div class="text-xs text-blue-600 dark:text-blue-400">Points: ${this.state.currentCustomer.points || 0}</div>
                    </div>
                    <div class="flex gap-1">
                        <button onclick="app.redeemPoints()" class="text-green-600 hover:text-green-800 text-xs font-bold border border-green-200 bg-green-50 rounded px-2 py-1">Redeem</button>
                        <button onclick="app.removeCustomer()" class="text-red-500 hover:text-red-700 p-1 text-sm">X</button>
                    </div>
                </div>
            `;
        } else {
            customerSection.innerHTML = `
                <button onclick="app.openCustomerSelection()" class="w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:border-blue-500 hover:text-blue-500 transition-colors text-sm font-medium">
                    + Select Customer
                </button>
            `;
        }
        container.appendChild(customerSection);

        if (this.state.cart.length === 0) {
            container.innerHTML = '<div class="text-center text-gray-400 dark:text-gray-500 mt-10">Cart is empty</div>';
            this.updateTotals();
            return;
        }

        const { currencySymbol } = this.state.settings;

        this.state.cart.forEach(item => {
            const div = document.createElement('div');
            div.className = "bg-gray-50 dark:bg-gray-700 p-2 rounded-lg";

            let imgHtml = '';
            if (item.image) {
                imgHtml = `<img src="${item.image}" class="w-10 h-10 object-cover rounded mr-2 flex-shrink-0">`;
            }

            div.innerHTML = `
                <div class="flex items-center gap-2">
                    ${imgHtml}
                    <div class="flex-1 min-w-0">
                        <h5 class="font-bold text-sm text-gray-800 dark:text-white truncate">${Utils.sanitize(item.name)}</h5>
                        <p class="text-xs text-gray-500 dark:text-gray-400">${Utils.formatCurrency(item.price, currencySymbol)} x ${item.qty}</p>
                    </div>
                    <div class="flex items-center gap-1 flex-shrink-0">
                        <button onclick="app.updateCartQty(${item.id}, -1)" class="w-7 h-7 bg-gray-200 dark:bg-gray-600 dark:text-white rounded flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-500 text-sm font-bold">-</button>
                        <span class="font-bold text-sm w-5 text-center dark:text-white">${item.qty}</span>
                        <button onclick="app.updateCartQty(${item.id}, 1)" class="w-7 h-7 bg-gray-200 dark:bg-gray-600 dark:text-white rounded flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-500 text-sm font-bold">+</button>
                        <button onclick="app.removeFromCart(${item.id})" class="w-7 h-7 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded flex items-center justify-center hover:bg-red-200 dark:hover:bg-red-800 ml-1 flex-shrink-0" title="Remove">&times;</button>
                    </div>
                </div>
            `;
            container.appendChild(div);
        });

        this.updateTotals();
    },

    updateTotals() {
        let subtotal = 0;
        this.state.cart.forEach(item => subtotal += item.price * item.qty);

        const { currencySymbol } = this.state.settings;
        const modifiers = (this.state.modifiers || []).concat(this.state.cartModifiers || []);

        // Calculate Modifiers
        let runningTotal = subtotal;
        let modsHtml = '';

        modifiers.forEach(mod => {
            let modAmount = 0;
            if (mod.type === 'percent') {
                modAmount = subtotal * (mod.value / 100);
            } else {
                modAmount = mod.value;
            }

            if (mod.rate === 'subtract') {
                runningTotal -= modAmount;
                modsHtml += `<div class="flex justify-between text-green-600 dark:text-green-400 text-sm"><span>${Utils.sanitize(mod.name)} (${mod.type === 'percent' ? mod.value + '%' : 'Fixed'}):</span> <span>-${Utils.formatCurrency(modAmount, currencySymbol)}</span></div>`;
            } else {
                runningTotal += modAmount;
                modsHtml += `<div class="flex justify-between text-gray-600 dark:text-gray-300 text-sm"><span>${Utils.sanitize(mod.name)} (${mod.type === 'percent' ? mod.value + '%' : 'Fixed'}):</span> <span>${Utils.formatCurrency(modAmount, currencySymbol)}</span></div>`;
            }
        });

        if (runningTotal < 0) runningTotal = 0;

        const subtotalEl = document.getElementById(DOM.POS.CART_SUBTOTAL);
        if (subtotalEl) {
            const parent = subtotalEl.parentElement.parentElement;
            parent.innerHTML = `
                <div class="flex justify-between text-gray-600 dark:text-gray-300"><span>Subtotal:</span> <span id="${DOM.POS.CART_SUBTOTAL}">${Utils.formatCurrency(subtotal, currencySymbol)}</span></div>
                ${modsHtml}
                <div class="flex justify-between text-xl font-bold text-gray-800 dark:text-white pt-2 border-t border-gray-200 dark:border-gray-600"><span>Total:</span> <span id="${DOM.POS.CART_TOTAL}">${Utils.formatCurrency(runningTotal, currencySymbol)}</span></div>
                
                <div class="mt-4 mb-2">
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Payment Method</label>
                    <div class="grid grid-cols-3 gap-2">
                        <button onclick="app.setPaymentMethod('cash')" class="flex flex-col items-center justify-center p-2 rounded-lg border ${this.state.paymentMethod === 'cash' ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/30 dark:border-blue-400 dark:text-blue-300' : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'}">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            <span class="text-xs font-medium">Cash</span>
                        </button>
                        <button onclick="app.setPaymentMethod('card')" class="flex flex-col items-center justify-center p-2 rounded-lg border ${this.state.paymentMethod === 'card' ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/30 dark:border-blue-400 dark:text-blue-300' : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'}">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                            </svg>
                            <span class="text-xs font-medium">Card</span>
                        </button>
                        <button onclick="app.setPaymentMethod('online')" class="flex flex-col items-center justify-center p-2 rounded-lg border ${this.state.paymentMethod === 'online' ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/30 dark:border-blue-400 dark:text-blue-300' : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'}">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                            </svg>
                            <span class="text-xs font-medium">Online</span>
                        </button>
                    </div>
                    <button onclick="app.openSplitPaymentModal()" class="w-full mt-2 py-2 border border-blue-500 text-blue-600 dark:text-blue-400 rounded-lg text-sm font-bold hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                        ${this.state.paymentMethod === 'split' ? 'Manage Split Payment' : 'Split Payment / Mixed'}
                    </button>
                    <div id="split-payment-summary" class="${this.state.paymentMethod === 'split' ? '' : 'hidden'} mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-sm">
                        <!-- Summary injected here -->
                    </div>
                </div>
                <button onclick="app.checkout()" class="w-full bg-emerald-500 text-white py-3 rounded-lg font-bold text-lg hover:bg-emerald-600 transition-colors mt-2">Pay Now</button>
                <button onclick="app.clearCart()" class="w-full bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-200 py-2 rounded-lg font-medium text-sm hover:bg-red-200 dark:hover:bg-red-800 transition-colors mt-2">Clear Cart</button>
            `;
        }
    },

    async checkout() {
        if (this.state.cart.length === 0) {
            Utils.showToast("Cart is empty!", "error");
            return;
        }

        const subtotal = this.state.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        let runningTotal = subtotal;

        // Combine global modifiers and cart-specific modifiers (like redemption)
        const allModifiers = (this.state.modifiers || []).concat(this.state.cartModifiers || []);
        const orderModifiers = [];

        allModifiers.forEach(mod => {
            let amount = 0;
            if (mod.type === 'percent') {
                amount = subtotal * (mod.value / 100);
            } else {
                amount = mod.value;
            }

            if (mod.rate === 'subtract') runningTotal -= amount;
            else runningTotal += amount;

            orderModifiers.push({
                name: mod.name,
                amount: amount,
                rate: mod.rate,
                isRedemption: mod.isRedemption || false,
                pointsCost: mod.pointsCost || 0
            });
        });

        if (runningTotal < 0) runningTotal = 0;
        const finalTotal = parseFloat(runningTotal.toFixed(2)); // Ensure precision

        // Split Payment Validation
        let assignedPayments = [];
        if (this.state.paymentMethod === 'split') {
            const totalPaid = this.state.payments.reduce((sum, p) => sum + p.amount, 0);
            // Allow for small floating point diffs
            if (Math.abs(totalPaid - finalTotal) > 0.01) {
                // If total paid is less, error.
                if (totalPaid < finalTotal) {
                    Utils.showToast(`Insufficient payment! Paid: $${totalPaid.toFixed(2)}, Due: $${finalTotal.toFixed(2)}`, "error");
                    return;
                }
                // If total paid is more, assume change if cash is involved, or strictly require match?
                // For simplicity, let's treat excess as Change (Cash) if a cash payment exists, or just record it as 'Paid'.
                // Ideally, we shouldn't allow Card > Total.

                // Let's prompt or just toast?
                // Actually, let's just allow it and record the change in one of the payments? 
                // No, typically we render 'Change: $x'.
                // Let's checking if the "Change" is covered by a Cash payment.
                const cashPayment = this.state.payments.find(p => p.method === 'cash');
                if (totalPaid > finalTotal && !cashPayment) {
                    Utils.showToast("Overpayment without Cash! Please adjust amounts.", "error");
                    return;
                }
            }
            assignedPayments = [...this.state.payments];
        } else {
            // Single payment method
            assignedPayments = [{
                method: this.state.paymentMethod || 'cash',
                amount: finalTotal
            }];
        }

        const order = {
            timestamp: Date.now(),
            subtotal: subtotal,
            modifiers: orderModifiers, // Save snapshot
            total: finalTotal,
            items: [...this.state.cart],
            paymentMethod: this.state.paymentMethod, // 'split', 'cash', 'card', 'online'
            payments: assignedPayments, // NEW: Detailed payment breakdown
            userId: this.state.currentUser ? this.state.currentUser.id : null,
            userName: this.state.currentUser ? this.state.currentUser.name : 'Unknown',
            shiftId: this.state.currentShift ? this.state.currentShift.id : null,
            customerId: this.state.currentCustomer ? this.state.currentCustomer.id : null,
            customerName: this.state.currentCustomer ? this.state.currentCustomer.name : null
        };

        // Check for redemption
        const redemption = (this.state.cartModifiers || []).find(m => m.isRedemption);
        if (redemption) {
            order.pointsRedeemed = redemption.pointsCost;
        }

        // Points Calculation (Configurable rate)
        const earningRate = this.state.settings.pointsEarningRate || 1;
        const pointsEarned = Math.floor(runningTotal * earningRate);
        if (this.state.currentCustomer) {
            order.pointsEarned = pointsEarned;
        }

        // Open receipt window FIRST while user-gesture context is still active
        // (Browsers block window.open after async/await calls)
        const receiptWindow = window.open('', '', 'width=340,height=600');
        if (receiptWindow) {
            receiptWindow.document.write('<html><body style="font-family:monospace;text-align:center;padding-top:40px;"><p>Preparing receipt...</p></body></html>');
        }

        try {
            // Save order to DB
            const orderId = await DB.saveOrder(order);

            // Update Stock
            for (const item of this.state.cart) {
                try {
                    const product = await DB.getProduct(item.id);
                    if (product) {
                        const newStock = product.stock - item.qty;
                        await DB.updateProduct(product.id, { stock: newStock });

                        // Log Stock Change
                        await DB.addStockLog({
                            productId: product.id,
                            changeAmount: -item.qty,
                            reason: 'Sale',
                            timestamp: Date.now(),
                            note: `Order #${orderId}`,
                            userId: this.state.currentUser ? this.state.currentUser.id : null
                        });
                    }
                } catch (stockErr) {
                    console.error("Failed to update stock for item:", item.id, stockErr);
                }
            }

            // Generate QR Code state logic... (reused)
            let qrCodeDataUri = null;
            if (this.state.settings.receiptShowQrCode && this.state.settings.receiptQrCodeUrl) {
                try {
                    qrCodeDataUri = await Utils.generateQRCode(this.state.settings.receiptQrCodeUrl);
                } catch (e) {
                    console.error("Failed to generate QR Code", e);
                }
            }

            // Write receipt content into the already-open window
            if (receiptWindow && !receiptWindow.closed) {
                const settingsWithQr = { ...this.state.settings, receiptQrCodeDataUri: qrCodeDataUri };
                const receiptHtml = Utils.generateReceipt(
                    this.state.settings.storeName,
                    this.state.settings.storeAddress,
                    order,
                    settingsWithQr,
                    this.state.settings.storeLogo
                );
                receiptWindow.document.open();
                receiptWindow.document.write(receiptHtml);
                receiptWindow.document.close();
            }

            // Update Customer Points
            if (this.state.currentCustomer) {
                const currentPoints = this.state.currentCustomer.points || 0;
                const earned = order.pointsEarned || 0;
                const redeemed = order.pointsRedeemed || 0;
                const newPoints = currentPoints + earned - redeemed;

                await DB.updateCustomer(this.state.currentCustomer.id, { points: newPoints });
            }

            this.state.cart = [];
            this.state.cartModifiers = [];
            this.state.payments = [];
            this.state.paymentMethod = 'cash'; // Reset
            this.state.currentCustomer = null;
            this.renderCart();

            // Refresh grid to show new stock
            this.renderProducts();

            Utils.showToast("Order Completed!");
        } catch (err) {
            console.error("Checkout error:", err);
            Utils.logError('checkout', err);
            Utils.showToast("Checkout failed. Check console.", "error");
            if (receiptWindow) receiptWindow.close();
        }
    },

    // --- Split Payment Logic ---

    openSplitPaymentModal() {
        // Calculate current total
        let subtotal = 0;
        this.state.cart.forEach(item => subtotal += item.price * item.qty);
        let runningTotal = subtotal;

        const allModifiers = (this.state.modifiers || []).concat(this.state.cartModifiers || []);
        allModifiers.forEach(mod => {
            let amount = 0;
            if (mod.type === 'percent') amount = subtotal * (mod.value / 100);
            else amount = mod.value;
            if (mod.rate === 'subtract') runningTotal -= amount;
            else runningTotal += amount;
        });
        if (runningTotal < 0) runningTotal = 0;

        // Reset if starting fresh, or keep if editing? 
        // Let's keep existing split state if method is 'split', else init empty.
        if (this.state.paymentMethod !== 'split') {
            this.state.payments = [];
            this.state.paymentMethod = 'split';
        }

        // Render Modal content dynamically
        this.renderSplitPaymentModalContent(runningTotal);

        document.getElementById('pos-split-modal').classList.remove('hidden');
    },

    renderSplitPaymentModalContent(totalDue) {
        const listObj = document.getElementById('pos-split-list');
        const remainingObj = document.getElementById('pos-split-remaining');

        if (!listObj) return;

        // Calculate paid
        const totalPaid = this.state.payments.reduce((sum, p) => sum + p.amount, 0);
        const remaining = totalDue - totalPaid;

        remainingObj.innerText = Utils.formatCurrency(remaining > 0 ? remaining : 0, this.state.settings.currencySymbol);

        // Render List
        listObj.innerHTML = '';
        this.state.payments.forEach((p, index) => {
            const div = document.createElement('div');
            div.className = "flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded mb-2";
            div.innerHTML = `
                <span class="capitalize font-bold text-gray-700 dark:text-gray-300">${p.method}</span>
                <div class="flex items-center gap-2">
                    <span class="font-mono text-gray-800 dark:text-gray-200">${Utils.formatCurrency(p.amount, this.state.settings.currencySymbol)}</span>
                    <button onclick="app.removeSplitPayment(${index}, ${totalDue})" class="text-red-500 hover:text-red-700">&times;</button>
                </div>
            `;
            listObj.appendChild(div);
        });

        // Update Summary in Cart
        this.updateSplitSummary(totalDue, totalPaid);
    },

    addSplitPayment() {
        // Check input
        const methodEl = document.getElementById('split-method-select');
        const amountEl = document.getElementById('split-amount-input');

        const method = methodEl.value;
        const amount = parseFloat(amountEl.value);

        if (!amount || amount <= 0) {
            Utils.showToast("Invalid Amount", "error");
            return;
        }

        // Recalculate total for limit check
        let subtotal = 0;
        this.state.cart.forEach(item => subtotal += item.price * item.qty);
        let runningTotal = subtotal;
        const allModifiers = (this.state.modifiers || []).concat(this.state.cartModifiers || []);
        allModifiers.forEach(mod => {
            let val = (mod.type === 'percent') ? subtotal * (mod.value / 100) : mod.value;
            if (mod.rate === 'subtract') runningTotal -= val;
            else runningTotal += val;
        });
        if (runningTotal < 0) runningTotal = 0;

        // Check if overpaying? (Allowed for cash, maybe not for others, but let's just add it)
        this.state.payments.push({ method, amount });

        amountEl.value = '';
        this.renderSplitPaymentModalContent(runningTotal);
    },

    removeSplitPayment(index, totalDue) {
        this.state.payments.splice(index, 1);
        this.renderSplitPaymentModalContent(totalDue);
    },

    closeSplitModal() {
        document.getElementById('pos-split-modal').classList.add('hidden');
        this.renderCart();
    },

    updateSplitSummary(total, paid) {
        const summary = document.getElementById('split-payment-summary');
        if (!summary) return;

        const remaining = total - paid;
        let text = '';
        let colorClass = '';

        if (Math.abs(remaining) < 0.01) {
            text = "Fully Paid";
            colorClass = "text-green-600 dark:text-green-400";
        } else if (remaining > 0) {
            text = `Remaining: ${Utils.formatCurrency(remaining, this.state.settings.currencySymbol)}`;
            colorClass = "text-red-600 dark:text-red-400";
        } else {
            text = `Change: ${Utils.formatCurrency(Math.abs(remaining), this.state.settings.currencySymbol)}`;
            colorClass = "text-blue-600 dark:text-blue-400";
        }

        summary.innerHTML = `<div class="font-bold cursor-pointer ${colorClass}" onclick="app.openSplitPaymentModal()">${text}</div>`;
        summary.classList.remove('hidden');
    },

    // --- Order Hold / Park ---

    holdOrder() {
        if (!this.state.cart || this.state.cart.length === 0) {
            Utils.showToast('Cart is empty — nothing to hold.', 'error');
            return;
        }

        if (!this.state.heldOrders) this.state.heldOrders = [];

        // Snapshot the current cart state
        this.state.heldOrders.push({
            heldAt: Date.now(),
            cart: JSON.parse(JSON.stringify(this.state.cart)),
            cartModifiers: JSON.parse(JSON.stringify(this.state.cartModifiers || [])),
            currentCustomer: this.state.currentCustomer ? { ...this.state.currentCustomer } : null,
            paymentMethod: this.state.paymentMethod || 'cash',
            payments: JSON.parse(JSON.stringify(this.state.payments || []))
        });

        // Clear current cart
        this.state.cart = [];
        this.state.cartModifiers = [];
        this.state.currentCustomer = null;
        this.state.paymentMethod = 'cash';
        this.state.payments = [];

        this.renderCart();
        Utils.showToast(`Order held! (${this.state.heldOrders.length} on hold)`);
    },

    openHeldOrdersModal() {
        if (!this.state.heldOrders) this.state.heldOrders = [];
        const listEl = document.getElementById('held-orders-list');
        if (!listEl) return;

        const { currencySymbol } = this.state.settings;
        listEl.innerHTML = '';

        if (this.state.heldOrders.length === 0) {
            listEl.innerHTML = '<div class="text-center text-gray-400 dark:text-gray-500 py-10">No held orders</div>';
        } else {
            this.state.heldOrders.forEach((held, index) => {
                const subtotal = held.cart.reduce((sum, item) => sum + item.price * item.qty, 0);
                const itemCount = held.cart.reduce((sum, item) => sum + item.qty, 0);
                const previewNames = held.cart.slice(0, 3).map(i => Utils.sanitize(i.name)).join(', ');
                const timeDiff = Math.round((Date.now() - held.heldAt) / 1000);
                const timeLabel = timeDiff < 60 ? `${timeDiff}s ago` : `${Math.round(timeDiff / 60)}m ago`;

                const card = document.createElement('div');
                card.className = 'p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-100 dark:border-gray-600 flex flex-col gap-2';
                card.innerHTML = `
                    <div class="flex justify-between items-start">
                        <div>
                            <div class="font-bold text-gray-800 dark:text-white text-sm">Hold #${index + 1}</div>
                            <div class="text-xs text-gray-400 dark:text-gray-500">${timeLabel}</div>
                        </div>
                        <div class="text-right">
                            <div class="font-bold text-blue-600 dark:text-blue-400">${Utils.formatCurrency(subtotal, currencySymbol)}</div>
                            <div class="text-xs text-gray-500 dark:text-gray-400">${itemCount} item${itemCount !== 1 ? 's' : ''}</div>
                        </div>
                    </div>
                    ${held.currentCustomer ? `<div class="text-xs text-blue-700 dark:text-blue-300 font-medium">👤 ${Utils.sanitize(held.currentCustomer.name)}</div>` : ''}
                    <div class="text-xs text-gray-500 dark:text-gray-400 truncate">${previewNames}${held.cart.length > 3 ? ` +${held.cart.length - 3} more` : ''}</div>
                    <div class="flex gap-2 mt-1">
                        <button onclick="app.resumeHeldOrder(${index})" class="flex-1 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-colors">Resume</button>
                        <button onclick="app.deleteHeldOrder(${index})" class="py-1.5 px-3 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-800 text-red-600 dark:text-red-400 text-xs font-bold rounded-lg transition-colors">Delete</button>
                    </div>
                `;
                listEl.appendChild(card);
            });
        }

        document.getElementById('pos-held-orders-modal').classList.remove('hidden');
    },

    resumeHeldOrder(index) {
        if (!this.state.heldOrders || !this.state.heldOrders[index]) return;

        // Warn if current cart has items
        if (this.state.cart && this.state.cart.length > 0) {
            if (!confirm('Current cart has items. Hold it first or discard? Click OK to discard current cart and resume selected order.')) {
                return;
            }
        }

        const held = this.state.heldOrders.splice(index, 1)[0];

        this.state.cart = held.cart;
        this.state.cartModifiers = held.cartModifiers;
        this.state.currentCustomer = held.currentCustomer;
        this.state.paymentMethod = held.paymentMethod;
        this.state.payments = held.payments;

        document.getElementById('pos-held-orders-modal').classList.add('hidden');
        this.renderCart();
        Utils.showToast('Order resumed!');
    },

    deleteHeldOrder(index) {
        if (!this.state.heldOrders) return;
        this.state.heldOrders.splice(index, 1);
        this.openHeldOrdersModal(); // Re-render modal
        this.renderCart(); // Update badge
        Utils.showToast('Held order deleted.', 'warning');
    }

};

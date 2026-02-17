// POS Module
// Depends on: db.js, utils.js, constants.js

window.POS = {
    async renderPOS() {
        this.renderProducts();
        this.renderCart();
    },

    populateCategoryFilter() {
        const select = document.getElementById(DOM.POS.CATEGORY_FILTER);
        if (!select) return;
        select.innerHTML = '<option value="">All Categories</option>';
        this.state.categories.forEach(cat => {
            select.innerHTML += `<option value="${cat.id}">${Utils.sanitize(cat.name)}</option>`; // Categories are still loaded in app.js
        });
    },

    async renderProducts(overrideProducts = null) {
        const grid = document.getElementById(DOM.POS.PRODUCTS_GRID);
        if (!grid) return;
        grid.innerHTML = '';
        Utils.showLoading();

        try {
            let products = [];

            if (overrideProducts) {
                products = overrideProducts;
            } else {
                // Default view (Paginated 50 items for grid)
                // We could add pagination controls, but for now let's just show top 50 
                // or implement infinite scroll if requested.
                // User asked for pagination. Let's add simple Next/Prev at bottom of grid.
                const page = this.state.posPage || 1;
                const result = await DB.getProducts(page, 50);
                products = result.data;

                // We need to render pagination controls
                this.renderPosPagination(result.total, page);
            }

            const { currencySymbol } = this.state.settings;

            products.forEach(prod => {
                const card = document.createElement('div');
                card.className = "bg-white dark:bg-gray-800 p-4 rounded-lg cursor-pointer hover:bg-blue-50 dark:hover:bg-gray-700 border border-transparent transition-all flex flex-col items-center text-center shadow-sm";
                card.onclick = () => this.addToCart(prod);

                let imageHtml = `
                    <div class="h-12 w-12 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-xl font-bold text-gray-500 dark:text-gray-400 mb-2">
                        ${prod.name.charAt(0).toUpperCase()}
                    </div>
                `;

                if (prod.image) {
                    imageHtml = `<img src="${prod.image}" class="h-24 w-full object-cover rounded-lg mb-2" alt="${Utils.sanitize(prod.name)}">`;
                }

                card.innerHTML = `
                    ${imageHtml}
                    <h4 class="font-bold text-gray-800 dark:text-gray-200 line-clamp-2 text-sm">${Utils.sanitize(prod.name)}</h4>
                    <p class="text-blue-600 dark:text-blue-400 font-bold mt-1">${Utils.formatCurrency(prod.price, currencySymbol)}</p>
                    <div class="text-xs text-gray-400 mt-1">Stock: ${prod.stock}</div>
                `;
                grid.appendChild(card);
            });

            if (products.length === 0) {
                grid.innerHTML = '<p class="text-center text-gray-500 col-span-full mt-10">No products found</p>';
            }

        } catch (e) {
            console.error(e);
        } finally {
            Utils.hideLoading();
        }
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

    addToCart(product) {
        // ... (Logic remains mostly same, just checking passed product)
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

    setPaymentMethod(method) {
        this.state.paymentMethod = method;
        this.renderCart();
    },

    renderCart() {
        // ... (Same as before)
        const container = document.getElementById(DOM.POS.CART_ITEMS);
        if (!container) return;
        container.innerHTML = '';

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
        const modifiers = this.state.modifiers || [];

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

        // Calculate Modifiers Snapshot
        const orderModifiers = [];
        let runningTotal = subtotal;

        this.state.modifiers.forEach(mod => {
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
                rate: mod.rate
            });
        });

        if (runningTotal < 0) runningTotal = 0;

        const order = {
            timestamp: Date.now(),
            subtotal: subtotal,
            modifiers: orderModifiers, // Save snapshot
            total: runningTotal,
            items: [...this.state.cart],
            paymentMethod: this.state.paymentMethod,
            userId: this.state.currentUser ? this.state.currentUser.id : null,
            userName: this.state.currentUser ? this.state.currentUser.name : 'Unknown',
            shiftId: this.state.currentShift ? this.state.currentShift.id : null
        };

        // Open receipt window FIRST while user-gesture context is still active
        // (Browsers block window.open after async/await calls)
        const receiptWindow = window.open('', '', 'width=340,height=600');
        if (receiptWindow) {
            receiptWindow.document.write('<html><body style="font-family:monospace;text-align:center;padding-top:40px;"><p>Preparing receipt...</p></body></html>');
        }

        try {
            // Save order to DB
            await DB.saveOrder(order);

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
                            note: `Order #${orderId || 'New'}`, // We might not have order ID if it's auto-incremented by DB and not returned in add() immediately if not awaited properly, but we can just say 'Sale'
                            userId: this.state.currentUser ? this.state.currentUser.id : null
                        });
                    }
                } catch (stockErr) {
                    console.error("Failed to update stock for item:", item.id, stockErr);
                }
            }

            // Generate QR Code
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

            this.state.cart = [];
            this.renderCart();

            // Refresh grid to show new stock
            this.renderProducts();

            Utils.showToast("Order Completed!");
        } catch (err) {
            console.error("Checkout error:", err);
            Utils.logError('checkout', err);
            Utils.showToast("Checkout failed. Check console.", "error");
        }
    }

};

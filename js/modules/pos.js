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
        select.replaceChildren();
        select.appendChild(new Option('All Categories', ''));
        select.appendChild(new Option('⭐ Favorites', '__favorites__'));
        select.appendChild(new Option('🕒 Recently Sold', '__recent__'));
        this.state.categories.forEach(cat => {
            select.appendChild(new Option(cat.name, cat.id));
        });
    },

    async toggleFavorite(productId, currentlyFavorite) {
        try {
            await DB.updateProduct(productId, { isFavorite: !currentlyFavorite });
            // Re-render
            const searchInput = document.getElementById(DOM.POS.SEARCH);
            const catFilter = document.getElementById(DOM.POS.CATEGORY_FILTER);
            this.filterProducts(searchInput ? searchInput.value : '', catFilter ? catFilter.value : '');
        } catch (e) {
            console.error("Failed to toggle favorite", e);
            Utils.showToast("Failed to update favorite status", "error");
        }
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

            const infoDiv = document.createElement('div');
            const nameDiv = document.createElement('div');
            nameDiv.className = "font-bold dark:text-gray-200";
            nameDiv.textContent = c.name;
            const phoneDiv = document.createElement('div');
            phoneDiv.className = "text-xs text-gray-500";
            phoneDiv.textContent = c.phone || '';
            infoDiv.appendChild(nameDiv);
            infoDiv.appendChild(phoneDiv);

            const pointsDiv = document.createElement('div');
            pointsDiv.className = "text-blue-600 dark:text-blue-400 font-bold text-sm";
            pointsDiv.textContent = `${c.points || 0} pts`;

            li.appendChild(infoDiv);
            li.appendChild(pointsDiv);
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
        card.className = "bg-white dark:bg-gray-800 p-4 rounded-lg cursor-pointer hover:bg-blue-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 transition-all flex flex-col items-center text-center shadow-sm hover:shadow-md relative shrink-0 min-w-[140px]";

        const favColor = prod.isFavorite ? 'text-yellow-400 hover:text-yellow-500' : 'text-gray-300 dark:text-gray-600 hover:text-yellow-400';
        const favBtn = document.createElement('button');
        favBtn.className = `absolute top-2 right-2 p-1 z-10 ${favColor} transition-colors favorite-btn`;
        favBtn.title = "Toggle Favorite";
        favBtn.innerHTML = DOMPurify.sanitize('<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd"></path></svg>');
        favBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            prod.isFavorite = !prod.isFavorite;
            try {
                await DB.updateProduct(prod.id, { isFavorite: prod.isFavorite });
                this.renderProducts();
            } catch (err) {
                console.error("Failed to toggle favorite", err);
                Utils.showToast("Failed to update favorite status", "error");
            }
        });
        card.appendChild(favBtn);

        const contentDiv = document.createElement('div');
        contentDiv.className = "w-full h-full flex flex-col items-center justify-between";
        contentDiv.onclick = () => app.addToCart(prod.id);

        const imgWrapper = document.createElement('div');
        imgWrapper.className = "w-full flex justify-center";
        if (prod.image) {
            const img = document.createElement('img');
            img.src = prod.image;
            img.className = "h-24 w-full object-cover rounded-lg mb-2 pointer-events-none";
            img.alt = prod.name;
            imgWrapper.appendChild(img);
        } else {
            const initialDiv = document.createElement('div');
            initialDiv.className = "h-12 w-12 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-xl font-bold text-gray-500 dark:text-gray-400 mb-2 pointer-events-none";
            initialDiv.textContent = prod.name.charAt(0).toUpperCase();
            imgWrapper.appendChild(initialDiv);
        }
        contentDiv.appendChild(imgWrapper);

        const titleH4 = document.createElement('h4');
        titleH4.className = "font-bold text-gray-800 dark:text-gray-200 line-clamp-2 text-sm pointer-events-none w-full";
        titleH4.textContent = prod.name;
        contentDiv.appendChild(titleH4);

        const priceStockDiv = document.createElement('div');
        priceStockDiv.className = "mt-auto pt-1 pointer-events-none";
        const priceP = document.createElement('p');
        priceP.className = "text-blue-600 dark:text-blue-400 font-bold";
        priceP.textContent = Utils.formatCurrency(prod.price, this.state.settings.currencySymbol);
        const stockDiv = document.createElement('div');
        stockDiv.className = "text-xs text-gray-400";
        stockDiv.textContent = `Stock: ${prod.stock}`;
        priceStockDiv.appendChild(priceP);
        priceStockDiv.appendChild(stockDiv);
        contentDiv.appendChild(priceStockDiv);

        card.appendChild(contentDiv);

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

    async addToCartLogic(product) {
        // If Bundle, check max available stock of components
        if (product.isBundle && product.bundleItems && product.bundleItems.length > 0) {
            let maxBundleStock = Infinity;
            for (let bi of product.bundleItems) {
                let p = await DB.getProduct(bi.productId);
                if (p) {
                    let possible = Math.floor(p.stock / bi.quantity);
                    if (possible < maxBundleStock) maxBundleStock = possible;
                }
            }
            if (maxBundleStock <= 0) {
                Utils.showToast("Bundle components out of stock!", "error");
                return;
            }

            const existingItem = this.state.cart.find(item => item.id === product.id);
            if (existingItem && existingItem.qty >= maxBundleStock) {
                Utils.showToast("Max bundle stock reached based on components!", "error");
                return;
            }

            if (existingItem) {
                existingItem.qty++;
            } else {
                this.state.cart.push({ ...product, qty: 1, maxStock: maxBundleStock });
            }
            this.renderCart();
            Utils.showToast("Added Bundle to Cart");
            return;
        }

        // If Variants, show Variant Selection Modal
        if (product.hasVariants && product.variants && product.variants.length > 0) {
            this.openVariantModal(product);
            return;
        }

        // Normal Product
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

    openVariantModal(product) {
        const modal = document.getElementById('pos-variant-modal');
        const title = document.getElementById('pos-variant-title');
        const list = document.getElementById('pos-variant-list');

        if (!modal) return;

        title.innerText = `Select Variant: ${product.name}`;
        list.innerHTML = '';

        product.variants.forEach((v, index) => {
            const div = document.createElement('div');
            const isOutOfStock = v.stock <= 0;
            div.className = `p-3 border dark:border-gray-700 rounded-lg flex justify-between items-center ${isOutOfStock ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800' : 'cursor-pointer hover:bg-blue-50 dark:hover:bg-gray-700'}`;

            const infoDiv = document.createElement('div');
            const nameDiv = document.createElement('div');
            nameDiv.className = "font-bold dark:text-gray-200";
            nameDiv.textContent = v.name;
            const stockDiv = document.createElement('div');
            stockDiv.className = "text-sm text-gray-500";
            stockDiv.textContent = `${v.stock} in stock`;
            infoDiv.appendChild(nameDiv);
            infoDiv.appendChild(stockDiv);

            const priceDiv = document.createElement('div');
            priceDiv.className = "font-bold text-blue-600 dark:text-blue-400";
            priceDiv.textContent = Utils.formatCurrency(v.price, this.state.settings.currencySymbol);

            div.appendChild(infoDiv);
            div.appendChild(priceDiv);

            if (!isOutOfStock) {
                div.onclick = () => {
                    this.addVariantToCart(product, v, index);
                    modal.classList.add('hidden');
                };
            }

            list.appendChild(div);
        });

        modal.classList.remove('hidden');
    },

    addVariantToCart(product, variant, variantIndex) {
        const cartItemId = `${product.id}-${variantIndex}`;
        const existingItem = this.state.cart.find(item => item.cartItemId === cartItemId);

        if (existingItem) {
            if (existingItem.qty >= variant.stock) {
                Utils.showToast("Max variant stock reached!", "error");
                return;
            }
            existingItem.qty++;
        } else {
            this.state.cart.push({
                ...product,
                cartItemId: cartItemId,
                name: `${product.name} - ${variant.name}`,
                price: variant.price,
                stock: variant.stock,
                isVariant: true,
                variantIndex: variantIndex,
                qty: 1
            });
        }

        this.renderCart();
        Utils.showToast(`Added ${variant.name} to Cart`);
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

        const prevBtn = document.createElement('button');
        prevBtn.id = 'pos-prev';
        prevBtn.disabled = page <= 1;
        prevBtn.className = "px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded disabled:opacity-50";
        prevBtn.textContent = 'Prev';
        prevBtn.onclick = () => {
            this.state.posPage = page - 1;
            this.renderProducts();
        };

        const span = document.createElement('span');
        span.className = "text-gray-600 dark:text-gray-300 self-center";
        span.textContent = `Page ${page} of ${totalPages || 1}`;

        const nextBtn = document.createElement('button');
        nextBtn.id = 'pos-next';
        nextBtn.disabled = page >= totalPages;
        nextBtn.className = "px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded disabled:opacity-50";
        nextBtn.textContent = 'Next';
        nextBtn.onclick = () => {
            this.state.posPage = page + 1;
            this.renderProducts();
        };

        container.appendChild(prevBtn);
        container.appendChild(span);
        container.appendChild(nextBtn);

        grid.parentNode.appendChild(container);
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
                if (categoryId === '__favorites__') {
                    collection = db.products.filter(p => !!p.isFavorite);
                } else if (categoryId === '__recent__') {
                    let recentIds = [];
                    try {
                        const recentIdsStr = localStorage.getItem('pos_recent_products');
                        recentIds = JSON.parse(recentIdsStr) || [];
                    } catch (e) { }
                    collection = db.products.filter(p => recentIds.includes(p.id));
                } else {
                    collection = db.products.where('categoryId').equals(parseInt(categoryId));
                }
            }

            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                // if we used index for category, we need to filter for name
                collection = collection.filter(p =>
                    Utils.fuzzyMatch(term, p.name) ||
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

    removeFromCart(identifier) {
        this.state.cart = this.state.cart.filter(item => item.cartItemId !== identifier && item.id !== identifier);
        this.renderCart();
    },

    updateCartQty(identifier, change) {
        const item = this.state.cart.find(i => i.cartItemId === identifier || i.id === identifier);
        if (!item) return;

        const newQty = item.qty + change;

        let maxAllowed = item.maxStock !== undefined ? item.maxStock : item.stock;

        if (newQty <= 0) {
            this.removeFromCart(identifier);
        } else if (newQty > maxAllowed) {
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
            headerActions.replaceChildren();
            const heldCount = (this.state.heldOrders || []).length;
            const holdBtn = document.createElement('button');
            holdBtn.onclick = () => app.holdOrder();
            holdBtn.title = "Hold current order";
            holdBtn.className = "flex items-center gap-1 px-2 py-1 text-xs font-bold rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800 border border-amber-200 dark:border-amber-700 transition-colors";
            holdBtn.innerHTML = DOMPurify.sanitize('<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>');
            holdBtn.appendChild(document.createTextNode(' Hold'));
            headerActions.appendChild(holdBtn);

            if (heldCount > 0) {
                const heldBtn = document.createElement('button');
                heldBtn.onclick = () => app.openHeldOrdersModal();
                heldBtn.title = "View held orders";
                heldBtn.className = "flex items-center gap-1 px-2 py-1 text-xs font-bold rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 border border-blue-200 dark:border-blue-700 transition-colors";
                heldBtn.innerHTML = DOMPurify.sanitize('<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>');
                heldBtn.appendChild(document.createTextNode(` Held (${heldCount})`));
                headerActions.appendChild(heldBtn);
            }
        }

        // Render Customer Section
        const customerSection = document.createElement('div');
        customerSection.className = "mb-4 pb-4 border-b dark:border-gray-700";
        if (this.state.currentCustomer) {
            const card = document.createElement('div');
            card.className = "flex justify-between items-center bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800";

            const info = document.createElement('div');
            const nameEl = document.createElement('div');
            nameEl.className = "font-bold text-blue-800 dark:text-blue-300 text-sm overflow-hidden text-ellipsis whitespace-nowrap max-w-[150px]";
            nameEl.textContent = this.state.currentCustomer.name;
            const pointsEl = document.createElement('div');
            pointsEl.className = "text-xs text-blue-600 dark:text-blue-400";
            pointsEl.textContent = `Points: ${this.state.currentCustomer.points || 0}`;
            info.appendChild(nameEl);
            info.appendChild(pointsEl);

            const btns = document.createElement('div');
            btns.className = "flex gap-1";
            const redeemBtn = document.createElement('button');
            redeemBtn.onclick = () => app.redeemPoints();
            redeemBtn.className = "text-green-600 hover:text-green-800 text-xs font-bold border border-green-200 bg-green-50 rounded px-2 py-1";
            redeemBtn.textContent = "Redeem";
            const removeBtn = document.createElement('button');
            removeBtn.onclick = () => app.removeCustomer();
            removeBtn.className = "text-red-500 hover:text-red-700 p-1 text-sm";
            removeBtn.textContent = "X";
            btns.appendChild(redeemBtn);
            btns.appendChild(removeBtn);

            card.appendChild(info);
            card.appendChild(btns);
            customerSection.appendChild(card);
        } else {
            const selectBtn = document.createElement('button');
            selectBtn.onclick = () => app.openCustomerSelection();
            selectBtn.className = "w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:border-blue-500 hover:text-blue-500 transition-colors text-sm font-medium";
            selectBtn.textContent = "+ Select Customer";
            customerSection.appendChild(selectBtn);
        }
        container.appendChild(customerSection);

        if (this.state.cart.length === 0) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = "text-center text-gray-400 dark:text-gray-500 mt-10";
            emptyDiv.textContent = "Cart is empty";
            container.appendChild(emptyDiv);
            this.updateTotals();
            return;
        }

        const { currencySymbol } = this.state.settings;

        this.state.cart.forEach(item => {
            const div = document.createElement('div');
            div.className = "bg-gray-50 dark:bg-gray-700 p-2 rounded-lg";

            const row = document.createElement('div');
            row.className = "flex items-center gap-2";

            if (item.image) {
                const img = document.createElement('img');
                img.src = item.image;
                img.className = "w-10 h-10 object-cover rounded mr-2 flex-shrink-0";
                img.alt = item.name;
                row.appendChild(img);
            }

            const info = document.createElement('div');
            info.className = "flex-1 min-w-0";
            const titleH5 = document.createElement('h5');
            titleH5.className = "font-bold text-sm text-gray-800 dark:text-white truncate";
            titleH5.textContent = item.name;
            const priceP = document.createElement('p');
            priceP.className = "text-xs text-gray-500 dark:text-gray-400";
            priceP.textContent = `${Utils.formatCurrency(item.price, currencySymbol)} x ${item.qty}`;
            info.appendChild(titleH5);
            info.appendChild(priceP);
            row.appendChild(info);

            const actions = document.createElement('div');
            actions.className = "flex items-center gap-1 flex-shrink-0";

            const itemKey = item.cartItemId || item.id;
            const decBtn = document.createElement('button');
            decBtn.onclick = () => app.updateCartQty(itemKey, -1);
            decBtn.className = "w-7 h-7 bg-gray-200 dark:bg-gray-600 dark:text-white rounded flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-500 text-sm font-bold";
            decBtn.textContent = "-";

            const qtySpan = document.createElement('span');
            qtySpan.className = "font-bold text-sm w-5 text-center dark:text-white";
            qtySpan.textContent = item.qty;

            const incBtn = document.createElement('button');
            incBtn.onclick = () => app.updateCartQty(itemKey, 1);
            incBtn.className = "w-7 h-7 bg-gray-200 dark:bg-gray-600 dark:text-white rounded flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-500 text-sm font-bold";
            incBtn.textContent = "+";

            const removeBtn = document.createElement('button');
            removeBtn.onclick = () => app.removeFromCart(itemKey);
            removeBtn.className = "w-7 h-7 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded flex items-center justify-center hover:bg-red-200 dark:hover:bg-red-800 ml-1 flex-shrink-0";
            removeBtn.title = "Remove";
            removeBtn.innerHTML = "&times;";

            actions.appendChild(decBtn);
            actions.appendChild(qtySpan);
            actions.appendChild(incBtn);
            actions.appendChild(removeBtn);

            row.appendChild(actions);
            div.appendChild(row);
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

            parent.replaceChildren();

            const subtotalRow = document.createElement('div');
            subtotalRow.className = "flex justify-between text-gray-600 dark:text-gray-300";
            const subtotalLabel = document.createElement('span');
            subtotalLabel.textContent = "Subtotal:";
            const subtotalVal = document.createElement('span');
            subtotalVal.id = DOM.POS.CART_SUBTOTAL;
            subtotalVal.textContent = Utils.formatCurrency(subtotal, currencySymbol);
            subtotalRow.appendChild(subtotalLabel);
            subtotalRow.appendChild(subtotalVal);
            parent.appendChild(subtotalRow);

            // Modifiers
            modifiers.forEach(mod => {
                let modAmount = mod.type === 'percent' ? subtotal * (mod.value / 100) : mod.value;
                const isSubtract = mod.rate === 'subtract';
                const modRow = document.createElement('div');
                modRow.className = `flex justify-between text-sm ${isSubtract ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-300'}`;
                const nameSpan = document.createElement('span');
                nameSpan.textContent = `${mod.name} (${mod.type === 'percent' ? mod.value + '%' : 'Fixed'}):`;
                const valSpan = document.createElement('span');
                valSpan.textContent = `${isSubtract ? '-' : ''}${Utils.formatCurrency(modAmount, currencySymbol)}`;
                modRow.appendChild(nameSpan);
                modRow.appendChild(valSpan);
                parent.appendChild(modRow);
            });

            // Total row
            const totalRow = document.createElement('div');
            totalRow.className = "flex justify-between text-xl font-bold text-gray-800 dark:text-white pt-2 border-t border-gray-200 dark:border-gray-600";
            const totalLabel = document.createElement('span');
            totalLabel.textContent = "Total:";
            const totalVal = document.createElement('span');
            totalVal.id = DOM.POS.CART_TOTAL;
            totalVal.textContent = Utils.formatCurrency(runningTotal, currencySymbol);
            totalRow.appendChild(totalLabel);
            totalRow.appendChild(totalVal);
            parent.appendChild(totalRow);

            // Payment method section
            const paySection = document.createElement('div');
            paySection.className = "mt-4 mb-2";
            const payLabel = document.createElement('label');
            payLabel.className = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2";
            payLabel.textContent = "Payment Method";
            paySection.appendChild(payLabel);

            const grid = document.createElement('div');
            grid.className = "grid grid-cols-3 gap-2";

            const methods = [
                { id: 'cash', label: 'Cash', svg: '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>' },
                { id: 'card', label: 'Card', svg: '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>' },
                { id: 'online', label: 'Online', svg: '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>' }
            ];

            methods.forEach(m => {
                const btn = document.createElement('button');
                btn.onclick = () => app.setPaymentMethod(m.id);
                btn.className = `flex flex-col items-center justify-center p-2 rounded-lg border ${
                    this.state.paymentMethod === m.id
                        ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/30 dark:border-blue-400 dark:text-blue-300'
                        : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`;
                btn.innerHTML = DOMPurify.sanitize(m.svg);
                const span = document.createElement('span');
                span.className = "text-xs font-medium";
                span.textContent = m.label;
                btn.appendChild(span);
                grid.appendChild(btn);
            });
            paySection.appendChild(grid);

            const splitBtn = document.createElement('button');
            splitBtn.onclick = () => app.openSplitPaymentModal();
            splitBtn.className = "w-full mt-2 py-2 border border-blue-500 text-blue-600 dark:text-blue-400 rounded-lg text-sm font-bold hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors";
            splitBtn.textContent = this.state.paymentMethod === 'split' ? 'Manage Split Payment' : 'Split Payment / Mixed';
            paySection.appendChild(splitBtn);

            const splitSummary = document.createElement('div');
            splitSummary.id = 'split-payment-summary';
            splitSummary.className = `${this.state.paymentMethod === 'split' ? '' : 'hidden'} mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-sm`;
            paySection.appendChild(splitSummary);
            parent.appendChild(paySection);

            // Digital Receipt Section
            if (this.state.currentCustomer && (this.state.currentCustomer.phone || this.state.currentCustomer.email)) {
                const digitalDiv = document.createElement('div');
                digitalDiv.className = "mt-4 mb-2 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm";

                const header = document.createElement('div');
                header.className = "text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide flex justify-between";
                const titleSpan = document.createElement('span');
                titleSpan.textContent = "Digital Receipt";
                const optSpan = document.createElement('span');
                optSpan.className = "bg-blue-100 text-blue-800 text-[10px] px-1.5 py-0.5 rounded dark:bg-blue-900/50 dark:text-blue-200";
                optSpan.textContent = "Optional";
                header.appendChild(titleSpan);
                header.appendChild(optSpan);
                digitalDiv.appendChild(header);

                const optionsContainer = document.createElement('div');
                optionsContainer.className = "space-y-2.5";

                if (this.state.currentCustomer.phone) {
                    const label = document.createElement('label');
                    label.className = "flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none";
                    const chk = document.createElement('input');
                    chk.type = "checkbox";
                    chk.id = "digital-receipt-whatsapp";
                    chk.className = "w-4 h-4 text-emerald-500 rounded border-gray-300 focus:ring-emerald-500";
                    const textSpan = document.createElement('span');
                    textSpan.textContent = "WhatsApp to ";
                    const strong = document.createElement('strong');
                    strong.textContent = this.state.currentCustomer.phone;
                    textSpan.appendChild(strong);
                    label.appendChild(chk);
                    label.appendChild(textSpan);
                    optionsContainer.appendChild(label);
                }

                if (this.state.currentCustomer.email) {
                    const label = document.createElement('label');
                    label.className = "flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none";
                    const chk = document.createElement('input');
                    chk.type = "checkbox";
                    chk.id = "digital-receipt-email";
                    chk.className = "w-4 h-4 text-blue-500 rounded border-gray-300 focus:ring-blue-500";
                    const textSpan = document.createElement('span');
                    textSpan.textContent = "Email to ";
                    const strong = document.createElement('strong');
                    strong.textContent = this.state.currentCustomer.email;
                    textSpan.appendChild(strong);
                    label.appendChild(chk);
                    label.appendChild(textSpan);
                    optionsContainer.appendChild(label);
                }

                digitalDiv.appendChild(optionsContainer);
                parent.appendChild(digitalDiv);
            }

            // Checkout and Clear buttons
            const payBtn = document.createElement('button');
            payBtn.onclick = () => app.checkout();
            payBtn.className = "w-full bg-emerald-500 text-white py-3 rounded-lg font-bold text-lg hover:bg-emerald-600 transition-colors mt-2 shadow-sm";
            payBtn.textContent = "Pay Now";
            parent.appendChild(payBtn);

            const clearBtn = document.createElement('button');
            clearBtn.onclick = () => app.clearCart();
            clearBtn.className = "w-full bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-300 py-2 rounded-lg font-medium text-sm hover:bg-red-200 dark:hover:bg-red-800 transition-colors mt-2";
            clearBtn.textContent = "Clear Cart";
            parent.appendChild(clearBtn);
        }
    },

    async checkout() {
        if (this.state.cart.length === 0) {
            Utils.showToast("Cart is empty!", "error");
            return;
        }

        const optWhatsApp = document.getElementById('digital-receipt-whatsapp')?.checked;
        const optEmail = document.getElementById('digital-receipt-email')?.checked;

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
            receiptWindow.document.body.style.fontFamily = 'monospace';
            receiptWindow.document.body.style.textAlign = 'center';
            receiptWindow.document.body.style.paddingTop = '40px';
            const p = receiptWindow.document.createElement('p');
            p.textContent = 'Preparing receipt...';
            receiptWindow.document.body.replaceChildren(p);
        }

        try {
            // Save order to DB
            const orderId = await DB.saveOrder(order);

            // Update Stock
            for (const item of this.state.cart) {
                try {
                    const product = await DB.getProduct(item.id);
                    if (product) {
                        if (item.isVariant) {
                            product.variants[item.variantIndex].stock -= item.qty;
                            product.stock = product.variants.reduce((sum, v) => sum + v.stock, 0);
                            await DB.updateProduct(product.id, product);

                            await DB.addStockLog({
                                productId: product.id,
                                changeAmount: -item.qty,
                                reason: 'Sale',
                                timestamp: Date.now(),
                                note: `Order #${orderId} (Variant: ${item.name.split(' - ')[1] || 'Variant'})`,
                                userId: this.state.currentUser ? this.state.currentUser.id : null
                            });
                        } else if (product.isBundle && product.bundleItems) {
                            for (let bi of product.bundleItems) {
                                let compProduct = await DB.getProduct(bi.productId);
                                if (compProduct) {
                                    let deductQty = item.qty * bi.quantity;
                                    compProduct.stock -= deductQty;
                                    await DB.updateProduct(compProduct.id, { stock: compProduct.stock });

                                    await DB.addStockLog({
                                        productId: compProduct.id,
                                        changeAmount: -deductQty,
                                        reason: 'Sale',
                                        timestamp: Date.now(),
                                        note: `Order #${orderId} (Part of Bundle: ${product.name})`,
                                        userId: this.state.currentUser ? this.state.currentUser.id : null
                                    });
                                }
                            }
                        } else {
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
                    }
                } catch (stockErr) {
                    console.error("Failed to update stock for item:", item.id, stockErr);
                }
            }

            // Generate QR Code state logic... (reused)
            let qrCodeDataUri = null;

            // Save Recent Products
            try {
                const currentRecentStr = localStorage.getItem('pos_recent_products');
                let recentIds = currentRecentStr ? JSON.parse(currentRecentStr) : [];
                const newIds = this.state.cart.map(i => i.id);
                recentIds = [...new Set([...newIds, ...recentIds])].slice(0, 20);
                localStorage.setItem('pos_recent_products', JSON.stringify(recentIds));
            } catch (e) { console.error("Could not save recent products", e); }
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
                receiptWindow.document.documentElement.innerHTML = DOMPurify.sanitize(receiptHtml, { WHOLE_DOCUMENT: true });
                receiptWindow.document.close();
                setTimeout(() => {
                    try { receiptWindow.print(); } catch (e) {}
                }, 500);

                // Digital Receipt Generation
                if (optWhatsApp || optEmail) {
                    try {
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = DOMPurify.sanitize(receiptHtml, { WHOLE_DOCUMENT: true });
                        tempDiv.style.width = '340px';
                        tempDiv.style.padding = '20px';
                        tempDiv.style.background = 'white';
                        tempDiv.style.color = 'black';
                        tempDiv.style.position = 'absolute';
                        tempDiv.style.left = '-9999px';
                        document.body.appendChild(tempDiv);

                        const opt = {
                            margin: 0.2,
                            filename: `Receipt_${orderId}.pdf`,
                            image: { type: 'jpeg', quality: 0.98 },
                            html2canvas: { scale: 2 },
                            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
                        };

                        const pdfBlob = await window.html2pdf().set(opt).from(tempDiv).output('blob');
                        document.body.removeChild(tempDiv);

                        const file = new File([pdfBlob], `Receipt_${orderId}.pdf`, { type: "application/pdf" });

                        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                            await navigator.share({
                                files: [file],
                                title: `Receipt for Order #${orderId}`,
                                text: 'Thank you for your purchase!'
                            });
                        } else {
                            const url = URL.createObjectURL(pdfBlob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `Receipt_${orderId}.pdf`;
                            a.click();
                            URL.revokeObjectURL(url);

                            Utils.showToast("Receipt downloaded. You can now attach it.");

                            setTimeout(() => {
                                if (optWhatsApp && this.state.currentCustomer?.phone) {
                                    const waUrl = `https://wa.me/${this.state.currentCustomer.phone.replace(/[^0-9+]/g, '')}?text=${encodeURIComponent('Please find your receipt attached.')}`;
                                    window.open(waUrl, '_blank');
                                } else if (optEmail && this.state.currentCustomer?.email) {
                                    const emailUrl = `mailto:${this.state.currentCustomer.email}?subject=${encodeURIComponent('Receipt for Order #' + orderId)}&body=${encodeURIComponent('Please find your receipt attached as a download.')}`;
                                    window.open(emailUrl, '_blank');
                                }
                            }, 500);
                        }
                    } catch (err) {
                        console.error("Failed to generate digital receipt:", err);
                        Utils.showToast("Failed to generate digital receipt", "error");
                    }
                }
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
        listObj.replaceChildren();
        this.state.payments.forEach((p, index) => {
            const div = document.createElement('div');
            div.className = "flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded mb-2";

            const methodSpan = document.createElement('span');
            methodSpan.className = "capitalize font-bold text-gray-700 dark:text-gray-300";
            methodSpan.textContent = p.method;

            const rightDiv = document.createElement('div');
            rightDiv.className = "flex items-center gap-2";
            const amtSpan = document.createElement('span');
            amtSpan.className = "font-mono text-gray-800 dark:text-gray-200";
            amtSpan.textContent = Utils.formatCurrency(p.amount, this.state.settings.currencySymbol);

            const removeBtn = document.createElement('button');
            removeBtn.onclick = () => app.removeSplitPayment(index, totalDue);
            removeBtn.className = "text-red-500 hover:text-red-700";
            removeBtn.innerHTML = "&times;";

            rightDiv.appendChild(amtSpan);
            rightDiv.appendChild(removeBtn);
            div.appendChild(methodSpan);
            div.appendChild(rightDiv);
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

        summary.replaceChildren();
        const div = document.createElement('div');
        div.className = `font-bold cursor-pointer ${colorClass}`;
        div.textContent = text;
        div.onclick = () => app.openSplitPaymentModal();
        summary.appendChild(div);
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

                const topRow = document.createElement('div');
                topRow.className = "flex justify-between items-start";
                const leftTop = document.createElement('div');
                const titleDiv = document.createElement('div');
                titleDiv.className = "font-bold text-gray-800 dark:text-white text-sm";
                titleDiv.textContent = `Hold #${index + 1}`;
                const timeDiv = document.createElement('div');
                timeDiv.className = "text-xs text-gray-400 dark:text-gray-500";
                timeDiv.textContent = timeLabel;
                leftTop.appendChild(titleDiv);
                leftTop.appendChild(timeDiv);

                const rightTop = document.createElement('div');
                rightTop.className = "text-right";
                const totalDiv = document.createElement('div');
                totalDiv.className = "font-bold text-blue-600 dark:text-blue-400";
                totalDiv.textContent = Utils.formatCurrency(subtotal, currencySymbol);
                const countDiv = document.createElement('div');
                countDiv.className = "text-xs text-gray-500 dark:text-gray-400";
                countDiv.textContent = `${itemCount} item${itemCount !== 1 ? 's' : ''}`;
                rightTop.appendChild(totalDiv);
                rightTop.appendChild(countDiv);

                topRow.appendChild(leftTop);
                topRow.appendChild(rightTop);
                card.appendChild(topRow);

                if (held.currentCustomer) {
                    const custDiv = document.createElement('div');
                    custDiv.className = "text-xs text-blue-700 dark:text-blue-300 font-medium";
                    custDiv.textContent = `👤 ${held.currentCustomer.name}`;
                    card.appendChild(custDiv);
                }

                const namesDiv = document.createElement('div');
                namesDiv.className = "text-xs text-gray-500 dark:text-gray-400 truncate";
                namesDiv.textContent = `${previewNames}${held.cart.length > 3 ? ` +${held.cart.length - 3} more` : ''}`;
                card.appendChild(namesDiv);

                const btnRow = document.createElement('div');
                btnRow.className = "flex gap-2 mt-1";
                const resumeBtn = document.createElement('button');
                resumeBtn.onclick = () => app.resumeHeldOrder(index);
                resumeBtn.className = "flex-1 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-colors";
                resumeBtn.textContent = "Resume";

                const delBtn = document.createElement('button');
                delBtn.onclick = () => app.deleteHeldOrder(index);
                delBtn.className = "py-1.5 px-3 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-800 text-red-600 dark:text-red-400 text-xs font-bold rounded-lg transition-colors";
                delBtn.textContent = "Delete";

                btnRow.appendChild(resumeBtn);
                btnRow.appendChild(delBtn);
                card.appendChild(btnRow);
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

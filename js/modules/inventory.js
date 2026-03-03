// Inventory Module
// Depends on: db.js, utils.js, constants.js

window.Inventory = {
    async renderInventory() {
        const tbody = document.getElementById(DOM.INVENTORY.TABLE_BODY);
        const banner = document.getElementById(DOM.INVENTORY.FILTER_BANNER);
        const searchInput = document.getElementById('inv-search-input'); // Direct ID for now

        if (!tbody) return;
        tbody.innerHTML = '';
        Utils.showLoading();

        try {
            // Get State
            const page = this.state.inventoryPage || 1;
            const perPage = 10;
            const query = (searchInput ? searchInput.value : '').toLowerCase();
            const lowStockFilter = this.state.inventoryFilter === 'low_stock';

            // Filter UI
            if (lowStockFilter) {
                banner.classList.remove('hidden');
            } else {
                banner.classList.add('hidden');
            }

            const { currencySymbol } = this.state.settings;

            // Fetch from DB
            const result = await DB.getProducts(page, perPage, query, lowStockFilter);
            const products = result.data;
            const totalItems = result.total;

            // Empty State
            if (products.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5" class="p-8 text-center text-gray-500 dark:text-gray-400">
                            <div class="flex flex-col items-center justify-center">
                                <svg class="w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
                                </svg>
                                <p>No products found.</p>
                            </div>
                        </td>
                    </tr>`;
                this.updateInventoryPagination(0, 0, 1);
                return;
            }

            // Pagination Logic
            const totalPages = Math.ceil(totalItems / perPage);
            // safePage logic is handled by UI restrictions, but good to keep state consistent
            if (page > totalPages && totalPages > 0) {
                this.state.inventoryPage = totalPages;
                // Refetch? Or just let it be next time.
            }

            products.forEach(prod => {
                const tr = document.createElement('tr');
                tr.className = "hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 transition-colors";

                let imgContent = '<div class="w-8 h-8 bg-gray-200 rounded-full"></div>';
                if (prod.image) {
                    imgContent = `<img src="${prod.image}" class="w-8 h-8 object-cover rounded-full">`;
                }

                tr.innerHTML = `
                    <td class="p-4 flex items-center gap-3 dark:text-white">
                        ${imgContent}
                        <span class="font-medium">${Utils.sanitize(prod.name)}</span>
                    </td>
                    <td class="p-4 font-mono text-sm text-gray-500 dark:text-gray-400">${Utils.sanitize(prod.barcode || '-')}</td>
                    <td class="p-4 dark:text-white">${Utils.formatCurrency(prod.price, currencySymbol)}</td>
                    <td class="p-4 ${prod.stock < 5 ? 'text-red-500 font-bold' : 'dark:text-white'}">${prod.stock}</td>
                    <td class="p-4 flex gap-2">
                        <button onclick="app.openProductModal(${prod.id})" class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">Edit</button>
                        <button onclick="app.deleteProduct(${prod.id})" class="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300">Delete</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });

            this.updateInventoryPagination(totalItems, totalPages, page);

        } catch (error) {
            console.error(error);
            Utils.showToast("Error loading inventory", "error");
        } finally {
            Utils.hideLoading();
        }
    },

    updateInventoryPagination(totalItems, totalPages, currentPage) {
        const pageInfo = document.getElementById('inv-page-info');
        const prevBtn = document.getElementById('inv-prev-btn');
        const nextBtn = document.getElementById('inv-next-btn');

        if (pageInfo) pageInfo.textContent = totalItems === 0 ? "No items" : `Page ${currentPage} of ${totalPages} (${totalItems} items)`;

        if (prevBtn) {
            prevBtn.disabled = currentPage <= 1;
            prevBtn.onclick = () => {
                this.state.inventoryPage = currentPage - 1;
                this.renderInventory();
            };
        }

        if (nextBtn) {
            nextBtn.disabled = currentPage >= totalPages;
            nextBtn.onclick = () => {
                this.state.inventoryPage = currentPage + 1;
                this.renderInventory();
            };
        }

        const exportBtn = document.getElementById('inv-export-btn');
        if (exportBtn) {
            exportBtn.onclick = () => this.exportProducts();
        }
    },

    async exportProducts() {
        Utils.showLoading();
        try {
            const products = await DB.getProducts();
            if (!products || products.length === 0) {
                Utils.showToast("No products to export", "error");
                return;
            }

            const headers = ["Product ID", "Name", "Barcode", "Price", "Cost Price", "Stock Level", "Total Value", "Category ID", "Supplier ID"];
            const rows = products.map(p => [
                p.id,
                p.name,
                p.barcode || '',
                p.price.toFixed(2),
                p.costPrice.toFixed(2),
                p.stock,
                (p.price * p.stock).toFixed(2),
                p.categoryId || '',
                p.supplierId || ''
            ]);

            Utils.exportToCSV("exported_inventory", headers, rows);
            Utils.showToast("Inventory exported successfully");
        } catch (error) {
            console.error(error);
            Utils.showToast("Error exporting inventory", "error");
        } finally {
            Utils.hideLoading();
        }
    },

    async openProductModal(productId = null) {
        const modal = document.getElementById(DOM.MODALS.PRODUCT.ID);
        const form = document.getElementById(DOM.MODALS.PRODUCT.FORM);
        const title = document.getElementById(DOM.MODALS.PRODUCT.TITLE);

        Utils.clearFormErrors(form); // Clear errors

        // Image elements
        const preview = document.getElementById(DOM.MODALS.PRODUCT.IMAGE_PREVIEW);
        const placeholder = document.getElementById(DOM.MODALS.PRODUCT.IMAGE_PLACEHOLDER);
        const base64Input = document.getElementById(DOM.MODALS.PRODUCT.IMAGE_BASE64);
        const fileInput = document.getElementById(DOM.MODALS.PRODUCT.IMAGE_INPUT);

        // Reset Image state
        preview.src = '';
        preview.classList.add('hidden');
        placeholder.classList.remove('hidden');
        base64Input.value = '';
        fileInput.value = '';

        // Ensure categories are refreshed
        const categorySelect = document.getElementById(DOM.MODALS.PRODUCT.INPUT_CATEGORY);
        categorySelect.innerHTML = '';
        this.state.categories.forEach(cat => {
            categorySelect.innerHTML += `<option value="${cat.id}">${Utils.sanitize(cat.name)}</option>`;
        });

        // Ensure Suppliers are refreshed
        const supplierSelect = document.getElementById(DOM.MODALS.PRODUCT.INPUT_SUPPLIER);
        if (supplierSelect) {
            supplierSelect.innerHTML = '<option value="">None</option>';
            try {
                const suppliers = await DB.getSuppliers();
                suppliers.forEach(s => {
                    supplierSelect.innerHTML += `<option value="${s.id}">${Utils.sanitize(s.name)}</option>`;
                });
            } catch (e) { console.error("Error loading suppliers for modal", e); }
        }


        if (productId) {
            let prod;
            try {
                prod = await DB.getProduct(productId);
            } catch (e) {
                console.error("Failed to fetch product for edit", e);
                Utils.showToast("Error loading product details", "error");
                return;
            }

            if (!prod) {
                Utils.showToast("Product not found", "error");
                return;
            }
            title.innerText = "Edit Product";
            document.getElementById(DOM.MODALS.PRODUCT.INPUT_ID).value = prod.id;
            document.getElementById(DOM.MODALS.PRODUCT.INPUT_NAME).value = prod.name;
            document.getElementById(DOM.MODALS.PRODUCT.INPUT_BARCODE).value = prod.barcode;
            document.getElementById(DOM.MODALS.PRODUCT.INPUT_PRICE).value = prod.price;
            document.getElementById(DOM.MODALS.PRODUCT.INPUT_COST).value = prod.costPrice;
            document.getElementById(DOM.MODALS.PRODUCT.INPUT_STOCK).value = prod.stock;
            document.getElementById(DOM.MODALS.PRODUCT.INPUT_CATEGORY).value = prod.categoryId;
            if (document.getElementById(DOM.MODALS.PRODUCT.INPUT_SUPPLIER)) {
                document.getElementById(DOM.MODALS.PRODUCT.INPUT_SUPPLIER).value = prod.supplierId || '';
            }
            if (document.getElementById(DOM.MODALS.PRODUCT.INPUT_THRESHOLD)) {
                document.getElementById(DOM.MODALS.PRODUCT.INPUT_THRESHOLD).value = prod.lowStockThreshold || 5;
            }

            if (prod.image) {
                preview.src = prod.image;
                preview.classList.remove('hidden');
                placeholder.classList.add('hidden');
                base64Input.value = prod.image;
            }

        } else {
            title.innerText = "Add Product";
            form.reset();
            document.getElementById(DOM.MODALS.PRODUCT.INPUT_ID).value = '';
            // Defaults
            if (document.getElementById(DOM.MODALS.PRODUCT.INPUT_THRESHOLD)) {
                document.getElementById(DOM.MODALS.PRODUCT.INPUT_THRESHOLD).value = 5;
            }
        }

        modal.classList.remove('hidden');
    },

    async handleProductImageUpload(event) {
        const file = event.target.files[0];
        if (file) {
            // Check size before compression (optional, but good for UX) or just compress
            try {
                Utils.showLoading();
                const base64 = await Utils.compressImage(file, 800, 0.7);
                Utils.hideLoading();

                document.getElementById(DOM.MODALS.PRODUCT.IMAGE_BASE64).value = base64;

                const preview = document.getElementById(DOM.MODALS.PRODUCT.IMAGE_PREVIEW);
                const placeholder = document.getElementById(DOM.MODALS.PRODUCT.IMAGE_PLACEHOLDER);

                preview.src = base64;
                preview.classList.remove('hidden');
                placeholder.classList.add('hidden');
            } catch (error) {
                Utils.hideLoading();
                Utils.showToast("Failed to process image", "error");
                console.error(error);
            }
        }
    },

    removeProductImage() {
        document.getElementById(DOM.MODALS.PRODUCT.IMAGE_BASE64).value = '';
        document.getElementById(DOM.MODALS.PRODUCT.IMAGE_INPUT).value = '';

        const preview = document.getElementById(DOM.MODALS.PRODUCT.IMAGE_PREVIEW);
        const placeholder = document.getElementById(DOM.MODALS.PRODUCT.IMAGE_PLACEHOLDER);

        preview.src = '';
        preview.classList.add('hidden');
        placeholder.classList.remove('hidden');
    },

    closeProductModal() {
        document.getElementById(DOM.MODALS.PRODUCT.ID).classList.add('hidden');
    },

    async saveProduct(event) {
        event.preventDefault();
        const form = event.target;
        Utils.clearFormErrors(form);

        const idInput = document.getElementById(DOM.MODALS.PRODUCT.INPUT_ID);
        const nameInput = document.getElementById(DOM.MODALS.PRODUCT.INPUT_NAME);
        const priceInput = document.getElementById(DOM.MODALS.PRODUCT.INPUT_PRICE);
        const stockInput = document.getElementById(DOM.MODALS.PRODUCT.INPUT_STOCK);
        const barcodeInput = document.getElementById(DOM.MODALS.PRODUCT.INPUT_BARCODE);
        const supplierInput = document.getElementById(DOM.MODALS.PRODUCT.INPUT_SUPPLIER);
        const thresholdInput = document.getElementById(DOM.MODALS.PRODUCT.INPUT_THRESHOLD);

        const id = idInput.value;
        const name = nameInput.value.trim();
        const price = parseFloat(priceInput.value);
        const stock = parseInt(stockInput.value);
        const barcode = barcodeInput.value.trim();
        const supplierId = supplierInput ? parseInt(supplierInput.value) || null : null;
        const lowStockThreshold = thresholdInput ? parseInt(thresholdInput.value) || 5 : 5;

        // Validation based on fields
        let isValid = true;

        if (!name) {
            Utils.showFormError(nameInput, "Product name is required");
            isValid = false;
        }

        if (isNaN(price) || price < 0) {
            Utils.showFormError(priceInput, "Valid price is required");
            isValid = false;
        }

        if (isNaN(stock)) {
            Utils.showFormError(stockInput, "Valid stock quantity is required");
            isValid = false;
        }

        if (!isValid) return;

        const product = {
            name,
            barcode,
            price,
            costPrice: parseFloat(document.getElementById(DOM.MODALS.PRODUCT.INPUT_COST).value) || 0,
            stock,
            categoryId: parseInt(document.getElementById(DOM.MODALS.PRODUCT.INPUT_CATEGORY).value),
            image: document.getElementById(DOM.MODALS.PRODUCT.IMAGE_BASE64).value,
            supplierId,
            lowStockThreshold
        };

        // Check for duplicate barcode
        if (product.barcode) {
            try {
                const existing = await DB.getProductByBarcode(product.barcode);
                // If exists AND (we are adding new OR editing different product)
                if (existing && (!id || existing.id != parseInt(id))) {
                    Utils.showFormError(barcodeInput, "Barcode already exists");
                    return;
                }
            } catch (e) {
                console.error("Error checking barcode", e);
            }
        }

        try {
            if (id) {
                const oldProduct = await DB.getProduct(parseInt(id));
                const stockDiff = product.stock - oldProduct.stock;

                // If stock changed manually, log it
                if (stockDiff !== 0) {
                    await DB.addStockLog({
                        productId: parseInt(id),
                        changeAmount: stockDiff,
                        reason: 'Manual Adjustment',
                        timestamp: Date.now(),
                        note: 'Edited via Product Modal',
                        userId: null // TODO: Add user ID when auth enabled globally
                    });
                }

                await DB.updateProduct(parseInt(id), product);
                Utils.showToast("Product Updated");
            } else {
                const newId = await DB.addProduct(product);
                // Log initial stock
                await DB.addStockLog({
                    productId: newId,
                    changeAmount: product.stock,
                    reason: 'Initial Stock',
                    timestamp: Date.now(),
                    note: 'New Product Created'
                });
                Utils.showToast("Product Added");
            }

            this.closeProductModal();
            await this.loadData();
            // renderInventory included in loadData flow usually if state updated, but here we manually refresh
            if (!this.state.activeTab || this.state.activeTab === 'products') {
                this.renderInventory();
            } else {
                // If we were on another tab, maybe switch back? Nah.
            }
        } catch (e) {
            console.error(e);
            Utils.showToast("Error saving product", "error");
        }
    },

    switchTab(tabName) {
        // Hide all tabs
        document.querySelectorAll('.inv-tab-content').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.inv-tab-btn').forEach(btn => {
            btn.classList.remove('border-blue-600', 'text-blue-600');
            btn.classList.add('border-transparent', 'text-gray-500', 'dark:text-gray-400');
        });

        // Show selected
        const selectedContent = document.getElementById(`inv-tab-content-${tabName}`);
        const selectedBtn = document.querySelector(`.inv-tab-btn[data-tab="${tabName}"]`);

        if (selectedContent) selectedContent.classList.remove('hidden');
        if (selectedBtn) {
            selectedBtn.classList.remove('border-transparent', 'text-gray-500', 'dark:text-gray-400');
            selectedBtn.classList.add('border-blue-600', 'text-blue-600');
        }

        this.state.activeTab = tabName;

        // Button visibility
        const addProdBtn = document.getElementById('inv-add-product-btn');
        const addSupplierBtn = document.getElementById('inv-add-supplier-btn');
        const addPOBtn = document.getElementById('inv-add-po-btn');

        if (addProdBtn) addProdBtn.classList.add('hidden');
        if (addSupplierBtn) addSupplierBtn.classList.add('hidden');
        if (addPOBtn) addPOBtn.classList.add('hidden');

        if (tabName === 'products') {
            if (addProdBtn) addProdBtn.classList.remove('hidden');
            this.renderInventory();
        } else if (tabName === 'suppliers') {
            if (addSupplierBtn) addSupplierBtn.classList.remove('hidden');
            if (typeof Suppliers !== 'undefined') Suppliers.renderSuppliers();
        } else if (tabName === 'purchase-orders') {
            if (addPOBtn) addPOBtn.classList.remove('hidden');
            if (typeof Stock !== 'undefined') Stock.renderPurchaseOrders();
        } else if (tabName === 'stock-logs') {
            if (typeof Stock !== 'undefined') Stock.renderStockLogs();
        }
    },

    async deleteProduct(id) {
        if (await Utils.confirm("Delete Product", "Are you sure you want to delete this product?")) {
            await DB.deleteProduct(id);
            await this.loadData();
            this.renderInventory();
            Utils.showToast("Product Deleted");
        }
    }
};

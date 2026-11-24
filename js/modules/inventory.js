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
                tbody.textContent = '';
                const tr = document.createElement('tr');
                const td = document.createElement('td');
                td.colSpan = 5;
                td.className = "p-8 text-center text-gray-500 dark:text-gray-400";
                const div = document.createElement('div');
                div.className = "flex flex-col items-center justify-center";
                div.innerHTML = DOMPurify.sanitize(`
                    <svg class="w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
                    </svg>
                    <p>No products found.</p>
                `);
                td.appendChild(div);
                tr.appendChild(td);
                tbody.appendChild(tr);
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

            tbody.textContent = '';
            products.forEach(prod => {
                const tr = document.createElement('tr');
                tr.className = "hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 transition-colors";

                const tdName = document.createElement('td');
                tdName.className = "p-4 flex items-center gap-3 dark:text-white";
                if (prod.image) {
                    const img = document.createElement('img');
                    img.src = prod.image;
                    img.className = "w-8 h-8 object-cover rounded-full";
                    img.alt = prod.name;
                    tdName.appendChild(img);
                } else {
                    const placeholder = document.createElement('div');
                    placeholder.className = "w-8 h-8 bg-gray-200 rounded-full";
                    tdName.appendChild(placeholder);
                }
                const nameSpan = document.createElement('span');
                nameSpan.className = "font-medium";
                nameSpan.textContent = prod.name;
                tdName.appendChild(nameSpan);

                const tdBarcode = document.createElement('td');
                tdBarcode.className = "p-4 font-mono text-sm text-gray-500 dark:text-gray-400";
                tdBarcode.textContent = prod.barcode || '-';

                const tdPrice = document.createElement('td');
                tdPrice.className = "p-4 dark:text-white";
                tdPrice.textContent = Utils.formatCurrency(prod.price, currencySymbol);

                const tdStock = document.createElement('td');
                tdStock.className = `p-4 ${prod.stock < 5 ? 'text-red-500 font-bold' : 'dark:text-white'}`;
                tdStock.textContent = prod.stock;

                const tdActions = document.createElement('td');
                tdActions.className = "p-4 flex gap-2";
                if (prod.barcode) {
                    const printBtn = document.createElement('button');
                    printBtn.className = "text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300";
                    printBtn.textContent = "Print";
                    printBtn.onclick = () => app.printProductBarcode(prod.barcode, prod.name);
                    tdActions.appendChild(printBtn);
                }
                const editBtn = document.createElement('button');
                editBtn.className = "text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300";
                editBtn.textContent = "Edit";
                editBtn.onclick = () => app.openProductModal(prod.id);
                tdActions.appendChild(editBtn);

                const delBtn = document.createElement('button');
                delBtn.className = "text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300";
                delBtn.textContent = "Delete";
                delBtn.onclick = () => app.deleteProduct(prod.id);
                tdActions.appendChild(delBtn);

                tr.appendChild(tdName);
                tr.appendChild(tdBarcode);
                tr.appendChild(tdPrice);
                tr.appendChild(tdStock);
                tr.appendChild(tdActions);
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
        categorySelect.replaceChildren();
        this.state.categories.forEach(cat => {
            categorySelect.appendChild(new Option(cat.name, cat.id));
        });

        // Ensure Suppliers are refreshed
        const supplierSelect = document.getElementById(DOM.MODALS.PRODUCT.INPUT_SUPPLIER);
        if (supplierSelect) {
            supplierSelect.replaceChildren(new Option('None', ''));
            try {
                const suppliers = await DB.getSuppliers();
                suppliers.forEach(s => {
                    supplierSelect.appendChild(new Option(s.name, s.id));
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

            // Populate Variants & Bundles
            const hasVariantsCheck = document.getElementById('prod-hasVariants');
            const isBundleCheck = document.getElementById('prod-isBundle');
            hasVariantsCheck.checked = !!prod.hasVariants;
            isBundleCheck.checked = !!prod.isBundle;

            document.getElementById('variants-list').innerHTML = '';
            document.getElementById('bundle-items-list').innerHTML = '';

            if (prod.hasVariants && prod.variants) {
                prod.variants.forEach(v => Inventory.addVariantRow(v));
            }
            if (prod.isBundle && prod.bundleItems) {
                prod.bundleItems.forEach(b => Inventory.addBundleRow(b));
            }

        } else {
            title.innerText = "Add Product";
            form.reset();
            document.getElementById(DOM.MODALS.PRODUCT.INPUT_ID).value = '';
            // Defaults
            if (document.getElementById(DOM.MODALS.PRODUCT.INPUT_THRESHOLD)) {
                document.getElementById(DOM.MODALS.PRODUCT.INPUT_THRESHOLD).value = 5;
            }
            document.getElementById('prod-hasVariants').checked = false;
            document.getElementById('prod-isBundle').checked = false;
            document.getElementById('variants-list').innerHTML = '';
            document.getElementById('bundle-items-list').innerHTML = '';
        }

        Inventory.toggleProductSections();
        modal.classList.remove('hidden');
    },

    toggleProductSections() {
        const hasVariants = document.getElementById('prod-hasVariants').checked;
        const isBundle = document.getElementById('prod-isBundle').checked;
        const variantsSection = document.getElementById('variants-section');
        const bundleSection = document.getElementById('bundle-section');
        const stockInputDiv = document.getElementById('prod-stock').closest('div');
        const costInputDiv = document.getElementById('prod-costPrice').closest('div');

        // Hide stock input if variants or bundles handle it
        if (stockInputDiv) stockInputDiv.style.display = (hasVariants || isBundle) ? 'none' : 'block';
        if (costInputDiv) costInputDiv.style.display = (isBundle) ? 'none' : 'block';

        if (hasVariants) variantsSection.classList.remove('hidden');
        else variantsSection.classList.add('hidden');

        if (isBundle) bundleSection.classList.remove('hidden');
        else bundleSection.classList.add('hidden');
    },

    addVariantRow(variant = null) {
        const list = document.getElementById('variants-list');
        const div = document.createElement('div');
        div.className = 'flex gap-2 items-center variant-row';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.placeholder = 'Size/Color';
        nameInput.className = 'variant-name flex-1 px-2 py-1 text-sm border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded';
        nameInput.value = variant ? variant.name : '';
        nameInput.required = true;

        const priceInput = document.createElement('input');
        priceInput.type = 'number';
        priceInput.placeholder = 'Price';
        priceInput.step = '0.01';
        priceInput.className = 'variant-price w-20 px-2 py-1 text-sm border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded';
        priceInput.value = variant ? variant.price : '';
        priceInput.required = true;

        const stockInput = document.createElement('input');
        stockInput.type = 'number';
        stockInput.placeholder = 'Stock';
        stockInput.min = '0';
        stockInput.className = 'variant-stock w-20 px-2 py-1 text-sm border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded';
        stockInput.value = variant !== null && variant.stock !== undefined ? variant.stock : 0;
        stockInput.required = true;

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'text-red-500 hover:text-red-700 font-bold px-2';
        removeBtn.innerHTML = '&times;';
        removeBtn.onclick = () => div.remove();

        div.appendChild(nameInput);
        div.appendChild(priceInput);
        div.appendChild(stockInput);
        div.appendChild(removeBtn);
        list.appendChild(div);
    },

    addBundleRow(bundleItem = null) {
        const list = document.getElementById('bundle-items-list');
        const div = document.createElement('div');
        div.className = 'flex gap-2 items-center bundle-row';

        const select = document.createElement('select');
        select.className = 'bundle-product flex-1 px-2 py-1 text-sm border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded';
        select.required = true;
        select.appendChild(new Option('Select Product...', ''));

        if (this.state && this.state.products) {
            this.state.products.forEach(p => {
                if (!p.isBundle) {
                    const opt = new Option(p.name, p.id);
                    if (bundleItem && bundleItem.productId === p.id) {
                        opt.selected = true;
                    }
                    select.appendChild(opt);
                }
            });
        }

        const qtyInput = document.createElement('input');
        qtyInput.type = 'number';
        qtyInput.placeholder = 'Qty';
        qtyInput.min = '1';
        qtyInput.className = 'bundle-qty w-16 px-2 py-1 text-sm border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded';
        qtyInput.value = bundleItem ? bundleItem.quantity : 1;
        qtyInput.required = true;

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'text-red-500 hover:text-red-700 font-bold px-2';
        removeBtn.innerHTML = '&times;';
        removeBtn.onclick = () => div.remove();

        div.appendChild(select);
        div.appendChild(qtyInput);
        div.appendChild(removeBtn);
        list.appendChild(div);
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

        const hasVariants = document.getElementById('prod-hasVariants').checked;
        const isBundle = document.getElementById('prod-isBundle').checked;

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

        if (!hasVariants && !isBundle && isNaN(stock)) {
            Utils.showFormError(stockInput, "Valid stock quantity is required");
            isValid = false;
        }

        if (!isValid) return;

        // Collect Variants
        let variants = [];
        let calculatedStock = 0;
        if (hasVariants) {
            document.querySelectorAll('.variant-row').forEach(row => {
                const vName = row.querySelector('.variant-name').value.trim();
                const vPrice = parseFloat(row.querySelector('.variant-price').value);
                const vStock = parseInt(row.querySelector('.variant-stock').value) || 0;
                if (vName && !isNaN(vPrice)) {
                    variants.push({ name: vName, price: vPrice, stock: vStock });
                    calculatedStock += vStock;
                }
            });
            if (variants.length === 0) {
                Utils.showToast("Add at least one variant", "error");
                return;
            }
        }

        // Collect Bundle Items
        let bundleItems = [];
        if (isBundle) {
            document.querySelectorAll('.bundle-row').forEach(row => {
                const pId = parseInt(row.querySelector('.bundle-product').value);
                const bQty = parseInt(row.querySelector('.bundle-qty').value) || 1;
                if (pId && bQty > 0) {
                    bundleItems.push({ productId: pId, quantity: bQty });
                }
            });
            if (bundleItems.length === 0) {
                Utils.showToast("Add at least one product to bundle", "error");
                return;
            }
        }

        const finalStock = hasVariants ? calculatedStock : (isBundle ? 0 : stock);

        const product = {
            name,
            barcode,
            price,
            costPrice: parseFloat(document.getElementById(DOM.MODALS.PRODUCT.INPUT_COST).value) || 0,
            stock: finalStock,
            categoryId: parseInt(document.getElementById(DOM.MODALS.PRODUCT.INPUT_CATEGORY).value),
            image: document.getElementById(DOM.MODALS.PRODUCT.IMAGE_BASE64).value,
            supplierId,
            lowStockThreshold,
            hasVariants,
            isBundle,
            variants,
            bundleItems
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

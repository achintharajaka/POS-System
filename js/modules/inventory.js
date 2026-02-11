// Inventory Module
// Depends on: db.js, utils.js, constants.js

window.Inventory = {
    renderInventory() {
        const tbody = document.getElementById(DOM.INVENTORY.TABLE_BODY);
        const banner = document.getElementById(DOM.INVENTORY.FILTER_BANNER);
        const searchInput = document.getElementById('inv-search-input'); // Direct ID for now

        if (!tbody) return;
        tbody.innerHTML = '';

        // Get State
        const page = this.state.inventoryPage || 1;
        const perPage = 10;
        const query = (searchInput ? searchInput.value : '').toLowerCase();
        const lowStockFilter = this.state.inventoryFilter === 'low_stock';

        // Filter
        if (lowStockFilter) {
            banner.classList.remove('hidden');
        } else {
            banner.classList.add('hidden');
        }

        const { currencySymbol } = this.state.settings;

        let products = this.state.products;
        if (lowStockFilter) {
            products = products.filter(p => p.stock < 5);
        }

        if (query) {
            products = products.filter(p =>
                p.name.toLowerCase().includes(query) ||
                (p.barcode && p.barcode.toLowerCase().includes(query))
            );
        }

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

        // Pagination
        const totalPages = Math.ceil(products.length / perPage);
        const safePage = Math.min(Math.max(1, page), totalPages);
        this.state.inventoryPage = safePage;

        const start = (safePage - 1) * perPage;
        const pagedProducts = products.slice(start, start + perPage);

        pagedProducts.forEach(prod => {
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

        this.updateInventoryPagination(products.length, totalPages, safePage);
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
    },

    openProductModal(productId = null) {
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


        if (productId) {
            const prod = this.state.products.find(p => p.id === productId);
            title.innerText = "Edit Product";
            document.getElementById(DOM.MODALS.PRODUCT.INPUT_ID).value = prod.id;
            document.getElementById(DOM.MODALS.PRODUCT.INPUT_NAME).value = prod.name;
            document.getElementById(DOM.MODALS.PRODUCT.INPUT_BARCODE).value = prod.barcode;
            document.getElementById(DOM.MODALS.PRODUCT.INPUT_PRICE).value = prod.price;
            document.getElementById(DOM.MODALS.PRODUCT.INPUT_COST).value = prod.costPrice;
            document.getElementById(DOM.MODALS.PRODUCT.INPUT_STOCK).value = prod.stock;
            document.getElementById(DOM.MODALS.PRODUCT.INPUT_CATEGORY).value = prod.categoryId;

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
        }

        modal.classList.remove('hidden');
    },

    handleProductImageUpload(event) {
        const file = event.target.files[0];
        if (file) {
            if (file.size > 500 * 1024) { // 500KB limit
                Utils.showToast("Image too large (Max 500KB)", "error");
                event.target.value = ''; // clear input
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                const base64 = e.target.result;
                document.getElementById(DOM.MODALS.PRODUCT.IMAGE_BASE64).value = base64;

                const preview = document.getElementById(DOM.MODALS.PRODUCT.IMAGE_PREVIEW);
                const placeholder = document.getElementById(DOM.MODALS.PRODUCT.IMAGE_PLACEHOLDER);

                preview.src = base64;
                preview.classList.remove('hidden');
                placeholder.classList.add('hidden');
            };
            reader.readAsDataURL(file);
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

        const id = idInput.value;
        const name = nameInput.value.trim();
        const price = parseFloat(priceInput.value);
        const stock = parseInt(stockInput.value);
        const barcode = barcodeInput.value.trim();

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
            image: document.getElementById(DOM.MODALS.PRODUCT.IMAGE_BASE64).value
        };

        // Check for duplicate barcode
        if (product.barcode) {
            const existing = this.state.products.find(p => p.barcode === product.barcode);
            // If exists AND (we are adding new OR editing different product)
            if (existing && (!id || existing.id != id)) {
                Utils.showFormError(barcodeInput, "Barcode already exists");
                return;
            }
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
        // renderInventory included in loadData flow usually if state updated, but here we manually refresh
        this.renderInventory();
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

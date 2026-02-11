// Inventory Module
// Depends on: db.js, utils.js, constants.js

window.Inventory = {
    renderInventory(filter = null) {
        const tbody = document.getElementById(DOM.INVENTORY.TABLE_BODY);
        const banner = document.getElementById(DOM.INVENTORY.FILTER_BANNER);
        if (!tbody) return;
        tbody.innerHTML = '';

        if (filter === 'low_stock') {
            banner.classList.remove('hidden');
        } else {
            banner.classList.add('hidden');
        }

        const { currencySymbol } = this.state.settings;

        let products = this.state.products;
        if (filter === 'low_stock') {
            products = products.filter(p => p.stock < 5);
        }

        if (products.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-500 dark:text-gray-400">No items found.</td></tr>';
            return;
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
    },

    openProductModal(productId = null) {
        const modal = document.getElementById(DOM.MODALS.PRODUCT.ID);
        const form = document.getElementById(DOM.MODALS.PRODUCT.FORM);
        const title = document.getElementById(DOM.MODALS.PRODUCT.TITLE);

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

        const id = document.getElementById(DOM.MODALS.PRODUCT.INPUT_ID).value;
        const product = {
            name: document.getElementById(DOM.MODALS.PRODUCT.INPUT_NAME).value.trim(),
            barcode: document.getElementById(DOM.MODALS.PRODUCT.INPUT_BARCODE).value.trim(),
            price: parseFloat(document.getElementById(DOM.MODALS.PRODUCT.INPUT_PRICE).value),
            costPrice: parseFloat(document.getElementById(DOM.MODALS.PRODUCT.INPUT_COST).value) || 0,
            stock: parseInt(document.getElementById(DOM.MODALS.PRODUCT.INPUT_STOCK).value),
            categoryId: parseInt(document.getElementById(DOM.MODALS.PRODUCT.INPUT_CATEGORY).value),
            image: document.getElementById(DOM.MODALS.PRODUCT.IMAGE_BASE64).value
        };

        if (product.price < 0) {
            Utils.showToast("Price cannot be negative", "error");
            return;
        }

        // Check for duplicate barcode
        if (product.barcode) {
            const existing = this.state.products.find(p => p.barcode === product.barcode);
            // If exists AND (we are adding new OR editing different product)
            if (existing && (!id || existing.id != id)) {
                Utils.showToast(`Barcode "${product.barcode}" already exists!`, "error");
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
        this.renderInventory(); // Refresh view
    },

    async deleteProduct(id) {
        if (confirm("Are you sure you want to delete this product?")) {
            await DB.deleteProduct(id);
            await this.loadData();
            this.renderInventory();
            Utils.showToast("Product Deleted");
        }
    }
};

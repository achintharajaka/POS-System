// Stock Management Module
// Depends on: db.js, utils.js, suppliers.js

window.Stock = {
    // --- Purchase Orders ---
    async renderPurchaseOrders() {
        const tbody = document.getElementById(DOM.STOCK.PO_TABLE_BODY);
        if (!tbody) return;

        tbody.innerHTML = '';
        Utils.showLoading();

        try {
            const pos = await DB.getPurchaseOrders();
            const suppliers = await DB.getSuppliers();
            const supplierMap = {};
            suppliers.forEach(s => supplierMap[s.id] = s.name);

            if (pos.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" class="p-8 text-center text-gray-500 dark:text-gray-400">
                            <p>No purchase orders found.</p>
                        </td>
                    </tr>`;
                return;
            }

            pos.forEach(po => {
                const tr = document.createElement('tr');
                tr.className = "hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 transition-colors";

                let statusColor = 'bg-gray-100 text-gray-800';
                if (po.status === 'ordered') statusColor = 'bg-blue-100 text-blue-800';
                if (po.status === 'received') statusColor = 'bg-green-100 text-green-800';
                if (po.status === 'cancerlled') statusColor = 'bg-red-100 text-red-800';

                tr.innerHTML = `
                    <td class="p-4 font-mono text-sm dark:text-gray-300">#${po.id}</td>
                    <td class="p-4 dark:text-white">${po.date}</td>
                    <td class="p-4 dark:text-white">${Utils.sanitize(supplierMap[po.supplierId] || 'Unknown')}</td>
                    <td class="p-4"><span class="px-2 py-1 rounded-full text-xs font-bold ${statusColor}">${po.status.toUpperCase()}</span></td>
                    <td class="p-4 dark:text-white">${Utils.formatCurrency(po.totalCost)}</td>
                    <td class="p-4 flex gap-2">
                        ${po.status === 'ordered' ? `<button onclick="Stock.receiveGenericPO(${po.id})" class="text-green-600 hover:text-green-800 text-sm font-bold">Receive</button>` : ''}
                        <button onclick="Stock.viewPO(${po.id})" class="text-blue-600 hover:text-blue-800 dark:text-blue-400">View</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });

        } catch (error) {
            console.error(error);
            Utils.showToast("Error loading purchase orders", "error");
        } finally {
            Utils.hideLoading();
        }
    },

    async openPOModal() {
        const modal = document.getElementById(DOM.MODALS.PO.ID);
        const form = document.getElementById(DOM.MODALS.PO.FORM);
        const supplierSelect = document.getElementById(DOM.MODALS.PO.INPUT_SUPPLIER);
        const itemsContainer = document.getElementById(DOM.MODALS.PO.ITEMS_CONTAINER);

        form.reset();
        itemsContainer.innerHTML = ''; // Start empty

        // Load Suppliers
        const suppliers = await DB.getSuppliers();
        supplierSelect.innerHTML = '<option value="">Select Supplier</option>';
        suppliers.forEach(s => {
            supplierSelect.innerHTML += `<option value="${s.id}">${Utils.sanitize(s.name)}</option>`;
        });

        // Add first empty item row
        this.addPOItemRow();

        modal.classList.remove('hidden');
    },

    async addPOItemRow() {
        const container = document.getElementById(DOM.MODALS.PO.ITEMS_CONTAINER);
        const products = await DB.getProducts(); // Optimization: cache this or use a search input

        const div = document.createElement('div');
        div.className = "flex gap-2 items-center mb-2 po-item-row";

        let productOptions = '<option value="">Select Product</option>';
        products.forEach(p => {
            productOptions += `<option value="${p.id}" data-cost="${p.costPrice}">${Utils.sanitize(p.name)}</option>`;
        });

        div.innerHTML = `
            <select class="flex-1 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white po-item-select" onchange="Stock.updatePORowCost(this)">
                ${productOptions}
            </select>
            <input type="number" class="w-20 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white po-item-qty" placeholder="Qty" min="1" value="1" onchange="Stock.calculatePOTotal()">
             <input type="number" class="w-24 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white po-item-cost" placeholder="Cost" step="0.01" onchange="Stock.calculatePOTotal()">
            <button type="button" onclick="this.parentElement.remove(); Stock.calculatePOTotal()" class="text-red-500 hover:text-red-700">X</button>
        `;
        container.appendChild(div);
    },

    updatePORowCost(select) {
        const row = select.parentElement;
        const costInput = row.querySelector('.po-item-cost');
        const selectedOption = select.options[select.selectedIndex];
        if (selectedOption && selectedOption.dataset.cost) {
            costInput.value = selectedOption.dataset.cost;
        }
        this.calculatePOTotal();
    },

    calculatePOTotal() {
        // Simple client-side calc
        let total = 0;
        document.querySelectorAll('.po-item-row').forEach(row => {
            const qty = parseFloat(row.querySelector('.po-item-qty').value) || 0;
            const cost = parseFloat(row.querySelector('.po-item-cost').value) || 0;
            total += qty * cost;
        });
        document.getElementById(DOM.MODALS.PO.TOTAL_COST).textContent = Utils.formatCurrency(total);
    },

    async savePO(event) {
        event.preventDefault();
        const supplierId = document.getElementById(DOM.MODALS.PO.INPUT_SUPPLIER).value;

        if (!supplierId) {
            Utils.showToast("Please select a supplier", "error");
            return;
        }

        const items = [];
        let totalCost = 0;
        let isValid = true;

        document.querySelectorAll('.po-item-row').forEach(row => {
            const productId = row.querySelector('.po-item-select').value;
            const qty = parseFloat(row.querySelector('.po-item-qty').value);
            const cost = parseFloat(row.querySelector('.po-item-cost').value);

            if (!productId || qty <= 0) {
                isValid = false;
                return;
            }
            items.push({ productId: parseInt(productId), qty, cost });
            totalCost += qty * cost;
        });

        if (!isValid || items.length === 0) {
            Utils.showToast("Invalid items in order", "error");
            return;
        }

        const po = {
            supplierId: parseInt(supplierId),
            date: new Date().toISOString().split('T')[0],
            status: 'ordered',
            items,
            totalCost,
            receivedDate: null
        };

        try {
            await DB.addPurchaseOrder(po);
            Utils.showToast("Purchase Order created");
            this.closePOModal();
            this.renderPurchaseOrders();
        } catch (e) {
            console.error(e);
            Utils.showToast("Error creating PO", "error");
        }
    },

    closePOModal() {
        document.getElementById(DOM.MODALS.PO.ID).classList.add('hidden');
    },

    async receiveGenericPO(id) {
        if (!await Utils.confirm("Receive Order", "Confirm receipt of all items? This will update stock levels.")) return;

        try {
            const orders = await DB.getPurchaseOrders(); // Improve with get(id)
            const po = orders.find(o => o.id === id);
            if (!po) return;

            // Update Stock and Create Logs
            for (const item of po.items) {
                const product = await DB.getProduct(item.productId);
                if (product) {
                    const newStock = product.stock + item.qty;
                    await DB.updateProduct(product.id, {
                        stock: newStock,
                        costPrice: item.cost // Optional: Update cost price to latest? Let's keep it simple for now or maybe weighted average?
                        // For now, let's just update stock.
                    });

                    // Log
                    await DB.addStockLog({
                        productId: product.id,
                        changeAmount: item.qty,
                        reason: 'Purchase Order',
                        timestamp: Date.now(),
                        note: `PO #${po.id}`
                    });
                }
            }

            await DB.updatePurchaseOrder(id, {
                status: 'received',
                receivedDate: new Date().toISOString().split('T')[0]
            });

            Utils.showToast("Order Received & Stock Updated");
            this.renderPurchaseOrders();
            // Refresh inventory view if visible
            if (Inventory && typeof Inventory.renderInventory === 'function') Inventory.renderInventory();

        } catch (e) {
            console.error(e);
            Utils.showToast("Error processing receipt", "error");
        }
    },

    // --- Stock Logs ---
    async renderStockLogs(productId = null) {
        const tbody = document.getElementById(DOM.STOCK.LOGS_TABLE_BODY);
        if (!tbody) return;

        tbody.innerHTML = '';

        try {
            const logs = await DB.getStockLogs(productId);
            const products = await DB.getProducts();
            const productMap = {};
            products.forEach(p => productMap[p.id] = p.name);

            if (logs.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-gray-500">No stock history found.</td></tr>`;
                return;
            }

            logs.forEach(log => {
                const tr = document.createElement('tr');
                tr.className = "hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700";

                const isPositive = log.changeAmount > 0;
                const color = isPositive ? 'text-green-600' : 'text-red-600';
                const sign = isPositive ? '+' : '';

                tr.innerHTML = `
                    <td class="p-4 dark:text-gray-300">${new Date(log.timestamp).toLocaleString()}</td>
                    <td class="p-4 font-bold dark:text-white">${Utils.sanitize(productMap[log.productId] || 'Unknown')}</td>
                    <td class="p-4 ${color} font-mono font-bold">${sign}${log.changeAmount}</td>
                    <td class="p-4 dark:text-gray-300">${Utils.sanitize(log.reason)}</td>
                    <td class="p-4 text-sm text-gray-500">${Utils.sanitize(log.note || '-')}</td>
                 `;
                tbody.appendChild(tr);
            });
        } catch (e) {
            console.error(e);
        }
    }
};

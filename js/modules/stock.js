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
                tbody.replaceChildren();
                const tr = document.createElement('tr');
                const td = document.createElement('td');
                td.colSpan = 6;
                td.className = "p-8 text-center text-gray-500 dark:text-gray-400";
                const p = document.createElement('p');
                p.textContent = "No purchase orders found.";
                td.appendChild(p);
                tr.appendChild(td);
                tbody.appendChild(tr);
                return;
            }

            tbody.replaceChildren();
            pos.forEach(po => {
                const tr = document.createElement('tr');
                tr.className = "hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 transition-colors";

                let statusColor = 'bg-gray-100 text-gray-800';
                if (po.status === 'ordered') statusColor = 'bg-blue-100 text-blue-800';
                if (po.status === 'received') statusColor = 'bg-green-100 text-green-800';
                if (po.status === 'cancerlled') statusColor = 'bg-red-100 text-red-800';

                const tdId = document.createElement('td');
                tdId.className = "p-4 font-mono text-sm dark:text-gray-300";
                tdId.textContent = `#${po.id}`;

                const tdDate = document.createElement('td');
                tdDate.className = "p-4 dark:text-white";
                tdDate.textContent = po.date;

                const tdSup = document.createElement('td');
                tdSup.className = "p-4 dark:text-white";
                tdSup.textContent = supplierMap[po.supplierId] || 'Unknown';

                const tdStatus = document.createElement('td');
                tdStatus.className = "p-4";
                const statusBadge = document.createElement('span');
                statusBadge.className = `px-2 py-1 rounded-full text-xs font-bold ${statusColor}`;
                statusBadge.textContent = (po.status || '').toUpperCase();
                tdStatus.appendChild(statusBadge);

                const tdTotal = document.createElement('td');
                tdTotal.className = "p-4 dark:text-white";
                tdTotal.textContent = Utils.formatCurrency(po.totalCost);

                const tdActions = document.createElement('td');
                tdActions.className = "p-4 flex gap-2";
                if (po.status === 'ordered') {
                    const recBtn = document.createElement('button');
                    recBtn.onclick = () => Stock.receiveGenericPO(po.id);
                    recBtn.className = "text-green-600 hover:text-green-800 text-sm font-bold";
                    recBtn.textContent = "Receive";
                    tdActions.appendChild(recBtn);
                }
                const viewBtn = document.createElement('button');
                viewBtn.onclick = () => Stock.viewPO(po.id);
                viewBtn.className = "text-blue-600 hover:text-blue-800 dark:text-blue-400";
                viewBtn.textContent = "View";
                tdActions.appendChild(viewBtn);

                tr.appendChild(tdId);
                tr.appendChild(tdDate);
                tr.appendChild(tdSup);
                tr.appendChild(tdStatus);
                tr.appendChild(tdTotal);
                tr.appendChild(tdActions);
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
        supplierSelect.replaceChildren(new Option('Select Supplier', ''));
        suppliers.forEach(s => {
            supplierSelect.appendChild(new Option(s.name, s.id));
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

        const select = document.createElement('select');
        select.className = "flex-1 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white po-item-select";
        select.onchange = () => Stock.updatePORowCost(select);
        select.appendChild(new Option('Select Product', ''));
        products.forEach(p => {
            const opt = new Option(p.name, p.id);
            opt.dataset.cost = p.costPrice;
            select.appendChild(opt);
        });

        const qtyInput = document.createElement('input');
        qtyInput.type = "number";
        qtyInput.className = "w-20 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white po-item-qty";
        qtyInput.placeholder = "Qty";
        qtyInput.min = "1";
        qtyInput.value = "1";
        qtyInput.onchange = () => Stock.calculatePOTotal();

        const costInput = document.createElement('input');
        costInput.type = "number";
        costInput.className = "w-24 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white po-item-cost";
        costInput.placeholder = "Cost";
        costInput.step = "0.01";
        costInput.onchange = () => Stock.calculatePOTotal();

        const removeBtn = document.createElement('button');
        removeBtn.type = "button";
        removeBtn.className = "text-red-500 hover:text-red-700 font-bold px-2";
        removeBtn.innerHTML = "&times;";
        removeBtn.onclick = () => {
            div.remove();
            Stock.calculatePOTotal();
        };

        div.appendChild(select);
        div.appendChild(qtyInput);
        div.appendChild(costInput);
        div.appendChild(removeBtn);
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
                tbody.replaceChildren();
                const tr = document.createElement('tr');
                const td = document.createElement('td');
                td.colSpan = 5;
                td.className = "p-8 text-center text-gray-500";
                td.textContent = "No stock history found.";
                tr.appendChild(td);
                tbody.appendChild(tr);
                return;
            }

            tbody.replaceChildren();
            logs.forEach(log => {
                const tr = document.createElement('tr');
                tr.className = "hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700";

                const isPositive = log.changeAmount > 0;
                const color = isPositive ? 'text-green-600' : 'text-red-600';
                const sign = isPositive ? '+' : '';

                const tdDate = document.createElement('td');
                tdDate.className = "p-4 dark:text-gray-300";
                tdDate.textContent = new Date(log.timestamp).toLocaleString();

                const tdProd = document.createElement('td');
                tdProd.className = "p-4 font-bold dark:text-white";
                tdProd.textContent = productMap[log.productId] || 'Unknown';

                const tdChange = document.createElement('td');
                tdChange.className = `p-4 ${color} font-mono font-bold`;
                tdChange.textContent = `${sign}${log.changeAmount}`;

                const tdReason = document.createElement('td');
                tdReason.className = "p-4 dark:text-gray-300";
                tdReason.textContent = log.reason;

                const tdNote = document.createElement('td');
                tdNote.className = "p-4 text-sm text-gray-500";
                tdNote.textContent = log.note || '-';

                tr.appendChild(tdDate);
                tr.appendChild(tdProd);
                tr.appendChild(tdChange);
                tr.appendChild(tdReason);
                tr.appendChild(tdNote);
                tbody.appendChild(tr);
            });
        } catch (e) {
            console.error(e);
        }
    }
};

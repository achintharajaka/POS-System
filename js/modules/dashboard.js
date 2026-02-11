// Dashboard Module
// Depends on: db.js, utils.js, constants.js (loaded globally)

window.Dashboard = {
    async renderDashboard() {
        const orders = await DB.getOrders();

        // Stats
        const today = new Date().setHours(0, 0, 0, 0);
        const todayOrders = orders.filter(o => o.timestamp >= today);
        const dailySales = todayOrders.reduce((sum, o) => sum + o.total, 0);
        const lowStock = this.state.products.filter(p => p.stock < 5).length;
        const { currencySymbol } = this.state.settings;

        document.getElementById(DOM.DASHBOARD.DAILY_SALES).innerText = Utils.formatCurrency(dailySales, currencySymbol);
        document.getElementById(DOM.DASHBOARD.TOTAL_ORDERS).innerText = todayOrders.length;
        document.getElementById(DOM.DASHBOARD.LOW_STOCK).innerText = lowStock;

        // History Table
        const tbody = document.getElementById(DOM.DASHBOARD.RECENT_TXN_BODY);
        tbody.innerHTML = '';

        orders.slice(0, 50).forEach(order => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 transition-colors";
            tr.innerHTML = `
                <td class="p-4 font-mono text-sm text-gray-500 dark:text-gray-400">#${order.id}</td>
                <td class="p-4 dark:text-gray-300">${Utils.formatDate(order.timestamp)}</td>
                <td class="p-4 dark:text-gray-300">${order.items.length} Items</td>
                <td class="p-4 font-bold dark:text-white">${Utils.formatCurrency(order.total, currencySymbol)}</td>
                <td class="p-4">
                    <div class="flex gap-2">
                        <button data-action="view" data-id="${order.id}" class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 cursor-pointer">View</button>
                        <button data-action="delete" data-id="${order.id}" class="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 cursor-pointer">Delete</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Event delegation for action buttons
        tbody.onclick = (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const action = btn.dataset.action;
            const id = Number(btn.dataset.id);
            if (action === 'view') this.viewOrder(id);
            if (action === 'delete') this.deleteOrder(id);
        };
    },

    async viewOrder(id) {
        try {
            const orders = await DB.getOrders();
            const order = orders.find(o => o.id === id);
            if (!order) {
                Utils.showToast("Order not found!", "error");
                return;
            }

            this.state.currentOrder = order;

            // Open receipt in a popup window for review
            const receiptWindow = window.open('', '', 'width=400,height=700');
            if (!receiptWindow) {
                Utils.showToast("Popup blocked! Please allow popups for this site.", "error");
                return;
            }

            const receiptHtml = Utils.generateReceipt(
                this.state.settings.storeName,
                this.state.settings.storeAddress,
                order,
                this.state.settings,
                this.state.settings.storeLogo
            );

            receiptWindow.document.write(receiptHtml);
            receiptWindow.document.close();
        } catch (error) {
            console.error("viewOrder error:", error);
            Utils.logError('viewOrder', error);
            Utils.showToast("Failed to view order. Check console.", "error");
        }
    },

    closeOrderModal() {
        const modal = document.getElementById(DOM.MODALS.ORDER.ID);
        if (modal) modal.style.display = 'none';
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
        receiptWindow.document.close();
    }
};

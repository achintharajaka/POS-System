// Dashboard Module
// Depends on: db.js, utils.js, constants.js (loaded globally)

window.Dashboard = {
    async renderDashboard() {
        Utils.showLoading();
        try {
            // Stats
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Parallel fetch for stats and table
            const [todayOrders, lowStock, pagedResult] = await Promise.all([
                DB.getOrdersSince(today.getTime()),
                DB.getLowStockCount(),
                DB.getOrders(this.state.dashboardPage || 1, 10)
            ]);

            const dailySales = todayOrders.reduce((sum, o) => sum + o.total, 0);
            const { currencySymbol } = this.state.settings;

            document.getElementById(DOM.DASHBOARD.DAILY_SALES).innerText = Utils.formatCurrency(dailySales, currencySymbol);
            document.getElementById(DOM.DASHBOARD.TOTAL_ORDERS).innerText = todayOrders.length;
            document.getElementById(DOM.DASHBOARD.LOW_STOCK).innerText = lowStock;

            // History Table
            const tbody = document.getElementById(DOM.DASHBOARD.RECENT_TXN_BODY);
            tbody.innerHTML = '';

            const orders = pagedResult.data; // Current page data
            const totalItems = pagedResult.total;
            const page = this.state.dashboardPage || 1;
            const perPage = 10;
            const totalPages = Math.ceil(totalItems / perPage);

            if (orders.length === 0) {
                const tr = document.createElement('tr');
                const td = document.createElement('td');
                td.colSpan = 5;
                td.className = "p-8 text-center text-gray-500 dark:text-gray-400";
                const p = document.createElement('p');
                p.textContent = "No recent transactions.";
                td.appendChild(p);
                tr.appendChild(td);
                tbody.appendChild(tr);
                this.updateDashboardPagination(0, 0, 1);
                return;
            }

            orders.forEach(order => {
                const tr = document.createElement('tr');
                tr.className = "hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 transition-colors";

                const tdId = document.createElement('td');
                tdId.className = "p-4 font-mono text-sm text-gray-500 dark:text-gray-400";
                tdId.textContent = `#${order.id}`;

                const tdDate = document.createElement('td');
                tdDate.className = "p-4 dark:text-gray-300";
                tdDate.textContent = Utils.formatDate(order.timestamp);

                const tdItems = document.createElement('td');
                tdItems.className = "p-4 dark:text-gray-300";
                tdItems.textContent = `${order.items.length} Items`;

                const tdTotal = document.createElement('td');
                tdTotal.className = "p-4 font-bold dark:text-white";
                tdTotal.textContent = Utils.formatCurrency(order.total, currencySymbol);

                const tdActions = document.createElement('td');
                tdActions.className = "p-4";
                const div = document.createElement('div');
                div.className = "flex gap-2";
                const viewBtn = document.createElement('button');
                viewBtn.dataset.action = "view";
                viewBtn.dataset.id = order.id;
                viewBtn.className = "text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 cursor-pointer";
                viewBtn.textContent = "View";
                const delBtn = document.createElement('button');
                delBtn.dataset.action = "delete";
                delBtn.dataset.id = order.id;
                delBtn.className = "text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 cursor-pointer";
                delBtn.textContent = "Delete";
                div.appendChild(viewBtn);
                div.appendChild(delBtn);
                tdActions.appendChild(div);

                tr.appendChild(tdId);
                tr.appendChild(tdDate);
                tr.appendChild(tdItems);
                tr.appendChild(tdTotal);
                tr.appendChild(tdActions);
                tbody.appendChild(tr);
            });

            // Update Pagination Controls
            this.updateDashboardPagination(totalItems, totalPages, page);

            // Event delegation for action buttons
            tbody.onclick = (e) => {
                const btn = e.target.closest('[data-action]');
                if (!btn) return;
                const action = btn.dataset.action;
                const id = Number(btn.dataset.id);
                if (action === 'view') this.viewOrder(id);
                if (action === 'delete') this.deleteOrder(id);
            };

            // Export CSV Button
            const exportBtn = document.getElementById('dash-export-btn');
            if (exportBtn) {
                exportBtn.onclick = () => this.exportOrders();
            }

        } catch (error) {
            console.error(error);
            Utils.showToast("Error loading dashboard", "error");
        } finally {
            Utils.hideLoading();
        }
    },

    async exportOrders() {
        Utils.showLoading();
        try {
            const orders = await DB.getOrders();
            if (!orders || orders.length === 0) {
                Utils.showToast("No orders to export", "error");
                return;
            }

            const headers = ["Order ID", "Date", "Status", "Items Count", "Subtotal", "Tax", "Total", "Payment Method"];
            const rows = orders.map(o => [
                o.id,
                Utils.formatDate(o.timestamp),
                o.status || 'Completed',
                o.items ? o.items.length : 0,
                o.subtotal.toFixed(2),
                (o.total - o.subtotal).toFixed(2), // Simplistic tax calculation
                o.total.toFixed(2),
                o.paymentMethod || 'Cash'
            ]);

            Utils.exportToCSV("exported_orders", headers, rows);
            Utils.showToast("Orders exported successfully");
        } catch (error) {
            console.error(error);
            Utils.showToast("Error exporting orders", "error");
        } finally {
            Utils.hideLoading();
        }
    },

    updateDashboardPagination(totalItems, totalPages, currentPage) {
        const pageInfo = document.getElementById('dash-page-info');
        const prevBtn = document.getElementById('dash-prev-btn');
        const nextBtn = document.getElementById('dash-next-btn');

        if (pageInfo) pageInfo.textContent = totalItems === 0 ? "No orders" : `Page ${currentPage} of ${totalPages}`;

        if (prevBtn) {
            prevBtn.disabled = currentPage <= 1;
            prevBtn.onclick = () => {
                this.state.dashboardPage = currentPage - 1;
                this.renderDashboard();
            };
        }

        if (nextBtn) {
            nextBtn.disabled = currentPage >= totalPages;
            nextBtn.onclick = () => {
                this.state.dashboardPage = currentPage + 1;
                this.renderDashboard();
            };
        }
    },

    async viewOrder(id) {
        try {
            Utils.showLoading();
            const orders = await DB.getOrders();
            const order = orders.find(o => o.id === id);
            Utils.hideLoading();

            if (!order) {
                Utils.showToast("Order not found!", "error");
                return;
            }

            this.state.currentOrder = order;

            // Pre-generate QR code data URI for offline support
            let qrCodeDataUri = null;
            if (this.state.settings.receiptShowQrCode && this.state.settings.receiptQrCodeUrl) {
                try {
                    qrCodeDataUri = await Utils.generateQRCode(this.state.settings.receiptQrCodeUrl);
                } catch (e) {
                    console.error("Failed to generate QR Code", e);
                }
            }
            const settingsWithQr = { ...this.state.settings, receiptQrCodeDataUri: qrCodeDataUri };

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
                settingsWithQr,
                this.state.settings.storeLogo
            );

            receiptWindow.document.documentElement.innerHTML = DOMPurify.sanitize(receiptHtml, { WHOLE_DOCUMENT: true });
            receiptWindow.document.close();
            setTimeout(() => {
                try { receiptWindow.print(); } catch (e) {}
            }, 500);
        } catch (error) {
            Utils.hideLoading();
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
        if (await Utils.confirm("Delete Order", "Delete this order record? This cannot be undone.")) {
            Utils.showLoading();
            await DB.deleteOrder(id);
            await this.renderDashboard(); // Re-render triggers loading state too, but effectively one flow
            Utils.showToast("Order Deleted");
        }
    },

    async printOrder() {
        if (!this.state.currentOrder) return;

        // Pre-generate QR code data URI for offline support
        let qrCodeDataUri = null;
        if (this.state.settings.receiptShowQrCode && this.state.settings.receiptQrCodeUrl) {
            try {
                qrCodeDataUri = await Utils.generateQRCode(this.state.settings.receiptQrCodeUrl);
            } catch (e) {
                console.error("Failed to generate QR Code", e);
            }
        }
        const settingsWithQr = { ...this.state.settings, receiptQrCodeDataUri: qrCodeDataUri };

        const receiptWindow = window.open('', '', 'width=340,height=600');
        if (receiptWindow) {
            receiptWindow.document.documentElement.innerHTML = DOMPurify.sanitize(Utils.generateReceipt(
                this.state.settings.storeName,
                this.state.settings.storeAddress,
                this.state.currentOrder,
                settingsWithQr,
                this.state.settings.storeLogo
            ), { WHOLE_DOCUMENT: true });
            receiptWindow.document.close();
            setTimeout(() => {
                try { receiptWindow.print(); } catch (e) {}
            }, 500);
        }
    }
};

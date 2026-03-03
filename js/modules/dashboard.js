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
                tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="p-8 text-center text-gray-500 dark:text-gray-400">
                        <p>No recent transactions.</p>
                    </td>
                </tr>`;
                this.updateDashboardPagination(0, 0, 1);
                return;
            }

            orders.forEach(order => {
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

            receiptWindow.document.write(receiptHtml);
            receiptWindow.document.close();
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
        receiptWindow.document.write(Utils.generateReceipt(
            this.state.settings.storeName,
            this.state.settings.storeAddress,
            this.state.currentOrder,
            settingsWithQr,
            this.state.settings.storeLogo
        ));
        receiptWindow.document.close();
    }
};

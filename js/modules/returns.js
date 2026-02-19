// Returns Module
// Depends on: db.js, utils.js, constants.js

window.Returns = {
    state: {
        returnOrder: null,
        returnItems: {} // { itemId: qtyToReturn }
    },

    init() {
        console.log("Returns Module Initialized");
        // Inject styles or listeners if needed
        this.setupListeners();
    },

    setupListeners() {
        // Listeners usually setup in App.js, but we can do local ones here
    },

    openReturnModal() {
        const modal = document.getElementById('return-modal');
        if (modal) {
            modal.classList.remove('hidden');
            document.getElementById('return-order-search').focus();
            this.resetReturnState();
        }
    },

    closeReturnModal() {
        document.getElementById('return-modal').classList.add('hidden');
        this.resetReturnState();
    },

    resetReturnState() {
        this.state.returnOrder = null;
        this.state.returnItems = {};
        document.getElementById('return-order-details').classList.add('hidden');
        document.getElementById('return-order-search').value = '';
        document.getElementById('return-reason').value = '';
        document.getElementById('return-restock').checked = true;
    },

    async searchOrder(orderId) {
        if (!orderId) return;
        Utils.showLoading();
        try {
            const order = await DB.getOrder(parseInt(orderId));
            if (!order) {
                Utils.showToast("Order not found", "error");
                return;
            }

            // Check if already fully refunded
            if (order.status === 'refunded') {
                Utils.showToast("Order already fully refunded", "warning");
                // Show it anyway? Yes, for history maybe.
            }

            this.state.returnOrder = order;
            this.renderReturnOrderDetails(order);

        } catch (e) {
            console.error(e);
            Utils.showToast("Error searching order", "error");
        } finally {
            Utils.hideLoading();
        }
    },

    renderReturnOrderDetails(order) {
        const container = document.getElementById('return-order-details');
        const list = document.getElementById('return-order-items-list');
        const meta = document.getElementById('return-order-meta');
        
        container.classList.remove('hidden');
        list.innerHTML = '';
        
        meta.innerHTML = `
            <div class="flex justify-between items-center mb-2">
                <span class="font-bold">Order #${order.id}</span>
                <span class="text-sm text-gray-500">${new Date(order.timestamp).toLocaleString()}</span>
            </div>
            <div class="text-sm">Customer: ${order.customerName || 'Walk-in'}</div>
            <div class="text-sm">Total: ${Utils.formatCurrency(order.total)}</div>
             <div class="text-sm">Status: <span class="font-bold border px-1 rounded ${order.status === 'refunded' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}">${order.status || 'Completed'}</span></div>
        `;

        order.items.forEach(item => {
            // Calculate max returnable 
            // If we tracked previous returns, we'd subtract them here.
            // For now, assuming Version 5 starts fresh or we check `returnedQty` on items if we add that.
            // Let's assume we can calculate it from previous return records if we wanted to be strict.
            // For MVP, we just show original qty. 
            // TODO: In a real system, we must query DB.returns where orderId matches and sum up returned items.
            
            const li = document.createElement('div');
            li.className = "flex justify-between items-center p-2 border-b dark:border-gray-700";
            li.innerHTML = `
                <div class="flex-1">
                    <div class="font-medium">${item.name}</div>
                    <div class="text-xs text-gray-500">Sold: ${item.qty} x ${Utils.formatCurrency(item.price)}</div>
                </div>
                <div class="flex items-center gap-2">
                    <input type="number" min="0" max="${item.qty}" class="w-16 p-1 border rounded text-center dark:bg-gray-700 dark:text-white" 
                        onchange="Returns.updateReturnQty(${item.id}, this.value, ${item.qty}, ${item.price})" placeholder="0">
                </div>
            `;
            list.appendChild(li);
        });
        
        this.updateRefundTotal();
    },

    updateReturnQty(itemId, value, maxQty, price) {
        let qty = parseInt(value);
        if (isNaN(qty) || qty < 0) qty = 0;
        if (qty > maxQty) {
            qty = maxQty;
            // update input value if possible, but event has passed. 
            // We rely on validation at submit time too.
        }
        
        if (qty > 0) {
            this.state.returnItems[itemId] = { qty, price };
        } else {
            delete this.state.returnItems[itemId];
        }
        
        this.updateRefundTotal();
    },

    updateRefundTotal() {
        let total = 0;
        Object.values(this.state.returnItems).forEach(item => {
            total += item.qty * item.price;
        });
        document.getElementById('return-total-amount').innerText = Utils.formatCurrency(total);
    },

    async processReturn() {
        if (!this.state.returnOrder) return;
        
        const returnItemsList = Object.entries(this.state.returnItems);
        if (returnItemsList.length === 0) {
            Utils.showToast("No items selected for return", "error");
            return;
        }

        const restock = document.getElementById('return-restock').checked;
        const reason = document.getElementById('return-reason').value;
        const totalRefund = parseFloat(document.getElementById('return-total-amount').innerText.replace(/[^0-9.-]+/g,"")); // Crude parse, better to recalculate

        // Recalculate total for safety
        let calculatedTotal = 0;
        const returnPayloadItems = [];

        returnItemsList.forEach(([itemId, data]) => {
            calculatedTotal += data.qty * data.price;
            // Find name
            const originalItem = this.state.returnOrder.items.find(i => i.id == itemId);
            returnPayloadItems.push({
                id: itemId,
                name: originalItem ? originalItem.name : 'Unknown',
                qty: data.qty,
                price: data.price
            });
        });

        if (confirm(`Process refund of ${Utils.formatCurrency(calculatedTotal)}?`)) {
            Utils.showLoading();
            try {
                // 1. Create Return Record
                const returnRecord = {
                    orderId: this.state.returnOrder.id,
                    timestamp: Date.now(),
                    totalRefund: calculatedTotal,
                    items: returnPayloadItems,
                    reason: reason,
                    userId: App.state.currentUser ? App.state.currentUser.id : null,
                    customerId: this.state.returnOrder.customerId || null,
                    restocked: restock
                };

                await DB.addReturn(returnRecord);

                // 2. Update Order Status
                // If all items returned, 'refunded'. Else 'partially_refunded'.
                // Simplification for now: 'partially_refunded' unless we verify counts.
                // Let's check roughly.
                const originalTotalQty = this.state.returnOrder.items.reduce((acc, i) => acc + i.qty, 0);
                const returnedTotalQty = returnPayloadItems.reduce((acc, i) => acc + i.qty, 0);
                
                const newStatus = (returnedTotalQty >= originalTotalQty) ? 'refunded' : 'partially_refunded';
                
                await DB.updateOrder(this.state.returnOrder.id, {
                    status: newStatus,
                    returnedAmount: (this.state.returnOrder.returnedAmount || 0) + calculatedTotal
                });

                // 3. Restock if requested
                if (restock) {
                    for (const item of returnPayloadItems) {
                        try {
                            const product = await DB.getProduct(parseInt(item.id));
                            if (product) {
                                await DB.updateProduct(product.id, { stock: product.stock + item.qty });
                                await DB.addStockLog({
                                    productId: product.id,
                                    changeAmount: item.qty,
                                    reason: 'Return/Restock',
                                    timestamp: Date.now(),
                                    note: `Return for Order #${this.state.returnOrder.id}`,
                                    userId: App.state.currentUser ? App.state.currentUser.id : null
                                });
                            }
                        } catch (e) {
                            console.error("Restock error for item " + item.id, e);
                        }
                    }
                }

                // 4. Update Customer Points (Deduct)
                if (this.state.returnOrder.customerId) {
                    // Logic: Deduct points earned from this refund value
                    // e.g. 1 point per $1. 
                    // Need to check settings. 
                    const earningRate = App.state.settings.pointsEarningRate || 1;
                    const pointsToDeduct = Math.floor(calculatedTotal * earningRate);
                    
                    const customer = await DB.getCustomer(this.state.returnOrder.customerId);
                    if (customer) {
                        const newPoints = Math.max(0, (customer.points || 0) - pointsToDeduct);
                        await DB.updateCustomer(customer.id, { points: newPoints });
                    }
                }

                Utils.showToast("Return processed successfully");
                this.closeReturnModal();
                
                // Refresh dashboard if visible
                if (App.state.currentView === 'dashboard') App.renderDashboard();

            } catch (e) {
                console.error(e);
                Utils.showToast("Failed to process return", "error");
            } finally {
                Utils.hideLoading();
            }
        }

    }
};

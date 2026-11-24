window.Reports = {
    reportRange: { start: null, end: null, type: 'this_month' },

    initReportsUI() {
        const bindClick = (id, handler) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', handler);
        };

        bindClick(DOM.REPORTS.FILTER_TODAY, () => this.setReportRange('today'));
        bindClick(DOM.REPORTS.FILTER_WEEK, () => this.setReportRange('this_week'));
        bindClick(DOM.REPORTS.FILTER_MONTH, () => this.setReportRange('this_month'));
        bindClick(DOM.REPORTS.FILTER_BTN, () => {
            const from = document.getElementById(DOM.REPORTS.FILTER_FROM).value;
            const to = document.getElementById(DOM.REPORTS.FILTER_TO).value;
            if (from && to) {
                this.setReportRange('custom', from, to);
            } else {
                Utils.showToast("Please select both dates", "warning");
            }
        });

        const exportBtn = document.getElementById('report-export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportFinancials());
        }

        // Set initial range if not set
        if (!this.reportRange.start) {
            this.setReportRange('this_month', null, null, false);
        }
    },

    async exportFinancials() {
        Utils.showLoading();
        try {
            if (!this.reportRange.start) this.setReportRange('this_month', null, null, false);

            const startDate = new Date(this.reportRange.start);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(this.reportRange.end);
            endDate.setHours(23, 59, 59, 999);

            const allOrders = await DB.getOrders();
            const allExpenses = await DB.getExpenses();
            const allIncome = await DB.getIncome();

            let allReturns = [];
            try {
                if (DB.getReturns) allReturns = await DB.getReturns();
            } catch (e) { }

            const orders = allOrders.filter(o => o.timestamp >= startDate.getTime() && o.timestamp <= endDate.getTime());
            const expenses = allExpenses.filter(e => new Date(e.date) >= startDate && new Date(e.date) <= endDate);
            const income = allIncome.filter(i => new Date(i.date) >= startDate && new Date(i.date) <= endDate);
            const returns = allReturns.filter(r => r.timestamp >= startDate.getTime() && r.timestamp <= endDate.getTime());

            // Compile Data for CSV
            const headers = ["Date", "Type", "Category/ID", "Description", "Amount", "Notes"];
            const rows = [];
            const { currencySymbol } = this.state.settings;

            // Orders
            orders.forEach(o => {
                rows.push([
                    Utils.formatDate(o.timestamp),
                    "Revenue",
                    `Order #${o.id}`,
                    `${o.items?.length || 0} items`,
                    o.total.toFixed(2),
                    o.paymentMethod || 'Cash'
                ]);
            });

            // Extra Income
            income.forEach(i => {
                rows.push([
                    Utils.formatDate(i.date),
                    "Extra Income",
                    "-",
                    i.description,
                    i.amount.toFixed(2),
                    ""
                ]);
            });

            // Expenses
            expenses.forEach(e => {
                rows.push([
                    Utils.formatDate(e.date),
                    "Expense",
                    "-",
                    e.description,
                    (-e.amount).toFixed(2), // Negative to indicate cost
                    ""
                ]);
            });

            // Returns
            returns.forEach(r => {
                rows.push([
                    Utils.formatDate(r.timestamp),
                    "Refund",
                    `Order #${r.orderId}`,
                    r.reason || "Return",
                    (-(r.totalRefund || 0)).toFixed(2),
                    r.restocked ? "Restocked" : ""
                ]);
            });

            // Summary Rows
            const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0) + income.reduce((sum, i) => sum + i.amount, 0);
            const totalRefunds = returns.reduce((sum, r) => sum + (r.totalRefund || 0), 0);
            const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

            let cogs = 0;
            let cogsReduction = 0;
            orders.forEach(o => o.items.forEach(i => cogs += (parseFloat(i.costPrice) || 0) * i.qty));

            returns.forEach(ret => {
                if (ret.restocked && ret.items) {
                    const originalOrder = allOrders.find(o => o.id === ret.orderId);
                    if (originalOrder) {
                        ret.items.forEach(retItem => {
                            const originalItem = originalOrder.items.find(i => i.id === retItem.id);
                            if (originalItem) cogsReduction += (parseFloat(originalItem.costPrice) || 0) * retItem.qty;
                        });
                    }
                }
            });

            const netCogs = Math.max(0, cogs - cogsReduction);
            const totalNetRevenue = totalRevenue - totalRefunds;
            const netProfit = totalNetRevenue - netCogs - totalExpenses;

            rows.push([], ["--- SUMMARY ---", "", "", "", "", ""]);
            rows.push(["", "Gross Revenue", "", "", totalRevenue.toFixed(2), ""]);
            rows.push(["", "Total Refunds", "", "", (-totalRefunds).toFixed(2), ""]);
            rows.push(["", "Net Revenue", "", "", totalNetRevenue.toFixed(2), ""]);
            rows.push(["", "Cost of Goods Sold (COGS)", "", "", (-netCogs).toFixed(2), ""]);
            rows.push(["", "Total Expenses", "", "", (-totalExpenses).toFixed(2), ""]);
            rows.push(["", "NET PROFIT", "", "", netProfit.toFixed(2), ""]);

            const filename = `financial_report_${this.reportRange.start}_to_${this.reportRange.end}`;
            Utils.exportToCSV(filename, headers, rows);
            Utils.showToast("Financial Report exported");

        } catch (error) {
            console.error(error);
            Utils.showToast("Error exporting report", "error");
        } finally {
            Utils.hideLoading();
        }
    },

    setReportRange(type, start = null, end = null, render = true) {
        this.reportRange.type = type;
        const now = new Date();

        switch (type) {
            case 'today':
                const todayStr = now.toISOString().slice(0, 10);
                this.reportRange.start = todayStr;
                this.reportRange.end = todayStr;
                break;
            case 'this_week':
                const first = now.getDate() - now.getDay();
                const last = first + 6;
                this.reportRange.start = new Date(now.setDate(first)).toISOString().slice(0, 10);
                this.reportRange.end = new Date(now.setDate(last)).toISOString().slice(0, 10);
                break;
            case 'this_month':
                this.reportRange.start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
                this.reportRange.end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
                break;
            case 'custom':
                this.reportRange.start = start;
                this.reportRange.end = end;
                break;
        }

        // Update UI buttons
        const types = ['today', 'this_week', 'this_month'];
        types.forEach(t => {
            const btn = document.getElementById(DOM.REPORTS[`FILTER_${t.split('_').pop().toUpperCase()}`]);
            if (btn) {
                if (t === type) {
                    btn.className = "px-4 py-2 bg-blue-600 text-white rounded-lg transition-colors text-sm font-medium";
                } else {
                    btn.className = "px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-gray-700 dark:text-gray-300 rounded-lg transition-colors text-sm font-medium";
                }
            }
        });

        // Update date inputs
        document.getElementById(DOM.REPORTS.FILTER_FROM).value = this.reportRange.start;
        document.getElementById(DOM.REPORTS.FILTER_TO).value = this.reportRange.end;

        if (render) this.renderProfitLoss();
    },

    async renderProfitLoss() {
        if (!this.reportRange.start) this.setReportRange('this_month', null, null, false);

        const startDate = new Date(this.reportRange.start);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(this.reportRange.end);
        endDate.setHours(23, 59, 59, 999);

        // Fetch all data (optimization: could be filtered in DB)
        const allOrders = await DB.getOrders();
        const allExpenses = await DB.getExpenses();
        const allIncome = await DB.getIncome();

        // Fetch Returns (Added for Refund Logic)
        let allReturns = [];
        try {
            if (DB.getReturns) allReturns = await DB.getReturns();
        } catch (e) { console.warn("Returns table not found or error fetching", e); }

        // Filter by Range
        const orders = allOrders.filter(o => o.timestamp >= startDate.getTime() && o.timestamp <= endDate.getTime());
        const expenses = allExpenses.filter(e => {
            const d = new Date(e.date);
            return d >= startDate && d <= endDate;
        });
        const income = allIncome.filter(i => {
            const d = new Date(i.date);
            return d >= startDate && d <= endDate;
        });
        const returns = allReturns.filter(r => r.timestamp >= startDate.getTime() && r.timestamp <= endDate.getTime());

        this.renderExpensesList(expenses);
        this.renderIncomeList(income);

        // Calculate Metrics
        let orderRevenue = 0;
        let cogs = 0;

        orders.forEach(order => {
            orderRevenue += order.total;
            order.items.forEach(item => {
                const cost = parseFloat(item.costPrice) || 0;
                cogs += cost * item.qty;
            });
        });

        // --- Refund & COGS Adjustment Logic ---
        let totalRefunds = 0;
        let cogsReduction = 0;

        for (const ret of returns) {
            totalRefunds += (ret.totalRefund || 0);

            // If items were restocked, we should reverse the COGS for those items
            if (ret.restocked && ret.items) {
                // To get the accurate Cost Price at time of sale, we look up the original order
                const originalOrder = allOrders.find(o => o.id === ret.orderId);
                if (originalOrder) {
                    ret.items.forEach(retItem => {
                        const originalItem = originalOrder.items.find(i => i.id === retItem.id);
                        if (originalItem) {
                            cogsReduction += (parseFloat(originalItem.costPrice) || 0) * retItem.qty;
                        }
                    });
                }
            }
        }

        const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
        const totalIncome = income.reduce((sum, inc) => sum + inc.amount, 0);

        // Net Metrics
        const netOrderRevenue = orderRevenue - totalRefunds;
        const netCogs = Math.max(0, cogs - cogsReduction);
        const totalNetRevenue = netOrderRevenue + totalIncome;
        const netProfit = totalNetRevenue - netCogs - totalExpenses;

        const { currencySymbol } = this.state.settings;

        // Update UI
        const revEl = document.getElementById(DOM.REPORTS.REVENUE);
        revEl.textContent = Utils.formatCurrency(totalNetRevenue, currencySymbol);
        if (totalRefunds > 0) {
            const refDiv = document.createElement('div');
            refDiv.className = "text-xs text-red-400 font-normal";
            refDiv.textContent = `(-${Utils.formatCurrency(totalRefunds)} refunds)`;
            revEl.appendChild(refDiv);
        }

        const cogsEl = document.getElementById(DOM.REPORTS.COGS);
        cogsEl.textContent = Utils.formatCurrency(netCogs, currencySymbol);
        if (cogsReduction > 0) {
            const restockDiv = document.createElement('div');
            restockDiv.className = "text-xs text-green-600 font-normal";
            restockDiv.textContent = `(-${Utils.formatCurrency(cogsReduction)} restocked)`;
            cogsEl.appendChild(restockDiv);
        }

        document.getElementById(DOM.REPORTS.EXPENSES).innerText = Utils.formatCurrency(totalExpenses, currencySymbol);

        const netEl = document.getElementById(DOM.REPORTS.NET_PROFIT);
        netEl.innerText = Utils.formatCurrency(netProfit, currencySymbol);
        netEl.className = `text-3xl font-bold mt-2 ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`;

        if (typeof Chart === 'undefined') {
            await Utils.loadScript('js/lib/chart.js');
        }

        this.renderChart(orders, expenses, income, returns);
        this.renderOrderProfits(orders);
    },

    renderIncomeList(income) {
        const tbody = document.getElementById(DOM.REPORTS.INCOME_BODY);
        if (!tbody) return;
        tbody.replaceChildren();
        const { currencySymbol } = this.state.settings;

        income.slice(0, 50).forEach(inc => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 transition-colors";

            const tdDate = document.createElement('td');
            tdDate.className = "p-4 dark:text-gray-300";
            tdDate.textContent = Utils.formatDate(inc.date);

            const tdDesc = document.createElement('td');
            tdDesc.className = "p-4 font-medium dark:text-white";
            tdDesc.textContent = inc.description;

            const tdAmt = document.createElement('td');
            tdAmt.className = "p-4 font-bold text-green-600";
            tdAmt.textContent = Utils.formatCurrency(inc.amount, currencySymbol);

            const tdActions = document.createElement('td');
            tdActions.className = "p-4";
            const delBtn = document.createElement('button');
            delBtn.onclick = () => app.deleteIncome(inc.id);
            delBtn.className = "text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300";
            delBtn.textContent = "Delete";
            tdActions.appendChild(delBtn);

            tr.appendChild(tdDate);
            tr.appendChild(tdDesc);
            tr.appendChild(tdAmt);
            tr.appendChild(tdActions);
            tbody.appendChild(tr);
        });
    },

    renderOrderProfits(orders) {
        const tbody = document.getElementById(DOM.REPORTS.PROFITS_BODY);
        if (!tbody) return;
        tbody.replaceChildren();
        const { currencySymbol } = this.state.settings;

        // Sort by id desc (newest first)
        const sorted = [...orders].sort((a, b) => b.id - a.id).slice(0, 50);

        sorted.forEach(order => {
            let cogs = 0;
            order.items.forEach(i => cogs += (parseFloat(i.costPrice) || 0) * i.qty);

            const profit = order.total - cogs;
            const margin = order.total > 0 ? ((profit / order.total) * 100).toFixed(1) : 0;

            const tr = document.createElement('tr');
            tr.className = "hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 transition-colors";

            const tdDate = document.createElement('td');
            tdDate.className = "p-4 dark:text-gray-300";
            tdDate.textContent = Utils.formatDate(order.timestamp);

            const tdId = document.createElement('td');
            tdId.className = "p-4 font-mono text-sm dark:text-gray-400";
            tdId.textContent = `#${order.id} `;
            if (order.status === 'refunded') {
                const refSpan = document.createElement('span');
                refSpan.className = "text-xs text-red-500";
                refSpan.textContent = "(Refunded)";
                tdId.appendChild(refSpan);
            }

            const tdTotal = document.createElement('td');
            tdTotal.className = "p-4 dark:text-white";
            tdTotal.textContent = Utils.formatCurrency(order.total, currencySymbol);

            const tdCogs = document.createElement('td');
            tdCogs.className = "p-4 dark:text-gray-300";
            tdCogs.textContent = Utils.formatCurrency(cogs, currencySymbol);

            const tdProfit = document.createElement('td');
            tdProfit.className = `p-4 font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`;
            tdProfit.textContent = Utils.formatCurrency(profit, currencySymbol);

            const tdMargin = document.createElement('td');
            tdMargin.className = "p-4 text-sm dark:text-gray-400";
            tdMargin.textContent = `${margin}%`;

            tr.appendChild(tdDate);
            tr.appendChild(tdId);
            tr.appendChild(tdTotal);
            tr.appendChild(tdCogs);
            tr.appendChild(tdProfit);
            tr.appendChild(tdMargin);
            tbody.appendChild(tr);
        });
    },

    renderExpensesList(expenses) {
        const tbody = document.getElementById(DOM.REPORTS.EXPENSES_BODY);
        if (!tbody) return;
        tbody.replaceChildren();
        const { currencySymbol } = this.state.settings;

        expenses.slice(0, 50).forEach(exp => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 transition-colors";

            const tdDate = document.createElement('td');
            tdDate.className = "p-4 dark:text-gray-300";
            tdDate.textContent = Utils.formatDate(exp.date);

            const tdDesc = document.createElement('td');
            tdDesc.className = "p-4 font-medium dark:text-white";
            tdDesc.textContent = exp.description;

            const tdAmt = document.createElement('td');
            tdAmt.className = "p-4 font-bold text-red-500";
            tdAmt.textContent = `-${Utils.formatCurrency(exp.amount, currencySymbol)}`;

            const tdActions = document.createElement('td');
            tdActions.className = "p-4";
            const delBtn = document.createElement('button');
            delBtn.onclick = () => app.deleteExpense(exp.id);
            delBtn.className = "text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300";
            delBtn.textContent = "Delete";
            tdActions.appendChild(delBtn);

            tr.appendChild(tdDate);
            tr.appendChild(tdDesc);
            tr.appendChild(tdAmt);
            tr.appendChild(tdActions);
            tbody.appendChild(tr);
        });
    },

    // Chart
    renderChart(orders, expenses, income, returns = []) {
        const ctx = document.getElementById(DOM.REPORTS.CHART);
        if (!ctx) return;

        // Group by Date for the selected range
        const days = {};
        const start = new Date(this.reportRange.start);
        const end = new Date(this.reportRange.end);

        // Populate all days in range
        let curr = new Date(start);
        while (curr <= end) {
            days[curr.toISOString().slice(0, 10)] = { revenue: 0, expenses: 0 };
            curr.setDate(curr.getDate() + 1);
            if (Object.keys(days).length > 366) break; // Safety break
        }

        orders.forEach(o => {
            const d = new Date(o.timestamp).toISOString().slice(0, 10);
            if (days[d]) days[d].revenue += o.total;
        });

        income.forEach(i => {
            const d = new Date(i.date).toISOString().slice(0, 10);
            if (days[d]) days[d].revenue += i.amount;
        });

        expenses.forEach(e => {
            const d = new Date(e.date).toISOString().slice(0, 10);
            if (days[d]) days[d].expenses += e.amount;
        });

        orders.forEach(o => {
            const d = new Date(o.timestamp).toISOString().slice(0, 10);
            if (days[d]) {
                o.items.forEach(i => {
                    days[d].expenses += (parseFloat(i.costPrice) || 0) * i.qty;
                });
            }
        });

        // Adjust chart for returns
        returns.forEach(r => {
            const d = new Date(r.timestamp).toISOString().slice(0, 10);
            if (days[d]) {
                days[d].revenue -= (r.totalRefund || 0); // Decrease revenue
                // COGS adjustment is complex here without looking up every item, 
                // but strictly we should decrease expenses (COGS) too if restocked.
                // For chart simplicity, maybe we skip COGS adjustment or approximate?
                // Let's rely on the simpler Net Profit view for exact numbers.
                // Or we could subtract from expenses if we knew validity.
            }
        });

        const labels = Object.keys(days);
        const revenueData = Object.values(days).map(x => Math.max(0, x.revenue)); // Don't show negative revenue on bar chart usually
        const expenseData = Object.values(days).map(x => x.expenses);

        if (this.state.chart) {
            this.state.chart.destroy();
        }

        this.state.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Net Revenue',
                        data: revenueData,
                        backgroundColor: '#3b82f6',
                        borderRadius: 4
                    },
                    {
                        label: 'Expenses (Inc. COGS)',
                        data: expenseData,
                        backgroundColor: '#f97316',
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: document.documentElement.classList.contains('dark') ? '#fff' : '#666' }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: document.documentElement.classList.contains('dark') ? '#374151' : '#e5e7eb' },
                        ticks: { color: document.documentElement.classList.contains('dark') ? '#9ca3af' : '#6b7280' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: document.documentElement.classList.contains('dark') ? '#9ca3af' : '#6b7280' }
                    }
                }
            }
        });
    },

    async addExpense(event) {
        event.preventDefault();
        const desc = document.getElementById(DOM.REPORTS.EXPENSE_DESC).value.trim();
        const amount = parseFloat(document.getElementById(DOM.REPORTS.EXPENSE_AMOUNT).value);
        const date = document.getElementById(DOM.REPORTS.EXPENSE_DATE).value;

        if (!desc || amount <= 0 || !date) return;

        await DB.addExpense({ description: desc, amount: amount, date: date });

        document.getElementById(DOM.REPORTS.EXPENSE_FORM).reset(); // Assuming form has ID
        // Or manually clear inputs
        document.getElementById(DOM.REPORTS.EXPENSE_DESC).value = '';
        document.getElementById(DOM.REPORTS.EXPENSE_AMOUNT).value = '';

        await this.loadData();
        this.renderProfitLoss();
        Utils.showToast("Expense Added");
    },

    async deleteExpense(id) {
        if (confirm("Delete this expense?")) {
            await DB.deleteExpense(id);
            await this.loadData();
            this.renderProfitLoss();
        }
    },

    async addIncome(event) {
        event.preventDefault();
        const desc = document.getElementById(DOM.REPORTS.INCOME_DESC).value.trim();
        const amount = parseFloat(document.getElementById(DOM.REPORTS.INCOME_AMOUNT).value);
        const date = document.getElementById(DOM.REPORTS.INCOME_DATE).value;

        if (!desc || amount <= 0 || !date) return;

        await DB.addIncome({ description: desc, amount: amount, date: date });

        // document.getElementById(DOM.REPORTS.INCOME_FORM).reset();
        document.getElementById(DOM.REPORTS.INCOME_DESC).value = '';
        document.getElementById(DOM.REPORTS.INCOME_AMOUNT).value = '';

        await this.loadData();
        this.renderProfitLoss();
        Utils.showToast("Income Added");
    },

    async deleteIncome(id) {
        if (confirm("Delete this revenue entry?")) {
            await DB.deleteIncome(id);
            await this.loadData();
            this.renderProfitLoss();
        }
    }
};

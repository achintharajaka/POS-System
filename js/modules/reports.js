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

        // Set initial range if not set
        if (!this.reportRange.start) {
            this.setReportRange('this_month', null, null, false);
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

        const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
        const totalIncome = income.reduce((sum, inc) => sum + inc.amount, 0);

        const totalRevenue = orderRevenue + totalIncome;
        const netProfit = totalRevenue - cogs - totalExpenses;

        const { currencySymbol } = this.state.settings;

        document.getElementById(DOM.REPORTS.REVENUE).innerText = Utils.formatCurrency(totalRevenue, currencySymbol);
        document.getElementById(DOM.REPORTS.COGS).innerText = Utils.formatCurrency(cogs, currencySymbol);
        document.getElementById(DOM.REPORTS.EXPENSES).innerText = Utils.formatCurrency(totalExpenses, currencySymbol);

        const netEl = document.getElementById(DOM.REPORTS.NET_PROFIT);
        netEl.innerText = Utils.formatCurrency(netProfit, currencySymbol);
        netEl.className = `text-3xl font-bold mt-2 ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`;

        if (typeof Chart === 'undefined') {
            await Utils.loadScript('js/lib/chart.js');
        }

        this.renderChart(orders, expenses, income);
        this.renderOrderProfits(orders);
    },

    renderIncomeList(income) {
        const tbody = document.getElementById(DOM.REPORTS.INCOME_BODY);
        if (!tbody) return;
        tbody.innerHTML = '';
        const { currencySymbol } = this.state.settings;

        income.slice(0, 50).forEach(inc => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 transition-colors";
            tr.innerHTML = `
                <td class="p-4 dark:text-gray-300">${Utils.formatDate(inc.date)}</td>
                <td class="p-4 font-medium dark:text-white">${Utils.sanitize(inc.description)}</td>
                <td class="p-4 font-bold text-green-600">${Utils.formatCurrency(inc.amount, currencySymbol)}</td>
                <td class="p-4">
                    <button onclick="app.deleteIncome(${inc.id})" class="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    renderOrderProfits(orders) {
        const tbody = document.getElementById(DOM.REPORTS.PROFITS_BODY);
        if (!tbody) return;
        tbody.innerHTML = '';
        const { currencySymbol } = this.state.settings;

        // Sort by id desc (newest first)
        const sorted = [...orders].sort((a, b) => b.id - a.id).slice(0, 50);

        sorted.forEach(order => {
            let cogs = 0;
            order.items.forEach(i => cogs += (parseFloat(i.costPrice) || 0) * i.qty);

            // Gross Profit = Revenue - COGS
            // Revenue here is order.total (including tax/mods) or subtotal? 
            // Usually Gross Profit is Sales - COGS. 
            // Let's use Total for now as it represents money in.
            const profit = order.total - cogs;
            const margin = order.total > 0 ? ((profit / order.total) * 100).toFixed(1) : 0;

            const tr = document.createElement('tr');
            tr.className = "hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 transition-colors";
            tr.innerHTML = `
                <td class="p-4 dark:text-gray-300">${Utils.formatDate(order.timestamp)}</td>
                <td class="p-4 font-mono text-sm dark:text-gray-400">#${order.id}</td>
                 <td class="p-4 dark:text-white">${Utils.formatCurrency(order.total, currencySymbol)}</td>
                <td class="p-4 dark:text-gray-300">${Utils.formatCurrency(cogs, currencySymbol)}</td>
                <td class="p-4 font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}">${Utils.formatCurrency(profit, currencySymbol)}</td>
                <td class="p-4 text-sm dark:text-gray-400">${margin}%</td>
            `;
            tbody.appendChild(tr);
        });
    },

    renderExpensesList(expenses) {
        const tbody = document.getElementById(DOM.REPORTS.EXPENSES_BODY);
        if (!tbody) return;
        tbody.innerHTML = '';
        const { currencySymbol } = this.state.settings;

        expenses.slice(0, 50).forEach(exp => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 transition-colors";
            tr.innerHTML = `
                <td class="p-4 dark:text-gray-300">${Utils.formatDate(exp.date)}</td>
                <td class="p-4 font-medium dark:text-white">${Utils.sanitize(exp.description)}</td>
                <td class="p-4 font-bold text-red-500">-${Utils.formatCurrency(exp.amount, currencySymbol)}</td>
                <td class="p-4">
                    <button onclick="app.deleteExpense(${exp.id})" class="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    // Chart
    renderChart(orders, expenses, income) {
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

        const labels = Object.keys(days);
        const revenueData = Object.values(days).map(x => x.revenue);
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
                        label: 'Revenue',
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

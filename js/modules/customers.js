// Customers Module (CRM)
// Depends on: db.js, utils.js

window.Customers = {
    async renderCustomers() {
        const tbody = document.getElementById('customers-table-body');
        const searchInput = document.getElementById('customers-search-input');

        if (!tbody) return;
        tbody.innerHTML = '';
        Utils.showLoading();

        try {
            const page = this.state.customersPage || 1;
            const perPage = 10;
            const query = (searchInput ? searchInput.value : '').toLowerCase();

            const result = await DB.getCustomers(page, perPage, query);
            const customers = result.data;
            const totalItems = result.total;

            if (customers.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5" class="p-8 text-center text-gray-500 dark:text-gray-400">
                            <div class="flex flex-col items-center justify-center">
                                <svg class="w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                                </svg>
                                <p>No customers found.</p>
                            </div>
                        </td>
                    </tr>`;
                this.updateCustomerPagination(0, 0, 1);
                return;
            }

            const totalPages = Math.ceil(totalItems / perPage);

            customers.forEach(customer => {
                const tr = document.createElement('tr');
                tr.className = "hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 transition-colors";

                tr.innerHTML = `
                    <td class="p-4 font-medium dark:text-white">${Utils.sanitize(customer.name)}</td>
                    <td class="p-4 text-gray-500 dark:text-gray-400">${Utils.sanitize(customer.phone || '-')}</td>
                    <td class="p-4 text-gray-500 dark:text-gray-400">${Utils.sanitize(customer.email || '-')}</td>
                    <td class="p-4">
                        <span class="px-2 py-1 rounded-full text-xs font-semibold
                            ${customer.points > 100 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
                            ${customer.points || 0} pts
                        </span>
                         <span class="ml-2 px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                            ${customer.tier || 'Standard'}
                        </span>
                    </td>
                    <td class="p-4 flex gap-2">
                        <button onclick="Customers.openCustomerModal(${customer.id})" class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">Edit</button>
                        <button onclick="Customers.deleteCustomer(${customer.id})" class="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300">Delete</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });

            this.updateCustomerPagination(totalItems, totalPages, page);

        } catch (e) {
            console.error(e);
            Utils.showToast("Error loading customers", "error");
        } finally {
            Utils.hideLoading();
        }
    },

    updateCustomerPagination(totalItems, totalPages, currentPage) {
        const pageInfo = document.getElementById('customers-page-info');
        const prevBtn = document.getElementById('customers-prev-btn');
        const nextBtn = document.getElementById('customers-next-btn');

        if (pageInfo) pageInfo.textContent = totalItems === 0 ? "No items" : `Page ${currentPage} of ${totalPages} (${totalItems} items)`;

        if (prevBtn) {
            prevBtn.disabled = currentPage <= 1;
            prevBtn.onclick = () => {
                this.state.customersPage = currentPage - 1;
                this.renderCustomers();
            };
        }

        if (nextBtn) {
            nextBtn.disabled = currentPage >= totalPages;
            nextBtn.onclick = () => {
                this.state.customersPage = currentPage + 1;
                this.renderCustomers();
            };
        }
    },

    async openCustomerModal(customerId = null) {
        const modal = document.getElementById('customer-modal');
        const form = document.getElementById('customer-form');
        const title = document.getElementById('customer-modal-title');

        Utils.clearFormErrors(form);
        form.reset();

        if (customerId) {
            title.innerText = "Edit Customer";
            try {
                const customer = await DB.getCustomer(customerId);
                document.getElementById('customer-id').value = customer.id;
                document.getElementById('customer-name').value = customer.name;
                document.getElementById('customer-phone').value = customer.phone || '';
                document.getElementById('customer-email').value = customer.email || '';
                document.getElementById('customer-points').value = customer.points || 0;
            } catch (e) {
                console.error(e);
                Utils.showToast("Error fetching customer", "error");
                return;
            }
        } else {
            title.innerText = "Add Customer";
            document.getElementById('customer-id').value = '';
            document.getElementById('customer-points').value = 0;
        }

        modal.classList.remove('hidden');
    },

    closeCustomerModal() {
        document.getElementById('customer-modal').classList.add('hidden');
    },

    async saveCustomer(event) {
        event.preventDefault();
        const form = event.target;
        Utils.clearFormErrors(form);

        const idInput = document.getElementById('customer-id');
        const nameInput = document.getElementById('customer-name');
        const phoneInput = document.getElementById('customer-phone');
        const emailInput = document.getElementById('customer-email');

        const id = idInput.value;
        const name = nameInput.value.trim();
        const phone = phoneInput.value.trim();
        const email = emailInput.value.trim();
        const points = parseInt(document.getElementById('customer-points').value) || 0;

        if (!name) {
            Utils.showFormError(nameInput, "Name is required");
            return;
        }

        try {
            if (id) {
                // Update
                const existing = await DB.getCustomer(parseInt(id));
                await DB.updateCustomer(parseInt(id), {
                    name, phone, email, points
                });
                Utils.showToast("Customer updated");
            } else {
                // Create
                const newId = await DB.addCustomer({
                    name,
                    phone,
                    phone,
                    email,
                    points,
                    tier: 'Standard',
                    totalSpent: 0
                });
                Utils.showToast("Customer added");

                // Check if called from POS (POS Customer Modal is open)
                const posModal = document.getElementById('pos-customer-modal');
                if (posModal && !posModal.classList.contains('hidden') && window.POS) {
                    const newCustomer = await DB.getCustomer(newId);
                    if (newCustomer) {
                        window.POS.selectCustomer(newCustomer);
                        posModal.classList.add('hidden');
                        Utils.showToast("Customer selected for Order");
                    }
                }
            }
            this.closeCustomerModal();
            this.renderCustomers();
        } catch (e) {
            console.error(e);
            Utils.showToast("Error saving customer", "error");
        }
    },

    async deleteCustomer(id) {
        if (await Utils.confirm("Delete Customer", "Are you sure? This cannot be undone.")) {
            try {
                await DB.deleteCustomer(id);
                this.renderCustomers();
                Utils.showToast("Customer deleted");
            } catch (e) {
                console.error(e);
                Utils.showToast("Error deleting customer", "error");
            }
        }
    }
};

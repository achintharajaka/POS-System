// Suppliers Module
// Depends on: db.js, utils.js

window.Suppliers = {
    async renderSuppliers() {
        const tbody = document.getElementById(DOM.SUPPLIERS.TABLE_BODY);
        if (!tbody) return;

        tbody.innerHTML = '';
        Utils.showLoading();

        try {
            const suppliers = await DB.getSuppliers();

            if (suppliers.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5" class="p-8 text-center text-gray-500 dark:text-gray-400">
                            <div class="flex flex-col items-center justify-center">
                                <svg class="w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                                </svg>
                                <p>No suppliers found.</p>
                            </div>
                        </td>
                    </tr>`;
                return;
            }

            suppliers.forEach(supplier => {
                const tr = document.createElement('tr');
                tr.className = "hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 transition-colors";
                tr.innerHTML = `
                    <td class="p-4 font-medium dark:text-white">${Utils.sanitize(supplier.name)}</td>
                    <td class="p-4 text-gray-600 dark:text-gray-300">${Utils.sanitize(supplier.contact || '-')}</td>
                    <td class="p-4 text-gray-600 dark:text-gray-300">${Utils.sanitize(supplier.phone || '-')}</td>
                     <td class="p-4 text-gray-600 dark:text-gray-300">${Utils.sanitize(supplier.email || '-')}</td>
                    <td class="p-4 flex gap-2">
                        <button onclick="Suppliers.openSupplierModal(${supplier.id})" class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">Edit</button>
                        <button onclick="Suppliers.deleteSupplier(${supplier.id})" class="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300">Delete</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });

        } catch (error) {
            console.error(error);
            Utils.showToast("Error loading suppliers", "error");
        } finally {
            Utils.hideLoading();
        }
    },

    openSupplierModal(id = null) {
        const modal = document.getElementById(DOM.MODALS.SUPPLIER.ID);
        const form = document.getElementById(DOM.MODALS.SUPPLIER.FORM);
        const title = document.getElementById(DOM.MODALS.SUPPLIER.TITLE);

        form.reset();
        document.getElementById(DOM.MODALS.SUPPLIER.INPUT_ID).value = '';

        if (id) {
            title.innerText = "Edit Supplier";
            DB.getSuppliers().then(suppliers => {
                const supplier = suppliers.find(s => s.id === id);
                if (supplier) {
                    document.getElementById(DOM.MODALS.SUPPLIER.INPUT_ID).value = supplier.id;
                    document.getElementById(DOM.MODALS.SUPPLIER.INPUT_NAME).value = supplier.name;
                    document.getElementById(DOM.MODALS.SUPPLIER.INPUT_CONTACT).value = supplier.contact || '';
                    document.getElementById(DOM.MODALS.SUPPLIER.INPUT_PHONE).value = supplier.phone || '';
                    document.getElementById(DOM.MODALS.SUPPLIER.INPUT_EMAIL).value = supplier.email || '';
                    document.getElementById(DOM.MODALS.SUPPLIER.INPUT_ADDRESS).value = supplier.address || '';
                }
            });
        } else {
            title.innerText = "Add Supplier";
        }

        modal.classList.remove('hidden');
    },

    closeSupplierModal() {
        document.getElementById(DOM.MODALS.SUPPLIER.ID).classList.add('hidden');
    },

    async saveSupplier(event) {
        event.preventDefault();
        const form = event.target;

        const idInput = document.getElementById(DOM.MODALS.SUPPLIER.INPUT_ID);
        const nameInput = document.getElementById(DOM.MODALS.SUPPLIER.INPUT_NAME);
        const contactInput = document.getElementById(DOM.MODALS.SUPPLIER.INPUT_CONTACT);
        const phoneInput = document.getElementById(DOM.MODALS.SUPPLIER.INPUT_PHONE);
        const emailInput = document.getElementById(DOM.MODALS.SUPPLIER.INPUT_EMAIL);
        const addressInput = document.getElementById(DOM.MODALS.SUPPLIER.INPUT_ADDRESS);

        const id = idInput.value;
        const name = nameInput.value.trim();

        if (!name) {
            Utils.showToast("Supplier name is required", "error");
            return;
        }

        const supplier = {
            name,
            contact: contactInput.value.trim(),
            phone: phoneInput.value.trim(),
            email: emailInput.value.trim(),
            address: addressInput.value.trim()
        };

        try {
            if (id) {
                await DB.updateSupplier(parseInt(id), supplier);
                Utils.showToast("Supplier updated");
            } else {
                await DB.addSupplier(supplier);
                Utils.showToast("Supplier added");
            }
            this.closeSupplierModal();
            this.renderSuppliers();
        } catch (error) {
            console.error(error);
            Utils.showToast("Error saving supplier", "error");
        }
    },

    async deleteSupplier(id) {
        if (await Utils.confirm("Delete Supplier", "Are you sure? This will not remove products linked to this supplier.")) {
            try {
                await DB.deleteSupplier(id);
                this.renderSuppliers();
                Utils.showToast("Supplier deleted");
            } catch (error) {
                console.error(error);
                Utils.showToast("Error deleting supplier", "error");
            }
        }
    }
};

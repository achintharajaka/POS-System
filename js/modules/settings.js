// Settings Module
// Depends on: db.js, utils.js, constants.js

window.Settings = {
    async saveSettings(event) {
        event.preventDefault();
        const formData = new FormData(event.target);
        const updates = {};

        // Handle checkboxes explicitly as FormData might miss them if unchecked, but for settings we usually want boolean
        const checkboxes = ['receiptShowLogo', 'receiptShowAddress', 'receiptShowDate', 'receiptShowQrCode'];

        checkboxes.forEach(key => {
            updates[key] = !!formData.get(key);
        });

        // Other fields
        // We iterate specifically to catch known keys or just iterate input IDs?
        // Easier: Just grab known text/number/textarea fields
        const textFields = ['storeName', 'storeAddress', 'currencySymbol', 'receiptHeader', 'receiptFooter', 'receiptQrCodeUrl', 'storeLogo', 'pointsEarningRate', 'pointsRedemptionRate'];
        textFields.forEach(key => {
            updates[key] = formData.get(key);
        });

        // Update DB
        for (const [key, value] of Object.entries(updates)) {
            await DB.updateSetting(key, value);
        }

        // Handle Language
        const newLang = formData.get('setting-language') || document.getElementById('setting-language').value;
        if (newLang && window.I18n) {
            window.I18n.setLanguage(newLang);
        }

        Utils.showToast("Settings Saved");
        await this.loadData();
        this.updateStoreDetails();
    },

    handleLogoUpload(event) {
        const file = event.target.files[0];
        if (file) {
            if (file.size > 1024 * 1024) { // 1MB
                Utils.showToast("Image too large (Max 1MB)", "error");
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                document.getElementById(DOM.SETTINGS.STORE_LOGO_HIDDEN).value = e.target.result;
                Utils.showToast("Logo Selected. Click Save.");
            };
            reader.readAsDataURL(file);
        }
    },

    removeLogo() {
        document.getElementById(DOM.SETTINGS.STORE_LOGO_HIDDEN).value = '';
        Utils.showToast("Logo Removed. Click Save.");
    },

    async previewReceipt() {
        // Create a fake order for preview
        const dummyOrder = {
            id: 1234,
            timestamp: Date.now(),
            items: [
                { name: "Demo Product A", price: 10.00, qty: 2 },
                { name: "Demo Product B", price: 5.50, qty: 1 }
            ],
            subtotal: 25.50,
            total: 28.05,
            paymentMethod: 'cash',
            modifiers: [{ name: "Tax", amount: 2.55, rate: "add", type: "percent" }]
        };

        const currentFormSettings = { ...this.state.settings };
        // Override with form values
        currentFormSettings.storeName = document.getElementById(DOM.SETTINGS.STORE_NAME).value;
        currentFormSettings.storeAddress = document.getElementById(DOM.SETTINGS.STORE_ADDRESS).value;
        currentFormSettings.receiptHeader = document.getElementById(DOM.SETTINGS.RECEIPT_HEADER).value;
        currentFormSettings.receiptFooter = document.getElementById(DOM.SETTINGS.RECEIPT_FOOTER).value;
        currentFormSettings.receiptQrCodeUrl = document.getElementById(DOM.SETTINGS.RECEIPT_QR_URL).value;
        currentFormSettings.receiptShowLogo = document.getElementById(DOM.SETTINGS.RECEIPT_SHOW_LOGO).checked;
        currentFormSettings.receiptShowAddress = document.getElementById(DOM.SETTINGS.RECEIPT_SHOW_ADDRESS).checked;
        currentFormSettings.receiptShowDate = document.getElementById(DOM.SETTINGS.RECEIPT_SHOW_DATE).checked;
        currentFormSettings.receiptShowQrCode = document.getElementById(DOM.SETTINGS.RECEIPT_SHOW_QR).checked;
        currentFormSettings.storeLogo = document.getElementById(DOM.SETTINGS.STORE_LOGO_HIDDEN).value;

        // Pre-generate QR code data URI for offline support
        if (currentFormSettings.receiptShowQrCode && currentFormSettings.receiptQrCodeUrl) {
            try {
                currentFormSettings.receiptQrCodeDataUri = await Utils.generateQRCode(currentFormSettings.receiptQrCodeUrl);
            } catch (e) {
                console.error("Failed to generate QR Code for preview", e);
            }
        }

        const win = window.open('', '', 'width=340,height=600');
        win.document.write(Utils.generateReceipt(
            currentFormSettings.storeName,
            currentFormSettings.storeAddress,
            dummyOrder,
            currentFormSettings,
            currentFormSettings.storeLogo
        ));
        win.document.close();
    },

    // Category Management
    async addCategory() {
        const input = document.getElementById(DOM.SETTINGS.NEW_CAT_NAME);
        const name = input.value.trim();
        if (!name) return;

        await DB.addCategory(name);
        input.value = '';
        await this.loadData();
        Utils.showToast("Category Added");
    },

    async deleteCategory(id) {
        if (confirm("Delete this category?")) {
            await DB.deleteCategory(id);
            await this.loadData();
            Utils.showToast("Category Deleted");
        }
    },

    renderCategoryList() {
        const list = document.getElementById(DOM.SETTINGS.CATEGORY_LIST);
        if (!list) return;

        list.innerHTML = '';
        this.state.categories.forEach(cat => {
            const li = document.createElement('li');
            li.className = "flex justify-between items-center bg-gray-50 dark:bg-gray-700 p-2 rounded";
            li.innerHTML = `
                <span class="dark:text-white">${Utils.sanitize(cat.name)}</span>
                <button onclick="app.deleteCategory(${cat.id})" class="text-red-500 hover:text-red-700">&times;</button>
            `;
            list.appendChild(li);
        });


        this.populateCategoryFilter();
    },

    // Modifiers Management
    renderModifiersList() {
        const tbody = document.getElementById(DOM.SETTINGS.MODIFIERS_LIST);
        if (!tbody) return;
        tbody.innerHTML = '';
        const { currencySymbol } = this.state.settings;

        this.state.modifiers.forEach(mod => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${Utils.sanitize(mod.name)}</td>
                <td class="capitalize">${mod.type}</td>
                <td>${mod.type === 'percent' ? mod.value + '%' : Utils.formatCurrency(mod.value, currencySymbol)} (${mod.rate})</td>
                <td class="text-right">
                    <button onclick="app.deleteModifier(${mod.id})" class="text-red-500 hover:text-red-700">&times;</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    async addModifier() {
        const name = document.getElementById(DOM.SETTINGS.NEW_MOD_NAME).value.trim();
        const type = document.getElementById(DOM.SETTINGS.NEW_MOD_TYPE).value;
        const rate = document.getElementById(DOM.SETTINGS.NEW_MOD_ACTION).value;
        const value = parseFloat(document.getElementById(DOM.SETTINGS.NEW_MOD_VALUE).value);

        if (!name || isNaN(value)) {
            Utils.showToast("Invalid Input", "error");
            return;
        }

        // Get max ID to increment
        const maxId = parseInt(this.state.settings.maxModifierId || 0);
        const newId = maxId + 1;

        const newMod = { id: newId, name, type, rate, value };
        const updatedModifiers = [...this.state.modifiers, newMod];

        await DB.updateSetting("orderModifiers", updatedModifiers);
        await DB.updateSetting("maxModifierId", newId);

        // Clear Inputs
        document.getElementById(DOM.SETTINGS.NEW_MOD_NAME).value = '';
        document.getElementById(DOM.SETTINGS.NEW_MOD_VALUE).value = '';

        await this.loadData();
        Utils.showToast("Modifier Added");
    },

    async deleteModifier(id) {
        if (confirm("Remove this adjustment?")) {
            const updatedModifiers = this.state.modifiers.filter(m => m.id !== id);
            await DB.updateSetting("orderModifiers", updatedModifiers);
            await this.loadData();
            Utils.showToast("Modifier Removed");
        }
    },


    // Data Import/Export
    async exportData() {
        const data = await DB.exportData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pos_backup_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        Utils.showToast("Data Exported");
    },

    async importData(input) {
        const file = input.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                await DB.importData(data);
                await this.loadData();
                this.updateStoreDetails();
                Utils.showToast("Data Imported Successfully");
                setTimeout(() => location.reload(), 1500);
            } catch (err) {
                console.error(err);
                Utils.showToast("Invalid Data File", "error");
            }
        };
        reader.readAsText(file);
    },

    async resetSystem() {
        if (confirm("DANGER: This will delete ALL data (Products, Orders, Settings) and reset the system to factory defaults.\n\nAre you sure you want to continue?")) {
            if (confirm("Last Warning: This action cannot be undone.")) {
                await DB.reset();
            }
        }
    }
};

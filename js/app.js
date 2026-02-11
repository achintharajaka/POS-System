// Main App Controller
// Depends on: db.js, utils.js, constants.js, and all modules loaded globally

const App = {
    state: {
        cart: [],
        products: [],
        categories: [],
        settings: {},
        expenses: [],
        income: [],
        currentView: 'dashboard',
        currentOrder: null,
        modifiers: [],
        chart: null,
        paymentMethod: 'cash'
    },

    async init() {
        console.log("Initializing App v3 (Modular)...");

        // Mixin all modules eagerly (loaded via script tags in index.html)
        if (window.Dashboard) Object.assign(App, window.Dashboard);
        if (window.POS) Object.assign(App, window.POS);
        if (window.Inventory) Object.assign(App, window.Inventory);
        if (window.Reports) Object.assign(App, window.Reports);
        if (window.Settings) Object.assign(App, window.Settings);

        try {
            // Load settings
            this.state.settings = await DB.getSettings();

            // Ensure Modifiers exist (Migration check)
            if (!this.state.settings.orderModifiers) {
                const oldTax = this.state.settings.taxRate || 0;
                this.state.settings.orderModifiers = [{ id: 1, name: "Tax", type: "percent", rate: "add", value: parseFloat(oldTax) }];
                await DB.updateSetting("orderModifiers", this.state.settings.orderModifiers);
                await DB.updateSetting("maxModifierId", 1);
            }
            this.state.modifiers = this.state.settings.orderModifiers;

            this.applyTheme();
            this.updateStoreDetails();

            // Load data
            await this.loadData();

            // Init Router/View
            this.navigate('dashboard');

            // Setup Listeners
            this.setupEventListeners();

        } catch (error) {
            console.error("Initialization Failed:", error);
            Utils.showToast("Failed to initialize app. Check console.", "error");
        }
    },

    async loadData() {
        // this.state.products = await DB.getProducts(); // Removed for pagination
        this.state.categories = await DB.getCategories();
        this.state.settings = await DB.getSettings();
        // this.state.expenses = await DB.getExpenses(); // Removed for pagination
        // this.state.income = await DB.getIncome(); // Removed for pagination
        this.state.modifiers = this.state.settings.orderModifiers || [];

        // Refresh active views if needed
        if (this.renderCategoryList) this.renderCategoryList();
        if (this.renderModifiersList) this.renderModifiersList();
    },

    async navigate(viewId) {
        Utils.showLoading();
        try {
            this.state.currentView = viewId;
            document.querySelectorAll(DOM.VIEWS.ALL_SECTIONS).forEach(el => el.classList.add('hidden'));
            const view = document.getElementById(`view-${viewId}`);
            if (view) view.classList.remove('hidden');

            // Trigger render for the view
            if (viewId === 'dashboard' && this.renderDashboard) await this.renderDashboard();
            if (viewId === 'pos' && this.renderPOS) this.renderPOS();
            if (viewId === 'inventory' && this.renderInventory) this.renderInventory();
            if (viewId === 'reports' && this.renderProfitLoss) await this.renderProfitLoss();
            if (viewId === 'settings') {
                this.updateStoreDetails();
                if (this.renderCategoryList) this.renderCategoryList();
                if (this.renderModifiersList) this.renderModifiersList();
            }
        } catch (e) {
            console.error(e);
            Utils.showToast("Failed to load view", "error");
        } finally {
            Utils.hideLoading();
        }
    },

    // --- Theme ---
    // --- Theme ---
    applyTheme() {
        const theme = localStorage.getItem('pos_theme') || 'light';
        const html = document.querySelector('html');
        const iconMoon = document.getElementById(DOM.APP.THEME_ICON_MOON);
        const iconSun = document.getElementById(DOM.APP.THEME_ICON_SUN);
        const mobileStatus = document.getElementById('mobile-theme-status');

        if (theme === 'dark') {
            html.classList.add('dark');
            if (iconMoon) iconMoon.classList.remove('hidden');
            if (iconSun) iconSun.classList.add('hidden');
            if (mobileStatus) mobileStatus.innerText = 'Dark';
        } else {
            html.classList.remove('dark');
            if (iconMoon) iconMoon.classList.add('hidden');
            if (iconSun) iconSun.classList.remove('hidden');
            if (mobileStatus) mobileStatus.innerText = 'Light';
        }
    },

    toggleTheme() {
        const current = localStorage.getItem('pos_theme') || 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        localStorage.setItem('pos_theme', next);
        this.applyTheme();
    },

    updateStoreDetails() {
        const { settings } = this.state;
        const nameEl = document.getElementById(DOM.NAV.STORE_NAME);
        if (nameEl && settings.storeName) nameEl.innerText = settings.storeName;

        // Logo
        const defaultLogo = document.getElementById(DOM.NAV.DEFAULT_LOGO_TEXT);
        const imgLogo = document.getElementById(DOM.NAV.LOGO_IMG);

        if (settings.storeLogo && imgLogo) {
            imgLogo.src = settings.storeLogo;
            imgLogo.classList.remove('hidden');
            if (defaultLogo) defaultLogo.classList.add('hidden');
        } else if (imgLogo && defaultLogo) {
            imgLogo.classList.add('hidden');
            defaultLogo.classList.remove('hidden');
        }

        // Populate settings form if visible (or just populate it anyway if it exists)
        if (document.getElementById(DOM.SETTINGS.STORE_NAME)) {
            document.getElementById(DOM.SETTINGS.STORE_NAME).value = settings.storeName || '';
            document.getElementById(DOM.SETTINGS.STORE_ADDRESS).value = settings.storeAddress || '';
            document.getElementById(DOM.SETTINGS.CURRENCY_SYMBOL).value = settings.currencySymbol || '$';
            document.getElementById(DOM.SETTINGS.RECEIPT_HEADER).value = settings.receiptHeader || '';
            document.getElementById(DOM.SETTINGS.RECEIPT_FOOTER).value = settings.receiptFooter || '';
            document.getElementById(DOM.SETTINGS.STORE_LOGO_HIDDEN).value = settings.storeLogo || '';

            // Checkboxes
            const setCheck = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.checked = val;
            };
            setCheck(DOM.SETTINGS.RECEIPT_SHOW_LOGO, settings.receiptShowLogo !== false);
            setCheck(DOM.SETTINGS.RECEIPT_SHOW_ADDRESS, settings.receiptShowAddress !== false);
            setCheck(DOM.SETTINGS.RECEIPT_SHOW_DATE, settings.receiptShowDate !== false);
            setCheck(DOM.SETTINGS.RECEIPT_SHOW_QR, settings.receiptShowQrCode === true);

            const qrUrl = document.getElementById(DOM.SETTINGS.RECEIPT_QR_URL);
            if (qrUrl) qrUrl.value = settings.receiptQrCodeUrl || '';
        }
    },

    async filterInventory(type) {
        // Set filter BEFORE navigating so renderInventory() inside navigate()
        // already picks up the correct filter — avoids double-render duplication.
        this.state.inventoryFilter = type;
        await this.navigate('inventory');
    },

    setupEventListeners() {
        const bindClick = (id, handler) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', handler);
        };

        const bindSubmit = (id, handler) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('submit', handler);
        };

        // --- Navigation ---
        bindClick(DOM.NAV.DASHBOARD, () => this.navigate('dashboard'));
        bindClick(DOM.NAV.POS, () => this.navigate('pos'));
        bindClick(DOM.NAV.INVENTORY, () => this.navigate('inventory'));
        bindClick(DOM.NAV.SETTINGS, () => this.navigate('settings'));
        bindClick(DOM.NAV.REPORTS, () => this.navigate('reports'));
        bindClick(DOM.APP.THEME_TOGGLE_BTN, () => this.toggleTheme());
        bindClick('mobile-theme-toggle-btn', () => this.toggleTheme());

        // Mobile Menu
        const mobileMenuBtn = document.getElementById('mobile-menu-btn');
        const mobileMenu = document.getElementById('mobile-menu');
        if (mobileMenuBtn && mobileMenu) {
            mobileMenuBtn.addEventListener('click', () => {
                mobileMenu.classList.toggle('hidden');
            });

            // Close menu when clicking a link
            document.querySelectorAll('.mobile-nav-link').forEach(link => {
                link.addEventListener('click', (e) => {
                    const view = e.target.dataset.nav;
                    if (view) this.navigate(view);
                    mobileMenu.classList.add('hidden');
                });
            });
        }

        // --- Dashboard ---
        bindClick(DOM.DASHBOARD.LOW_STOCK_CARD, () => this.filterInventory('low_stock'));
        bindClick(DOM.DASHBOARD.REFRESH_BTN, () => this.renderDashboard());

        // --- POS ---
        const searchInput = document.getElementById(DOM.POS.SEARCH);
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.filterProducts(e.target.value));
        }
        const catFilter = document.getElementById(DOM.POS.CATEGORY_FILTER);
        if (catFilter) {
            catFilter.addEventListener('change', (e) => this.filterProducts(searchInput ? searchInput.value : '', e.target.value));
        }
        bindClick(DOM.POS.CHECKOUT_BTN, () => this.checkout());
        bindClick(DOM.POS.CLEAR_CART_BTN, () => this.clearCart());

        // --- Inventory ---
        bindClick(DOM.INVENTORY.ADD_PRODUCT_BTN, () => this.openProductModal());
        bindClick(DOM.INVENTORY.CLEAR_FILTER_BTN, () => this.renderInventory());

        const invSearchInput = document.getElementById('inv-search-input');
        if (invSearchInput) {
            invSearchInput.addEventListener('input', () => {
                this.state.inventoryPage = 1; // Reset to first page on search
                this.renderInventory();
            });
        }

        // --- Reports ---
        bindSubmit(DOM.REPORTS.EXPENSE_FORM, (e) => this.addExpense(e));
        bindSubmit(DOM.REPORTS.INCOME_FORM, (e) => this.addIncome(e));

        // --- Settings ---
        bindSubmit(DOM.SETTINGS.FORM, (e) => this.saveSettings(e));
        bindClick(DOM.SETTINGS.REMOVE_LOGO_BTN, () => this.removeLogo());
        bindClick(DOM.SETTINGS.ADD_MODIFIER_BTN, () => this.addModifier());
        bindClick(DOM.SETTINGS.PREVIEW_RECEIPT_BTN, () => this.previewReceipt());
        bindClick(DOM.SETTINGS.ADD_CATEGORY_BTN, () => this.addCategory());
        bindClick(DOM.SETTINGS.EXPORT_BTN, () => this.exportData());
        bindClick(DOM.SETTINGS.RESET_BTN, () => this.resetSystem());

        const importFile = document.getElementById(DOM.SETTINGS.IMPORT_FILE);
        if (importFile) {
            importFile.addEventListener('change', (e) => this.importData(e.target));
        }

        const logoUpload = document.getElementById(DOM.SETTINGS.LOGO_UPLOAD);
        if (logoUpload) {
            logoUpload.addEventListener('change', (e) => this.handleLogoUpload(e));
        }

        // --- Modals ---
        // Product Modal
        bindSubmit(DOM.MODALS.PRODUCT.FORM, (e) => this.saveProduct(e));
        bindClick(DOM.MODALS.PRODUCT.REMOVE_IMG_BTN, () => this.removeProductImage());
        bindClick(DOM.MODALS.PRODUCT.CANCEL_BTN, () => this.closeProductModal());
        bindClick(DOM.MODALS.PRODUCT.CLOSE_X, () => this.closeProductModal());

        const prodImageInput = document.getElementById(DOM.MODALS.PRODUCT.IMAGE_INPUT);
        if (prodImageInput) {
            prodImageInput.addEventListener('change', (e) => this.handleProductImageUpload(e));
        }

        // Order Modal
        bindClick(DOM.MODALS.ORDER.CLOSE_X, () => this.closeOrderModal());
        bindClick(DOM.MODALS.ORDER.CLOSE_BTN, () => this.closeOrderModal());
        bindClick(DOM.MODALS.ORDER.PRINT_BTN, () => this.printOrder());
    }
};

// Mixin Modules (Removed for Lazy Loading)
// Object.assign(App, window.POS);
// Object.assign(App, window.Inventory);
// Object.assign(App, window.Dashboard);
// Object.assign(App, window.Reports);
// Object.assign(App, window.Settings);

// Expose to window for legacy onclick support
window.app = App;

// Debugging: Ensure viewOrder is accessible
// window.app.viewOrder was causing recursion issues. Removed.

// Init on load
window.addEventListener('DOMContentLoaded', () => {
    App.init();
});

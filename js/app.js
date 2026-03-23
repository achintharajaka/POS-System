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
        paymentMethod: 'cash',
        currentUser: null,
        currentShift: null,
        // POS specific state
        currentCustomer: null,
        cartModifiers: []
    },

    async init() {
        console.log("Initializing App v3 (Modular)...");

        if (!window.crypto || !window.crypto.subtle) {
            console.error("Secure Context Warning: crypto.subtle is unavailable. Login may fail.");
            setTimeout(() => Utils.showToast("Warning: App requires Secure Context (HTTPS/Localhost) for login.", "warning"), 1000);
        }

        // Helper to safely mixin modules
        const mixin = (module) => {
            if (!module) return;
            if (module.state) {
                // Merge state instead of overwriting
                Object.assign(this.state, module.state);
            }
            // Link module.state to shared App.state so module methods invoked directly
            // (e.g. Customers.method()) still have access to the full state.
            module.state = this.state;
            Object.assign(App, module);
        };

        // Mixin all modules eagerly (loaded via script tags in index.html)
        if (window.Auth) mixin(window.Auth);
        if (window.I18n) mixin(window.I18n); // Mixin I18n
        if (window.Dashboard) mixin(window.Dashboard);
        if (window.POS) mixin(window.POS);
        if (window.Inventory) mixin(window.Inventory);
        if (window.Reports) mixin(window.Reports);
        if (window.Settings) mixin(window.Settings);
        if (window.Suppliers) mixin(window.Suppliers); // Mixin, though mainly accessed via Global
        if (window.Stock) mixin(window.Stock);
        if (this.initReportsUI) this.initReportsUI();
        if (window.Customers) mixin(window.Customers);
        if (window.Returns) mixin(window.Returns);
        if (window.Shortcuts) {
            mixin(window.Shortcuts);
            window.Shortcuts.init();
        }

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

            // Initialize Localization
            if (this.load) this.load(); // I18n.load() mixed in

            // Setup Listeners (before showing login so PIN pad works)
            this.setupEventListeners();

            // Setup Auth listeners
            if (this.setupAuthListeners) this.setupAuthListeners();

            // Check if there are any users — if DB was just migrated (no users), seed one
            const userCount = await DB.getUserCount();
            if (userCount === 0) {
                const adminPinHash = await DB.hashPin('1234');
                await DB.addUser({
                    name: 'Admin',
                    pin: adminPinHash,
                    role: 'admin',
                    active: true,
                    createdAt: Date.now()
                });
            }

            // Show login screen
            this.showLoginScreen();

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
        // Role-based access check
        if (this.state.currentUser && !this.hasAccess(viewId)) {
            Utils.showToast('Access denied for your role', 'error');
            // Redirect to the first allowed view
            const role = this.state.currentUser.role;
            const allowed = this._roleAccess[role] || ['pos'];
            viewId = allowed[0];
        }

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
            if (viewId === 'customers' && this.renderCustomers) this.renderCustomers();
            if (viewId === 'reports' && this.renderProfitLoss) await this.renderProfitLoss();
            if (viewId === 'settings') {
                this.updateStoreDetails();
                if (this.renderCategoryList) this.renderCategoryList();
                if (this.renderModifiersList) this.renderModifiersList();
                if (this.renderStoresList) this.renderStoresList();

                // User management (admin only)
                const userMgmt = document.getElementById('user-management-section');
                if (userMgmt) {
                    if (this.state.currentUser && this.state.currentUser.role === 'admin') {
                        userMgmt.classList.remove('hidden');
                        if (this.renderUserManagement) this.renderUserManagement();
                        if (this.renderShiftHistory) this.renderShiftHistory();
                    } else {
                        userMgmt.classList.add('hidden');
                    }
                }
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

            // Language
            const langSelect = document.getElementById('setting-language');
            if (langSelect && this.currentLang) {
                langSelect.value = this.currentLang;
            }
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
        bindClick('nav-customers', () => this.navigate('customers'));
        bindClick(DOM.NAV.SETTINGS, () => this.navigate('settings'));
        bindClick(DOM.NAV.REPORTS, () => this.navigate('reports'));
        bindClick(DOM.APP.THEME_TOGGLE_BTN, () => this.toggleTheme());
        bindClick('mobile-theme-toggle-btn', () => this.toggleTheme());

        // Mobile Menu
        const mobileMenuBtn = document.getElementById('mobile-menu-btn');
        const mobileMenu = document.getElementById('mobile-menu');
        const mobileBackdrop = document.getElementById('mobile-menu-backdrop');
        const mobileCloseBtn = document.getElementById('mobile-menu-close-btn');

        const toggleMobileMenu = (show) => {
            if (!mobileMenu) return;
            if (show === undefined) show = mobileMenu.classList.contains('hidden');
            if (show) {
                mobileMenu.classList.remove('hidden');
                if (mobileBackdrop) mobileBackdrop.classList.remove('hidden');
            } else {
                mobileMenu.classList.add('hidden');
                if (mobileBackdrop) mobileBackdrop.classList.add('hidden');
            }
        };

        if (mobileMenuBtn) {
            mobileMenuBtn.addEventListener('click', () => toggleMobileMenu());
        }
        if (mobileCloseBtn) {
            mobileCloseBtn.addEventListener('click', () => toggleMobileMenu(false));
        }
        if (mobileBackdrop) {
            mobileBackdrop.addEventListener('click', () => toggleMobileMenu(false));
        }

        // Close menu when clicking a nav link
        document.querySelectorAll('.mobile-nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                const view = e.target.dataset.nav;
                if (view) this.navigate(view);
                toggleMobileMenu(false);
            });
        });

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
        // --- Inventory ---
        bindClick(DOM.INVENTORY.ADD_PRODUCT_BTN, () => this.openProductModal());
        bindClick(DOM.INVENTORY.ADD_SUPPLIER_BTN, () => Suppliers.openSupplierModal());
        bindClick(DOM.INVENTORY.ADD_PO_BTN, () => Stock.openPOModal());
        bindClick(DOM.INVENTORY.CLEAR_FILTER_BTN, () => this.renderInventory());

        // Inventory Tabs
        document.querySelectorAll('.inv-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.getAttribute('data-tab'); // Use getAttribute to be safe
                if (tab && this.switchTab) this.switchTab(tab);
            });
        });

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
    },

    printProductBarcode(barcode, name) {
        if (!barcode) return;
        const printWindow = window.open('', '_blank', 'width=400,height=300');
        if (!printWindow) {
            Utils.showToast("Please allow popups to print barcodes", "error");
            return;
        }

        printWindow.document.write(`
            <html>
                <head>
                    <title>Print Barcode - ${name}</title>
                    <style>
                        body { text-align: center; font-family: sans-serif; padding-top: 20px; }
                        svg { max-width: 100%; height: auto; }
                    </style>
                    <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
                </head>
                <body>
                    <h4>${name}</h4>
                    <svg id="barcode"></svg>
                    <script>
                        window.onload = function() {
                            if (window.JsBarcode) {
                                JsBarcode("#barcode", "${barcode}", {
                                    format: "CODE128",
                                    lineColor: "#000",
                                    width: 2,
                                    height: 50,
                                    displayValue: true
                                });
                                setTimeout(() => {
                                    window.print();
                                    window.close();
                                }, 500);
                            } else {
                                document.body.innerHTML = "Error loading barcode library.";
                            }
                        };
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
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

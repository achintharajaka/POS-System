window.Shortcuts = {
    buffer: '',
    bufferTimeout: null,

    init() {
        console.log("Initializing Shortcuts Module...");
        document.addEventListener('keydown', (e) => this.handleKey(e));
    },

    handleKey(e) {
        // Ignore if focus is on input/textarea/contentEditable
        const target = e.target;
        const isInput = target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            target.isContentEditable;

        // F1-F5 Navigation (Global)
        if (e.key === 'F1') { e.preventDefault(); app.navigate('dashboard'); return; }
        if (e.key === 'F2') { e.preventDefault(); app.navigate('pos'); return; }
        if (e.key === 'F3') { e.preventDefault(); app.navigate('inventory'); return; }
        if (e.key === 'F4') { e.preventDefault(); app.navigate('reports'); return; }
        if (e.key === 'F5') { e.preventDefault(); app.navigate('settings'); return; }

        // F9 Checkout
        if (e.key === 'F9') {
            e.preventDefault();
            this.triggerCheckout();
            return;
        }

        // Enter Checkout (Only if not in input)
        if (e.key === 'Enter' && !isInput) {
            // Check if we are in POS
            if (app.state.currentView === 'pos') {
                // Check if a modal is open? 
                if (this.isAnyModalOpen()) return;
                e.preventDefault();
                this.triggerCheckout();
            }
            return;
        }

        // Esc Modal
        if (e.key === 'Escape') {
            this.closeModals();
            return;
        }

        // Number Keys for Quantity (Only in POS, not in input)
        // Check for 0-9 keys. 
        if (!isInput && app.state.currentView === 'pos' && !this.isAnyModalOpen() && /^[0-9]$/.test(e.key)) {
            this.handleQuantityInput(e.key);
            // We usually don't prevent default for numbers unless we are sure. 
            // If body has focus, default action is nothing.
        }
    },

    triggerCheckout() {
        if (app.state.currentView === 'pos') {
            // Ensure app.checkout exists (it's mixed in from POS module)
            if (app.checkout) app.checkout();
        }
    },

    isAnyModalOpen() {
        const isVisible = (el) => !!(el && (el.offsetWidth > 0 || el.offsetHeight > 0));

        // Check for product modal
        const prodModal = document.getElementById(DOM.MODALS.PRODUCT.ID);
        if (isVisible(prodModal)) return true;

        // Check order modal
        const orderModal = document.getElementById(DOM.MODALS.ORDER.ID);
        if (isVisible(orderModal)) return true;

        // Login screen
        const login = document.getElementById('login-screen');
        if (isVisible(login)) return true;

        return false;
    },

    closeModals() {
        // Close Product Modal
        const prodModal = document.getElementById(DOM.MODALS.PRODUCT.ID);
        if (prodModal && !prodModal.classList.contains('hidden')) {
            if (app.closeProductModal) app.closeProductModal();
            return;
        }

        // Close Order Modal
        const orderModal = document.getElementById(DOM.MODALS.ORDER.ID);
        if (orderModal && !orderModal.classList.contains('hidden')) {
            if (app.closeOrderModal) app.closeOrderModal(); // Assuming this exists in Reports or App
            // In constants.js: DOM.MODALS.ORDER.CLOSE_X -> calls closeOrderModal()
            // reports.js likely defines closeOrderModal.
            return;
        }
    },

    handleQuantityInput(key) {
        clearTimeout(this.bufferTimeout);
        this.buffer += key;

        const cart = app.state.cart;
        if (!cart || cart.length === 0) {
            this.buffer = '';
            return;
        }

        const lastItem = cart[cart.length - 1];

        // Update quantity
        const qty = parseInt(this.buffer);
        if (qty > 0) {
            const diff = qty - lastItem.qty;
            if (diff !== 0) {
                // updateCartQty checks stock limits
                app.updateCartQty(lastItem.id, diff);
            }
        }

        this.bufferTimeout = setTimeout(() => {
            this.buffer = '';
        }, 1000); // 1 second reset
    }
};

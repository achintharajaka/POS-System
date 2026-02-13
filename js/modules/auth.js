// Auth Module (Global)
// Depends on: db.js, utils.js, constants.js

window.Auth = {
    // --- State ---
    _pinBuffer: '',
    _shiftTimer: null,

    // --- Role Access Map ---
    _roleAccess: {
        admin: ['dashboard', 'pos', 'inventory', 'reports', 'settings'],
        manager: ['dashboard', 'pos', 'inventory', 'reports'],
        cashier: ['pos']
    },

    // --- Login Screen ---
    showLoginScreen() {
        const loginScreen = document.getElementById(DOM.AUTH.LOGIN_SCREEN);
        const mainNav = document.querySelector('nav');
        const mainContent = document.querySelector('main');
        const mobileMenu = document.getElementById('mobile-menu');

        if (loginScreen) loginScreen.classList.remove('hidden');
        if (mainNav) mainNav.classList.add('hidden');
        if (mainContent) mainContent.classList.add('hidden');
        if (mobileMenu) mobileMenu.classList.add('hidden');

        this._pinBuffer = '';
        this._updatePinDots();
        this._clearLoginError();
        this._focusPinPad();
    },

    hideLoginScreen() {
        const loginScreen = document.getElementById(DOM.AUTH.LOGIN_SCREEN);
        const mainNav = document.querySelector('nav');
        const mainContent = document.querySelector('main');

        if (loginScreen) loginScreen.classList.add('hidden');
        if (mainNav) mainNav.classList.remove('hidden');
        if (mainContent) mainContent.classList.remove('hidden');
    },

    _focusPinPad() {
        const pad = document.getElementById(DOM.AUTH.PIN_PAD);
        if (pad) pad.focus();
    },

    _updatePinDots() {
        const dots = document.querySelectorAll('.pin-dot');
        dots.forEach((dot, i) => {
            if (i < this._pinBuffer.length) {
                dot.classList.add('filled');
            } else {
                dot.classList.remove('filled');
            }
        });
    },

    _showLoginError(msg) {
        const el = document.getElementById(DOM.AUTH.ERROR_MSG);
        if (el) {
            el.textContent = msg;
            el.classList.remove('hidden');
            // Shake animation
            const pad = document.getElementById(DOM.AUTH.PIN_CONTAINER);
            if (pad) {
                pad.classList.add('shake');
                setTimeout(() => pad.classList.remove('shake'), 500);
            }
        }
    },

    _clearLoginError() {
        const el = document.getElementById(DOM.AUTH.ERROR_MSG);
        if (el) {
            el.textContent = '';
            el.classList.add('hidden');
        }
    },

    // --- PIN Input ---
    pinInput(digit) {
        if (this._pinBuffer.length >= 6) return;
        this._pinBuffer += digit;
        this._updatePinDots();
        this._clearLoginError();
    },

    pinBackspace() {
        this._pinBuffer = this._pinBuffer.slice(0, -1);
        this._updatePinDots();
        this._clearLoginError();
    },

    pinClear() {
        this._pinBuffer = '';
        this._updatePinDots();
        this._clearLoginError();
    },

    // --- Login ---
    async attemptLogin() {
        const pin = this._pinBuffer;
        if (!pin || pin.length < 4) {
            this._showLoginError('Enter at least 4 digits');
            return;
        }

        try {
            const hashedPin = await DB.hashPin(pin);
            const user = await DB.getUserByPin(hashedPin);

            if (!user) {
                this._showLoginError('Invalid PIN. Try again.');
                this._pinBuffer = '';
                this._updatePinDots();
                return;
            }

            // Success — set user state
            this.state.currentUser = user;

            // Start or resume shift
            let activeShift = await DB.getActiveShift(user.id);
            if (!activeShift) {
                const shiftId = await DB.startShift(user.id);
                activeShift = { id: shiftId, userId: user.id, clockIn: Date.now(), status: 'open' };
            }
            this.state.currentShift = activeShift;

            // Load application data
            await this.loadData();
            this.updateStoreDetails();

            // Hide login, show app
            this.hideLoginScreen();
            this._updateUserIndicator();
            this._applyRoleRestrictions();
            this._startShiftTimer();

            // Navigate to default view based on role
            const defaultView = user.role === 'cashier' ? 'pos' : 'dashboard';
            await this.navigate(defaultView);

            Utils.showToast(`Welcome, ${user.name}!`);
        } catch (err) {
            console.error('Login error:', err);
            this._showLoginError('Login failed. Please try again.');
            this._pinBuffer = '';
            this._updatePinDots();
        }
    },

    // --- Logout ---
    async logout() {
        if (!confirm('Are you sure you want to clock out and logout?')) return;

        try {
            // End shift
            if (this.state.currentShift && this.state.currentShift.id) {
                await DB.endShift(this.state.currentShift.id);
            }

            // Clear state
            this.state.currentUser = null;
            this.state.currentShift = null;

            // Stop shift timer
            this._stopShiftTimer();

            // Show login
            this.showLoginScreen();
            Utils.showToast('Logged out successfully', 'info');
        } catch (err) {
            console.error('Logout error:', err);
            Utils.showToast('Logout failed', 'error');
        }
    },

    // --- Role Checks ---
    hasAccess(viewId) {
        if (!this.state.currentUser) return false;
        const role = this.state.currentUser.role;
        const allowed = this._roleAccess[role] || [];
        return allowed.includes(viewId);
    },

    _applyRoleRestrictions() {
        const user = this.state.currentUser;
        if (!user) return;

        const role = user.role;
        const allowed = this._roleAccess[role] || [];

        // Desktop nav
        const navMap = {
            'dashboard': DOM.NAV.DASHBOARD,
            'pos': DOM.NAV.POS,
            'inventory': DOM.NAV.INVENTORY,
            'reports': DOM.NAV.REPORTS,
            'settings': DOM.NAV.SETTINGS
        };

        Object.entries(navMap).forEach(([view, id]) => {
            const el = document.getElementById(id);
            if (el) {
                if (allowed.includes(view)) {
                    el.classList.remove('hidden');
                } else {
                    el.classList.add('hidden');
                }
            }
        });

        // Mobile nav
        document.querySelectorAll('.mobile-nav-link').forEach(link => {
            const view = link.dataset.nav;
            if (view) {
                if (allowed.includes(view)) {
                    link.classList.remove('hidden');
                } else {
                    link.classList.add('hidden');
                }
            }
        });
    },

    // --- User Indicator in Nav ---
    _updateUserIndicator() {
        const user = this.state.currentUser;
        const nameEl = document.getElementById(DOM.AUTH.USER_NAME);
        const roleEl = document.getElementById(DOM.AUTH.USER_ROLE);
        const indicator = document.getElementById(DOM.AUTH.USER_INDICATOR);
        const timerEl = document.getElementById(DOM.AUTH.SHIFT_TIMER);

        if (user && nameEl) nameEl.textContent = user.name;
        if (user && roleEl) {
            roleEl.textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);
            roleEl.className = 'text-xs px-2 py-0.5 rounded-full font-semibold ' + this._getRoleBadgeClass(user.role);
        }
        if (indicator) indicator.classList.remove('hidden');

        // Only show shift timer for cashiers
        const timerContainer = timerEl ? timerEl.parentElement : null;
        if (timerContainer) {
            if (user && user.role === 'cashier') {
                timerContainer.classList.remove('hidden');
            } else {
                timerContainer.classList.add('hidden');
            }
        }
    },

    _getRoleBadgeClass(role) {
        switch (role) {
            case 'admin': return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300';
            case 'manager': return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
            case 'cashier': return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
            default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
        }
    },

    // --- Shift Timer ---
    _startShiftTimer() {
        this._stopShiftTimer();
        // Only run timer for cashiers
        if (!this.state.currentUser || this.state.currentUser.role !== 'cashier') return;

        const timerEl = document.getElementById(DOM.AUTH.SHIFT_TIMER);
        if (!timerEl || !this.state.currentShift) return;

        const clockIn = this.state.currentShift.clockIn;
        const updateTimer = () => {
            const elapsed = Date.now() - clockIn;
            const hours = Math.floor(elapsed / 3600000);
            const minutes = Math.floor((elapsed % 3600000) / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            timerEl.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        };
        updateTimer();
        this._shiftTimer = setInterval(updateTimer, 1000);
    },

    _stopShiftTimer() {
        if (this._shiftTimer) {
            clearInterval(this._shiftTimer);
            this._shiftTimer = null;
        }
    },

    // --- User Management (Admin only) ---
    async renderUserManagement() {
        if (!this.state.currentUser || this.state.currentUser.role !== 'admin') return;

        const tbody = document.getElementById(DOM.AUTH.USER_TABLE_BODY);
        if (!tbody) return;

        const users = await DB.getUsers();
        tbody.innerHTML = users.map(u => `
            <tr class="border-b dark:border-gray-700">
                <td class="p-3">
                    <div class="flex items-center gap-2">
                        <div class="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${u.role === 'admin' ? 'bg-purple-500' : u.role === 'manager' ? 'bg-blue-500' : 'bg-green-500'
            }">${u.name.charAt(0).toUpperCase()}</div>
                        <span>${Utils.sanitize(u.name)}</span>
                    </div>
                </td>
                <td class="p-3">
                    <span class="text-xs px-2 py-0.5 rounded-full font-semibold ${this._getRoleBadgeClass(u.role)}">
                        ${u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                    </span>
                </td>
                <td class="p-3">
                    <span class="inline-flex items-center gap-1 text-xs font-medium ${u.active ? 'text-green-600' : 'text-red-500'}">
                        <span class="w-2 h-2 rounded-full ${u.active ? 'bg-green-500' : 'bg-red-500'}"></span>
                        ${u.active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td class="p-3">
                    <div class="flex gap-1">
                        <button onclick="app.editUser(${u.id})" class="text-blue-600 hover:text-blue-800 text-sm px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/30" title="Edit">✏️</button>
                        <button onclick="app.resetUserPin(${u.id})" class="text-yellow-600 hover:text-yellow-800 text-sm px-2 py-1 rounded hover:bg-yellow-50 dark:hover:bg-yellow-900/30" title="Reset PIN">🔑</button>
                        ${u.id !== this.state.currentUser.id ? `<button onclick="app.removeUser(${u.id})" class="text-red-600 hover:text-red-800 text-sm px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30" title="Delete">🗑️</button>` : ''}
                    </div>
                </td>
            </tr>
        `).join('');
    },

    async addNewUser() {
        const nameInput = document.getElementById(DOM.AUTH.NEW_USER_NAME);
        const roleInput = document.getElementById(DOM.AUTH.NEW_USER_ROLE);
        const pinInput = document.getElementById(DOM.AUTH.NEW_USER_PIN);

        const name = nameInput ? nameInput.value.trim() : '';
        const role = roleInput ? roleInput.value : 'cashier';
        const pin = pinInput ? pinInput.value.trim() : '';

        if (!name) { Utils.showToast('Please enter a user name', 'error'); return; }
        if (!pin || pin.length < 4) { Utils.showToast('PIN must be at least 4 digits', 'error'); return; }
        if (!/^\d+$/.test(pin)) { Utils.showToast('PIN must be numbers only', 'error'); return; }

        try {
            const hashedPin = await DB.hashPin(pin);

            // Check if PIN already exists
            const existing = await DB.getUserByPin(hashedPin);
            if (existing) {
                Utils.showToast('This PIN is already in use', 'error');
                return;
            }

            await DB.addUser({
                name,
                pin: hashedPin,
                role,
                active: true,
                createdAt: Date.now()
            });

            // Clear inputs
            if (nameInput) nameInput.value = '';
            if (pinInput) pinInput.value = '';
            if (roleInput) roleInput.value = 'cashier';

            Utils.showToast(`User "${name}" added`);
            this.renderUserManagement();
        } catch (err) {
            console.error('Add user error:', err);
            Utils.showToast('Failed to add user', 'error');
        }
    },

    async editUser(id) {
        const user = await DB.getUser(id);
        if (!user) return;

        const nameInput = document.getElementById(DOM.AUTH.NEW_USER_NAME);
        const roleInput = document.getElementById(DOM.AUTH.NEW_USER_ROLE);
        const pinInput = document.getElementById(DOM.AUTH.NEW_USER_PIN);
        const editIdInput = document.getElementById(DOM.AUTH.EDIT_USER_ID);
        const addBtn = document.getElementById(DOM.AUTH.ADD_USER_BTN);

        if (nameInput) nameInput.value = user.name;
        if (roleInput) roleInput.value = user.role;
        if (pinInput) { pinInput.value = ''; pinInput.placeholder = 'Leave blank to keep'; }
        if (editIdInput) editIdInput.value = id;
        if (addBtn) addBtn.textContent = 'Update User';
    },

    async saveUserEdit() {
        const editIdInput = document.getElementById(DOM.AUTH.EDIT_USER_ID);
        const editId = editIdInput ? parseInt(editIdInput.value) : null;

        if (!editId) {
            // It's a new user
            return this.addNewUser();
        }

        const nameInput = document.getElementById(DOM.AUTH.NEW_USER_NAME);
        const roleInput = document.getElementById(DOM.AUTH.NEW_USER_ROLE);
        const pinInput = document.getElementById(DOM.AUTH.NEW_USER_PIN);

        const name = nameInput ? nameInput.value.trim() : '';
        const role = roleInput ? roleInput.value : 'cashier';
        const pin = pinInput ? pinInput.value.trim() : '';

        if (!name) { Utils.showToast('Please enter a user name', 'error'); return; }

        try {
            const updates = { name, role };

            if (pin) {
                if (pin.length < 4 || !/^\d+$/.test(pin)) {
                    Utils.showToast('PIN must be at least 4 digits', 'error');
                    return;
                }
                updates.pin = await DB.hashPin(pin);
            }

            await DB.updateUser(editId, updates);

            // Reset form
            if (nameInput) nameInput.value = '';
            if (pinInput) { pinInput.value = ''; pinInput.placeholder = 'Min 4 digits'; }
            if (editIdInput) editIdInput.value = '';
            const addBtn = document.getElementById(DOM.AUTH.ADD_USER_BTN);
            if (addBtn) addBtn.textContent = 'Add User';

            // Update current user state if editing self
            if (this.state.currentUser && this.state.currentUser.id === editId) {
                this.state.currentUser = { ...this.state.currentUser, ...updates };
                this._updateUserIndicator();
                this._applyRoleRestrictions();
            }

            Utils.showToast('User updated');
            this.renderUserManagement();
        } catch (err) {
            console.error('Edit user error:', err);
            Utils.showToast('Failed to update user', 'error');
        }
    },

    async resetUserPin(id) {
        const user = await DB.getUser(id);
        if (!user) return;

        const confirmed = await Utils.confirm('Reset PIN', `Reset PIN for "${user.name}"? New default PIN will be 1234.`);
        if (!confirmed) return;

        try {
            const newPin = await DB.hashPin('1234');
            await DB.updateUser(id, { pin: newPin });
            Utils.showToast(`PIN reset for "${user.name}" to 1234`);
        } catch (err) {
            console.error('Reset PIN error:', err);
            Utils.showToast('Failed to reset PIN', 'error');
        }
    },

    async removeUser(id) {
        const user = await DB.getUser(id);
        if (!user) return;

        if (this.state.currentUser && this.state.currentUser.id === id) {
            Utils.showToast('Cannot delete your own account', 'error');
            return;
        }

        const confirmed = await Utils.confirm('Delete User', `Permanently delete user "${user.name}"?`);
        if (!confirmed) return;

        try {
            await DB.deleteUser(id);
            Utils.showToast(`User "${user.name}" deleted`);
            this.renderUserManagement();
        } catch (err) {
            console.error('Delete user error:', err);
            Utils.showToast('Failed to delete user', 'error');
        }
    },

    // --- Shift History ---
    async renderShiftHistory() {
        const tbody = document.getElementById(DOM.AUTH.SHIFT_TABLE_BODY);
        if (!tbody) return;

        const shifts = await DB.getShifts();
        const users = await DB.getUsers();
        const userMap = {};
        users.forEach(u => userMap[u.id] = u.name);

        tbody.innerHTML = shifts.slice(0, 20).map(s => {
            const clockIn = new Date(s.clockIn);
            const clockOut = s.clockOut ? new Date(s.clockOut) : null;
            let duration = '—';
            if (clockOut) {
                const diff = s.clockOut - s.clockIn;
                const h = Math.floor(diff / 3600000);
                const m = Math.floor((diff % 3600000) / 60000);
                duration = `${h}h ${m}m`;
            }
            return `
                <tr class="border-b dark:border-gray-700">
                    <td class="p-3">${userMap[s.userId] || 'Unknown'}</td>
                    <td class="p-3 text-sm">${clockIn.toLocaleDateString()} ${clockIn.toLocaleTimeString()}</td>
                    <td class="p-3 text-sm">${clockOut ? clockOut.toLocaleDateString() + ' ' + clockOut.toLocaleTimeString() : '<span class="text-green-500 font-medium">Active</span>'}</td>
                    <td class="p-3 text-sm">${duration}</td>
                    <td class="p-3">
                        <span class="text-xs px-2 py-0.5 rounded-full font-medium ${s.status === 'open' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}">
                            ${s.status === 'open' ? 'Open' : 'Closed'}
                        </span>
                    </td>
                </tr>
            `;
        }).join('');

        if (shifts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-400">No shift records yet</td></tr>';
        }
    },

    // --- Setup Event Listeners ---
    setupAuthListeners() {
        // PIN pad buttons
        document.querySelectorAll('[data-pin-digit]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.pinInput(e.currentTarget.dataset.pinDigit);
            });
        });

        const backspaceBtn = document.getElementById(DOM.AUTH.PIN_BACKSPACE);
        if (backspaceBtn) backspaceBtn.addEventListener('click', () => this.pinBackspace());

        const clearBtn = document.getElementById(DOM.AUTH.PIN_CLEAR);
        if (clearBtn) clearBtn.addEventListener('click', () => this.pinClear());

        const submitBtn = document.getElementById(DOM.AUTH.PIN_SUBMIT);
        if (submitBtn) submitBtn.addEventListener('click', () => this.attemptLogin());

        // Logout button
        const logoutBtn = document.getElementById(DOM.AUTH.LOGOUT_BTN);
        if (logoutBtn) logoutBtn.addEventListener('click', () => this.logout());

        const mobileLogoutBtn = document.getElementById(DOM.AUTH.MOBILE_LOGOUT_BTN);
        if (mobileLogoutBtn) mobileLogoutBtn.addEventListener('click', () => this.logout());

        // User management
        const addUserBtn = document.getElementById(DOM.AUTH.ADD_USER_BTN);
        if (addUserBtn) addUserBtn.addEventListener('click', () => this.saveUserEdit());

        // Keyboard support for login screen
        document.addEventListener('keydown', (e) => {
            const loginScreen = document.getElementById(DOM.AUTH.LOGIN_SCREEN);
            if (!loginScreen || loginScreen.classList.contains('hidden')) return;

            if (e.key >= '0' && e.key <= '9') {
                e.preventDefault();
                this.pinInput(e.key);
            } else if (e.key === 'Backspace') {
                e.preventDefault();
                this.pinBackspace();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                this.attemptLogin();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.pinClear();
            }
        });
    }
};

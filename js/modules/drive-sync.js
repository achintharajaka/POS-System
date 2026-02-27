// Google Drive Sync Module
// Using Google Identity Services (GSI) and Google API Client Library

const CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID_HERE'; // User must replace this
const API_KEY = 'YOUR_GOOGLE_API_KEY_HERE'; // User must replace this
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

window.DriveSync = {
    tokenClient: null,
    gapiInited: false,
    gisInited: false,
    accessToken: null,

    async init() {
        if (CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID_HERE') {
            this.setStatus("Sync unavailable: Missing Client ID. Please edit js/modules/drive-sync.js", "text-red-500");
            return;
        }

        // Load the libraries (This is handled in index.html, but we wait for global vars)
        this.waitForLibs();
    },

    waitForLibs() {
        let attempts = 0;
        const check = setInterval(() => {
            if (window.gapi && window.google) {
                clearInterval(check);
                this.gapiLoaded();
                this.gisLoaded();
            } else if (attempts > 50) {
                clearInterval(check);
                this.setStatus("Failed to load Google APIs.", "text-red-500");
            }
            attempts++;
        }, 100);
    },

    gapiLoaded() {
        gapi.load('client', async () => {
            await gapi.client.init({
                apiKey: API_KEY,
                discoveryDocs: [DISCOVERY_DOC],
            });
            this.gapiInited = true;
            this.checkIfReady();
        });
    },

    gisLoaded() {
        this.tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: '', // defined later
        });
        this.gisInited = true;
        this.checkIfReady();
    },

    checkIfReady() {
        if (this.gapiInited && this.gisInited) {
            this.setStatus("Ready to sync.");
        }
    },

    handleAuthClick() {
        if (!this.gapiInited || !this.gisInited) {
            Utils.showToast("Google Sync not initialized. Verify Client ID and API Key.", "error");
            return;
        }

        this.tokenClient.callback = async (resp) => {
            if (resp.error) {
                this.setStatus("Login failed.", "text-red-500");
                console.error(resp.error);
                return;
            }
            this.accessToken = resp.access_token;
            this.setStatus("Logged in. Starting sync...", "text-blue-500");
            this.updateUI(true);
            await this.uploadBackup();
        };

        if (gapi.client.getToken() === null) {
            this.tokenClient.requestAccessToken({ prompt: 'consent' });
        } else {
            this.tokenClient.requestAccessToken({ prompt: '' });
        }
    },

    handleSignoutClick() {
        const token = gapi.client.getToken();
        if (token !== null) {
            google.accounts.oauth2.revoke(token.access_token);
            gapi.client.setToken('');
            this.accessToken = null;
            this.setStatus("Signed out.");
            this.updateUI(false);
        }
    },

    updateUI(isLoggedIn) {
        const loginBtn = document.getElementById('gdrive-login-btn');
        const logoutBtn = document.getElementById('gdrive-logout-btn');
        if (isLoggedIn) {
            if (loginBtn) loginBtn.classList.add('hidden');
            if (logoutBtn) logoutBtn.classList.remove('hidden');
        } else {
            if (loginBtn) loginBtn.classList.remove('hidden');
            if (logoutBtn) logoutBtn.classList.add('hidden');
        }
    },

    setStatus(message, colorClass = "text-gray-500") {
        const statusEl = document.getElementById('gdrive-status');
        if (statusEl) {
            statusEl.className = `text-xs mt-2 text-center ${colorClass}`;
            statusEl.innerText = message;
        }
    },

    async uploadBackup() {
        try {
            this.setStatus("Preparing data backup...", "text-blue-500");
            const data = await DB.exportData();
            const jsonStr = JSON.stringify(data, null, 2);
            const activeStore = localStorage.getItem('pos_active_store') || 'POSDatabase';
            const dateStr = new Date().toISOString().slice(0, 10);
            const fileName = `pos_backup_${activeStore}_${dateStr}.json`;

            const metadata = {
                'name': fileName,
                'mimeType': 'application/json'
            };

            const file = new Blob([jsonStr], { type: 'application/json' });
            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', file);

            this.setStatus(`Uploading ${fileName}...`, "text-blue-500");

            const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: new Headers({ 'Authorization': 'Bearer ' + this.accessToken }),
                body: form,
            });

            if (response.ok) {
                const resJson = await response.json();
                this.setStatus(`Backup successful! File ID: ${resJson.id}`, "text-green-500");
                Utils.showToast("Backup saved to Google Drive!", "success");
            } else {
                const errorText = await response.text();
                this.setStatus(`Upload failed: ${response.statusText}`, "text-red-500");
                console.error("GDrive Upload Error:", errorText);
            }

        } catch (e) {
            console.error(e);
            this.setStatus("Error during backup.", "text-red-500");
            Utils.showToast("Google Drive Sync Failed", "error");
        }
    }
};

// Initialize on load
window.addEventListener('DOMContentLoaded', () => {
    DriveSync.init();
});

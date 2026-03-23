// Utils (Global)
// Depends on: constants.js

window.Utils = {
    formatCurrency(amount, symbol = "$") {
        return `${symbol}${parseFloat(amount).toFixed(2)}`;
    },

    formatDate(timestamp) {
        return new Date(timestamp).toLocaleString();
    },

    // Image Compression
    async compressImage(file, maxWidth = 800, quality = 0.7) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
                img.onerror = (error) => reject(error);
            };
            reader.onerror = (error) => reject(error);
        });
    },

    // QR Code Generation (Local)
    generateQRCode(text) {
        return new Promise((resolve, reject) => {
            try {
                if (typeof QRCode === 'undefined') {
                    // Fallback to load script if not present (though we added it to index.html)
                    this.loadScript('js/lib/qrcode.js').then(() => {
                        this.generateQRCode(text).then(resolve).catch(reject);
                    }).catch(err => reject("QRCode lib not found"));
                    return;
                }

                const div = document.createElement('div');
                const qr = new QRCode(div, {
                    text: text,
                    width: 128,
                    height: 128,
                    colorDark: "#000000",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.H
                });

                // Wait for rendering
                setTimeout(() => {
                    const canvas = div.querySelector('canvas');
                    const img = div.querySelector('img');

                    if (canvas) {
                        resolve(canvas.toDataURL("image/png"));
                    } else if (img && img.src) {
                        resolve(img.src);
                    } else {
                        reject("Failed to render QR Code");
                    }
                }, 100);
            } catch (e) {
                reject(e);
            }
        });
    },

    // Dynamic Script Loading
    loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.body.appendChild(script);
        });
    },

    // Input Sanitization
    sanitize(str) {
        if (!str) return '';
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
    },

    getLevenshteinDistance(a, b) {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;

        const matrix = [];

        // increment along the first column of each row
        let i;
        for (i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }

        // increment each column in the first row
        let j;
        for (j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }

        // Fill in the rest of the matrix
        for (i = 1; i <= b.length; i++) {
            for (j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, // substitution
                        Math.min(matrix[i][j - 1] + 1, // insertion
                            matrix[i - 1][j] + 1)); // deletion
                }
            }
        }

        return matrix[b.length][a.length];
    },

    fuzzyMatch(query, text, maxDistance = 2) {
        if (!query || !text) return false;
        query = query.toLowerCase();
        text = text.toLowerCase();

        if (text.includes(query)) return true;

        if (query.length <= 3) return text.includes(query);

        // Check against individual words
        const words = text.split(/\s+/);
        for (const word of words) {
            if (Math.abs(query.length - word.length) <= maxDistance) {
                if (this.getLevenshteinDistance(query, word) <= maxDistance) {
                    return true;
                }
            }
        }

        return false;
    },

    showToast(message, type = "success") {
        const container = document.getElementById(DOM.APP.TOAST_CONTAINER);
        if (!container) return; // Guard against missing container

        const toast = document.createElement("div");

        let colors = type === "success" ? "bg-green-500" : "bg-red-500";

        toast.className = `${colors} text-white px-6 py-3 rounded-lg shadow-lg transform transition-all duration-300 translate-x-full opacity-0`;
        toast.innerText = message;

        container.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => {
            toast.classList.remove("translate-x-full", "opacity-0");
        });

        // Remove after 3s
        setTimeout(() => {
            toast.classList.add("translate-x-full", "opacity-0");
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    generateReceipt(storeName, address, order, settings, logo = null) {
        // Simple HTML string generation for receipt
        const date = new Date(order.timestamp).toLocaleString();

        let logoHtml = '';
        if (logo && settings.receiptShowLogo) {
            logoHtml = `<div class="text-center mb-2"><img src="${logo}" style="max-height: 50px; max-width: 100%;"></div>`;
        }

        let addressHtml = '';
        if (settings.receiptShowAddress) {
            addressHtml = `<p>${this.sanitize(address)}</p>`;
        }

        let dateHtml = '';
        if (settings.receiptShowDate) {
            dateHtml = `<p>${date}</p>`;
        }

        let itemsHtml = order.items.map(item => `
            <tr>
                <td style="padding: 5px 0;">${this.sanitize(item.name)} <br> <span style="font-size: 0.8em; color: #666;">${item.qty} x ${Utils.formatCurrency(item.price, settings.currencySymbol)}</span></td>
                <td style="text-align: right; vertical-align: top; padding: 5px 0;">${Utils.formatCurrency(item.price * item.qty, settings.currencySymbol)}</td>
            </tr>
        `).join('');

        let modifiersHtml = '';
        if (order.modifiers) {
            order.modifiers.forEach(mod => {
                const sign = mod.rate === 'subtract' ? '-' : '';
                modifiersHtml += `<tr><td>${this.sanitize(mod.name)}</td><td class="text-right">${sign}${Utils.formatCurrency(mod.amount, settings.currencySymbol)}</td></tr>`;
            });
        } else if (order.tax) {
            // Legacy
            modifiersHtml += `<tr><td>Tax</td><td class="text-right">${Utils.formatCurrency(order.tax, settings.currencySymbol)}</td></tr>`;
        }

        let qrCodeScript = '';
        let qrCodeContainer = '';


        if (settings.receiptQrCodeDataUri) {
            qrCodeContainer = `<div class="text-center py-2"><img src="${settings.receiptQrCodeDataUri}" alt="QR Code" style="width: 128px; height: 128px;"></div>`;
        } else if (settings.receiptShowQrCode && settings.receiptQrCodeUrl) {
            // Fallback (Should be handled by caller now, but keeping for backward compat)
            // const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=128x128&data=${encodeURIComponent(settings.receiptQrCodeUrl)}`;
            // qrCodeContainer = `<div class="text-center py-2"><img src="${qrApiUrl}" alt="QR Code" style="width: 128px; height: 128px;"></div>`;
            // Disable external fallback for offline safety
            qrCodeContainer = '';
        }

        qrCodeScript = `<script>window.onload = function() { setTimeout(() => window.print(), 500); };</script>`;

        return `
            <html>
                <head>
                    <title>Receipt</title>
                    <style>
                        body { font-family: monospace; width: 300px; margin: 0 auto; color: #000; }
                        table { width: 100%; border-collapse: collapse; }
                        .text-center { text-align: center; }
                        .text-right { text-align: right; }
                        .border-top { border-top: 1px dashed #000; }
                        .border-bottom { border-bottom: 1px dashed #000; }
                        .py-2 { padding-top: 10px; padding-bottom: 10px; }
                        .mb-2 { margin-bottom: 10px; }
                    </style>
                </head>
                <body>
                    ${logoHtml}
                    <div class="text-center">
                        <h2>${this.sanitize(storeName)}</h2>
                        ${addressHtml}
                        ${dateHtml}
                        ${settings.receiptHeader ? `<p style="margin-top: 5px; font-size: 0.9em;">${this.sanitize(settings.receiptHeader)}</p>` : ''}
                    </div>
                    <div class="border-bottom"></div>
                    <div class="text-center py-2" style="font-size: 0.9em;">
                        ${order.paymentMethod === 'split' && order.payments ?
                '<strong>Payment Method: Split</strong><br>' +
                order.payments.map(p => `<span>${p.method.toUpperCase()}: ${Utils.formatCurrency(p.amount, settings.currencySymbol)}</span>`).join('<br>')
                :
                `<strong>Payment Method:</strong> ${(order.paymentMethod || 'Cash').toUpperCase()}`
            }
                    </div>
                    <div class="border-bottom"></div>
                    <table>
                        ${itemsHtml}
                    </table>
                    <div class="border-top py-2">
                        <table>
                            <tr><td>Subtotal</td><td class="text-right">${Utils.formatCurrency(order.subtotal, settings.currencySymbol)}</td></tr>
                            ${modifiersHtml}
                            <tr><td style="font-weight: bold;">TOTAL</td><td class="text-right" style="font-weight: bold;">${Utils.formatCurrency(order.total, settings.currencySymbol)}</td></tr>
                        </table>
                    </div>
                    ${qrCodeContainer}
                    <div class="text-center py-2">
                        <p>${this.sanitize(settings.receiptFooter || "Thank you!")}</p>
                    </div>
                    ${qrCodeScript}
                </body>
            </html>
        `;
    },
    // --- Debug / Error Logging ---
    logs: [],

    logError(type, error) {
        const timestamp = new Date().toISOString();
        const msg = typeof error === 'object' ? (error.stack || error.message) : error;
        const entry = `[${timestamp}] [${type}] ${msg}`;
        console.error(entry);
        this.logs.push(entry);
        try { sessionStorage.setItem('pos_debug_logs', JSON.stringify(this.logs)); } catch (e) { }
    },

    downloadDebugReport() {
        const report = ["POS System Debug Report", "=======================", ...this.logs].join('\n');
        const blob = new Blob([report], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `debug_report_${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        this.showToast("Debug Report Downloaded");
    },

    // --- UI Helpers ---
    confirm(title, message) {
        return new Promise((resolve) => {
            const modal = document.getElementById('confirm-modal');
            const titleEl = document.getElementById('confirm-title');
            const msgEl = document.getElementById('confirm-message');
            const okBtn = document.getElementById('confirm-ok-btn');
            const cancelBtn = document.getElementById('confirm-cancel-btn');

            if (!modal) {
                // Fallback if modal missing
                resolve(window.confirm(`${title}\n\n${message}`));
                return;
            }

            titleEl.textContent = title;
            msgEl.textContent = message;
            modal.classList.remove('hidden');

            // Clone buttons to remove old listeners
            const newOk = okBtn.cloneNode(true);
            const newCancel = cancelBtn.cloneNode(true);
            okBtn.parentNode.replaceChild(newOk, okBtn);
            cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

            newOk.addEventListener('click', () => {
                modal.classList.add('hidden');
                resolve(true);
            });

            newCancel.addEventListener('click', () => {
                modal.classList.add('hidden');
                resolve(false);
            });
        });
    },

    showLoading() {
        const el = document.getElementById('loading-overlay');
        if (el) el.classList.remove('hidden');
    },

    hideLoading() {
        const el = document.getElementById('loading-overlay');
        if (el) el.classList.add('hidden');
    },

    showFormError(input, message) {
        if (!input) return;
        // Remove existing error
        this.removeFormError(input);

        input.classList.add('border-red-500', 'focus:ring-red-500');
        input.classList.remove('border-gray-300', 'focus:ring-blue-500');

        const errorMsg = document.createElement('p');
        errorMsg.className = "text-red-500 text-xs mt-1 form-error-msg";
        errorMsg.textContent = message;
        input.parentNode.appendChild(errorMsg);
    },

    removeFormError(input) {
        if (!input) return;
        input.classList.remove('border-red-500', 'focus:ring-red-500');
        const next = input.nextElementSibling;
        if (next && next.classList.contains('form-error-msg')) {
            next.remove();
        }
    },

    clearFormErrors(form) {
        if (!form) return;
        const inputs = form.querySelectorAll('.border-red-500');
        inputs.forEach(input => this.removeFormError(input));
    },

    // CSV Export Utility
    exportToCSV(filename, headers, dataRows) {
        // Construct CSV string
        let csvContent = headers.map(h => `"${h.replace(/"/g, '""')}"`).join(",") + "\n";

        dataRows.forEach(row => {
            const rowString = row.map(cell => {
                const cellStr = cell !== null && cell !== undefined ? String(cell) : "";
                // Escape quotes
                return `"${cellStr.replace(/"/g, '""')}"`;
            }).join(",");
            csvContent += rowString + "\n";
        });

        // Create Blob and download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", filename.endsWith('.csv') ? filename : filename + '.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};

// Global Error Listeners
window.addEventListener('error', (event) => {
    window.Utils.logError('Uncaught Exception', event.error || event.message);
});

window.addEventListener('unhandledrejection', (event) => {
    window.Utils.logError('Unhandled Rejection', event.reason);
});

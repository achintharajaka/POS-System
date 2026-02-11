// Utils (Global)
// Depends on: constants.js

window.Utils = {
    formatCurrency(amount, symbol = "$") {
        return `${symbol}${parseFloat(amount).toFixed(2)}`;
    },

    formatDate(timestamp) {
        return new Date(timestamp).toLocaleString();
    },

    // Input Sanitization
    sanitize(str) {
        if (!str) return '';
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
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

        if (settings.receiptShowQrCode && settings.receiptQrCodeUrl) {
            const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=128x128&data=${encodeURIComponent(settings.receiptQrCodeUrl)}`;
            qrCodeContainer = `<div class="text-center py-2"><img src="${qrApiUrl}" alt="QR Code" style="width: 128px; height: 128px;"></div>`;
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
                        <strong>Payment Method:</strong> ${(order.paymentMethod || 'Cash').toUpperCase()}
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
    }
};

// Global Error Listeners
window.addEventListener('error', (event) => {
    window.Utils.logError('Uncaught Exception', event.error || event.message);
});

window.addEventListener('unhandledrejection', (event) => {
    window.Utils.logError('Unhandled Rejection', event.reason);
});

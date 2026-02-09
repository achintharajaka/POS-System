// utils.js - Formatting and Helpers

const Utils = {
    formatCurrency(amount, symbol = "$") {
        return `${symbol}${parseFloat(amount).toFixed(2)}`;
    },

    formatDate(timestamp) {
        return new Date(timestamp).toLocaleString();
    },

    showToast(message, type = "success") {
        const container = document.getElementById("toast-container");
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

    generateReceipt(storeName, address, order, settings) {
        // Simple HTML string generation for receipt
        const date = new Date(order.timestamp).toLocaleString();
        let itemsHtml = order.items.map(item => `
            <tr>
                <td style="padding: 5px 0;">${item.name} <br> <span style="font-size: 0.8em; color: #666;">${item.qty} x ${Utils.formatCurrency(item.price, settings.currencySymbol)}</span></td>
                <td style="text-align: right; vertical-align: top; padding: 5px 0;">${Utils.formatCurrency(item.price * item.qty, settings.currencySymbol)}</td>
            </tr>
        `).join('');

        return `
            <html>
                <head>
                    <title>Receipt</title>
                    <style>
                        body { font-family: monospace; width: 300px; margin: 0 auto; }
                        table { width: 100%; border-collapse: collapse; }
                        .text-center { text-align: center; }
                        .text-right { text-align: right; }
                        .border-top { border-top: 1px dashed #000; }
                        .border-bottom { border-bottom: 1px dashed #000; }
                        .py-2 { padding-top: 10px; padding-bottom: 10px; }
                    </style>
                </head>
                <body>
                    <div class="text-center">
                        <h2>${storeName}</h2>
                        <p>${address}</p>
                        <p>${date}</p>
                    </div>
                    <div class="border-bottom"></div>
                    <table>
                        ${itemsHtml}
                    </table>
                    <div class="border-top py-2">
                        <table>
                            <tr><td>Subtotal</td><td class="text-right">${Utils.formatCurrency(order.subtotal, settings.currencySymbol)}</td></tr>
                            <tr><td>Tax (${settings.taxRate}%)</td><td class="text-right">${Utils.formatCurrency(order.tax, settings.currencySymbol)}</td></tr>
                            <tr><td style="font-weight: bold;">TOTAL</td><td class="text-right" style="font-weight: bold;">${Utils.formatCurrency(order.total, settings.currencySymbol)}</td></tr>
                        </table>
                    </div>
                    <div class="text-center py-2">
                        <p>${settings.receiptFooter || "Thank you!"}</p>
                    </div>
                    <script>window.print();</script>
                </body>
            </html>
        `;
    }
};

// AI Module - Gemini Integration
window.AI = {
    state: {
        isAiChatOpen: false,
        chatHistory: []
    },

    initAI() {
        console.log("AI module initialized.");
        const aiModal = document.getElementById("ai-chat-modal");
        const aiCloseBtn = document.getElementById("ai-close-btn");
        const aiOpenBtn = document.getElementById("ai-open-btn");
        const aiSubmitBtn = document.getElementById("ai-submit-btn");
        const aiInput = document.getElementById("ai-chat-input");

        if (aiCloseBtn) {
            aiCloseBtn.addEventListener("click", () => this.toggleAIChat(false));
        }
        if (aiOpenBtn) {
            aiOpenBtn.addEventListener("click", () => this.toggleAIChat(true));
        }

        if (aiSubmitBtn && aiInput) {
            const handleSubmit = () => {
                const text = aiInput.value.trim();
                if (text) {
                    this.askGemini(text);
                    aiInput.value = "";
                }
            };

            aiSubmitBtn.addEventListener("click", handleSubmit);
            aiInput.addEventListener("keypress", (e) => {
                if (e.key === "Enter") handleSubmit();
            });
        }
    },

    toggleAIChat(show) {
        this.state.isAiChatOpen = arguments.length > 0 ? show : !this.state.isAiChatOpen;
        const modal = document.getElementById("ai-chat-modal");
        if (modal) {
            if (this.state.isAiChatOpen) {
                modal.classList.remove("translate-y-full", "opacity-0", "pointer-events-none");
                modal.classList.add("translate-y-0", "opacity-100");
                setTimeout(() => document.getElementById("ai-chat-input")?.focus(), 300);
            } else {
                modal.classList.add("translate-y-full", "opacity-0", "pointer-events-none");
                modal.classList.remove("translate-y-0", "opacity-100");
            }
        }
    },

    appendMessage(role, text) {
        const container = document.getElementById("ai-chat-messages");
        if (!container) return;

        const wrapper = document.createElement("div");
        wrapper.className = "flex w-full mb-4 " + (role === "user" ? "justify-end" : "justify-start");

        const bubble = document.createElement("div");
        const roleClass = role === "user" 
            ? "bg-blue-600 text-white rounded-br-none" 
            : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-none";
        
        bubble.className = "max-w-[80%] rounded-xl p-3 text-sm " + roleClass;
        
        // Simple markdown parsing for bold text
        const formattedText = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
        bubble.innerHTML = formattedText.replace(/\n/g, "<br/>");

        wrapper.appendChild(bubble);
        container.appendChild(wrapper);
        container.scrollTop = container.scrollHeight;

        if (role !== "system" && text !== "Thinking...") {
            this.state.chatHistory.push({ role, parts: [{ text }] });
        }
    },

    async askGemini(question) {
        // 1. Get API Key
        const apiKey = this.state.settings.geminiApiKey;
        if (!apiKey) {
            this.appendMessage("user", question);
            this.appendMessage("model", "Please set your Gemini Studio API Key in the Settings view first.");
            return;
        }

        this.appendMessage("user", question);
        this.appendMessage("model", "Thinking..."); // Temporary loading message

        // 2. Fetch context
        try {
            const today = new Date();
            today.setHours(0,0,0,0);
            
            const settings = this.state.settings;
            const storeName = settings.storeName || "My POS Store";
            
            // Promise.all to fetch deep context efficiently
            const [
                allProducts, 
                allCategories, 
                salesToday, 
                allExpenses, 
                allCustomers,
                allUsers
            ] = await Promise.all([
                window.DB.getProducts(),
                window.DB.getCategories(),
                window.DB.getOrdersSince(today.getTime()),
                window.DB.getExpenses(),
                window.DB.getCustomers ? window.DB.getCustomers() : Promise.resolve([]),
                window.DB.getUsers ? window.DB.getUsers() : Promise.resolve([])
            ]);
            
            const lowStockProducts = allProducts.filter(p => p.stock < (p.lowStockThreshold || 5));
            const totalSalesToday = salesToday.reduce((sum, order) => sum + order.total, 0);

            const systemFeatures = [
               "POS Terminal checkout", "Inventory Management", "Categories", 
               "Reporting (Sales/Profit)", "Customer CRM & Loyalty", 
               "Shift Tracking", "Multi-Store & Google Drive Sync"
            ].join(", ");

            const currencySymbol = settings.currencySymbol || "$";
            
            const systemPrompt = `You are the AI assistant inside a Point of Sale (POS) system named "${storeName}". 
You have COMPLETE access to the store's latest local database snapshot. You MUST answer the user's questions based strictly on this provided data.
You can answer questions regarding sales, products, stock levels, expenses, customer loyalty, staff, and system functionality. 

=== SYSTEM CAPABILITIES ===
Features available: ${systemFeatures}

=== METRICS & SETTINGS ===
Currency: ${currencySymbol}
Loyalty Program: ${settings.loyaltyEnabled ? 'Yes' : 'No'}
Today's Total Sales: ${currencySymbol}${totalSalesToday.toFixed(2)} (${salesToday.length} orders today)
Total Products: ${allProducts.length} (Low Stock: ${lowStockProducts.length})
Total Customers registered: ${allCustomers.length}
Total Staff Users: ${allUsers.length}

=== STORE DATABASE EXTRACT (JSON) ===
Products List (ID, Name, Stock, Price): ${JSON.stringify(allProducts.map(p => ({id: p.id, name: p.name, stock: p.stock, price: p.price})))}
Categories: ${JSON.stringify(allCategories.map(c => c.name))}
Low Stock Items: ${JSON.stringify(lowStockProducts.map(p => p.name))}
Top 10 Customers: ${JSON.stringify(allCustomers.slice(0, 10).map(c=> ({name: c.name, points: c.points, spent: c.totalSpent})))}
Staff Users: ${JSON.stringify(allUsers.map(u => ({name: u.name, role: u.role, active: u.active})))}
Order Modifiers: ${JSON.stringify(settings.orderModifiers || [])}

INSTRUCTIONS: 
- Answer the user's internal queries concisely.
- Do NOT hallucinate data. If you don't know, state it clearly.
- If asked "what can you do?" summarize the data you have.
- If they ask about "how" to do something (e.g., how to sync), infer based on standard UI features in the Capabilities list.`;

            // Prepare Gemini Request
            const payload = {
                system_instruction: {
                    parts: [{ text: systemPrompt }]
                },
                contents: this.state.chatHistory
            };

            // Remove the "Thinking..." message from UI before adding the real response
            const container = document.getElementById("ai-chat-messages");
            if (container && container.lastChild) {
                container.lastChild.remove();
            }

            const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey;
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error("HTTP error " + response.status);
            }

            const data = await response.json();
            const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response received.";
            this.appendMessage("model", reply);

        } catch (error) {
            console.error(error);
            const container = document.getElementById("ai-chat-messages");
            if (container && container.lastChild) {
                container.lastChild.remove(); // Remove thinking message
            }
            this.appendMessage("model", "Error fetching response: " + error.message);
        }
    }
};

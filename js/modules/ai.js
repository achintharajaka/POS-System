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
            
            // Get data snippets
            const salesToday = await DB.getOrdersSince(today.getTime());
            const totalSales = salesToday.reduce((sum, order) => sum + order.total, 0);
            const lowStockCount = await DB.getLowStockCount();
            
            // Fetch top 10 low stock items
            const products = await DB.getProducts(null, null, "", true); // true = lowStock filter
            const lowStockText = products.slice(0, 10).map(p => p.name + ": " + p.stock + " left").join(", ");

            const currencySymbol = this.state.settings.currencySymbol || "$";
            const systemPrompt = "You are an AI assistant for a POS (Point of Sale) system.\n" +
                "Here is the current system context:\n" +
                "- Today's Total Sales: " + currencySymbol + totalSales.toFixed(2) + " from " + salesToday.length + " orders\n" +
                "- Low Stock Items Count: " + lowStockCount + "\n" +
                "- Top Low Stock Items: " + (lowStockText || "None") + "\n\n" +
                "Please answer the user's question concisely based on this data. Do not invent data that is not provided.";

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

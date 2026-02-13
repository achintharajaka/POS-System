const I18n = {
    defaultLang: 'en',
    currentLang: 'en',
    translations: {},

    load() {
        // Init translations from window objects loaded via script tags
        this.translations['en'] = window.lang_en || {};
        this.translations['si'] = window.lang_si || {};
        this.translations['ta'] = window.lang_ta || {};

        // Load saved language
        const saved = localStorage.getItem('pos_lang');
        if (saved && this.translations[saved]) {
            this.currentLang = saved;
        } else {
            this.currentLang = this.defaultLang;
        }

        console.log(`I18n loaded. Language: ${this.currentLang}`);
        this.apply();
    },

    setLanguage(lang) {
        if (this.translations[lang]) {
            this.currentLang = lang;
            localStorage.setItem('pos_lang', lang);
            this.apply();
            return true;
        }
        return false;
    },

    t(key) {
        const dict = this.translations[this.currentLang];
        return dict && dict[key] ? dict[key] : key;
    },

    apply() {
        // Find all elements with data-i18n attribute
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(el => {
            const key = el.getAttribute('data-i18n');
            const text = this.t(key);

            // Handle placeholders if needed in future
            if (el.tagName === 'INPUT' && el.type === 'text') {
                el.placeholder = text;
            } else {
                el.innerText = text;
            }
        });

        // Update HTML lang attribute
        document.documentElement.lang = this.currentLang;

        // Trigger event for other modules to re-render if needed
        window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang: this.currentLang } }));
    }
};

// Expose globally
window.I18n = I18n;

import { logger } from './logger.js';
import translations from './translations.js';
import { state } from './state.js';
import { API_URL } from '../config.js';
import { showNotification } from './ui-utils.js';

function getAuthHeaders() {
    const token = state.token || localStorage.getItem('accessToken');
    return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : {};
}

export const AdminTranslationsManager = {
    items: [],
    searchQuery: '',
    currentPage: 1,
    totalItems: 0,
    pendingEdits: {},

    async show() {
        const dashboardGrid = document.querySelector('.dashboard-grid');
        const existing = document.getElementById('adminTranslationsPanel');
        if (existing) existing.remove();

        document.querySelectorAll('.dashboard-controls, .stats-cards, .charts-grid, .quick-actions-card, .recent-orders-card')
            .forEach(el => el.style.display = 'none');

        const panel = document.createElement('div');
        panel.id = 'adminTranslationsPanel';
        panel.className = 'admin-orders-panel';
        dashboardGrid.appendChild(panel);

        await this.render();
    },

    hide() {
        const panel = document.getElementById('adminTranslationsPanel');
        if (panel) panel.remove();
        document.querySelectorAll('.dashboard-controls, .stats-cards, .charts-grid, .quick-actions-card, .recent-orders-card')
            .forEach(el => el.style.display = '');
    },

    async render() {
        const panel = document.getElementById('adminTranslationsPanel');
        if (!panel) return;
        const getT = (k) => translations[state.currentLanguage]?.[k] || translations.en[k] || k;

        panel.innerHTML = `
            <div class="admin-orders-header">
                <div>
                    <h2>${getT('translations') || 'Translations'}</h2>
                    <p>${getT('translationsDesc') || 'Manage multi-language content for your store'}</p>
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap">
                    <button class="btn btn-primary btn-sm" onclick="AdminTranslationsManager.saveAll()">
                        💾 ${getT('saveAll') || 'Save All'}
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="AdminTranslationsManager.goBack()">
                        ← ${getT('backToDashboard') || 'Back to Dashboard'}
                    </button>
                </div>
            </div>
            <div style="margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                <input id="translationSearch" type="text" placeholder="${getT('searchTranslations') || 'Search by key...'}" value="${this.searchQuery}" style="padding:6px 10px;border:1px solid #ccc;border-radius:4px;flex:1;min-width:200px">
                <button class="btn btn-secondary btn-sm" onclick="AdminTranslationsManager.search()">${getT('search') || 'Search'}</button>
                <span style="color:#666;font-size:13px">${this.totalItems} ${getT('keys') || 'keys'}</span>
            </div>
            <div id="adminTranslationList">
                <div class="loading-cell">${getT('loading') || 'Loading...'}</div>
            </div>
            <div id="adminTranslationPagination" style="margin-top:12px;display:flex;gap:8px;justify-content:center"></div>
        `;

        document.getElementById('translationSearch')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.search();
        });

        await this.fetchList();
    },

    async search() {
        this.searchQuery = document.getElementById('translationSearch')?.value || '';
        this.currentPage = 1;
        await this.fetchList();
    },

    async fetchList() {
        const container = document.getElementById('adminTranslationList');
        const pagination = document.getElementById('adminTranslationPagination');
        if (!container) return;
        const getT = (k) => translations[state.currentLanguage]?.[k] || translations.en[k] || k;

        try {
            let url = `${API_URL}/admin/translations/?page=${this.currentPage}`;
            if (this.searchQuery) url += `&search=${encodeURIComponent(this.searchQuery)}`;

            const resp = await fetch(url, { headers: getAuthHeaders() });
            if (!resp.ok) throw new Error(`API error: ${resp.status}`);
            const data = await resp.json();
            this.items = data.translations;
            this.totalItems = data.total;

            container.innerHTML = `
                <div class="admin-orders-table-wrap" style="margin-top:4px;">
                    <table class="admin-orders-table">
                        <thead>
                            <tr>
                                <th style="width:25%">${getT('key') || 'Key'}</th>
                                <th style="width:25%">EN</th>
                                <th style="width:25%">FR</th>
                                <th style="width:25%">AR</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.items.map(t => `
                                <tr>
                                    <td><code style="font-size:12px;word-break:break-all">${t.key}</code></td>
                                    <td><input class="translation-input" data-key="${t.key}" data-lang="en" value="${this.escapeAttr(t.en)}" style="width:100%;padding:4px 6px;border:1px solid #ddd;border-radius:3px;font-size:13px"></td>
                                    <td><input class="translation-input" data-key="${t.key}" data-lang="fr" value="${this.escapeAttr(t.fr)}" style="width:100%;padding:4px 6px;border:1px solid #ddd;border-radius:3px;font-size:13px"></td>
                                    <td><input class="translation-input" data-key="${t.key}" data-lang="ar" value="${this.escapeAttr(t.ar)}" style="width:100%;padding:4px 6px;border:1px solid #ddd;border-radius:3px;font-size:13px;direction:rtl"></td>
                                </tr>
                            `).join('')}
                            ${this.items.length === 0 ? '<tr><td colspan="4" class="empty-cell">' + (getT('noResults') || 'No translations found.') + '</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            `;

            const totalPages = Math.ceil(this.totalItems / 50);
            if (totalPages > 1) {
                let phtml = '';
                for (let p = 1; p <= totalPages; p++) {
                    phtml += `<button class="btn ${p === this.currentPage ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="AdminTranslationsManager.goPage(${p})">${p}</button>`;
                }
                pagination.innerHTML = phtml;
            } else {
                pagination.innerHTML = '';
            }
        } catch (err) {
            logger.error('Failed to fetch translations:', err);
            container.innerHTML = `<div class="error-cell">${getT('loadError') || 'Failed to load translations.'}</div>`;
        }
    },

    goPage(page) {
        this.currentPage = page;
        this.fetchList();
    },

    escapeAttr(str) {
        return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },

    async saveAll() {
        const inputs = document.querySelectorAll('.translation-input');
        const updates = {};
        inputs.forEach(inp => {
            const key = inp.dataset.key;
            const lang = inp.dataset.lang;
            if (!updates[key]) updates[key] = {};
            updates[key][lang] = inp.value;
        });

        let success = 0;
        let failed = 0;
        const keys = Object.keys(updates);

        for (const key of keys) {
            try {
                const resp = await fetch(`${API_URL}/admin/translations/${encodeURIComponent(key)}/`, {
                    method: 'PATCH',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(updates[key])
                });
                if (resp.ok) success++;
                else failed++;
            } catch {
                failed++;
            }
        }

        if (failed === 0) {
            showNotification(`Saved ${success} translation${success !== 1 ? 's' : ''}.`, 'success');
        } else {
            showNotification(`Saved ${success}, failed ${failed}.`, 'error');
        }
    },

    goBack() {
        this.hide();
    }
};

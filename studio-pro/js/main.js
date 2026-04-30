function initEventListeners() {
    const safeBind = (id, event, handler) => {
        const el = document.getElementById(id);
        if (el) el[event] = handler;
    };

    // --- 1. PRIORITY: Global Keyboard Shortcuts (Registered first to avoid init crashes) ---
    // Using capture: true to ensure shortcuts are handled before deep element propagation
    document.addEventListener('keydown', (e) => {
        const isCmdOrCtrl = e.metaKey || e.ctrlKey;
        const key = e.key;

        // A. Navigation Shortcuts (Cmd/Ctrl + 1-3)
        if (isCmdOrCtrl && ['1', '2', '3'].includes(key)) {
            e.preventDefault();
            e.stopPropagation();
            console.log(`>> Navigation Shortcut Detected: Cmd/Ctrl + ${key}`);
            if (key === '1') window.switchToTab('customers');
            if (key === '2') window.switchToTab('projects');
            if (key === '3') window.switchToTab('tasks');
            return;
        }

        // B. Global Save Shortcut (Cmd/Ctrl + S)
        if (isCmdOrCtrl && key.toLowerCase() === 's') {
            const activeView = document.querySelector('.sub-view-stack.active, .admin-sub-tab.active, .tab-content.active');
            if (!activeView) return;

            // Define mapping of view IDs to their respective save functions and required permission keys
            const saveMap = [
                { id: 'projectsEditView', perm: ['proj_c', 'proj_u'], fn: () => window.handleQuotationSubmit(null, false) },
                { id: 'customersEditView', perm: ['cust_c', 'cust_u'], fn: () => window.saveCustomer() },
                { id: 'bankSettingsView', perm: ['set_u'], fn: () => window.handleGlobalSettingsSubmit(new Event('submit')) },
                { id: 'workflowSettingsView', perm: ['set_u'], fn: () => window.handleGlobalSettingsSubmit(new Event('submit')) },
                { id: 'permissionsMatrixView', perm: ['perm_m'], fn: () => window.saveRolePermissions() }
            ];

            // Check if current active view matches a saveable view and has permission
            for (const item of saveMap) {
                const el = document.getElementById(item.id);
                if (el && el.classList.contains('active')) {
                    e.preventDefault();
                    e.stopPropagation();

                    // Permission Guard
                    const hasPerm = item.perm.some(p => typeof window.hasPermission === 'function' && window.hasPermission(p));
                    if (!hasPerm) {
                        console.warn(`>> Permission Denied: Cannot save ${item.id} via shortcut.`);
                        return;
                    }

                    console.log(`>> Global Shortcut Detected: Cmd/Ctrl + S (Saving ${item.id})`);
                    item.fn();
                    return;
                }
            }
        }

        // C. Escape Key (Clear Search or Close Modals/Views)
        if (key === 'Escape') {
            // 1. Priority: Clear active search input
            const activeEl = document.activeElement;
            if (activeEl && activeEl.classList.contains('card-search-input')) {
                console.log(">> ESC: Clearing search input");
                activeEl.value = '';
                const tabId = activeEl.id.replace('SearchInput', '');
                // Trigger relevant filter
                if (tabId === 'customer' && typeof window.filterCustomers === 'function') window.filterCustomers('');
                if (tabId === 'project' && typeof window.filterProjects === 'function') window.filterProjects('');
                activeEl.blur();
                return;
            }

            if (document.querySelector('.swal2-container')) {
                console.log(">> ESC: Swal detected, letting library handle it.");
                return; 
            }

            const activeModals = document.querySelectorAll('.modal-overlay.active');
            if (activeModals.length > 0) {
                console.log(">> ESC: Closing active modals");
                activeModals.forEach(m => m.classList.remove('active'));
                return;
            }

            const activeEditViews = document.querySelectorAll('.sub-view-stack.active[id*="EditView"]');
            if (activeEditViews.length > 0) {
                activeEditViews.forEach(ev => {
                    const tabId = ev.id.replace('EditView', '').replace('ListView', '');
                    console.log(`>> ESC: Returning to list for ${tabId}`);
                    if (typeof window.switchSubView === 'function') {
                        window.switchSubView(tabId, 'list');
                    }
                });
                return;
            }

            const activeTab = document.querySelector('.tab-link.active');
            if (activeTab) {
                const tabId = activeTab.dataset.tab;
                const editView = document.getElementById(`${tabId}EditView`);
                if (editView && editView.classList.contains('active')) {
                    console.log(`>> ESC Fallback: Closing edit view for current tab ${tabId}`);
                    if (typeof window.switchSubView === 'function') {
                        window.switchSubView(tabId, 'list');
                    }
                }
            }
        }

        // D. Pagination Navigation (ArrowLeft / ArrowRight)
        if (key === 'ArrowLeft' || key === 'ArrowRight') {
            const activeSubView = document.querySelector('.sub-view-stack.active');
            if (!activeSubView || !activeSubView.id.endsWith('ListView')) return;

            // Ignore if typing in an input, textarea or select
            const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
            if (isTyping) return;

            e.preventDefault();
            const dir = (key === 'ArrowRight') ? 1 : -1;
            console.log(`>> Pagination Shortcut: ${key} (${dir})`);
            if (typeof window.changePage === 'function') window.changePage(dir);
        }
    }, true);

    // --- 2. PRIORITY: Global Click-Outside Listener ---
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            console.log(">> Click: Closing modal overlay");
            e.target.classList.remove('active');
            return;
        }

        // --- ENHANCED: Precise Background Closing ---
        // Restricted per user request: Quotation/Project editor should NOT close on outside click.
        // Only other views (like Customers) will maintain this behavior for now.
        const activeStack = document.querySelector('.sub-view-stack.active');
        if (activeStack && activeStack.id.includes('EditView')) {
            // CRITICAL: Skip if it's the projects or customers editor
            if (activeStack.id === 'projectsEditView' || activeStack.id === 'customersEditView') return;

            const isRootBackground = (e.target === activeStack) || 
                                     (e.target.classList.contains('card-wrapper')) ||
                                     (e.target.classList.contains('sub-view-stack'));

            if (isRootBackground) {
                const tabId = activeStack.id.replace('EditView', '').replace('ListView', '');
                console.log(">> Clicked Background: returning to list for tab:", tabId);
                if (typeof window.switchSubView === 'function') {
                    window.switchSubView(tabId, 'list');
                }
            }
        }
    });

    // --- 3. Normal Event Bindings ---
    safeBind('loginForm', 'onsubmit', window.handleLogin);
    safeBind('registerForm', 'onsubmit', window.handleRegister);

    const regUserInput = document.getElementById('regUser');
    const regEmailInput = document.getElementById('regEmail');
    if (regUserInput) regUserInput.onblur = () => window.checkAvailability('username', regUserInput.value);
    if (regEmailInput) regEmailInput.onblur = () => window.checkAvailability('email', regEmailInput.value);

    safeBind('verifyForm', 'onsubmit', window.handleVerify);
    safeBind('logoutBtn', 'onclick', window.logout);
    safeBind('bindLineBtn', 'onclick', window.startLiffBinding);
    safeBind('lineLoginBtn', 'onclick', window.loginViaLine);
    safeBind('googleLoginBtn', 'onclick', window.loginViaGoogle);
    safeBind('bindGoogleBtn', 'onclick', window.bindGoogle);

    const socialToggle = document.getElementById('socialToggle');
    if (socialToggle) {
        socialToggle.onclick = () => {
            const options = document.getElementById('socialOptions');
            if (options) {
                const isCurrentlyHidden = window.getComputedStyle(options).display === 'none';
                options.style.display = isCurrentlyHidden ? 'flex' : 'none';
            }
        };
    }

    safeBind('addCustomerBtn', 'onclick', () => showCustomerEditor('新增客戶資料'));
    safeBind('addProjectBtn', 'onclick', () => showQuotationEditor('建立新報價單'));
    safeBind('addTaskBtn', 'onclick', () => window.addTaskInline());
    const custForm = document.getElementById('customerForm');
    if (custForm) {
        custForm.onsubmit = (e) => { e.preventDefault(); window.saveCustomer(); };
        // Track changes
        custForm.addEventListener('input', () => {
            window.isCustomerModified = true;
        });
    }

    safeBind('userInfoTrigger', 'onclick', window.openProfileModal);
    safeBind('profileForm', 'onsubmit', window.handleProfileUpdateSubmit);
    safeBind('memberForm', 'onsubmit', window.handleMemberUpdateSubmit);
    safeBind('globalSettingsForm', 'onsubmit', window.handleSettingsSubmit);
    const qForm = document.getElementById('quotationForm');
    if (qForm) {
        qForm.onsubmit = (e) => { e.preventDefault(); window.handleQuotationSubmit(e); };
        qForm.addEventListener('input', () => {
            window.isQuotationModified = true;
        });
    }

    // Component-specific inits wrapped in safety checks
    if (typeof window.initQuotationAutocomplete === 'function') {
        console.log(">> [INIT] Binding Quotation Autocomplete...");
        window.initQuotationAutocomplete();
    } else {
        console.warn(">> [INIT WARNING] initQuotationAutocomplete not found in projects.js");
    }

    const customerSearch = document.getElementById('customerSearchInput');
    if (customerSearch) {
        customerSearch.oninput = (e) => {
            if (typeof window.filterCustomers === 'function') window.filterCustomers(e.target.value);
        };
        customerSearch.onkeydown = (e) => {
            if (e.key === 'Escape') {
                customerSearch.value = '';
                if (typeof window.filterCustomers === 'function') window.filterCustomers('');
                customerSearch.blur();
            }
        };
    }

    const projectSearch = document.getElementById('projectSearchInput');
    if (projectSearch) {
        projectSearch.oninput = (e) => {
            if (typeof window.filterProjects === 'function') window.filterProjects(e.target.value);
        };
        projectSearch.onkeydown = (e) => {
            if (e.key === 'Escape') {
                projectSearch.value = '';
                if (typeof window.filterProjects === 'function') window.filterProjects('');
                projectSearch.blur();
            }
        };
    }

    // --- Browser Navigation Guard ---
    window.onbeforeunload = function() {
        if (window.isQuotationModified || window.isCustomerModified) {
            return "內容已修改，確定要離開嗎？";
        }
    };

    // Profile Modal outside-click
    const pModal = document.getElementById('profileModal');
    if (pModal) {
        pModal.onclick = (e) => {
            if (e.target === pModal) closeProfileModal();
        };
    }

    safeBind('forgotForm', 'onsubmit', window.handleForgotSubmit);

    // Customer Pagination
    const itemsInput = document.getElementById('itemsPerPageInput');
    if (itemsInput) {
        itemsInput.value = window.itemsPerPage;
        itemsInput.oninput = (e) => {
            const val = parseInt(e.target.value) || 7;
            window.itemsPerPage = val;
            localStorage.setItem('st_pro_items_per_page', window.itemsPerPage);
            window.currentPage = 1;
            window.renderCustomers();
        };
        itemsInput.onwheel = (e) => {
            e.preventDefault();
            let val = parseInt(itemsInput.value) || 7;
            if (e.deltaY < 0) val += 5; else val -= 5;
            if (val < 1) val = 1;
            if (val > 200) val = 200;
            itemsInput.value = val;
            window.itemsPerPage = val;
            localStorage.setItem('st_pro_items_per_page', window.itemsPerPage);
            window.currentPage = 1;
            window.renderCustomers();
        };
    }

    // Project Pagination
    const projItemsInput = document.getElementById('projItemsPerPageInput');
    if (projItemsInput) {
        projItemsInput.value = window.projectItemsPerPage;
        projItemsInput.oninput = (e) => {
            const val = parseInt(e.target.value) || 7;
            window.projectItemsPerPage = val;
            localStorage.setItem('st_pro_project_items_per_page', window.projectItemsPerPage);
            window.projectPage = 1;
            window.renderProjects();
        };
        projItemsInput.onwheel = (e) => {
            e.preventDefault();
            let val = parseInt(projItemsInput.value) || 7;
            if (e.deltaY < 0) val += 5; else val -= 5;
            if (val < 1) val = 1;
            if (val > 200) val = 200;
            projItemsInput.value = val;
            window.projectItemsPerPage = val;
            localStorage.setItem('st_pro_project_items_per_page', window.projectItemsPerPage);
            window.projectPage = 1;
            window.renderProjects();
        };
    }

    safeBind('prevPageBtn', 'onclick', () => window.changePage(-1));
    safeBind('nextPageBtn', 'onclick', () => window.changePage(1));
    safeBind('projPrevPageBtn', 'onclick', () => window.changePage(-1));
    safeBind('projNextPageBtn', 'onclick', () => window.changePage(1));



    // Password Visibility Logic
    document.querySelectorAll('.password-wrapper').forEach(wrapper => {
        const input = wrapper.querySelector('input');
        const toggle = wrapper.querySelector('.toggle-password');
        if (input && toggle) {
            if (input.value.length > 0) toggle.classList.add('visible');
            input.addEventListener('input', () => {
                if (input.value.length > 0) toggle.classList.add('visible');
                else toggle.classList.remove('visible');
            });
        }
    });
}

// Icon Cache to prevent redundant fetches
const iconCache = new Map();

// Custom SVG Loader for Studio Pro Branding Icons
window.replaceIcons = async function () {
    const icons = document.querySelectorAll('[data-lucide]');
    const nameMapping = {
        'trash-2': 'trash',
        'trash': 'trash',
        'check': 'checked',
        'square-check': 'checked',
        'square': 'unchecked',
        'x': 'close',
        'eye-off': 'eye off',
        'eye': 'eye',
        'grip-vertical': 'drag',
        'drag': 'drag',
        'plus': 'plus',
        'pencil': 'pencil',
        'google': 'Google',
        'line': 'LINE',
        'search': 'search',
        'settings': 'settings',
        'credit-card': 'account',
        'file-text': 'process',
        'star': 'star',
        'users': 'users',
        'layers': 'projects',
        'briefcase': 'projects',
        'projects': 'projects',
        'list-todo': 'tasks',
        'tasks': 'tasks',
        'calendar': 'calendar',
        'clock': 'clock',
        'printer': 'printer',
        'circle-slash': 'unbound',
        'bound': 'bound',
        'unbound': 'unbound'
    };

    for (const icon of icons) {
        // Skip elements that were already successfully replaced (now they are SVG containers)
        if (icon.getAttribute('data-brand-loaded') === 'true') continue;

        let name = icon.getAttribute('data-lucide');
        if (!name) continue;

        const mappedName = nameMapping[name] || name;
        const iconPath = `assets/icons/${mappedName}.svg`;

        try {
            let svgText;
            if (iconCache.has(mappedName)) {
                svgText = iconCache.get(mappedName);
            } else {
                const response = await fetch(iconPath);
                if (response.ok) {
                    svgText = await response.text();
                    iconCache.set(mappedName, svgText);
                }
            }

            if (svgText) {
                // Non-destructive replacement: keeps original element but replaces its content
                // Or: keep data-lucide and add a marker
                icon.innerHTML = svgText;
                icon.style.display = 'inline-flex';
                icon.style.alignItems = 'center';
                icon.style.justifyContent = 'center';
                icon.style.width = icon.style.width || '18px';
                icon.style.height = icon.style.height || '18px';
                icon.setAttribute('data-brand-loaded', 'true');

                const svgEl = icon.querySelector('svg');
                if (svgEl) {
                    svgEl.style.width = '100%';
                    svgEl.style.height = '100%';
                    svgEl.style.display = 'block';
                }
            } else {
                // Fallback to Lucide
                if (window.lucide) lucide.createIcons();
            }
        } catch (err) {
            console.error(`Error loading icon ${name}:`, err);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    console.log(">> System Init: v1.9 Release Starting...");
    try { initEventListeners(); } catch (e) { console.error("Event Init Error:", e); }
    try { initTabs(); } catch (e) { console.error("Tab Init Error:", e); }

    // Initial Icon Replacement
    window.replaceIcons();

    const initApp = async () => {
        setSyncStatus(true);
        const hasLiffParams = window.location.search.includes('liffClientId') || window.location.search.includes('code') || window.location.search.includes('liff.state');

        if (hasLiffParams) {
            console.log(">> LINE Redirect detected, awaiting processing...");
            await handleLiffRedirect();
        }
        
        // Pre-fetch system settings for automation
        if (typeof fetchSettings === 'function') fetchSettings();

        if (!window.currentUser && document.querySelectorAll('.auth-stage.active').length === 0) {
            checkAuth();
        }
        setSyncStatus(false);
    };

    initApp();
    initResizableTable();
    initBackgroundParallax();
    setTimeout(checkModalIntegrity, 2000);
});


function initTabs() {
    document.querySelectorAll('.tab-link').forEach(t => {
        t.onclick = async (e) => {
            const tabId = t.dataset.tab;
            
            // Check if we are allowed to switch tabs (Guard for unsaved changes)
            if (typeof window.switchSubView === 'function') {
                const canSwitch = await window.switchSubView(tabId, 'list');
                if (!canSwitch) {
                    console.log(">> Navigation blocked by unsaved changes guard.");
                    return;
                }
            }

            document.querySelectorAll('.tab-link').forEach(x => x.classList.remove('active'));
            t.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            const section = document.getElementById(tabId);
            if (section) {
                section.classList.add('active');
            }

            // Update URL hash without jumping
            if (history.pushState) {
                history.pushState(null, null, '#' + tabId);
            } else {
                window.location.hash = tabId;
            }

            // Section-specific logic
            if (tabId === 'permissions') {
                fetchMembers();
            } else if (tabId === 'settings') {
                if (typeof fetchSettings === 'function') fetchSettings();
            } else if (tabId === 'tasks') {
                if (typeof fetchTasks === 'function') fetchTasks();
                if (!window.allProjects || window.allProjects.length === 0) {
                    if (typeof fetchProjects === 'function') fetchProjects();
                }
            } else if (tabId === 'projects') {
                if (typeof fetchProjects === 'function') fetchProjects();
                if (typeof fetchCustomers === 'function') fetchCustomers();
            } else {
                renderCustomers();
            }

            // Re-init resizers and icons for new tab content
            initResizableTable();
            if (window.replaceIcons) window.replaceIcons();
        };
    });
}

window.switchToTab = function (tabId, sectionId = null) {
    const btn = document.querySelector(`.tab-link[data-tab="${tabId}"]`);
    if (btn) {
        btn.click();
        if (sectionId) {
            setTimeout(() => {
                const target = document.getElementById(sectionId);
                if (target) {
                    // For settings/permissions sub-tabs
                    if (target.classList.contains('admin-sub-tab') || target.classList.contains('sub-view-stack')) {
                        document.querySelectorAll('.admin-sub-tab, .sub-view-stack').forEach(s => s.classList.remove('active'));
                        target.classList.add('active');
                    }
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 200);
        }
    }
};

window.routeFromProfile = function(tabId, sectionId) {
    if (typeof window.closeAllModals === 'function') window.closeAllModals();
    window.switchToTab(tabId, sectionId);
};


function initResizableTable() {
    document.querySelectorAll('th').forEach(th => {
        if (th.querySelector('.resizer')) return;
        const resizer = document.createElement('div');
        resizer.className = 'resizer';
        th.appendChild(resizer);

        let x = 0;
        let w = 0;

        const onMouseMove = (e) => {
            const dx = e.pageX - x;
            const newWidth = Math.max(100, w + dx);
            th.style.width = `${newWidth}px`;
            th.style.minWidth = `${newWidth}px`; // Important for table-layout
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.classList.remove('resizing');
        };

        resizer.addEventListener('mousedown', (e) => {
            x = e.pageX;
            const styles = window.getComputedStyle(th);
            w = parseInt(styles.width, 10);

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            document.body.classList.add('resizing');
        });

        // Double Click to Auto-Fit
        resizer.addEventListener('dblclick', () => {
            const colIndex = Array.from(th.parentNode.children).indexOf(th);
            const table = th.closest('table');
            const rows = table.querySelectorAll('tr');

            // Create a temporary span to measure text width accurately
            const tester = document.createElement('span');
            tester.style.visibility = 'hidden';
            tester.style.position = 'absolute';
            tester.style.whiteSpace = 'nowrap';
            tester.style.font = window.getComputedStyle(th).font;
            document.body.appendChild(tester);

            let maxWidth = 0;
            rows.forEach(row => {
                const cell = row.children[colIndex];
                if (cell) {
                    tester.innerText = cell.innerText;
                    const cellWidth = tester.offsetWidth + 32; // Include padding
                    if (cellWidth > maxWidth) maxWidth = cellWidth;
                }
            });

            document.body.removeChild(tester);
            th.style.width = `${maxWidth}px`;
            th.style.minWidth = `${maxWidth}px`;
        });
    });
}

function initBackgroundParallax() {
    const overlay = document.getElementById('authOverlay');
    if (!overlay) return;

    console.log(">> Initializing Premium Parallax Background...");

    overlay.addEventListener('mousemove', (e) => {
        const { clientX: x, clientY: y } = e;
        const { innerWidth: w, innerHeight: h } = window;

        // Calculate normalized position (-1 to 1)
        const nx = (x / w) * 2 - 1;
        const ny = (y / h) * 2 - 1;

        // Update CSS variables for smooth movement
        overlay.style.setProperty('--mx', nx.toFixed(3));
        overlay.style.setProperty('--my', ny.toFixed(3));
    });
}

function checkModalIntegrity() {
    // Only profileModal remains as a permanent modal in DOM
    const criticalModals = ['profileModal'];
    const missing = criticalModals.filter(id => !document.getElementById(id));

    if (missing.length > 0) {
        console.error(">> [DOM CRITICAL ERROR] Modals missing from DOM:", missing);
    } else {
        console.log(">> Modal Integrity Check: Profile modal present.");
    }
}

// --- Theme Menu ---
const STUDIO_PRO_THEMES = [
    { id: 'morning-green', label: 'Morning Green' },
    { id: 'solarized-light', label: 'Solarized Light' },
    { id: 'divider' },
    { id: 'dark', label: 'Dark' },
    { id: 'solarized-dark', label: 'Solarized Dark' },
    { id: 'synthwave-84', label: "SynthWave '84" },
    { id: 'tomorrow-night-blue', label: 'Tomorrow Night Blue' }
];

const STUDIO_PRO_THEME_STORAGE_KEY = 'st_pro_theme';
let lastPointerPosition = { x: 24, y: 24 };

function applyStudioProTheme(themeId) {
    const theme = STUDIO_PRO_THEMES.find(item => item.id === themeId && item.label);
    const nextTheme = theme ? theme.id : 'morning-green';

    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem(STUDIO_PRO_THEME_STORAGE_KEY, nextTheme);

    document.querySelectorAll('.theme-menu button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === nextTheme);
    });
}

function initThemeMenu() {
    if (document.getElementById('themeMenu')) {
        applyStudioProTheme(localStorage.getItem(STUDIO_PRO_THEME_STORAGE_KEY));
        return;
    }

    const menu = document.createElement('div');
    menu.id = 'themeMenu';
    menu.className = 'theme-menu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'Color theme');

    STUDIO_PRO_THEMES.forEach(theme => {
        if (theme.id === 'divider') {
            const divider = document.createElement('div');
            divider.className = 'theme-menu-divider';
            menu.appendChild(divider);
            return;
        }

        const item = document.createElement('button');
        item.type = 'button';
        item.dataset.theme = theme.id;
        item.textContent = theme.label;
        item.setAttribute('role', 'menuitem');
        item.addEventListener('click', () => {
            applyStudioProTheme(theme.id);
            window.toggleThemeMenu(false);
        });
        menu.appendChild(item);
    });

    document.body.appendChild(menu);
    applyStudioProTheme(localStorage.getItem(STUDIO_PRO_THEME_STORAGE_KEY));

    document.addEventListener('pointermove', (e) => {
        lastPointerPosition = { x: e.clientX, y: e.clientY };
    }, { passive: true });

    document.addEventListener('mousedown', (e) => {
        if (!menu.classList.contains('active')) return;
        if (!menu.contains(e.target)) window.toggleThemeMenu(false);
    });
}

window.toggleThemeMenu = function(forceOpen = null) {
    const menu = document.getElementById('themeMenu');
    if (!menu) return;

    const shouldOpen = forceOpen === null ? !menu.classList.contains('active') : forceOpen;
    menu.classList.toggle('active', shouldOpen);

    if (shouldOpen) {
        const gap = 10;
        const menuRect = menu.getBoundingClientRect();
        const left = Math.min(
            Math.max(gap, lastPointerPosition.x + gap),
            window.innerWidth - menuRect.width - gap
        );
        const top = Math.min(
            Math.max(gap, lastPointerPosition.y + gap),
            window.innerHeight - menuRect.height - gap
        );
        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;

        const activeItem = menu.querySelector('button.active') || menu.querySelector('button');
        if (activeItem) activeItem.focus({ preventScroll: true });
    }
};

// --- Print Utilities ---
window.addEventListener('beforeprint', () => {
    // Auto-expand all textareas inside the quotation print area so they don't get cropped
    document.querySelectorAll('#quotePrintArea textarea').forEach(el => {
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
    });
});

// --- Hash Navigation Support ---
function handleInitialHash() {
    const hash = window.location.hash.substring(1);
    if (!hash) return;

    if (hash === 'login') {
        if (typeof showAuth === 'function') showAuth();
        return;
    }

    const hashMapping = {
        'customers': { tab: 'customers' },
        'projects': { tab: 'projects' },
        'tasks': { tab: 'tasks' },
        'settings': { tab: 'settings' },
        'permissions': { tab: 'permissions' },
        'bankaccount': { tab: 'settings', section: 'bankSettingsView' },
        'remarks': { tab: 'settings', section: 'workflowSettingsView' },
        'users': { tab: 'permissions' },
        'permission': { tab: 'permissions', section: 'permissionsMatrixView' }
    };

    const route = hashMapping[hash];
    if (route) {
        window.switchToTab(route.tab, route.section);
    }
}

// Global initialization
window.addEventListener('DOMContentLoaded', () => {
    initThemeMenu();
    handleInitialHash();
});

window.addEventListener('hashchange', () => {
    const hash = window.location.hash.substring(1);
    const activeTab = document.querySelector('.tab-link.active');
    if (hash && hash !== activeTab?.dataset.tab) {
        handleInitialHash();
    }
});

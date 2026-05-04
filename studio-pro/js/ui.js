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
                if (typeof window.loadTaskColumnWidths === 'function') window.loadTaskColumnWidths();
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
    const taskColumnVars = new Map([
        ['task-drag-handle-header', '--task-col-drag-width'],
        ['task-project-header', '--task-col-project-width'],
        ['task-date-header', '--task-col-date-width'],
        ['task-content-header', '--task-col-content-width'],
        ['task-actions-header', '--task-col-actions-width']
    ]);

    const getTaskColumnVar = (header) => {
        for (const [className, varName] of taskColumnVars) {
            if (header.classList.contains(className)) return varName;
        }
        return null;
    };

    const getCssPx = (name) => {
        const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        const parsed = parseFloat(raw);
        return Number.isFinite(parsed) ? parsed : 0;
    };

    window.updateTaskContainerWidth = function () {
        const container = document.querySelector('#tasksListView .tasks-container, .tasks-container');
        if (!container || window.matchMedia('(max-width: 768px)').matches) return;

        const total =
            getCssPx('--task-col-drag-width') +
            getCssPx('--task-col-project-width') +
            getCssPx('--task-col-date-width') +
            getCssPx('--task-col-content-min-width') +
            getCssPx('--task-col-actions-width') +
            (getCssPx('--task-row-gap') * 4) +
            getCssPx('--task-row-padding-x');

        if (total > 0) {
            document.documentElement.style.setProperty('--total-task-width', `${total}px`);
        }
    };

    // --- Task Column Width Persistence ---
    window.saveTaskColumnWidths = function() {
        const widths = {
            '--task-col-drag-width': getComputedStyle(document.documentElement).getPropertyValue('--task-col-drag-width'),
            '--task-col-project-width': getComputedStyle(document.documentElement).getPropertyValue('--task-col-project-width'),
            '--task-col-date-width': getComputedStyle(document.documentElement).getPropertyValue('--task-col-date-width'),
            '--task-col-content-min-width': getComputedStyle(document.documentElement).getPropertyValue('--task-col-content-min-width'),
            '--task-col-actions-width': getComputedStyle(document.documentElement).getPropertyValue('--task-col-actions-width')
        };
        localStorage.setItem('studio_pro_task_column_widths', JSON.stringify(widths));
    };

    window.loadTaskColumnWidths = function() {
        const saved = localStorage.getItem('studio_pro_task_column_widths');
        if (saved) {
            try {
                const widths = JSON.parse(saved);
                for (const [prop, val] of Object.entries(widths)) {
                    if (val) document.documentElement.style.setProperty(prop, val);
                }
                setTimeout(() => { if (typeof window.updateTaskContainerWidth === 'function') window.updateTaskContainerWidth(); }, 100);
            } catch (e) { console.error('Failed to load column widths', e); }
        }
    };

    // Load widths immediately
    window.loadTaskColumnWidths();

    if (!window.__taskContainerResizeBound) {
        window.addEventListener('resize', () => {
            if (typeof window.updateTaskContainerWidth === 'function') window.updateTaskContainerWidth();
        });
        window.__taskContainerResizeBound = true;
    }
    // Select both standard table headers and Task header buttons
    const headers = document.querySelectorAll('th, .task-header-btn');
    
    headers.forEach(header => {
        if (header.querySelector('.resizer')) return;
        
        const resizer = document.createElement('div');
        resizer.className = 'resizer';
        header.appendChild(resizer);

        let x = 0;
        let w = 0;
        let activePointerId = null;

        const getPageX = (e) => {
            if (e.touches && e.touches[0]) return e.touches[0].pageX;
            if (e.changedTouches && e.changedTouches[0]) return e.changedTouches[0].pageX;
            return e.pageX;
        };

        const getMinWidth = () => {
            return 20; // Effectively no limit
        };

        const applyTaskColumnWidth = (newWidth) => {
            // Identify which column we are resizing and update its variable
            // This ensures only the targeted column's width is changed.
            // Identify which column we are resizing
            if (header.classList.contains('task-drag-handle-header')) {
                document.documentElement.style.setProperty('--task-col-drag-width', newWidth + 'px');
            } else if (header.classList.contains('task-project-header')) {
                document.documentElement.style.setProperty('--task-col-project-width', newWidth + 'px');
            } else if (header.classList.contains('task-date-header')) {
                document.documentElement.style.setProperty('--task-col-date-width', newWidth + 'px');
            } else if (header.classList.contains('task-content-header')) {
                document.documentElement.style.setProperty('--task-col-content-min-width', newWidth + 'px');
            } else if (header.classList.contains('task-actions-header')) {
                document.documentElement.style.setProperty('--task-col-actions-width', newWidth + 'px');
            }
        };

        const onPointerMove = (e) => {
            if (activePointerId !== null && e.pointerId !== undefined && e.pointerId !== activePointerId) return;
            e.preventDefault();
            const dx = getPageX(e) - x;
            const newWidth = Math.max(getMinWidth(), w + dx);
            
            if (header.tagName === 'TH') {
                header.style.width = `${newWidth}px`;
                header.style.minWidth = `${newWidth}px`;
            } else {
                // Task Header Resizing via CSS Variables
                applyTaskColumnWidth(newWidth);
            }
        };

        const onPointerUp = (e) => {
            if (activePointerId !== null && e.pointerId !== undefined && e.pointerId !== activePointerId) return;
            document.removeEventListener('pointermove', onPointerMove);
            document.removeEventListener('pointerup', onPointerUp);
            document.removeEventListener('pointercancel', onPointerUp);
            document.removeEventListener('mousemove', onPointerMove);
            document.removeEventListener('mouseup', onPointerUp);
            document.removeEventListener('touchmove', onPointerMove);
            document.removeEventListener('touchend', onPointerUp);
            document.removeEventListener('touchcancel', onPointerUp);
            if (activePointerId !== null && resizer.releasePointerCapture) {
                try { resizer.releasePointerCapture(activePointerId); } catch (err) { }
            }
            activePointerId = null;

            // Save widths after resizing tasks
            if (header.classList.contains('task-header-btn')) {
                window.saveTaskColumnWidths();
            }
            document.body.classList.remove('resizing');
            resizer.classList.remove('is-resizing');
            header.classList.remove('is-resizing');
        };

        const startResize = (e) => {
            if (document.body.classList.contains('resizing')) return;
            if (e.type === 'mousedown' && e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            activePointerId = e.pointerId ?? null;
            x = getPageX(e);
            const styles = window.getComputedStyle(header);
            w = parseInt(styles.width, 10);
            if (Number.isNaN(w)) w = header.getBoundingClientRect().width;

            if (activePointerId !== null && resizer.setPointerCapture) {
                try { resizer.setPointerCapture(activePointerId); } catch (err) { }
            }

            if (e.pointerId !== undefined) {
                document.addEventListener('pointermove', onPointerMove, { passive: false });
                document.addEventListener('pointerup', onPointerUp);
                document.addEventListener('pointercancel', onPointerUp);
            } else if (e.type === 'touchstart') {
                document.addEventListener('touchmove', onPointerMove, { passive: false });
                document.addEventListener('touchend', onPointerUp);
                document.addEventListener('touchcancel', onPointerUp);
            } else {
                document.addEventListener('mousemove', onPointerMove);
                document.addEventListener('mouseup', onPointerUp);
            }
            document.body.classList.add('resizing');
            resizer.classList.add('is-resizing');
            header.classList.add('is-resizing');
        };

        if (window.PointerEvent) {
            resizer.addEventListener('pointerdown', startResize, { passive: false });
        } else {
            resizer.addEventListener('touchstart', startResize, { passive: false });
            resizer.addEventListener('mousedown', startResize);
        }

        // Double Click to Auto-Fit
        resizer.addEventListener('dblclick', () => {
            if (header.tagName !== 'TH') return; // Auto-fit only for standard tables for now
            
            const colIndex = Array.from(header.parentNode.children).indexOf(header);
            const table = header.closest('table');
            if (!table) return;
            const rows = table.querySelectorAll('tr');

            const tester = document.createElement('span');
            tester.style.visibility = 'hidden';
            tester.style.position = 'absolute';
            tester.style.whiteSpace = 'nowrap';
            tester.style.font = window.getComputedStyle(header).font;
            document.body.appendChild(tester);

            let maxWidth = 100; // Start with requested minimum
            rows.forEach(row => {
                const cell = row.children[colIndex];
                if (cell) {
                    tester.innerText = cell.innerText;
                    maxWidth = Math.max(maxWidth, tester.offsetWidth + 20);
                }
            });

            header.style.width = `${maxWidth}px`;
            header.style.minWidth = `${maxWidth}px`;
            document.body.removeChild(tester);
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
    { id: 'morning-green', label: 'Studio Green' },
    { id: 'solarized-light', label: 'Warm Paper' },
    { id: 'divider' },
    { id: 'dark', label: 'Ocean Blue' },
    { id: 'solarized-dark', label: 'Jade Gold' },
    { id: 'synthwave-84', label: 'Neon Plum' },
    { id: 'tomorrow-night-blue', label: 'Dark Midnight' }
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

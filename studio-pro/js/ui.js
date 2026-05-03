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

// Input-level undo / redo for form controls across the app.
(function initInputHistory() {
    if (window.__inputHistoryBound) return;

    const histories = new WeakMap();
    let activeControl = null;
    let isApplyingHistory = false;
    const MAX_HISTORY = 80;

    const isHistoryControl = (el) => {
        if (!el || !['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return false;
        if (el.disabled || el.readOnly) return false;
        if (el.type && ['hidden', 'file', 'button', 'submit', 'reset'].includes(el.type)) return false;
        return true;
    };

    const snapshot = (el) => ({
        value: el.value,
        checked: !!el.checked,
        selectionStart: typeof el.selectionStart === 'number' ? el.selectionStart : null,
        selectionEnd: typeof el.selectionEnd === 'number' ? el.selectionEnd : null
    });

    const sameSnapshot = (a, b) => {
        if (!a || !b) return false;
        return a.value === b.value && a.checked === b.checked;
    };

    const getHistory = (el) => {
        if (!histories.has(el)) {
            histories.set(el, { undo: [snapshot(el)], redo: [] });
        }
        return histories.get(el);
    };

    const pushHistory = (el) => {
        if (!isHistoryControl(el) || isApplyingHistory) return;
        const history = getHistory(el);
        const next = snapshot(el);
        const last = history.undo[history.undo.length - 1];
        if (sameSnapshot(last, next)) return;
        history.undo.push(next);
        if (history.undo.length > MAX_HISTORY) history.undo.shift();
        history.redo = [];
    };

    const applySnapshot = (el, state) => {
        isApplyingHistory = true;
        el.value = state.value;
        if ('checked' in el) el.checked = state.checked;

        if (typeof el.setSelectionRange === 'function' && state.selectionStart !== null && state.selectionEnd !== null) {
            try {
                el.setSelectionRange(state.selectionStart, state.selectionEnd);
            } catch (err) {
                // Some input types, like date/number, do not support text selection.
            }
        }

        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        isApplyingHistory = false;
    };

    const stepHistory = (el, direction) => {
        if (!isHistoryControl(el)) return false;
        const history = getHistory(el);
        const current = snapshot(el);

        if (direction === 'undo') {
            if (history.undo.length <= 1) return false;
            if (!sameSnapshot(history.undo[history.undo.length - 1], current)) {
                history.undo.push(current);
            }
            const latest = history.undo.pop();
            history.redo.push(latest);
            applySnapshot(el, history.undo[history.undo.length - 1]);
            return true;
        }

        if (history.redo.length === 0) return false;
        const next = history.redo.pop();
        const lastUndo = history.undo[history.undo.length - 1];
        if (!sameSnapshot(lastUndo, current)) history.undo.push(current);
        if (!sameSnapshot(history.undo[history.undo.length - 1], next)) history.undo.push(next);
        applySnapshot(el, next);
        return true;
    };

    document.addEventListener('focusin', (e) => {
        if (!isHistoryControl(e.target)) return;
        activeControl = e.target;
        getHistory(activeControl);
    });

    document.addEventListener('focusout', (e) => {
        if (e.target === activeControl) activeControl = null;
    });

    document.addEventListener('input', (e) => pushHistory(e.target), true);
    document.addEventListener('change', (e) => pushHistory(e.target), true);

    document.addEventListener('keydown', (e) => {
        const isCmdOrCtrl = e.metaKey || e.ctrlKey;
        if (!isCmdOrCtrl || e.key.toLowerCase() !== 'z') return;

        const focusedControl = isHistoryControl(document.activeElement) ? document.activeElement : null;
        const control = isHistoryControl(e.target) ? e.target : focusedControl;
        if (!isHistoryControl(control)) return;

        const handled = stepHistory(control, e.shiftKey ? 'redo' : 'undo');
        if (!handled) return;

        e.preventDefault();
        e.stopImmediatePropagation();
    }, true);

    window.__inputHistoryBound = true;
})();


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
            getCssPx('--task-col-content-width') +
            getCssPx('--task-col-actions-width') +
            (getCssPx('--task-row-gap') * 4) +
            getCssPx('--task-row-padding-x');

        if (total > 0) {
            container.style.setProperty('width', `${total}px`, 'important');
            container.style.setProperty('min-width', `${total}px`, 'important');
            document.documentElement.style.setProperty('--total-task-width', `${total}px`);
        }
    };

    // --- Task Column Width Persistence ---
    window.saveTaskColumnWidths = function() {
        const widths = {
            '--task-col-drag-width': getComputedStyle(document.documentElement).getPropertyValue('--task-col-drag-width'),
            '--task-col-project-width': getComputedStyle(document.documentElement).getPropertyValue('--task-col-project-width'),
            '--task-col-date-width': getComputedStyle(document.documentElement).getPropertyValue('--task-col-date-width'),
            '--task-col-content-width': getComputedStyle(document.documentElement).getPropertyValue('--task-col-content-width'),
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
                setTimeout(() => window.updateTaskContainerWidth(), 100);
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
    const headers = document.querySelectorAll('th, .task-header-btn:not(.task-actions-header)');
    
    headers.forEach(header => {
        if (header.querySelector('.resizer')) return;
        
        const resizer = document.createElement('div');
        resizer.className = 'resizer';
        header.appendChild(resizer);

        let x = 0;
        let w = 0;
        let table = null;
        let tableStartWidth = 0;
        let columnCells = [];

        const setColumnWidth = (width) => {
            columnCells.forEach(cell => {
                cell.style.setProperty('width', `${width}px`, 'important');
                cell.style.setProperty('min-width', `${width}px`, 'important');
            });
        };

        const onMouseMove = (e) => {
            const dx = e.pageX - x;
            const newWidth = Math.max(100, w + dx);
            
            if (header.tagName === 'TH') {
                const widthDelta = newWidth - w;
                if (table) {
                    table.style.setProperty('width', `${Math.max(100, tableStartWidth + widthDelta)}px`, 'important');
                    table.style.setProperty('min-width', `${Math.max(100, tableStartWidth + widthDelta)}px`, 'important');
                }
                setColumnWidth(newWidth);
            } else {
                // Task Header Resizing via CSS Variables
                header.style.width = `${newWidth}px`;
                header.style.flex = 'none'; // Prevent flex growing/shrinking
                
                const columnVar = getTaskColumnVar(header);
                if (columnVar) document.documentElement.style.setProperty(columnVar, newWidth + 'px');
                window.updateTaskContainerWidth();
            }
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.style.cursor = 'default';
            resizer.classList.remove('is-resizing');

            // Save widths after resizing tasks
            if (header.classList.contains('task-header-btn')) {
                window.saveTaskColumnWidths();
            }
            document.body.classList.remove('resizing');
            header.classList.remove('is-resizing');
            table = null;
            columnCells = [];
        };

        resizer.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            x = e.pageX;
            const styles = window.getComputedStyle(header);
            w = parseInt(styles.width, 10) || header.getBoundingClientRect().width;

            if (header.tagName === 'TH') {
                table = header.closest('table');
                if (table) {
                    tableStartWidth = table.getBoundingClientRect().width;
                    table.style.setProperty('width', `${tableStartWidth}px`, 'important');
                    table.style.setProperty('min-width', `${tableStartWidth}px`, 'important');

                    const colIndex = Array.from(header.parentNode.children).indexOf(header);
                    columnCells = Array.from(table.querySelectorAll('tr'))
                        .map(row => row.children[colIndex])
                        .filter(Boolean);
                    setColumnWidth(w);
                }
            }

            if (header.classList.contains('task-header-btn')) {
                const columnVar = getTaskColumnVar(header);
                if (columnVar) document.documentElement.style.setProperty(columnVar, `${w}px`);
                window.updateTaskContainerWidth();
            }

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            document.body.classList.add('resizing');
            header.classList.add('is-resizing');
            resizer.classList.add('is-resizing');
        });

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

            const currentWidth = header.getBoundingClientRect().width;
            const currentTableWidth = table.getBoundingClientRect().width;
            const columnCells = Array.from(rows)
                .map(row => row.children[colIndex])
                .filter(Boolean);

            table.style.setProperty('width', `${Math.max(100, currentTableWidth + (maxWidth - currentWidth))}px`, 'important');
            table.style.setProperty('min-width', `${Math.max(100, currentTableWidth + (maxWidth - currentWidth))}px`, 'important');
            columnCells.forEach(cell => {
                cell.style.setProperty('width', `${maxWidth}px`, 'important');
                cell.style.setProperty('min-width', `${maxWidth}px`, 'important');
            });
            document.body.removeChild(tester);
        });
    });

    if (typeof window.updateTaskContainerWidth === 'function') window.updateTaskContainerWidth();
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

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
                if (typeof window.loadProjectColumnWidths === 'function') window.loadProjectColumnWidths();
            } else {
                renderCustomers();
                if (typeof window.loadCustomerColumnWidths === 'function') window.loadCustomerColumnWidths();
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
        ['task-content-header', '--task-col-content-min-width'],
        ['task-actions-header', '--task-col-actions-width']
    ]);

    const tableColumnVars = [
        ['q-col-1', '--quote-col-1-width'],
        ['q-col-2', '--quote-col-2-width'],
        ['q-col-3', '--quote-col-3-width'],
        ['q-col-4', '--quote-col-4-width'],
        ['q-col-5', '--quote-col-5-width'],
        ['q-col-6', '--quote-col-6-width'],
        ['p-col-1', '--proj-col-1-width'],
        ['p-col-2', '--proj-col-2-width'],
        ['p-col-3', '--proj-col-3-width'],
        ['p-col-4', '--proj-col-4-width'],
        ['p-col-5', '--proj-col-5-width'],
        ['p-col-6', '--proj-col-6-width'],
        ['p-col-7', '--proj-col-7-width'],
        ['c-col-1', '--cust-col-1-width'],
        ['c-col-2', '--cust-col-2-width'],
        ['c-col-3', '--cust-col-3-width'],
        ['c-col-4', '--cust-col-4-width'],
        ['c-col-5', '--cust-col-5-width']
    ];

    const getTaskColumnVar = (header) => {
        for (const [className, varName] of taskColumnVars) {
            if (header.classList.contains(className)) return varName;
        }
        return null;
    };

    const getTableColumnVar = (header) => {
        for (const [className, varName] of tableColumnVars) {
            if (header.classList.contains(className)) return varName;
        }
        return null;
    };

    const getColumnVar = (header) => getTaskColumnVar(header) || getTableColumnVar(header);

    const getCssPx = (name) => {
        const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        const parsed = parseFloat(raw);
        return Number.isFinite(parsed) ? parsed : 0;
    };

    const updateContainerForColumn = (varName) => {
        if (!varName) return;
        if (varName.startsWith('--task') && typeof window.updateTaskContainerWidth === 'function') window.updateTaskContainerWidth();
        if (varName.startsWith('--quote') && typeof window.updateQuotationContainerWidth === 'function') window.updateQuotationContainerWidth();
        if (varName.startsWith('--proj') && typeof window.updateProjectContainerWidth === 'function') window.updateProjectContainerWidth();
        if (varName.startsWith('--cust') && typeof window.updateCustomerContainerWidth === 'function') window.updateCustomerContainerWidth();
    };

    const saveColumnWidthsForHeader = (header) => {
        if (header.classList.contains('task-header-btn') && typeof window.saveTaskColumnWidths === 'function') window.saveTaskColumnWidths();
        if ((header.classList.contains('q-col-1') || header.classList.contains('q-col-2') || header.classList.contains('q-col-3') ||
            header.classList.contains('q-col-4') || header.classList.contains('q-col-5') || header.classList.contains('q-col-6')) &&
            typeof window.saveQuotationColumnWidths === 'function') window.saveQuotationColumnWidths();
        if ((header.classList.contains('p-col-1') || header.classList.contains('p-col-2') || header.classList.contains('p-col-3') ||
            header.classList.contains('p-col-4') || header.classList.contains('p-col-5') || header.classList.contains('p-col-6') ||
            header.classList.contains('p-col-7')) && typeof window.saveProjectColumnWidths === 'function') window.saveProjectColumnWidths();
        if ((header.classList.contains('c-col-1') || header.classList.contains('c-col-2') || header.classList.contains('c-col-3') ||
            header.classList.contains('c-col-4') || header.classList.contains('c-col-5')) && typeof window.saveCustomerColumnWidths === 'function') {
            window.saveCustomerColumnWidths();
        }
    };

    const applyColumnWidth = (header, newWidth) => {
        const width = Math.max(20, Math.ceil(newWidth));
        const varName = getColumnVar(header);
        header.style.width = `${width}px`;
        header.style.minWidth = `${width}px`;
        if (varName) {
            document.documentElement.style.setProperty(varName, `${width}px`);
            updateContainerForColumn(varName);
        }
        saveColumnWidthsForHeader(header);
    };

    const isVisibleForMeasure = (el) => {
        if (!el || el.classList?.contains('hidden')) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    };

    const getHorizontalSpace = (el) => {
        const style = window.getComputedStyle(el);
        return ['paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth']
            .reduce((sum, prop) => sum + (parseFloat(style[prop]) || 0), 0);
    };

    const getCleanText = (el) => {
        const controls = Array.from(el.querySelectorAll('input, textarea, select')).filter(isVisibleForMeasure);
        if (controls.length > 0) return controls.map(control => control.value || control.textContent || '').join(' ');

        const clone = el.cloneNode(true);
        clone.querySelectorAll('.resizer, script, style').forEach(node => node.remove());
        return (clone.textContent || '').replace(/\s+/g, ' ').trim();
    };

    const measureText = (text, sourceEl, tester) => {
        const lines = String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
        if (lines.length === 0) return 0;

        tester.style.font = window.getComputedStyle(sourceEl).font;
        return Math.max(...lines.map(line => {
            tester.textContent = line;
            return tester.getBoundingClientRect().width;
        }));
    };

    const measureVisualContent = (el) => {
        const rects = Array.from(el.querySelectorAll('img, svg, button')).filter(isVisibleForMeasure)
            .map(node => node.getBoundingClientRect())
            .filter(rect => rect.width > 0 && rect.height > 0);
        if (rects.length === 0) return 0;
        const left = Math.min(...rects.map(rect => rect.left));
        const right = Math.max(...rects.map(rect => rect.right));
        return right - left;
    };

    const measureElementFitWidth = (el, tester) => {
        if (!isVisibleForMeasure(el)) return 0;

        const controls = Array.from(el.querySelectorAll('input, textarea, select')).filter(isVisibleForMeasure);
        let textWidth = 0;
        if (controls.length > 0) {
            textWidth = Math.max(...controls.map(control => measureText(control.value || control.textContent || '', control, tester) + getHorizontalSpace(control)));
        } else {
            textWidth = measureText(getCleanText(el), el, tester);
        }

        const visualWidth = textWidth > 0 ? 0 : measureVisualContent(el);
        return Math.ceil(Math.max(textWidth, visualWidth) + getHorizontalSpace(el) + 2);
    };

    const getTaskCellSelector = (header) => {
        if (header.classList.contains('task-drag-handle-header')) return '.task-col-drag';
        if (header.classList.contains('task-project-header')) return '.task-col-project';
        if (header.classList.contains('task-date-header')) return '.task-col-date';
        if (header.classList.contains('task-content-header')) return '.task-col-content';
        if (header.classList.contains('task-actions-header')) return '.task-col-actions';
        return null;
    };

    const getAutoFitTargets = (header) => {
        if (header.classList.contains('task-header-btn')) {
            const selector = getTaskCellSelector(header);
            if (!selector) return [header];
            return [header, ...document.querySelectorAll(`#taskList .task-item > ${selector}`)];
        }

        const colIndex = Array.from(header.parentNode.children).indexOf(header);
        const table = header.closest('table');
        if (!table || colIndex < 0) return [header];

        return [header, ...Array.from(table.querySelectorAll('tr')).map(row => {
            const cell = row.children[colIndex];
            if (!cell || Number(cell.colSpan || 1) !== 1) return null;
            return cell;
        }).filter(Boolean)];
    };

    const autoFitColumn = (header) => {
        const tester = document.createElement('span');
        tester.style.visibility = 'hidden';
        tester.style.position = 'absolute';
        tester.style.whiteSpace = 'pre';
        tester.style.left = '-9999px';
        tester.style.top = '-9999px';
        document.body.appendChild(tester);

        const maxWidth = getAutoFitTargets(header).reduce((max, el) => {
            return Math.max(max, measureElementFitWidth(el, tester));
        }, 20);

        document.body.removeChild(tester);
        applyColumnWidth(header, maxWidth);
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

    window.updateQuotationContainerWidth = function () {
        const table = document.querySelector('#projectsEditView .quote-body-table');
        if (!table || window.matchMedia('(max-width: 768px)').matches) return;

        const total =
            getCssPx('--quote-col-1-width') +
            getCssPx('--quote-col-2-width') +
            getCssPx('--quote-col-3-width') +
            getCssPx('--quote-col-4-width') +
            getCssPx('--quote-col-5-width') +
            getCssPx('--quote-col-6-width');

        if (total > 0) {
            document.documentElement.style.setProperty('--total-quote-width', `${total}px`);
        }
    };

    window.updateProjectContainerWidth = function () {
        const table = document.querySelector('#projectTable');
        if (!table || window.matchMedia('(max-width: 768px)').matches) return;

        const total =
            getCssPx('--proj-col-1-width') +
            getCssPx('--proj-col-2-width') +
            getCssPx('--proj-col-3-width') +
            getCssPx('--proj-col-4-width') +
            getCssPx('--proj-col-5-width') +
            getCssPx('--proj-col-6-width') +
            getCssPx('--proj-col-7-width');

        if (total > 0) {
            document.documentElement.style.setProperty('--total-proj-width', `${total}px`);
        }
    };

    window.updateCustomerContainerWidth = function () {
        const table = document.querySelector('#customerTable');
        if (!table || window.matchMedia('(max-width: 768px)').matches) return;

        const total =
            getCssPx('--cust-col-1-width') +
            getCssPx('--cust-col-2-width') +
            getCssPx('--cust-col-3-width') +
            getCssPx('--cust-col-4-width') +
            getCssPx('--cust-col-5-width');

        if (total > 0) {
            document.documentElement.style.setProperty('--total-cust-width', `${total}px`);
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

    // --- Quotation Column Width Persistence ---
    window.saveQuotationColumnWidths = function() {
        const widths = {
            '--quote-col-1-width': getComputedStyle(document.documentElement).getPropertyValue('--quote-col-1-width'),
            '--quote-col-2-width': getComputedStyle(document.documentElement).getPropertyValue('--quote-col-2-width'),
            '--quote-col-3-width': getComputedStyle(document.documentElement).getPropertyValue('--quote-col-3-width'),
            '--quote-col-4-width': getComputedStyle(document.documentElement).getPropertyValue('--quote-col-4-width'),
            '--quote-col-5-width': getComputedStyle(document.documentElement).getPropertyValue('--quote-col-5-width'),
            '--quote-col-6-width': getComputedStyle(document.documentElement).getPropertyValue('--quote-col-6-width')
        };
        localStorage.setItem('studio_pro_quote_column_widths', JSON.stringify(widths));
    };

    window.loadQuotationColumnWidths = function() {
        const saved = localStorage.getItem('studio_pro_quote_column_widths');
        if (saved) {
            try {
                const widths = JSON.parse(saved);
                for (const [prop, val] of Object.entries(widths)) {
                    if (val) document.documentElement.style.setProperty(prop, val);
                }
                setTimeout(() => { if (typeof window.updateQuotationContainerWidth === 'function') window.updateQuotationContainerWidth(); }, 100);
            } catch (e) { console.error('Failed to load quotation widths', e); }
        }
    };

    // --- Projects List Column Width Persistence ---
    window.saveProjectColumnWidths = function() {
        const widths = {
            '--proj-col-1-width': getComputedStyle(document.documentElement).getPropertyValue('--proj-col-1-width'),
            '--proj-col-2-width': getComputedStyle(document.documentElement).getPropertyValue('--proj-col-2-width'),
            '--proj-col-3-width': getComputedStyle(document.documentElement).getPropertyValue('--proj-col-3-width'),
            '--proj-col-4-width': getComputedStyle(document.documentElement).getPropertyValue('--proj-col-4-width'),
            '--proj-col-5-width': getComputedStyle(document.documentElement).getPropertyValue('--proj-col-5-width'),
            '--proj-col-6-width': getComputedStyle(document.documentElement).getPropertyValue('--proj-col-6-width'),
            '--proj-col-7-width': getComputedStyle(document.documentElement).getPropertyValue('--proj-col-7-width')
        };
        localStorage.setItem('studio_pro_project_column_widths', JSON.stringify(widths));
    };

    window.loadProjectColumnWidths = function() {
        const saved = localStorage.getItem('studio_pro_project_column_widths');
        if (saved) {
            try {
                const widths = JSON.parse(saved);
                for (const [prop, val] of Object.entries(widths)) {
                    if (val) document.documentElement.style.setProperty(prop, val);
                }
            } catch (e) { console.error('Failed to load project widths', e); }
        }
    };

    // --- Customers List Column Width Persistence ---
    window.saveCustomerColumnWidths = function() {
        const widths = {
            '--cust-col-1-width': getComputedStyle(document.documentElement).getPropertyValue('--cust-col-1-width'),
            '--cust-col-2-width': getComputedStyle(document.documentElement).getPropertyValue('--cust-col-2-width'),
            '--cust-col-3-width': getComputedStyle(document.documentElement).getPropertyValue('--cust-col-3-width'),
            '--cust-col-4-width': getComputedStyle(document.documentElement).getPropertyValue('--cust-col-4-width'),
            '--cust-col-5-width': getComputedStyle(document.documentElement).getPropertyValue('--cust-col-5-width')
        };
        localStorage.setItem('studio_pro_customer_column_widths', JSON.stringify(widths));
    };

    window.loadCustomerColumnWidths = function() {
        const saved = localStorage.getItem('studio_pro_customer_column_widths');
        if (saved) {
            try {
                const widths = JSON.parse(saved);
                for (const [prop, val] of Object.entries(widths)) {
                    if (val) document.documentElement.style.setProperty(prop, val);
                }
                setTimeout(() => { if (typeof window.updateCustomerContainerWidth === 'function') window.updateCustomerContainerWidth(); }, 100);
            } catch (e) { console.error('Failed to load customer widths', e); }
        }
    };
    // --- Member List Column Width Persistence ---
    window.saveMemberColumnWidths = function() {
        const widths = {
            '--member-col-1-width': getComputedStyle(document.documentElement).getPropertyValue('--member-col-1-width'),
            '--member-col-2-width': getComputedStyle(document.documentElement).getPropertyValue('--member-col-2-width'),
            '--member-col-3-width': getComputedStyle(document.documentElement).getPropertyValue('--member-col-3-width'),
            '--member-col-4-width': getComputedStyle(document.documentElement).getPropertyValue('--member-col-4-width'),
            '--member-col-5-width': getComputedStyle(document.documentElement).getPropertyValue('--member-col-5-width')
        };
        localStorage.setItem('studio_pro_member_column_widths', JSON.stringify(widths));
    };

    window.loadMemberColumnWidths = function() {
        const saved = localStorage.getItem('studio_pro_member_column_widths');
        if (saved) {
            try {
                const widths = JSON.parse(saved);
                for (const [prop, val] of Object.entries(widths)) {
                    if (val) document.documentElement.style.setProperty(prop, val);
                }
            } catch (e) { console.error('Failed to load member widths', e); }
        }
    };

    // --- Permission Matrix Column Width Persistence ---
    window.savePermMatrixColumnWidths = function() {
        const widths = {
            '--pm-col-0-width': getComputedStyle(document.documentElement).getPropertyValue('--pm-col-0-width'),
            '--pm-col-1-width': getComputedStyle(document.documentElement).getPropertyValue('--pm-col-1-width'),
            '--pm-col-2-width': getComputedStyle(document.documentElement).getPropertyValue('--pm-col-2-width'),
            '--pm-col-3-width': getComputedStyle(document.documentElement).getPropertyValue('--pm-col-3-width')
        };
        localStorage.setItem('studio_pro_perm_matrix_column_widths', JSON.stringify(widths));
    };

    window.loadPermMatrixColumnWidths = function() {
        const saved = localStorage.getItem('studio_pro_perm_matrix_column_widths');
        if (saved) {
            try {
                const widths = JSON.parse(saved);
                for (const [prop, val] of Object.entries(widths)) {
                    if (val) document.documentElement.style.setProperty(prop, val);
                }
            } catch (e) { console.error('Failed to load matrix widths', e); }
        }
    };

    // Load widths immediately
    window.loadTaskColumnWidths();
    window.loadQuotationColumnWidths();
    window.loadProjectColumnWidths();
    window.loadCustomerColumnWidths();
    window.loadMemberColumnWidths();
    window.loadPermMatrixColumnWidths();

    if (!window.__taskContainerResizeBound) {
        window.addEventListener('resize', () => {
            if (typeof window.updateTaskContainerWidth === 'function') window.updateTaskContainerWidth();
            if (typeof window.updateQuotationContainerWidth === 'function') window.updateQuotationContainerWidth();
            if (typeof window.updateProjectContainerWidth === 'function') window.updateProjectContainerWidth();
            if (typeof window.updateCustomerContainerWidth === 'function') window.updateCustomerContainerWidth();
            if (typeof window.updateMemberContainerWidth === 'function') window.updateMemberContainerWidth();
            if (typeof window.updatePermMatrixContainerWidth === 'function') window.updatePermMatrixContainerWidth();
        });
        window.__taskContainerResizeBound = true;
    }
    // Select only intended tables AND the specialized Task Header buttons
    const targetContainers = document.querySelectorAll('#customerTable, #projectTable, #memberTable, #projectsEditView .quote-body-table, #tasksListView table, .task-header-row, .permission-matrix-table');
    
    targetContainers.forEach(container => {
        const headers = container.querySelectorAll('th, .task-header-btn');
        headers.forEach(header => {
            // Clean up existing resizers first
            const existing = header.querySelectorAll('.resizer');
            existing.forEach(r => r.remove());
            
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

        const getMinWidth = () => 20;
        let isDragging = false;

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
            isDragging = true;
            const dx = getPageX(e) - x;
            const newWidth = Math.max(getMinWidth(), w + dx);
            
            // Apply width directly to the header and any linked variable
            header.style.width = `${newWidth}px`;
            header.style.minWidth = `${newWidth}px`;

            if (header.tagName === 'TH') {
                let varName = null;
                if (header.classList.contains('q-col-1')) varName = '--quote-col-1-width';
                else if (header.classList.contains('q-col-2')) varName = '--quote-col-2-width';
                else if (header.classList.contains('q-col-3')) varName = '--quote-col-3-width';
                else if (header.classList.contains('q-col-4')) varName = '--quote-col-4-width';
                else if (header.classList.contains('q-col-5')) varName = '--quote-col-5-width';
                else if (header.classList.contains('q-col-6')) varName = '--quote-col-6-width';
                else if (header.classList.contains('p-col-1')) varName = '--proj-col-1-width';
                else if (header.classList.contains('p-col-2')) varName = '--proj-col-2-width';
                else if (header.classList.contains('p-col-3')) varName = '--proj-col-3-width';
                else if (header.classList.contains('p-col-4')) varName = '--proj-col-4-width';
                else if (header.classList.contains('p-col-5')) varName = '--proj-col-5-width';
                else if (header.classList.contains('p-col-6')) varName = '--proj-col-6-width';
                else if (header.classList.contains('p-col-7')) varName = '--proj-col-7-width';
                else if (header.classList.contains('c-col-1')) varName = '--cust-col-1-width';
                else if (header.classList.contains('c-col-2')) varName = '--cust-col-2-width';
                else if (header.classList.contains('c-col-3')) varName = '--cust-col-3-width';
                else if (header.classList.contains('c-col-4')) varName = '--cust-col-4-width';
                else if (header.classList.contains('c-col-5')) varName = '--cust-col-5-width';
                else if (header.classList.contains('m-col-1')) varName = '--member-col-1-width';
                else if (header.classList.contains('m-col-2')) varName = '--member-col-2-width';
                else if (header.classList.contains('m-col-3')) varName = '--member-col-3-width';
                else if (header.classList.contains('m-col-4')) varName = '--member-col-4-width';
                else if (header.classList.contains('m-col-5')) varName = '--member-col-5-width';
                else if (header.classList.contains('pm-col-0')) varName = '--pm-col-0-width';
                else if (header.classList.contains('pm-col-1')) varName = '--pm-col-1-width';
                else if (header.classList.contains('pm-col-2')) varName = '--pm-col-2-width';
                else if (header.classList.contains('pm-col-3')) varName = '--pm-col-3-width';

                if (varName) {
                    document.documentElement.style.setProperty(varName, `${newWidth}px`);
                    // Trigger container width updates
                    if (varName.startsWith('--quote')) window.updateQuotationContainerWidth();
                    if (varName.startsWith('--proj')) window.updateProjectContainerWidth();
                    if (varName.startsWith('--cust')) window.updateCustomerContainerWidth();
                    if (varName.startsWith('--member')) window.updateMemberContainerWidth();
                    if (varName.startsWith('--pm')) window.updatePermMatrixContainerWidth();
                }
            } else {
                applyTaskColumnWidth(newWidth);
                window.updateTaskContainerWidth();
            }
        };

        const onPointerUp = (e) => {
            if (activePointerId !== null && e.pointerId !== undefined && e.pointerId !== activePointerId) return;
            
            if (isDragging) {
                // Temporary capture to block the click event (sorting)
                const captureClick = (event) => {
                    event.stopImmediatePropagation();
                    header.removeEventListener('click', captureClick, true);
                };
                header.addEventListener('click', captureClick, true);
            }
            isDragging = false;

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
            
            // Save widths after resizing quotation table
            if (header.classList.contains('q-col-1') || header.classList.contains('q-col-2') || header.classList.contains('q-col-3') ||
                header.classList.contains('q-col-4') || header.classList.contains('q-col-5') || header.classList.contains('q-col-6')) {
                window.saveQuotationColumnWidths();
            }

            // Save widths after resizing project table
            if (header.classList.contains('p-col-1') || header.classList.contains('p-col-2') || header.classList.contains('p-col-3') ||
                header.classList.contains('p-col-4') || header.classList.contains('p-col-5') || header.classList.contains('p-col-6') ||
                header.classList.contains('p-col-7')) {
                window.saveProjectColumnWidths();
            }

            // Save widths after resizing customer table
            if (header.classList.contains('c-col-1') || header.classList.contains('c-col-2') || header.classList.contains('c-col-3') ||
                header.classList.contains('c-col-4') || header.classList.contains('c-col-5')) {
                window.saveCustomerColumnWidths();
            }

            // Save widths after resizing member table
            if (header.classList.contains('m-col-1') || header.classList.contains('m-col-2') || header.classList.contains('m-col-3') ||
                header.classList.contains('m-col-4') || header.classList.contains('m-col-5')) {
                window.saveMemberColumnWidths();
            }

            // Save widths after resizing permission matrix
            if (header.classList.contains('pm-col-0') || header.classList.contains('pm-col-1') || header.classList.contains('pm-col-2') ||
                header.classList.contains('pm-col-3')) {
                window.savePermMatrixColumnWidths();
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
            w = header.getBoundingClientRect().width;

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
        resizer.addEventListener('dblclick', (event) => {
            event.preventDefault();
            event.stopPropagation();
            autoFitColumn(header);
        });
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

window.updateMemberContainerWidth = function() {
    const table = document.getElementById('memberTable');
    if (!table) return;
    const widths = [
        '--member-col-1-width', '--member-col-2-width', '--member-col-3-width',
        '--member-col-4-width', '--member-col-5-width'
    ];
    let total = 0;
    const rootStyle = getComputedStyle(document.documentElement);
    widths.forEach(w => {
        const val = rootStyle.getPropertyValue(w).trim();
        if (val.endsWith('px')) total += parseInt(val);
        else if (val === 'auto') total += 150; // default
    });
    document.documentElement.style.setProperty('--total-member-width', (total + 40) + 'px');
};

window.updatePermMatrixContainerWidth = function() {
    const table = document.querySelector('.permission-matrix-table');
    if (!table) return;
    const widths = [
        '--pm-col-0-width', '--pm-col-1-width', '--pm-col-2-width', '--pm-col-3-width'
    ];
    let total = 0;
    const rootStyle = getComputedStyle(document.documentElement);
    widths.forEach(w => {
        const val = rootStyle.getPropertyValue(w).trim();
        if (val.endsWith('px')) total += parseInt(val);
    });
    document.documentElement.style.setProperty('--total-perm-width', total + 'px');
};

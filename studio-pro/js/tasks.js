// Tasks Management - Sub-view Pattern with Inline Editing
// ==========================================

window.allTasks = window.allTasks || [];
window.currentFilteredTasks = window.currentFilteredTasks || [];
const cachedTaskFilters = typeof getCache === 'function' ? getCache('taskStatusFilters') : null;
window.taskStatusFilters = cachedTaskFilters || ['uncompleted', 'completed']; 
window.taskSort = { column: 'drag', direction: 'asc' }; // Initialize sorting state

if (!window.saveLocks) window.saveLocks = new Map();

window.fetchTasks = async function () {
    const filters = window.taskStatusFilters || [];
    document.getElementById('uncompletedFilterBtn')?.classList.toggle('active', filters.includes('uncompleted'));
    document.getElementById('completedFilterBtn')?.classList.toggle('active', filters.includes('completed'));
    
    setSyncStatus(true);
    try {
        const json = await window.apiPost('get_all_tasks', {
            username: (window.currentUser ? window.currentUser.username : '')
        });
        console.log(">> Tasks json response:", json);
        if (json.success) {
            const raw = json.data || json.tasks || [];
            window.allTasks = raw.map(t => initializeTaskWeight(t));
            console.log(">> window.allTasks mapped:", window.allTasks.length);
            
            if (typeof window.updateTaskProjectFilter === 'function') window.updateTaskProjectFilter();
            window.filterTasksByProject();
        } else {
            Swal.fire({
                title: '資料讀取受阻',
                text: json.error || '請確認個人設定中的試算表 ID 是否正確。',
                icon: 'info',
                confirmButtonColor: 'var(--primary)'
            });
        }
    } catch (e) {
        console.error("Fetch Tasks Error:", e);
    } finally { 
        setSyncStatus(false); 
    }
}

function initializeTaskWeight(t) {
    if (!t.taskId) t.taskId = t.id || 'T-' + Date.now();
    const rawComp = t.isCompleted || t.completed;
    t.isCompleted = (rawComp === true || rawComp === 'TRUE' || rawComp === 'true' || rawComp === 1);
    t.orderWeight = parseFloat(t.orderWeight || 0);
    // Normalize date to YYYY-MM-DD only
    if (t.taskDate) t.taskDate = String(t.taskDate).substring(0, 10);
    return t;
}

window.updateTaskProjectFilter = function () {
    const filterSelect = document.getElementById('taskProjectFilter');
    if (!filterSelect) return;
    const currVal = filterSelect.value;
    
    let html = '<option value="">所有專案</option>';
    const projs = window.allProjects || [];
    const custs = window.allCustomers || [];

    projs.forEach(p => {
        if (p.status === '3') return; // Skip completed projects
        const cust = custs.find(c => String(c.customerId) === String(p.customerId));
        const nickname = cust ? (cust.nickname || cust.companyName) : '';
        html += `<option value="${escapeHtml(p.projectId)}">${escapeHtml(p.projectName)} (${escapeHtml(nickname)})</option>`;
    });

    filterSelect.innerHTML = html;
    if (currVal) filterSelect.value = currVal;
}

window.toggleTaskStatusFilter = function (type) {
    const idx = window.taskStatusFilters.indexOf(type);
    if (idx > -1) window.taskStatusFilters.splice(idx, 1);
    else window.taskStatusFilters.push(type);
    
    if (typeof setCache === 'function') setCache('taskStatusFilters', window.taskStatusFilters);
    document.getElementById('uncompletedFilterBtn')?.classList.toggle('active', window.taskStatusFilters.includes('uncompleted'));
    document.getElementById('completedFilterBtn')?.classList.toggle('active', window.taskStatusFilters.includes('completed'));
    window.filterTasksByProject();
}

window.filterTasksByProject = function () {
    const filterSelect = document.getElementById('taskProjectFilter');
    const pid = filterSelect ? filterSelect.value : '';
    let filtered = window.allTasks || [];

    if (pid && String(pid).trim() !== "") {
        filtered = filtered.filter(t => String(t.projectId) === String(pid));
    }
    
    filtered = filtered.filter(t => {
        const s = t.isCompleted ? 'completed' : 'uncompleted';
        const filterArr = window.taskStatusFilters || [];
        return (filterArr.length === 0) || filterArr.includes(s);
    });

    window.currentFilteredTasks = filtered;
    window.renderTasks();
}

window.setTaskSort = function (col) {
    if (col === 'drag') {
        window.taskSort = { column: 'drag', direction: 'asc' };
    } else {
        if (window.taskSort.column === col) {
            window.taskSort.direction = window.taskSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            window.taskSort.column = col;
            window.taskSort.direction = 'asc';
        }
    }
    window.renderTasks();
}

window.renderTasks = function() {
    console.log(">> renderTasks called. allTasks size:", (window.allTasks || []).length);
    const list = document.getElementById('taskList');
    if (!list) return;
    list.innerHTML = '';

    const query = (document.getElementById('taskSearchInput')?.value || '').toLowerCase();
    
    // Safety check on filtered data
    let tasksToRender = window.currentFilteredTasks || [];
    if (query) {
        tasksToRender = tasksToRender.filter(t => (t.taskName || '').toLowerCase().includes(query));
    }

    if (tasksToRender.length === 0) {
        list.innerHTML = `
            <div style="padding: 100px 0; text-align: center; color: var(--text-muted); opacity: 0.6;">
                <div style="margin-bottom: 20px;">
                    <img src="assets/icons/tasks.svg" style="width: 64px; height: 64px; filter: grayscale(1) brightness(1.5); opacity: 0.3;">
                </div>
                <p style="font-size: 0.9375rem;">目前沒有符合條件的任務</p>
            </div>
        `;
        return;
    }

    // --- NEW SORTING LOGIC ---
    const { column, direction } = window.taskSort || { column: 'drag', direction: 'asc' };
    
    // Update Header UI
    document.querySelectorAll('.task-header-btn').forEach(btn => {
        btn.classList.remove('active', 'asc', 'desc');
        const arrow = btn.querySelector('.sort-arrow');
        if (arrow) arrow.innerText = '';
    });
    const activeHeader = document.getElementById(`sort-${column}`);
    if (activeHeader) {
        activeHeader.classList.add('active', direction);
        const arrow = activeHeader.querySelector('.sort-arrow');
        if (arrow && column !== 'drag') {
            arrow.innerText = direction === 'asc' ? ' ↑' : ' ↓';
        }
    }

    if (column === 'drag') {
        // Original Order Weight
        tasksToRender.sort((a, b) => {
            const wA = parseFloat(a.orderWeight || 0);
            const wB = parseFloat(b.orderWeight || 0);
            return wA - wB;
        });
    } else {
        tasksToRender.sort((a, b) => {
            let valA, valB;
            if (column === 'project') {
                const getProjName = (t) => {
                    const p = (window.allProjects || []).find(pj => String(pj.projectId) === String(t.projectId));
                    return (p ? p.projectName : '') || String(t.projectId || '');
                };
                valA = getProjName(a);
                valB = getProjName(b);
            } else if (column === 'date') {
                valA = a.taskDate || '';
                valB = b.taskDate || '';
                // No date logic: "沒有選日期的項目，意義上，跟時間比較近相同"
                // Asc: No-date (top) -> Today -> Future
                // Desc: Future -> Today -> No-date (bottom)
                if (!valA && valB) return direction === 'asc' ? -1 : 1;
                if (valA && !valB) return direction === 'asc' ? 1 : -1;
                if (!valA && !valB) return 0;
                return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            } else if (column === 'content') {
                valA = a.taskName || '';
                valB = b.taskName || '';
            }

            const res = String(valA).localeCompare(String(valB), 'zh-Hant');
            return direction === 'asc' ? res : -res;
        });
    }

    tasksToRender.forEach((t, index) => {
        const item = document.createElement('li'); // Reverted to LI for list structure
        item.className = `task-item ${t.isCompleted ? 'is-completed' : ''}`;
        item.dataset.id = t.taskId;
        
        // Find project name and customer nickname
        const proj = (window.allProjects || []).find(p => String(p.projectId) === String(t.projectId));
        const cust = proj ? (window.allCustomers || []).find(c => String(c.customerId) === String(proj.customerId)) : null;
        
        let displayValue = "";
        if (proj && cust) {
            const custName = cust.nickname || cust.companyName || "未知客戶";
            displayValue = `${custName}${proj.projectName ? ` - ${proj.projectName}` : ''}`;
        } else {
            // Fallback: This allows "Plain Text" to be stored in the projectId field
            displayValue = t.projectId || "";
        }

        const iconStyle = 'width: 20px; height: 20px; vertical-align: middle; filter: brightness(0) saturate(100%) invert(48%) sepia(23%) saturate(382%) hue-rotate(177deg) brightness(93%) contrast(85%);';
        const checkIcon = t.isCompleted ? 'assets/icons/checked.svg' : 'assets/icons/unchecked.svg';

        item.innerHTML = `
            <div class="task-drag-handle task-col-drag">
                <img src="assets/icons/drag.svg" style="width: 16px; height: 16px; ${iconStyle}">
            </div>
            <div class="autocomplete-container task-col-project">
                <input class="task-inline-input customer-search" value="${escapeHtml(displayValue)}" 
                       onfocus="this.select(); showTaskCustomerSearch(this, '${t.taskId}')" 
                       oninput="filterTaskCustomerSearch(this)"
                       onblur="window.saveTaskCustomTarget('${t.taskId}', this.value)"
                       placeholder="請輸入對象">
            </div>
            <div class="task-col-date" style="position: relative;">
                <div class="task-date-display" style="
                    font-size: 0.8125rem; 
                    color: var(--text-main); 
                    pointer-events: none; 
                    text-align: center;
                    background: #f1f5f9;
                    padding: 8px 0;
                    border-radius: 8px;
                    border: 1px solid transparent;
                    width: 100%;
                ">
                    ${t.taskDate ? t.taskDate.substring(5).replace('-', '/') : '00/00'}
                </div>
                <input type="date" class="task-inline-input" 
                       style="position: absolute; top:0; left:0; width:100%; height:100%; opacity: 0; cursor: pointer; z-index: 10;" 
                       value="${escapeHtml(t.taskDate || '')}" 
                       onclick="if(this.showPicker) this.showPicker()"
                       onchange="window.updateTaskField('${t.taskId}', 'taskDate', this.value)">
            </div>
            <div class="task-col-content">
                <input class="task-inline-input" value="${escapeHtml(t.taskName || '')}" 
                       onblur="window.updateTaskField('${t.taskId}', 'taskName', this.value)" 
                       placeholder="任務內容...">
            </div>
            <div class="task-actions task-col-actions">
                <button class="action-btn-icon btn-toggle-status" onclick="window.toggleTaskStatus('${t.taskId}')" title="完成/取消">
                    <img src="${checkIcon}" style="${iconStyle}">
                </button>
                <button class="action-btn-icon btn-duplicate-task" onclick="window.duplicateTask('${t.taskId}')" title="複製項目">
                    <img src="assets/icons/duplicate.svg" style="${iconStyle}">
                </button>
                <button class="action-btn-icon btn-delete-task" onclick="window.deleteTask('${t.taskId}')" title="刪除任務">
                    <img src="assets/icons/trash.svg" style="${iconStyle}">
                </button>
            </div>
        `;
        
        // Apply Permissions to inline buttons
        const btnToggle = item.querySelector('.btn-toggle-status');
        const btnDup = item.querySelector('.btn-duplicate-task');
        const btnDel = item.querySelector('.btn-delete-task');
        window.applyPermissionState(btnToggle, 'task_u');
        window.applyPermissionState(btnDup, 'task_c');
        window.applyPermissionState(btnDel, 'task_d');

        list.appendChild(item);
    });

    // Only enable Drag & Drop if sorted by 'drag'
    if (window.Sortable) {
        if (window.taskSortable) window.taskSortable.destroy();
        
        const isDragSort = (window.taskSort.column === 'drag');
        list.classList.toggle('is-draggable', isDragSort);
        window.taskSortable = new Sortable(list, {
            animation: 150,
            disabled: !isDragSort,
            filter: 'input, button, .action-btn-icon', // Prevent drag when clicking inputs or buttons
            preventOnFilter: false, // Allow interaction with filtered elements
            onStart: () => {
                if (!isDragSort) return false;
            },
            onEnd: () => {
                const items = Array.from(list.querySelectorAll('.task-item'));
                const orderedIds = items.map(el => el.dataset.id);
                window.saveTaskOrder(orderedIds);
            }
        });
    }
}

window.saveTaskOrder = async function(orderedIds) {
    // 1. Update orderWeight in memory based on new sequence
    orderedIds.forEach((id, index) => {
        const task = window.allTasks.find(t => String(t.taskId) === String(id));
        if (task) task.orderWeight = (index + 1) * 10;
    });

    // 2. Sync to Backend
    const updates = window.allTasks.filter(t => t.rowIndex).map(t => ({
        rowIndex: t.rowIndex,
        orderWeight: t.orderWeight
    }));

    if (updates.length === 0) return;

    setSyncStatus(true);
    try {
        await fetch(GAS_WEB_APP_URL, {
            method: 'POST', mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(window.buildApiPayload('update_tasks_order', { updates }))
        });
        console.log(">> Task order synced. Refreshing Row Indices...");
        window.fetchTasks(); // Ensure fresh indices
    } catch (e) {
        console.error("Order Sync Error:", e);
    } finally {
        setSyncStatus(false);
    }
}

window.updateTaskField = async function(taskId, field, value) {
    const task = window.allTasks.find(t => String(t.taskId) === String(taskId));
    if (!task || task[field] === value) return;

    if (window.saveLocks.get(taskId)) {
        setTimeout(() => window.updateTaskField(taskId, field, value), 500);
        return;
    }

    window.saveLocks.set(taskId, true);
    task[field] = value;
    
    // Always re-render on any field update to ensure UI is in sync
    window.filterTasksByProject();

    setSyncStatus(true);
    try {
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST', mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(window.buildApiPayload('save_task', { task }))
        });
        const json = await res.json();
        if (json.success && json.data) {
            task.rowIndex = json.data.rowIndex;
            // setCache('tasks', window.allTasks); // Removed persistence
        }
    } catch (e) { console.error(e); } finally {
        window.saveLocks.delete(taskId);
        setSyncStatus(false);
    }
}

window.toggleTaskStatus = function(taskId) {
    const task = window.allTasks.find(t => String(t.taskId) === String(taskId));
    if (!task) return;
    
    // Calculate new state but DO NOT update memory yet
    const newState = !task.isCompleted;
    
    // Let the central field updater handle memory and saving
    window.updateTaskField(taskId, 'isCompleted', newState);
}

window.deleteTask = function(taskId) {
    const task = window.allTasks.find(t => String(t.taskId) === String(taskId));
    if (!task) return;
    Swal.fire({
        title: '確定要刪除？',
        icon: 'warning',
        showDenyButton: true,
        showCancelButton: false,
        confirmButtonText: '刪除',
        denyButtonText: '取消',
        confirmButtonColor: '#ef4444',
        denyButtonColor: '#667A8E'
    }).then(async (result) => {
        if (result.isConfirmed) {
            window.allTasks = window.allTasks.filter(t => String(t.taskId) !== String(taskId));
            window.filterTasksByProject(); // Instant UI removal

            if (task.rowIndex) {
                setSyncStatus(true);
                try {
                    await fetch(GAS_WEB_APP_URL, {
                        method: 'POST', mode: 'cors',
                        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                        body: JSON.stringify(window.buildApiPayload('delete_task', { rowIndex: task.rowIndex }))
                    });
                    // Crucial: Refresh from backend to sync RowIndices for remaining tasks
                    window.fetchTasks();
                } catch(e) { console.error(e); } finally {
                    setSyncStatus(false);
                }
            }
            // setCache('tasks', window.allTasks); // Removed persistence
        }
    });
}

window.duplicateTask = async function(taskId) {
    const srcIndex = window.allTasks.findIndex(t => String(t.taskId) === String(taskId));
    if (srcIndex === -1) return;
    const src = window.allTasks[srcIndex];

    // Create a new copy with unique ID and no rowIndex yet
    // Set orderWeight slightly higher than source to appear below it
    const newTask = { 
        ...src, 
        taskId: 'T-' + Date.now(), 
        rowIndex: null, 
        orderWeight: parseFloat(src.orderWeight || 0) + 1, 
        isCompleted: false 
    };

    setSyncStatus(true);
    try {
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST', mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(window.buildApiPayload('save_task', { task: newTask }))
        });
        const json = await res.json();
        if (json.success && json.data) {
            newTask.rowIndex = json.data.rowIndex;
            // Insert directly after source in memory
            window.allTasks.splice(srcIndex + 1, 0, newTask);
            window.filterTasksByProject();
        }
    } catch (e) {
        console.error("Duplicate Error:", e);
    } finally {
        setSyncStatus(false);
    }
}


window.addTaskInline = function() {
    if (!window.hasPermission('task_c')) return Toast.fire({ icon: 'warning', title: '無新增任務權限' });
    const newTask = {
        taskId: 'T-' + Date.now(),
        projectId: '',
        taskName: '',
        taskDate: new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0'),
        taskTime: '09:00',
        isCompleted: false,
        orderWeight: Date.now(),
        rowIndex: null
    };
    
    window.allTasks.unshift(newTask);
    window.filterTasksByProject(); // Refresh UI and filters

    setTimeout(() => {
        const first = document.querySelector('#taskList .customer-search');
        if (first) first.focus();
    }, 150);
}

// --- Autocomplete Logic ---
window.showTaskCustomerSearch = function(input, taskId) {
    document.querySelectorAll('.task-autocomplete-dropdown').forEach(d => d.remove());
    const container = input.closest('.autocomplete-container');
    const dropdown = document.createElement('div');
    dropdown.className = 'task-autocomplete-dropdown';
    container.appendChild(dropdown);
    window.filterTaskCustomerSearch(input);

    const closeListener = (e) => {
        if (!container.contains(e.target)) {
            dropdown.remove();
            document.removeEventListener('click', closeListener);
        }
    };
    setTimeout(() => document.addEventListener('click', closeListener), 10);
}

window.filterTaskCustomerSearch = function(input) {
    const dropdown = input.nextElementSibling;
    if (!dropdown || !dropdown.classList.contains('task-autocomplete-dropdown')) return;
    const query = input.value.toLowerCase().trim();
    const projs = (window.allProjects || []).filter(p => p.status === '1' || p.status === '2');
    const custs = window.allCustomers || [];

    const data = projs.map(p => {
        const c = custs.find(curr => String(curr.customerId) === String(p.customerId));
        return {
            projectId: p.projectId,
            projectName: p.projectName,
            customerName: c ? (c.nickname || c.companyName) : '未知客戶',
            fullSearch: `${p.projectName} ${c ? (c.nickname + ' ' + c.companyName + ' ' + c.phone) : ''}`.toLowerCase()
        };
    });

    const filtered = query ? 
        data.filter(i => i.fullSearch.includes(query)).slice(0, 10) : data.slice(0, 8);

    dropdown.innerHTML = filtered.map(item => `
        <div class="task-autocomplete-item" onmousedown="window.selectTaskProjectForInline('${input.closest('.task-item').dataset.id}', '${item.projectId}')">
            <div style="font-weight: 600;">${escapeHtml(item.customerName)}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(item.projectName)}</div>
        </div>
    `).join('') || '<div class="task-autocomplete-item" style="color: var(--text-muted); cursor: default;">查無項目</div>';
}

window.selectTaskProjectForInline = async function(taskId, projectId) {
    const task = window.allTasks.find(t => String(t.taskId) === String(taskId));
    if (!task) return;
    
    // Explicitly update ID
    task.projectId = projectId;
    
    // Close dropdown instantly
    document.querySelectorAll('.task-autocomplete-dropdown').forEach(d => d.remove());

    // Mandatory Instant Refresh
    window.filterTasksByProject();

    // FORCE SAVE TO BACKEND IMMEDIATELY
    setSyncStatus(true);
    try {
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST', mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(window.buildApiPayload('save_task', { task }))
        });
        const json = await res.json();
        if (json.success && json.data) {
            task.rowIndex = json.data.rowIndex;
            // setCache('tasks', window.allTasks); // Removed persistence
        }
    } catch (e) {
        console.error("Save Error after Selection:", e);
    } finally {
        setSyncStatus(false);
    }
}

// Helper to save custom text if no project was selected from the dropdown
window.saveTaskCustomTarget = function(taskId, value) {
    const task = window.allTasks.find(t => String(t.taskId) === String(taskId));
    if (!task) return;

    // Normalizing empty
    const normalizedValue = (value || "").trim();
    
    // Determine the "expected" display string for the current linked project
    let currentDisplay = "";
    const proj = (window.allProjects || []).find(p => String(p.projectId) === String(task.projectId));
    if (proj) {
        const cust = (window.allCustomers || []).find(c => String(c.customerId) === String(proj.customerId));
        const custName = cust ? (cust.nickname || cust.companyName) : "未知客戶";
        currentDisplay = `${custName}${proj.projectName ? ` - ${proj.projectName}` : ''}`;
    } else {
        currentDisplay = task.projectId || "";
    }

    // Only update if the user's input is different from what we'd expect for the current state
    if (normalizedValue !== currentDisplay) {
        console.log(">> Task Target Blur: Saving custom text:", normalizedValue);
        window.updateTaskField(taskId, 'projectId', normalizedValue);
    }
}

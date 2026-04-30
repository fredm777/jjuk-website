// Project Management & Quotation Editor
// ==========================================

window.currentFilteredProjects = [];
window.projectPage = 1;
window.projectItemsPerPage = parseInt(localStorage.getItem('st_pro_project_items_per_page')) || 7;

// --- Sorting State ---
window.projectSortField = 'date';
window.projectSortOrder = 'desc';
// Initialize from cache or default to All (Pending + Ongoing + Completed)
const cachedProjFilters = typeof getCache === 'function' ? getCache('projectStatusFilters') : null;
window.projectStatusFilters = cachedProjFilters || ['1', '2', '3']; 
window.projectSearchQuery = '';

/**
 * Dynamic Print Configuration
 * Updates the @page size and orientation based on UI selection
 */
window.updatePrintConfig = function() {
    const size = document.getElementById('printPaperSize')?.value || 'A4';
    const orientation = document.getElementById('printOrientation')?.value || 'portrait';
    
    let styleEl = document.getElementById('dynamicPrintConfig');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'dynamicPrintConfig';
        document.head.appendChild(styleEl);
    }
    
    // Inject dynamic @page rule
    styleEl.innerHTML = `
        @media print {
            @page {
                size: ${size} ${orientation} !important;
                margin: 0.5cm !important;
            }
        }
    `;
    console.log(`>> Print Config Applied: ${size} ${orientation}`);
};

/**
 * Project Filtering System
 */
window.setProjectStatusFilter = function(status) {
    if (!window.projectStatusFilters) window.projectStatusFilters = [];
    
    const idx = window.projectStatusFilters.indexOf(status);
    if (idx > -1) {
        // Toggle off
        window.projectStatusFilters.splice(idx, 1);
    } else {
        // Toggle on
        window.projectStatusFilters.push(status);
    }
    
    // Save to cache
    if (typeof setCache === 'function') setCache('projectStatusFilters', window.projectStatusFilters);
    
    // Update UI highlights for 3 pills based on inclusion
    window.updateProjectFilterUI();
    
    window.projectPage = 1;
    window.renderProjects();
};

/**
 * Toggle Project Sorting
 */
window.toggleProjectSort = function(field) {
    if (window.projectSortField === field) {
        // Toggle order
        window.projectSortOrder = (window.projectSortOrder === 'asc') ? 'desc' : 'asc';
    } else {
        // New field
        window.projectSortField = field;
        // Default: dates and amounts descending (newest/most first), names ascending
        if (['date', 'total', 'depositPaid', 'balanceDue'].includes(field)) {
            window.projectSortOrder = 'desc';
        } else {
            window.projectSortOrder = 'asc';
        }
    }
    
    window.projectPage = 1;
    window.renderProjects();
};

/**
 * Update Header Icons UI
 */
window.updateProjectSortHeaderUI = function() {
    // Clear all
    document.querySelectorAll('.sortable-header').forEach(th => {
        th.classList.remove('active', 'asc', 'desc');
        const icon = th.querySelector('.sort-icon');
        if (icon) icon.innerHTML = '';
    });
    
    const activeTh = document.getElementById(`th-${window.projectSortField}`);
    if (activeTh) {
        activeTh.classList.add('active', window.projectSortOrder);
        const icon = activeTh.querySelector('.sort-icon');
        if (icon) {
            // Force text arrows to match Task list exactly
            icon.innerText = window.projectSortOrder === 'asc' ? ' ↑' : ' ↓';
        }
    }
};

window.updateProjectFilterUI = function() {
    const filters = window.projectStatusFilters || [];
    document.getElementById('projFilterPending')?.classList.toggle('active', filters.includes('1'));
    document.getElementById('projFilterOngoing')?.classList.toggle('active', filters.includes('2'));
    document.getElementById('projFilterCompleted')?.classList.toggle('active', filters.includes('3'));
};

// Initialize listeners
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('projectSearchInput');
    if (searchInput) {
        searchInput.oninput = () => {
            window.projectPage = 1;
            window.renderProjects();
        };
    }
    // Set initial active states
    setTimeout(() => {
        window.updateProjectFilterUI();
    }, 500);
});

window.fetchProjects = async function() {
    if (!window.currentUser || !window.currentUser.sheetId) {
        console.warn(">> fetchProjects skipped: No valid user or sheetId found.");
        return;
    }
    setSyncStatus(true);
    const loading = document.getElementById('projectLoading');
    if (loading) loading.style.display = 'block';

    try {
        const json = await window.apiPost('get_projects');
        if (json.success) {
            window.allProjects = json.projects || [];
            window.currentFilteredProjects = [...window.allProjects];
            window.renderProjects();
            if (typeof updateTaskProjectFilter === 'function') updateTaskProjectFilter();
            if (typeof filterTasksByProject === 'function') filterTasksByProject();
        } else {
            Swal.fire({
                title: '資料讀取受阻',
                text: json.error || '請確認個人設定中的試算表 ID 是否正確。',
                icon: 'info',
                confirmButtonColor: 'var(--primary)'
            });
        }
    } catch (err) { console.error("Fetch Projects Error:", err); }
    finally {
        setSyncStatus(false);
        if (loading) loading.style.display = 'none';
    }
}

window.syncSingleProject = async function(projectId) {
    if (!projectId) return;
    console.log(`>> Syncing single project: ${projectId}`);
    
    try {
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(window.buildApiPayload('get_project', { projectId }))
        });
        const json = await res.json();
        
        if (json.success && json.project) {
            const newProj = json.project;
            
            // 1. Update in-memory array
            if (!window.allProjects) window.allProjects = [];
            const idx = window.allProjects.findIndex(p => p.projectId === projectId);
            if (idx > -1) {
                window.allProjects[idx] = newProj;
            } else {
                window.allProjects.unshift(newProj);
            }
            
            // 2. Trigger UI Render (List View)
            window.renderProjects();
            
            console.log(`>> [SUCCESS] Single project sync completed: ${projectId}`);
            
            // 4. If current editor is open for this project, consider refreshing it 
            // (Only if it's not currently being edited/dirty, though usually this runs after a save)
            const currentEditorId = document.getElementById('projId')?.value;
            if (currentEditorId === projectId && !window.isQuotationModified) {
                console.log(">> Editor matches synced project, potentially refreshing view...");
                // Note: We don't necessarily want to force showQuotationEditor again 
                // because it resets the form, but we might update the rowIndex.
                if (document.getElementById('projRowIndex')) {
                    document.getElementById('projRowIndex').value = newProj.rowIndex || '';
                }
            }
            
            return newProj;
        }
    } catch (err) {
        console.error("Single Project Sync Error:", err);
    }
}

window.renderProjects = function() {
    const tbody = document.getElementById('projectTableBody');
    if (!tbody) return;

    const loading = document.getElementById('projectLoading');
    if (loading) loading.style.display = 'none';

    const query = (document.getElementById('projectSearchInput')?.value || '').toLowerCase();
    
    window.currentFilteredProjects = (window.allProjects || []).filter(p => {
        // Direct numeric comparison (Spreadsheet V column)
        const s = String(p.status || '');

        const filterArr = window.projectStatusFilters || ['1', '2'];
        const matchesStatus = (filterArr.length === 0) || filterArr.includes(s);
        
        // Link with customer data for deeper search
        const cust = window.allCustomers ? window.allCustomers.find(c => String(c.customerId) === String(p.customerId)) : null;
        const custName = (cust ? (cust.companyName || cust.nickname || '') : '').toLowerCase();
        const taxId = (cust?.taxId || '').toLowerCase();
        const contact = (cust?.contact || '').toLowerCase();
        const phone = (cust?.phone || '').toLowerCase();
        const email = (cust?.email || '').toLowerCase();
        
        const matchesQuery = !query || 
            (p.projectName || '').toLowerCase().includes(query) ||
            (p.pic || '').toLowerCase().includes(query) ||
            custName.includes(query) ||
            taxId.includes(query) ||
            contact.includes(query) ||
            phone.includes(query) ||
            email.includes(query);
            
        return matchesStatus && matchesQuery;
    });

    // --- SORTING STEP ---
    const field = window.projectSortField || 'date';
    const order = window.projectSortOrder || 'desc';
    const multi = (order === 'desc') ? -1 : 1;

    window.currentFilteredProjects.sort((a, b) => {
        let valA, valB;

        switch (field) {
            case 'customer':
                const cA = window.allCustomers ? window.allCustomers.find(c => String(c.customerId) === String(a.customerId)) : null;
                const cB = window.allCustomers ? window.allCustomers.find(c => String(c.customerId) === String(b.customerId)) : null;
                valA = (cA ? (cA.companyName || cA.nickname || '') : '').toLowerCase();
                valB = (cB ? (cB.companyName || cB.nickname || '') : '').toLowerCase();
                break;
            case 'date':
                valA = a.date || '0000-00-00';
                valB = b.date || '0000-00-00';
                break;
            case 'total':
            case 'depositPaid':
            case 'balanceDue':
                valA = parseFloat(a[field]) || 0;
                valB = parseFloat(b[field]) || 0;
                break;
            default:
                valA = (a[field] || '').toLowerCase();
                valB = (b[field] || '').toLowerCase();
        }

        if (valA < valB) return -1 * multi;
        if (valA > valB) return 1 * multi;
        return 0;
    });

    // Update Header UI
    window.updateProjectSortHeaderUI();

    tbody.innerHTML = '';
    if (window.currentFilteredProjects.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center; padding: 60px 0; color: var(--text-muted); opacity: 0.6;">
                    <div style="margin-bottom: 20px;">
                        <img src="assets/icons/projects.svg" style="width: 64px; height: 64px; filter: grayscale(1) brightness(1.5); opacity: 0.3;">
                    </div>
                    <p style="font-size: 0.9375rem;">目前沒有符合條件的專案項目</p>
                </td>
            </tr>
        `;
        const pag = document.getElementById('projectPaginationContainer');
        if (pag) pag.style.display = 'none';
        return;
    }

    const totalPages = Math.ceil(window.currentFilteredProjects.length / window.projectItemsPerPage);
    if (window.projectPage > totalPages) window.projectPage = totalPages || 1;
    
    const start = (window.projectPage - 1) * window.projectItemsPerPage;
    const end = start + window.projectItemsPerPage;
    const pagedEntries = window.currentFilteredProjects.slice(start, end);

    const pag = document.getElementById('projectPaginationContainer');
    if (pag) pag.style.display = (window.currentFilteredProjects.length > 0) ? 'flex' : 'none';
    const info = document.getElementById('projPageInfo');
    if (info) info.innerText = `第 ${window.projectPage} / ${totalPages || 1} 頁 (共 ${window.currentFilteredProjects.length} 筆)`;

    pagedEntries.forEach(proj => {
        const cust = window.allCustomers ? window.allCustomers.find(c => c.customerId === proj.customerId) : null;
        const custDispRaw = cust ? (cust.companyName || cust.nickname) : proj.customerId;
        const custDisp = custDispRaw || '';
        const projNameDisp = proj.projectName || '';

        const dateStr = proj.date || '';
        const totalDisp = proj.total ? Number(proj.total).toLocaleString() : '0';
        const depositDisp = proj.depositPaid ? Number(proj.depositPaid).toLocaleString() : '0';
        const balanceDisp = proj.balanceDue ? Number(proj.balanceDue).toLocaleString() : '0';
        const balanceStyle = (parseFloat(proj.balanceDue) > 0) ? 'color: #ef4444; font-weight: 500;' : 'color: #94a3b8;';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="truncate-5" title="${escapeHtml(custDispRaw)}">${escapeHtml(custDisp)}</span></td>
            <td>${escapeHtml(dateStr)}</td>
            <td><span class="truncate-5" title="${escapeHtml(proj.projectName || '')}">${escapeHtml(projNameDisp)}</span></td>
            <td>${escapeHtml(proj.pic || '')}</td>
            <td style="color:var(--text-muted);">$${depositDisp}</td>
            <td style="${balanceStyle}">$${balanceDisp}</td>
            <td style="font-weight:700; color:var(--primary);">$${totalDisp}</td>
        `;
        tr.style.cursor = 'pointer';
        tr.onclick = (e) => {
            // Prevent opening if clicking on some action button or checkbox if added later
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A' || e.target.tagName === 'INPUT') return;
            showQuotationEditor('編輯報價單', proj);
        };
        tbody.appendChild(tr);
    });
    
    if (window.lucide) lucide.createIcons();
}

window.showQuotationEditor = async function(title, data = null) {
    // Ensure settings are cached before opening so we can instantly read bank & remark data
    if (!window.sysSettingsCache && window.currentUser && window.currentUser.sheetId) {
        try {
            const loading = document.getElementById('projectLoading');
            if (loading) loading.style.display = 'block';
            const res = await fetch(GAS_WEB_APP_URL, {
                method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(window.buildApiPayload('get_settings'))
            });
            const json = await res.json();
            if (json.success) window.sysSettingsCache = json.settings;
            if (loading) loading.style.display = 'none';
        } catch(e) {}
    }

    // Mobile Reminder
    if (window.innerWidth <= 768) {
        Swal.fire({
            title: '溫馨提示',
            text: '建議使用電腦瀏覽器進行編輯與輸出，以獲得最佳體驗與排版效果。',
            icon: 'info',
            confirmButtonText: '知道了',
            confirmButtonColor: '#667A8E'
        });
    }

    if (typeof switchSubView === 'function') switchSubView('projects', 'edit');
    const form = document.getElementById('quotationForm');
    if (form) form.reset();
    if (document.getElementById('quotationTitle')) document.getElementById('quotationTitle').innerText = title;
    if (document.getElementById('quotationItemsBody')) document.getElementById('quotationItemsBody').innerHTML = '';
    
    // Clear suggests & dataset
    const suggest = document.getElementById('autocompleteSuggestions');
    if (suggest) suggest.style.display = 'none';
    const qCustSearch = document.getElementById('qCustSearch');
    if (qCustSearch) delete qCustSearch.dataset.selectedId;

    if (data) {
        // Edit Mode
        if (document.getElementById('projRowIndex')) document.getElementById('projRowIndex').value = data.rowIndex || '';
        if (document.getElementById('projId')) document.getElementById('projId').value = data.projectId || '';
        if (document.getElementById('qProjName')) document.getElementById('qProjName').value = data.projectName || '';
        if (document.getElementById('qPic')) document.getElementById('qPic').value = data.pic || '';
        if (document.getElementById('qDate')) document.getElementById('qDate').value = data.date || '';
        
        if (document.getElementById('qWfDraft')) document.getElementById('qWfDraft').value = data.days || '';
        if (document.getElementById('qWfEdit')) document.getElementById('qWfEdit').value = data.revCount || '';
        if (document.getElementById('qWfOrder')) document.getElementById('qWfOrder').value = data.wfOrder || '';
        if (document.getElementById('qWfDeposit')) document.getElementById('qWfDeposit').value = data.wfDeposit || '';
        if (document.getElementById('qWfDelivery')) document.getElementById('qWfDelivery').value = data.wfDelivery || '';
        if (document.getElementById('qBankData')) document.getElementById('qBankData').value = data.bankData || '';
        if (document.getElementById('qWfRemark')) document.getElementById('qWfRemark').value = data.remark || '';
        if (document.getElementById('qDepositPaid')) document.getElementById('qDepositPaid').value = data.depositPaid || 0;
        
        const finalStatus = String(data.status || '1');
        if (document.getElementById('projStatus')) document.getElementById('projStatus').value = finalStatus;
        if (typeof updateProjectStatusUI === 'function') updateProjectStatusUI(finalStatus);
        
        if (typeof window.selectQuotationCustomer === 'function') window.selectQuotationCustomer(data.customerId, true);
        
        if (window.currentUser) {
            if (window.currentUser.phone && document.getElementById('qStudioPhone')) document.getElementById('qStudioPhone').innerText = window.currentUser.phone;
            if (window.currentUser.email && document.getElementById('qStudioEmail')) document.getElementById('qStudioEmail').innerText = window.currentUser.email;
        }
        
        fetchProjectItems(data.projectId);
    } else {
        // New Mode
        if (document.getElementById('projRowIndex')) document.getElementById('projRowIndex').value = '';
        if (document.getElementById('projId')) document.getElementById('projId').value = generateProjectId();
        if (document.getElementById('projStatus')) document.getElementById('projStatus').value = '1';
        if (typeof updateProjectStatusUI === 'function') updateProjectStatusUI('1');
        const userName = window.currentUser ? (window.currentUser.nickname || window.currentUser.username) : '';
        if (document.getElementById('qPic')) document.getElementById('qPic').value = userName;
        if (document.getElementById('qDate')) document.getElementById('qDate').value = new Date().toISOString().split('T')[0];
        
        if (window.currentUser) {
            if (window.currentUser.phone && document.getElementById('qStudioPhone')) document.getElementById('qStudioPhone').innerText = window.currentUser.phone;
            if (window.currentUser.email && document.getElementById('qStudioEmail')) document.getElementById('qStudioEmail').innerText = window.currentUser.email;
        }

        // --- NEW: Auto-import System Settings (Values only for NEW) ---
        if (window.sysSettingsCache) {
            const s = window.sysSettingsCache;
            // 1. Bank/Remittance formatting
            const bankStr = [
                s.bank_name ? `銀行：${s.bank_name}${s.bank_code ? ' (' + s.bank_code + ')' : ''}` : '',
                s.bank_branch ? `分行：${s.bank_branch}${s.branch_code ? ' (' + s.branch_code + ')' : ''}` : '',
                s.account_name ? `戶名：${s.account_name}` : '',
                s.account_num ? `帳號：${s.account_num.replace(/^'/, '')}` : ''
            ].filter(x => x).join('\n');
            if (document.getElementById('qBankData')) document.getElementById('qBankData').value = bankStr;

            // 2. Workflow Contents
            if (document.getElementById('qWfOrder')) document.getElementById('qWfOrder').value = s.wf_order || '';
            if (document.getElementById('qWfDeposit')) document.getElementById('qWfDeposit').value = s.wf_deposit || '';
            if (document.getElementById('qWfDraft')) document.getElementById('qWfDraft').value = s.wf_draft || '';
            if (document.getElementById('qWfEdit')) document.getElementById('qWfEdit').value = s.wf_edit || '';
            if (document.getElementById('qWfDelivery')) document.getElementById('qWfDelivery').value = s.wf_delivery || '';
            if (document.getElementById('qWfRemark')) document.getElementById('qWfRemark').value = s.wf_remark || '';
        }
        
        addQuotationRow(); 
    }

    // --- GLOBAL: Sync Labels from System Settings (ALWAYS RUN) ---
    if (window.sysSettingsCache) {
        const s = window.sysSettingsCache;
        if (document.getElementById('qWfOrderLbl')) document.getElementById('qWfOrderLbl').innerText = s.wf_order_lbl || '訂購單';
        if (document.getElementById('qWfDepositLbl')) document.getElementById('qWfDepositLbl').innerText = s.wf_deposit_lbl || '訂金';
        if (document.getElementById('qWfDraftLbl')) document.getElementById('qWfDraftLbl').innerText = s.wf_draft_lbl || '初稿';
        if (document.getElementById('qWfEditLbl')) document.getElementById('qWfEditLbl').innerText = s.wf_edit_lbl || '修改次數';
        if (document.getElementById('qWfDeliveryLbl')) document.getElementById('qWfDeliveryLbl').innerText = s.wf_delivery_lbl || '交付內容';
        if (document.getElementById('qWfRemarkLbl')) document.getElementById('qWfRemarkLbl').innerText = s.wf_remark_lbl || '其他';
    }
    
    if (window.lucide) lucide.createIcons();
    if (typeof initQuotationAutocomplete === 'function') initQuotationAutocomplete();
    
    // Safety: Reset modification state after initialization to prevent ghost auto-saves
    if (quotationAutoSaveTimer) clearTimeout(quotationAutoSaveTimer);
    window.isQuotationModified = false;

    // Toggle delete and duplicate buttons visibility based on existing record
    const saveBtn = form ? form.querySelector('button[type="submit"]') : null;
    const isUpdate = !!data;
    window.applyPermissionState(saveBtn, isUpdate ? 'proj_u' : 'proj_c');

    const deleteBtn = document.getElementById('deleteProjectBtn');
    const duplicateBtn = document.getElementById('duplicateProjectBtn');
    if (deleteBtn) {
        deleteBtn.style.display = data ? 'flex' : 'none';
        window.applyPermissionState(deleteBtn, 'proj_d');
    }
    if (duplicateBtn) {
        duplicateBtn.style.display = data ? 'flex' : 'none';
        window.applyPermissionState(duplicateBtn, 'proj_c');
    }

    // --- NEW: Force Auto-expand for all textareas after load ---
    setTimeout(() => {
        const allTextareas = form.querySelectorAll('textarea');
        allTextareas.forEach(ta => {
            if (typeof window.autoExpandTextarea === 'function') {
                window.autoExpandTextarea(ta);
            }
        });
    }, 150);
}

window.deleteProject = async function() {
    const projectId = document.getElementById('projId').value;
    const projName = document.getElementById('qProjName').value || '未命名專案';
    
    if (!window.hasPermission('proj_d')) return Swal.fire('權限不足', '您的帳號級別無法執行刪除動作', 'error');

    const result = await Swal.fire({
        title: '確定要刪除？',
        text: `我們即將刪除專案「${projName}」，所有相關細項與報價內容將一併移除，且無法復原。`,
        icon: 'warning',
        showDenyButton: true,
        showCancelButton: false,
        confirmButtonText: '確定刪除',
        denyButtonText: '取消',
        confirmButtonColor: '#ef4444',
        denyButtonColor: '#667A8E'
    });

    if (!result.isConfirmed) return;

    setSyncStatus(true);
    try {
        const body = {
            action: 'delete_project',
            projectId: projectId
        };
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(window.buildApiPayload('delete_project', body))
        });
        const json = await res.json();
        if (json.success) {
            Toast.fire({ icon: 'success', title: '專案報價單已刪除' });
            window.isQuotationModified = false;
            window.switchSubView('projects', 'list');
            if (typeof window.fetchProjects === 'function') window.fetchCustomers(); // Also refresh customers as they may be linked
            if (typeof window.fetchProjects === 'function') window.fetchProjects();
        } else {
            throw new Error(json.error);
        }
    } catch (e) {
        Swal.fire('刪除失敗', e.message || '請重新嘗試', 'error');
    } finally {
        setSyncStatus(false);
    }
}

window.duplicateProject = function() {
    // 1. Clear ID and Row Index to treat this as a NEW record
    if (document.getElementById('projRowIndex')) document.getElementById('projRowIndex').value = '';
    const newId = generateProjectId();
    if (document.getElementById('projId')) document.getElementById('projId').value = newId;

    // 2. Update Title
    if (document.getElementById('quotationTitle')) document.getElementById('quotationTitle').innerText = '複製報價單';

    // 3. Mark as modified
    window.isQuotationModified = true;

    // 4. Hide delete and duplicate buttons (since it's now a NEW unsaved project)
    const delBtn = document.getElementById('deleteProjectBtn');
    if (delBtn) delBtn.style.display = 'none';
    const dupBtn = document.getElementById('duplicateProjectBtn');
    if (dupBtn) dupBtn.style.display = 'none';

    Toast.fire({ icon: 'success', title: '專案資料已複製至新表單，請點擊「儲存專案」以完成' });
};

window.updateProjectStatusUI = function(status) {
    const icon = document.getElementById('quoteStatusIcon');
    const text = document.getElementById('quoteStatusText');
    const select = document.getElementById('projStatusSelect');
    if (!text) return;
    
    // Modernized configurations
    const configs = {
        '1': { 
            text: '待確認', 
            icon: 'assets/icons/TBD.svg', 
            color: '#64748b',
            decoration: 'none'
        },
        '2': { 
            text: '進行中', 
            icon: 'assets/icons/unchecked.svg', 
            color: '#00C800',
            decoration: 'none'
        },
        '3': { 
            text: '已完成', 
            icon: 'assets/icons/checked.svg', 
            color: '#94a3b8',
            decoration: 'line-through'
        }
    };

    const cfg = configs[status] || configs['1'];
    
    if (icon) icon.src = cfg.icon;
    text.innerText = cfg.text;
    text.style.color = cfg.color;
    text.style.textDecoration = cfg.decoration;
    text.style.fontWeight = (status === '3') ? '500' : '600';
    
    if (select) select.value = status;
}

window.handleStatusChange = function(status) {
    if (typeof updateProjectStatusUI === 'function') updateProjectStatusUI(status);
    window.isQuotationModified = true;
    console.log(">> Status changed to:", status, "- triggering instant sync...");
    window.handleQuotationSubmit(null, true); // Instant sync on status change
}

window.handleAddProjectTask = function() {
    const projId = document.getElementById('projId').value;
    const rowIndex = document.getElementById('projRowIndex').value;
    
    if (!rowIndex) {
        Swal.fire({
            title: '需先儲存報價單',
            text: '系統將為您自動儲存，並導向任務清單新增任務。',
            icon: 'info',
            showCancelButton: true,
            confirmButtonText: '確定',
            cancelButtonText: '取消'
        }).then((result) => {
            if (result.isConfirmed) {
                window._redirectAfterSaveToTasks = true;
                handleQuotationSubmit(new Event('submit'));
            }
        });
    } else {
        const tBtn = document.getElementById('tasksTabBtn');
        if (tBtn) tBtn.click();
        setTimeout(() => {
            const filter = document.getElementById('taskProjectFilter');
            if (filter) filter.value = projId;
            if (typeof filterTasksByProject === 'function') filterTasksByProject();
            if (typeof showTaskEditorPage === 'function') showTaskEditorPage();
        }, 300);
    }
}

async function fetchProjectItems(projId) {
    const proj = (window.allProjects || []).find(p => p.projectId === projId);
    const tbody = document.getElementById('quotationItemsBody');
    if (tbody) tbody.innerHTML = '';
    
    if (proj && proj.items && proj.items.length > 0) {
        proj.items.forEach(item => {
            addQuotationRow(item);
        });
    } else if (projId) {
        console.log(">> Items missing in cache, triggering precision sync...");
        const refreshedProj = await syncSingleProject(projId);
        if (refreshedProj && refreshedProj.items && refreshedProj.items.length > 0) {
            refreshedProj.items.forEach(item => addQuotationRow(item));
        } else {
            addQuotationRow();
        }
    } else {
        addQuotationRow(); 
    }
}

function generateProjectId() {
    const date = new Date();
    const YYYYMMDD = date.getFullYear() + String(date.getMonth() + 1).padStart(2, '0') + String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 999).toString().padStart(3, '0');
    return `SP-${YYYYMMDD}-${random}`;
}

async function loadSettingsPreview() {
    try {
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(window.buildApiPayload('get_settings'))
        });
        const json = await res.json();
        if (json.success) {
            const s = json.settings;
            
            // Utility to strip leading quote for UI display
            const clean = (val) => {
                const str = String(val || '');
                return str.startsWith("'") ? str.slice(1) : str;
            };

            const bankField = document.getElementById('qBankData');
            if (bankField) {
                const bname = clean(s.bank_name);
                const bcode = clean(s.bank_code);
                const bbranch = clean(s.bank_branch);
                const brcode = clean(s.branch_code);
                const aname = clean(s.account_name);
                const anum = clean(s.account_num);
                
                const parts = [];
                if (bname) parts.push(`銀行：${bname}${bcode ? ` (${bcode})` : ''}`);
                if (bbranch) parts.push(`分行：${bbranch}${brcode ? ` (${brcode})` : ''}`);
                if (aname) parts.push(`戶名：${aname}`);
                if (anum) parts.push(`帳號：${anum}`);
                bankField.value = parts.join('\n');
            }
            // Sync other workflow labels and text
            const mapping = [
                { val: 'qWfOrder', lbl: 'qWfOrderLbl', data: s.wf_order, text: s.wf_order_lbl, def: '訂購單說明' },
                { val: 'qWfDeposit', lbl: 'qWfDepositLbl', data: s.wf_deposit, text: s.wf_deposit_lbl, def: '訂金規則' },
                { val: 'qWfDraft', lbl: 'qWfDraftLbl', data: s.wf_draft, text: s.wf_draft_lbl, def: '初稿天數' },
                { val: 'qWfEdit', lbl: 'qWfEditLbl', data: s.wf_edit, text: s.wf_edit_lbl, def: '修改次數' }
            ];

            mapping.forEach(m => {
                const vEl = document.getElementById(m.val);
                const lEl = document.getElementById(m.lbl);
                if (vEl) vEl.value = clean(m.data);
                if (lEl) lEl.innerText = clean(m.text) || m.def;
            });
            
            if (document.getElementById('qWfDelivery')) document.getElementById('qWfDelivery').value = clean(s.wf_delivery);
            if (document.getElementById('qWfDeliveryLbl')) document.getElementById('qWfDeliveryLbl').innerText = clean(s.wf_delivery_lbl) || '交付內容說明';
            
            if (document.getElementById('qWfRemark')) {
                document.getElementById('qWfRemark').value = clean(s.wf_remark);
                autoExpandTextarea(document.getElementById('qWfRemark'));
            }
            if (document.getElementById('qWfRemarkLbl')) document.getElementById('qWfRemarkLbl').innerText = clean(s.wf_remark_lbl) || '其他說明';
            
            // Add listeners to workflow textareas
            ['qBankData', 'qWfOrder', 'qWfDeposit', 'qWfDraft', 'qWfEdit', 'qWfDelivery', 'qWfRemark'].forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.addEventListener('input', () => autoExpandTextarea(el));
                    autoExpandTextarea(el);
                }
            });
        }
    } catch(e) {}
}

window.autoExpandTextarea = function(el) {
    if (!el) return;
    // Temporarily shrink to minimum to get true scrollHeight without previous height interference
    el.style.height = '1px';
    // Calculate border thickness (offsetHeight includes borders, clientHeight does not)
    const borderOffset = el.offsetHeight - el.clientHeight;
    // Set exact height to fit text + padding + borders without extra space
    el.style.height = (el.scrollHeight + borderOffset) + 'px';
};

// Listen for window resize to fix height on text wrapping
window.addEventListener('resize', () => {
    const editView = document.getElementById('projectsEditView');
    if (editView && editView.classList.contains('active')) {
        const textareas = editView.querySelectorAll('textarea');
        textareas.forEach(ta => window.autoExpandTextarea(ta));
    }
});

function addQuotationRow(data = null) {
    const tbody = document.getElementById('quotationItemsBody');
    if (!tbody) return;
    const rowIdx = tbody.children.length + 1;
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td class="text-center" data-label="#" style="cursor: pointer; color: var(--primary); font-weight: 700;" title="連點兩下刪除此列" ondblclick="if(confirm('確定要刪除此列項目？')) { this.closest('tr').remove(); calcQuotation(); triggerQuotationAutoSave(); }">${rowIdx}</td>
        <td data-label="項目名稱"><input class="i-name" placeholder="項目名稱" value="${data ? escapeHtml(data.name) : ''}" oninput="triggerQuotationAutoSave()"></td>
        <td data-label="細項詳述"><textarea class="i-content" placeholder="細項詳述..." rows="1" style="resize:vertical;" oninput="autoExpandTextarea(this); triggerQuotationAutoSave()">${data ? escapeHtml(data.content) : ''}</textarea></td>
        <td data-label="單價"><input type="number" class="i-price text-right" value="${data ? data.price : ''}" oninput="calcQuotation(); triggerQuotationAutoSave();"></td>
        <td data-label="數量"><input type="number" class="i-qty text-center" value="${data ? data.qty : 1}" oninput="calcQuotation(); triggerQuotationAutoSave();"></td>
        <td data-label="小計">
            <input type="number" class="i-total text-right fw-bold" readonly tabindex="-1" value="${data ? data.subtotal : 0}">
        </td>
    `;
    tbody.appendChild(tr);

    // Initial expansion for loaded data
    const ta = tr.querySelector('textarea');
    if (ta && data && data.content) {
        setTimeout(() => autoExpandTextarea(ta), 0);
    }

    calcQuotation();
}

function calcQuotation() {
    let subtotal = 0;
    const rows = document.querySelectorAll('#quotationItemsBody tr');
    rows.forEach((row, idx) => {
        row.cells[0].innerText = idx + 1; 
        const priceField = row.querySelector('.i-price');
        const qtyField = row.querySelector('.i-qty');
        const price = priceField ? parseFloat(priceField.value) || 0 : 0;
        const qty = qtyField ? parseFloat(qtyField.value) || 0 : 0;
        const total = price * qty;
        const totalField = row.querySelector('.i-total');
        if (totalField) totalField.value = total;
        subtotal += total;
    });
    const tax = Math.round(subtotal * 0.05);
    const total = subtotal + tax;
    const deposit = parseFloat(document.getElementById('qDepositPaid')?.value) || 0;
    const balance = total - deposit;

    if (document.getElementById('qSubtotal')) document.getElementById('qSubtotal').innerText = subtotal.toLocaleString();
    if (document.getElementById('qTax')) document.getElementById('qTax').innerText = tax.toLocaleString();
    if (document.getElementById('qTotal')) document.getElementById('qTotal').innerText = total.toLocaleString();
    if (document.getElementById('qBalanceDue')) document.getElementById('qBalanceDue').innerText = balance.toLocaleString();
}

let quotationAutoSaveTimer = null;
/**
 * Triggers a background save with a 3-second debounce to prevent spamming GAS
 */
window.triggerQuotationAutoSave = function() {
    window.isQuotationModified = true; // Mark as dirty
    if (quotationAutoSaveTimer) clearTimeout(quotationAutoSaveTimer);
    quotationAutoSaveTimer = setTimeout(() => {
        const editView = document.getElementById('projectsEditView');
        if (editView && editView.style.display !== 'none') {
            console.log(">> Debounced Auto-save triggering...");
            window.handleQuotationSubmit(null, true);
        }
    }, 3000); 
}

let isSavingQuotation = false;
let nextSavePending = false; // Queue for rapid edits
window.isQuotationModified = false; // Flag for unsaved changes

window.handleQuotationSubmit = async function (e, isBackground = false) {
    if (e) e.preventDefault();
    
    if (isSavingQuotation) {
        if (isBackground) {
            console.log(">> Save in progress, queueing next background save...");
            nextSavePending = true;
        }
        return;
    }

    if (typeof window.setSyncStatus === 'function') window.setSyncStatus(true);
    isSavingQuotation = true;

    // Helper to extract values
    const getVal = (id) => document.getElementById(id)?.value || '';
    const getText = (id) => document.getElementById(id)?.innerText.replace(/,/g, '') || '0';
    const ensureLit = (val) => (val && String(val).startsWith('0')) ? "'" + val : val;

    const rowIdxInput = document.getElementById('projRowIndex');
    let rowIndex = rowIdxInput?.value || '';
    const projectId = getVal('projId');

    // Permission check
    const isUpdate = !!rowIndex;
    if (isUpdate && !window.hasPermission('proj_u')) {
        Swal.fire('權限不足', '您的帳號級別無法編輯專案', 'error');
        isSavingQuotation = false;
        return;
    }
    if (!isUpdate && !window.hasPermission('proj_c')) {
        Swal.fire('權限不足', '您的帳號級別無法建立專案', 'error');
        isSavingQuotation = false;
        return;
    }

    // Safety Match: Find rowIndex if missing
    if (!rowIndex && projectId) {
        const found = (window.allProjects || []).find(p => p.projectId === projectId);
        if (found?.rowIndex) {
            rowIndex = found.rowIndex;
            if (rowIdxInput) rowIdxInput.value = rowIndex;
        }
    }

    const projStatus = getVal('projStatusSelect') || '1';

    // Build Project Object (Strict A-P Mapping)
    const project = {
        rowIndex,
        projectId,
        date: getVal('qDate'),
        projectName: getVal('qProjName'),
        customerId: document.getElementById('qCustSearch')?.dataset.selectedId || '',
        pic: getVal('qPic'),
        subtotal: parseFloat(getText('qSubtotal')),
        tax: parseFloat(getText('qTax')),
        total: parseFloat(getText('qTotal')),
        days: getVal('qWfDraft'),
        revCount: getVal('qWfEdit'),
        wfOrder: getVal('qWfOrder'),
        wfDeposit: getVal('qWfDeposit'),
        bankData: ensureLit(getVal('qBankData')),
        wfDelivery: getVal('qWfDelivery'),
        remark: getVal('qWfRemark'),
        depositPaid: parseFloat(getVal('qDepositPaid')) || 0,
        balanceDue: parseFloat(getText('qBalanceDue')) || 0,
        status: projStatus,
        isCompleted: projStatus === '3'
    };

    // Build Items Array
    const items = Array.from(document.querySelectorAll('#quotationItemsBody tr')).map(row => {
        const getRowVal = (cls) => row.querySelector(cls)?.value || '';
        const iName = getRowVal('.i-name');
        
        // --- DEBUG: Name Collision Check ---
        if (iName && iName === project.projectName) {
            console.warn(">> DEBUG WARNING: Item name is identical to project name! Possible auto-fill/leak detected.", { iName, projectName: project.projectName });
        }
        
        return {
            index: row.cells[0].innerText,
            name: iName,
            content: getRowVal('.i-content'),
            price: parseFloat(getRowVal('.i-price')) || 0,
            qty: parseFloat(getRowVal('.i-qty')) || 0,
            subtotal: parseFloat(getRowVal('.i-total')) || 0
        };
    });

    // --- DEBUG: Log full payload before sending ---
    console.log(">> handleQuotationSubmit: Sending Payload", { 
        project: project.projectName, 
        pId: project.projectId, 
        itemsCount: items.length, 
        firstItem: items[0] 
    });

    try {
        const response = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            mode: 'cors', 
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(window.buildApiPayload('save_project', { project, items }))
        });

        const result = await response.json();

        if (result.success) {
            if (result.rowIndex && rowIdxInput) rowIdxInput.value = result.rowIndex;
            window.isQuotationModified = false;

            // --- INSTANT CACHE UPDATE: Update local memory before background sync finishes ---
            if (window.allProjects) {
                const idx = window.allProjects.findIndex(p => p.projectId === projectId);
                const updatedProj = { ...project, items, rowIndex: result.rowIndex || project.rowIndex };
                if (idx > -1) {
                    window.allProjects[idx] = updatedProj;
                } else {
                    window.allProjects.unshift(updatedProj);
                }
                window.renderProjects(); // Refresh list immediately
            }

            if (!isBackground) {
                // For manual saves, we AWAIT the precision sync to ensure consistency
                if (typeof syncSingleProject === 'function') await syncSingleProject(projectId);
                switchSubView('projects', 'list');
            } else {
                console.log(">> Async Sync success. Row:", result.rowIndex);
                // Precision sync for background saves (fire and forget)
                if (typeof syncSingleProject === 'function') syncSingleProject(projectId);
            }
        } else {
            throw new Error(result.error || '儲存失敗');
        }
    } catch (err) {
        console.error("Save Error:", err);
        if (!isBackground) Swal.fire('儲存失敗', err.message, 'error');
    } finally {
        isSavingQuotation = false;
        if (typeof window.setSyncStatus === 'function') window.setSyncStatus(false);
        
        // Handle Queued Save
        if (nextSavePending) {
            console.log(">> Triggering queued save...");
            nextSavePending = false;
            window.handleQuotationSubmit(null, true);
        }
    }
};

window.filterProjects = function(val) {
    const query = String(val).toLowerCase().trim();
    if (!query) {
        window.currentFilteredProjects = [...(window.allProjects || [])];
    } else {
        window.currentFilteredProjects = (window.allProjects || []).filter(p => {
            const pCustId = String(p.customerId || '').trim();
            const cust = (window.allCustomers || []).find(c => String(c.customerId || '').trim() === pCustId);
            
            if (val && val.length > 1 && !cust && query !== '') {
                // Optional: log if we can't find a customer for a project during an active search
                // console.warn(`>> Search: Project ${p.projectId} has no linked customer [${pCustId}]`);
            }

            // 1. Basic Fields (Project Name, PIC)
            const matchBasic = (p.projectName || '').toLowerCase().includes(query) ||
                               (p.pic || '').toLowerCase().includes(query);
            
            // 2. Customer Related Fields (Company Name, Nickname, Address, Tax ID)
            const matchCustomer = cust ? (
                (cust.companyName || '').toLowerCase().includes(query) ||
                (cust.nickname || '').toLowerCase().includes(query) ||
                (cust.address || '').toLowerCase().includes(query) ||
                (cust.taxId || '').toLowerCase().includes(query)
            ) : false;

            return matchBasic || matchCustomer;
        });
    }
    window.projectPage = 1;
    window.renderProjects();
};

window.preparePrint = function() {
    const originalTitle = document.title;
    const dateVal = document.getElementById('qDate') ? document.getElementById('qDate').value : ''; 
    const custName = document.getElementById('qCustName') ? document.getElementById('qCustName').value : '客戶';
    const projName = document.getElementById('qProjName') ? document.getElementById('qProjName').value : '未命名專案';
    
    // Sync Status to Print Area
    const statusSelect = document.getElementById('projStatusSelect');
    const statusVal = statusSelect ? statusSelect.value : '1';
    const statsEl = document.getElementById('qStatusPrint');
    if (statsEl) {
        let statusLabel = '待確認';
        let color = '#64748b';
        if (statusVal === '2') { statusLabel = '進行中'; color = '#3b82f6'; }
        else if (statusVal === '3') { statusLabel = '已完成'; color = '#00C800'; }
        
        statsEl.innerText = statusLabel;
        statsEl.style.color = color;
    }

    let yymmdd = '';
    if (dateVal) {
        const parts = dateVal.split('-');
        if (parts.length === 3) yymmdd = parts[0].slice(2) + parts[1] + parts[2];
    }
    // Update print-only status label
    const printStatus = document.getElementById('qPrintStatus');
    const statusTextEl = document.getElementById('quoteStatusText');
    if (printStatus && statusTextEl) {
        printStatus.innerText = statusTextEl.innerText;
    }

    if (window.lucide) lucide.createIcons();

    document.title = `${yymmdd}_${custName}_${projName}`;
    document.body.classList.add('printing');
    
    // Automatically apply current size/orientation from header
    if (typeof window.updatePrintConfig === 'function') window.updatePrintConfig();

    setTimeout(() => {
        window.print();
        document.title = originalTitle;
        document.body.classList.remove('printing');
    }, 300);
}

window.initQuotationAutocomplete = function() {
    console.log(">> Initializing Quotation Autocomplete (Downloads-logic-optimized)");
    const input = document.getElementById('qCustSearch');
    const suggest = document.getElementById('autocompleteSuggestions');
    if (!input || !suggest) return;

    // Load data if missing
    if (!window.allCustomers || window.allCustomers.length === 0) {
        if (typeof fetchCustomers === 'function') {
            console.log(">> Customer data missing for autocomplete, triggering fetch...");
            fetchCustomers();
        }
    }

    if (input.dataset.autocompleteBound) return;
    input.dataset.autocompleteBound = 'true';

    input.addEventListener('input', (e) => {
        const val = e.target.value.trim().toLowerCase();
        if (!val) {
            suggest.style.display = 'none';
            return;
        }

        // Safety Pre-fetch Check
        if (!window.allCustomers || window.allCustomers.length === 0) {
            console.log(">> Emergency pre-fetch triggered by input event...");
            if (typeof fetchCustomers === 'function') fetchCustomers();
        }

        // Reset linked ID if user types manually
        if (input.dataset.selectedId) {
            delete input.dataset.selectedId;
            const qCustName = document.getElementById('qCustName');
            if (qCustName) qCustName.value = '';
        }

        // --- Downloads-Logic: Explicit field matching for accuracy ---
        const matches = (window.allCustomers || []).filter(c => {
            const cn = (c.companyName || '').toLowerCase();
            const nk = (c.nickname || '').toLowerCase();
            const ct = (c.contact || '').toLowerCase();
            const tx = (c.taxId || '').toLowerCase();
            const ph = (c.phone || '').toLowerCase();
            const em = (c.email || '').toLowerCase();
            
            return cn.includes(val) || nk.includes(val) || ct.includes(val) || 
                   tx.includes(val) || ph.includes(val) || em.includes(val);
        }).slice(0, 10);

        if (matches.length === 0) {
            suggest.innerHTML = `
                <div class="suggestion-item no-results" style="padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.8125rem;">
                    <i data-lucide="search" style="width: 20px; height: 20px; margin-bottom: 8px; opacity: 0.5;"></i>
                    <div>查無相符客戶資料</div>
                </div>
            `;
            suggest.style.display = 'block';
            if (window.lucide) lucide.createIcons();
        } else {
            console.log(`>> Autocomplete: matches confirmed [${matches.length}] for "${val}"`);
            const cleanData = (v) => String(v || '').replace(/^'/, '').trim();

            suggest.innerHTML = matches.map(c => {
                const taxDisp = cleanData(c.taxId);
                const phoneDisp = cleanData(c.phone);
                const nameDisp = c.companyName || c.nickname || '未命名';
                const nickDisp = (c.nickname && c.companyName) ? `(${c.nickname})` : '';
                
                return `
                    <div class="suggestion-item" onmousedown="window.selectQuotationCustomer('${c.customerId}')" style="padding: 10px 15px; border-bottom: 1px solid #f1f5f9; cursor: pointer;">
                        <div class="s-name" style="font-weight: 700; color: #1e293b; margin-bottom: 3px; font-size: 0.9375rem; text-align: left;">
                            ${escapeHtml(nameDisp)} <span style="font-weight: 400; font-size: 0.8em; opacity: 0.7; margin-left: 4px; color: #64748b;">${escapeHtml(nickDisp)}</span>
                        </div>
                        <div class="s-meta" style="font-size: 0.75rem; color: #64748b; display: flex; gap: 8px; flex-wrap: wrap; text-align: left;">
                            ${taxDisp ? `<span>統編: ${escapeHtml(taxDisp)}</span>` : ''}
                            ${c.contact ? `<span> | 窗口: ${escapeHtml(c.contact)}</span>` : ''}
                            ${phoneDisp ? `<span> | 電話: ${escapeHtml(phoneDisp)}</span>` : ''}
                        </div>
                    </div>
                `;
            }).join('');
            suggest.style.display = 'block';
        }
        if (e.isTrusted) {
            window.isQuotationModified = true;
        }
    });

    // Handle focus to show results if already typed
    input.addEventListener('focus', () => {
        if (input.value.trim()) {
            input.dispatchEvent(new Event('input'));
        }
    });

    // Handle outside clicks
    document.addEventListener('mousedown', (e) => {
        if (!input.contains(e.target) && !suggest.contains(e.target)) {
            suggest.style.display = 'none';
        }
    });
};

window.selectQuotationCustomer = function(id, isInit = false) {
    if (!window.allCustomers) return;
    const cust = window.allCustomers.find(c => String(c.customerId) === String(id));
    if (!cust) return;

    const input = document.getElementById('qCustSearch');
    const hiddenName = document.getElementById('qCustName');
    const suggest = document.getElementById('autocompleteSuggestions');
    
    // Clean leading quotes from Excel/Sheets import
    const clean = (val) => String(val || '').replace(/^'/, '').trim();

    // 1. Fill Identity Fields
    const displayName = cust.companyName || cust.nickname || '';
    if (input) {
        input.value = displayName;
        input.dataset.selectedId = cust.customerId;
    }
    if (hiddenName) hiddenName.value = displayName;
    
    // 2. Exact Field Filling (Restored from stable version)
    const qTaxId = document.getElementById('qTaxId');
    const qContact = document.getElementById('qContact');
    const qPhone = document.getElementById('qPhone');
    const qEmail = document.getElementById('qEmail');

    if (qTaxId) qTaxId.value = clean(cust.taxId);
    if (qContact) qContact.value = cust.contact || '';
    if (qPhone) qPhone.value = clean(cust.phone);
    if (qEmail) qEmail.value = cust.email || '';

    // 3. Hide suggestions
    if (suggest) suggest.style.display = 'none';
    
    // 4. State Updates
    if (!isInit) {
        window.isQuotationModified = true;
        if (typeof window.triggerQuotationAutoSave === 'function') {
            window.triggerQuotationAutoSave();
        }
    }
    
    console.log(">> [SUCCESS] Imported Customer Info for:", displayName);
};

/**
 * Keyboard Shortcuts Binding
 */
window.addEventListener('keydown', (e) => {
    // Check if we are in the Quotation Editor View
    const editView = document.getElementById('projectsEditView');
    if (editView && editView.style.display !== 'none') {
        // Bind Cmd+P or Ctrl+P to customized preparePrint()
        if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
            e.preventDefault();
            console.log(">> Custom Print Shortcut Triggered");
            if (typeof window.preparePrint === 'function') {
                window.preparePrint();
            }
        }
    }
});

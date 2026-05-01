window.switchAdminSubTab = function(target) {
    console.log(">> Switching Admin Sub-Tab to:", target);
    document.querySelectorAll('.admin-sub-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('#admin .sub-nav .tab-link').forEach(l => l.classList.remove('active'));
    
    if (target === 'members') {
        const listEl = document.getElementById('adminListView');
        const tabEl = document.getElementById('adminMembersTab');
        if (listEl) listEl.classList.add('active');
        if (tabEl) tabEl.classList.add('active');
        fetchMembers();
        fetchRolePermissions(); // New: Fetch matrix data
    } else if (target === 'settings') {
        const settingsEl = document.getElementById('adminSettingsView');
        const tabEl = document.getElementById('adminSettingsTab');
        if (settingsEl) settingsEl.classList.add('active');
        if (tabEl) tabEl.classList.add('active');
        fetchSettings();
    }
}

async function fetchSettings() {
    setSyncStatus(true);
    try {
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(window.buildApiPayload('get_settings'))
        });
        const json = await res.json();
        if (json.success && json.settings) {
            window.sysSettingsCache = json.settings;
            const s = json.settings;
            if (document.getElementById('setBankName')) document.getElementById('setBankName').value = s.bank_name || '';
            if (document.getElementById('setBankCode')) document.getElementById('setBankCode').value = s.bank_code || '';
            if (document.getElementById('setBankBranch')) document.getElementById('setBankBranch').value = s.bank_branch || '';
            if (document.getElementById('setBranchCode')) document.getElementById('setBranchCode').value = s.branch_code || '';
            if (document.getElementById('setAccountName')) document.getElementById('setAccountName').value = s.account_name || '';
            if (document.getElementById('setAccountNum')) document.getElementById('setAccountNum').value = s.account_num || '';
            
            if (document.getElementById('setWfOrder')) document.getElementById('setWfOrder').value = s.wf_order || '';
            if (document.getElementById('setWfOrderLbl')) document.getElementById('setWfOrderLbl').value = s.wf_order_lbl || '訂購單說明';
            
            if (document.getElementById('setWfDeposit')) document.getElementById('setWfDeposit').value = s.wf_deposit || '';
            if (document.getElementById('setWfDepositLbl')) document.getElementById('setWfDepositLbl').value = s.wf_deposit_lbl || '訂金規則';
            
            if (document.getElementById('setWfDraft')) document.getElementById('setWfDraft').value = s.wf_draft || '';
            if (document.getElementById('setWfDraftLbl')) document.getElementById('setWfDraftLbl').value = s.wf_draft_lbl || '初稿天數';
            
            if (document.getElementById('setWfEdit')) document.getElementById('setWfEdit').value = s.wf_edit || '';
            if (document.getElementById('setWfEditLbl')) document.getElementById('setWfEditLbl').value = s.wf_edit_lbl || '修改次數說明';
            
            if (document.getElementById('setWfDelivery')) document.getElementById('setWfDelivery').value = s.wf_delivery || '';
            if (document.getElementById('setWfDeliveryLbl')) document.getElementById('setWfDeliveryLbl').value = s.wf_delivery_lbl || '交付內容說明';
            
            if (document.getElementById('setWfRemark')) document.getElementById('setWfRemark').value = s.wf_remark || '';
            if (document.getElementById('setWfRemarkLbl')) document.getElementById('setWfRemarkLbl').value = s.wf_remark_lbl || '其他說明';
        }
    } catch(e) { console.error("Fetch Settings Error:", e); }
    finally { setSyncStatus(false); }
}

window.handleGlobalSettingsSubmit = async function(e) {
    e.preventDefault();
    setSyncStatus(true);
    
    const settings = {
        bank_name: document.getElementById('setBankName').value,
        bank_code: ensureStringLiteral(document.getElementById('setBankCode').value),
        bank_branch: document.getElementById('setBankBranch').value,
        branch_code: ensureStringLiteral(document.getElementById('setBranchCode').value),
        account_name: document.getElementById('setAccountName').value,
        account_num: ensureStringLiteral(document.getElementById('setAccountNum').value),
        
        wf_order: document.getElementById('setWfOrder').value,
        wf_order_lbl: document.getElementById('setWfOrderLbl').value,
        wf_deposit: document.getElementById('setWfDeposit').value,
        wf_deposit_lbl: document.getElementById('setWfDepositLbl').value,
        wf_draft: document.getElementById('setWfDraft').value,
        wf_draft_lbl: document.getElementById('setWfDraftLbl').value,
        wf_edit: document.getElementById('setWfEdit').value,
        wf_edit_lbl: document.getElementById('setWfEditLbl').value,
        wf_delivery: document.getElementById('setWfDelivery').value,
        wf_delivery_lbl: document.getElementById('setWfDeliveryLbl').value,
        wf_remark: document.getElementById('setWfRemark') ? document.getElementById('setWfRemark').value : '',
        wf_remark_lbl: document.getElementById('setWfRemarkLbl') ? document.getElementById('setWfRemarkLbl').value : ''
    };

    function ensureStringLiteral(val) {
        if (!val) return '';
        // If starts with 0 and is numeric, prepend ' for Google Sheets
        if (val.startsWith('0')) return "'" + val;
        return val;
    }
    
    try {
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(window.buildApiPayload('update_settings', { settings }))
        });
        const json = await res.json();
        if (json.success) {
            // Swal.fire success removed as per user request
        } else {
            Swal.fire('錯誤', '儲存設定失敗', 'error');
        }
    } catch(e) { 
        Swal.fire('連線錯誤', '無法儲存設定', 'error');
    } finally { setSyncStatus(false); }
}

// --- Project & Quotation Logic ---

async function fetchMembers() {
    if (!window.currentUser || (window.currentUser.level || '').trim() !== '管理者') {
        console.warn(">> fetchMembers blocked: insufficient permissions or no user");
        return;
    }
    try {
        setSyncStatus(true);
        const res = await fetch(GAS_WEB_APP_URL, { 
            method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
            body: JSON.stringify(window.buildApiPayload('get_all_members')) 
        });
        const json = await res.json();
        if (json.success) {
            allMembers = json.data;
            renderMembers(allMembers);
        } else {
            console.error("Fetch Members Backend Error:", json.error);
        }
    } catch (e) { 
        console.error("Fetch Members Network/Request Error:", e); 
    } finally {
        setSyncStatus(false);
    }
}

function mapStatus(status) {
    const s = (status || '').toLowerCase().trim();
    if (s === 'active' || s === '啟用') return '啟用';
    if (s === 'unverified' || s === '待驗證') return '待驗證';
    if (s === 'pending' || s === '待審核') return '待審核';
    if (s === 'banned' || s === '暫停使用' || s === '停用') return '暫停使用';
    return status || '未知';
}

function renderMembers(list) {
    const tbody = document.getElementById('memberTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    list.forEach(m => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.ondblclick = () => showMemberEditor(m.rowIndex);
        const displayStatus = mapStatus(m.status);
        tr.innerHTML = `
            <td>${escapeHtml(m.username)}</td>
            <td>${escapeHtml(m.nickname || '')}</td>
            <td><span class="status-badge" style="background:#f1f5f9; color:var(--text-dark); border:1px solid var(--border);">${escapeHtml(m.level || '未知')}</span></td>
            <td>${escapeHtml(m.email || '')}</td>
            <td>${escapeHtml(displayStatus)}</td>
        `;
        tbody.appendChild(tr);
    });
}

function filterMembers(query) {
    const q = query.toLowerCase();
    const filtered = allMembers.filter(m => 
        String(m.username || '').toLowerCase().includes(q) ||
        String(m.nickname || '').toLowerCase().includes(q) ||
        String(m.email || '').toLowerCase().includes(q)
    );
    renderMembers(filtered);
}

window.showMemberEditor = (idx) => {
    console.log(">> showMemberEditor Triggered for Index:", idx);

    if (!window.currentUser) return;
    const m = allMembers.find(x => x.rowIndex == idx);
    if (!m) return console.error("Member not found for row index:", idx);
    
    switchSubView('permissions', 'edit');

    document.getElementById('memberTargetRow').value = idx;
    document.getElementById('memberUser').value = m.username || '';
    document.getElementById('memberLevel').value = m.level || '主帳號';
    document.getElementById('memberStatus').value = mapStatus(m.status);

    // --- Superior Account Handling ---
    const supGroup = document.getElementById('superiorGroup');
    const supSelect = document.getElementById('memberSuperior');
    if (supSelect) {
        supSelect.innerHTML = '<option value="">-- 請選擇主帳號 --</option>';
        // Find all Main Accounts from cached members list
        allMembers.forEach(person => {
            if (person.level === '主帳號' || person.level === '管理者') {
                const opt = document.createElement('option');
                opt.value = person.username;
                opt.innerText = `${person.nickname} (${person.username})`;
                supSelect.appendChild(opt);
            }
        });
        supSelect.value = m.superior || '';
    }
    toggleSuperiorField();

    // Clear error
    const memErr = document.getElementById('memberError');
    if (memErr) { memErr.innerText = ''; memErr.classList.remove('active'); }
    
    if (window.lucide) lucide.createIcons();
};

window.handleMemberUpdateSubmit = async function(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const body = { 
        action: 'update_member_status', 
        adminUser: window.currentUser.username, 
        targetRowIndex: parseInt(document.getElementById('memberTargetRow').value), 
        level: document.getElementById('memberLevel').value, 
        status: document.getElementById('memberStatus').value,
        superior: document.getElementById('memberSuperior').value
    };
    
    if (btn) btn.classList.add('btn-loading');
    setSyncStatus(true);
    
    // Clear error
    const memErr = document.getElementById('memberError');
    if (memErr) { memErr.innerText = ''; memErr.classList.remove('active'); }
    
    try {
        const res = await fetch(GAS_WEB_APP_URL, { method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(window.buildApiPayload('update_member_status', body)) });
        const json = await res.json();
        if (json.success) { 
            // Swal.fire success removed as per user request
            switchSubView('permissions', 'list'); 
            fetchMembers(); 
        } else {
            if (memErr) {
                memErr.innerText = json.error || '更新失敗';
                memErr.classList.add('active');
            } else {
                Toast.fire({ title: '更新失敗', icon: 'error' });
            }
        }
    } catch (e) { 
        if (memErr) {
            memErr.innerText = '更新失敗，請檢查網路';
            memErr.classList.add('active');
        } else {
            Toast.fire({ title: '更新失敗', icon: 'error' }); 
        }
    }
    finally {
        if (btn) btn.classList.remove('btn-loading');
        setSyncStatus(false);
    }
}

window.toggleSuperiorField = function() {
    const lvl = document.getElementById('memberLevel').value;
    const group = document.getElementById('superiorGroup');
    if (group) group.style.display = (lvl === '副帳號') ? 'block' : 'none';
}

// --- Granular Permission Matrix Logic ---

const PERM_DEFINITIONS = [
    { group: '客戶管理', icon: 'users.svg', perms: [
        { key: 'cust_v', label: '檢視' },
        { key: 'cust_c', label: '新增' },
        { key: 'cust_u', label: '編輯' },
        { key: 'cust_d', label: '刪除' }
    ]},
    { group: '專案報價', icon: 'projects.svg', perms: [
        { key: 'proj_v', label: '檢視' },
        { key: 'proj_c', label: '新增' },
        { key: 'proj_u', label: '編輯' },
        { key: 'proj_d', label: '刪除' }
    ]},
    { group: '任務管理', icon: 'tasks.svg', perms: [
        { key: 'task_v', label: '檢視' },
        { key: 'task_c', label: '新增' },
        { key: 'task_u', label: '編輯' },
        { key: 'task_d', label: '刪除' }
    ]},
    { group: '系統通知', icon: 'notify.svg', perms: [
        { key: 'notify_cust', label: '客戶異動通知' },
        { key: 'notify_proj', label: '專案異動通知' },
        { key: 'notify_task', label: '任務異動通知' }
    ]},
    { group: '系統設定', icon: 'settings.svg', perms: [
        { key: 'set_v', label: '進入分頁' },
        { key: 'set_u', label: '修改設定' },
        { key: 'perm_m', label: '管理權限' }
    ]}
];

const ROLES = ['管理者', '主帳號', '副帳號'];

async function fetchRolePermissions() {
    try {
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(window.buildApiPayload('get_role_permissions'))
        });
        const json = await res.json();
        if (json.success) {
            window.rolePermissionsCache = json.permissions;
            renderPermissionMatrix();
        }
    } catch (e) { console.error("Fetch Permissions Error:", e); }
}

function renderPermissionMatrix() {
    const tbody = document.getElementById('permissionMatrixBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const perms = window.rolePermissionsCache || {};

    PERM_DEFINITIONS.forEach(group => {
        // Group Header
        const groupTr = document.createElement('tr');
        groupTr.className = 'perm-row-group';
        groupTr.innerHTML = `
            <td colspan="4" style="background: #f1f5f9; font-weight: bold; color: #475569; padding: 12px 16px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <img src="assets/icons/${group.icon}" data-lucide="${group.icon.replace('.svg','')}" style="width: 18px; height: 18px;">
                    ${group.group}
                </div>
            </td>`;
        tbody.appendChild(groupTr);

        group.perms.forEach(p => {
            const tr = document.createElement('tr');
            let html = `<td>${p.label}</td>`;
            ROLES.forEach(role => {
                const isChecked = (perms[role] && perms[role][p.key]) ? 'checked' : '';
                
                // 權限鎖定邏輯：
                // 1. 「管理者」欄位預設不可改 (系統固定)，但「系統通知」除外
                // 2. 如果是「系統設定」群組，且目前登入者不是「管理者」，則全部設為不可改 (唯讀)
                let isDisabled = (role === '管理者' && group.group !== '系統通知'); 
                const userLevel = (window.currentUser.level || '').trim();
                if (group.group === '系統設定' && userLevel !== '管理者') {
                    isDisabled = true;
                }
                
                html += `<td><input type="checkbox" class="perm-checkbox" data-role="${role}" data-key="${p.key}" ${isChecked} ${isDisabled ? 'disabled' : ''}></td>`;
            });
            tr.innerHTML = html;
            tbody.appendChild(tr);
        });
    });

    // Re-trigger icon replacement for the new matrix rows
    if (window.replaceIcons) window.replaceIcons();
}

window.saveRolePermissions = async function() {
    // 1. Initialize matrix from cache or empty object
    const matrix = {};
    ROLES.forEach(role => {
        matrix[role] = {};
    });

    // 2. Read all checkboxes from the matrix UI
    const checkboxes = document.querySelectorAll('.perm-checkbox');
    console.log(`>> Found ${checkboxes.length} permission checkboxes.`);
    
    checkboxes.forEach(cb => {
        const role = cb.getAttribute('data-role');
        const key = cb.getAttribute('data-key');
        if (role && key) {
            matrix[role][key] = cb.checked;
        }
    });

    // 3. System Enforcement: Admins must have all core perms (except notifications)
    PERM_DEFINITIONS.forEach(g => {
        if (g.group !== '系統通知') {
            g.perms.forEach(p => {
                matrix['管理者'][p.key] = true;
            });
        }
    });

    console.log(">> Saving matrix payload:", matrix);

    setSyncStatus(true);
    try {
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(window.buildApiPayload('update_role_permissions', { permissions: matrix }))
        });
        const json = await res.json();
        if (json.success) {
            window.rolePermissionsCache = matrix;
            Toast.fire({ title: '權限設定已更新', icon: 'success' });
        } else {
            Swal.fire('錯誤', '存檔失敗: ' + json.error, 'error');
        }
    } catch (e) { 
        console.error("Save Permissions Error:", e);
        Swal.fire('錯誤', '網路連線失敗', 'error'); 
    } finally { 
        setSyncStatus(false); 
    }
}

/**
 * Navigation shortcut handler for Profile Modal cards
 */
window.routeFromProfile = function(tabId, viewId) {
    console.log(`>> Routing from Profile: Tab[${tabId}] View[${viewId}]`);
    
    // 1. Close Modal
    if (typeof closeModal === 'function') closeModal('profileModal');
    
    // 2. Perform Direct Tab Switching (Bypassing click logic if necessary)
    // First, standard tab link UI update
    document.querySelectorAll('.tab-link').forEach(x => x.classList.remove('active'));
    const targetBtn = document.querySelector(`.tab-link[data-tab="${tabId}"]`);
    if (targetBtn) targetBtn.classList.add('active');

    // Second, main content visibility
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    const section = document.getElementById(tabId);
    if (section) {
        section.classList.add('active');
    } else {
        console.error(`>> [Route Error] Section #${tabId} not found.`);
        return;
    }
    
    // 3. Switch Sub-view if specified
    if (viewId) {
        // Handle both .sub-view-stack and .admin-sub-tab
        const subViews = section.querySelectorAll('.sub-view-stack, .admin-sub-tab');
        subViews.forEach(v => v.classList.remove('active'));
        
        const targetView = document.getElementById(viewId);
        if (targetView) {
            targetView.classList.add('active');
            console.log(`>> Successfully activated sub-view: ${viewId}`);
        } else {
            console.warn(`>> [Route Warning] Sub-view #${viewId} not found.`);
        }
    }

    // 4. Trigger Refreshes
    if (tabId === 'settings' && typeof fetchSettings === 'function') fetchSettings();
    if (tabId === 'permissions' && typeof fetchRolePermissions === 'function') fetchRolePermissions();
    if (tabId === 'permissions' && typeof fetchMembers === 'function') fetchMembers();

    // Re-init UI elements
    if (window.replaceIcons) window.replaceIcons();
};

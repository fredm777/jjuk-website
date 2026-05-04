window.switchAdminSubTab = function(target) {
    console.log(">> Switching Admin Sub-Tab to:", target);
    document.querySelectorAll('.admin-sub-tab').forEach(t => t.classList.remove('active'));
    
    if (target === 'members') {
        const listEl = document.getElementById('adminMembersTab'); // Fixed ID
        if (listEl) listEl.classList.add('active');
        fetchMembers();
        fetchRolePermissions();
    } else if (target === 'settings') {
        const bankEl = document.getElementById('bankSettingsView'); // Correct target
        if (bankEl) bankEl.classList.add('active');
        fetchSettings();
    }
}

const WORKFLOW_TEXTAREA_IDS = [
    'setWfOrder',
    'setWfDeposit',
    'setWfDraft',
    'setWfEdit',
    'setWfDelivery',
    'setWfRemark'
];

function resizeWorkflowTextarea(el) {
    if (!el) return;
    const minHeight = window.matchMedia('(max-width: 768px)').matches ? 48 : 80;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, minHeight)}px`;
}

window.resizeWorkflowTextareas = function() {
    requestAnimationFrame(() => {
        WORKFLOW_TEXTAREA_IDS.forEach(id => resizeWorkflowTextarea(document.getElementById(id)));
    });
};

window.initWorkflowAutoResize = function() {
    if (window.__workflowAutoResizeBound) {
        window.resizeWorkflowTextareas();
        return;
    }

    WORKFLOW_TEXTAREA_IDS.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => resizeWorkflowTextarea(el));
    });
    window.addEventListener('resize', window.resizeWorkflowTextareas);
    window.__workflowAutoResizeBound = true;
    window.resizeWorkflowTextareas();
};

async function fetchSettings(force = false) {
    // Prevent washing away unsaved changes unless forced
    if (!force && window.sysSettingsCache && window.isSettingsModified) {
        console.log(">> fetchSettings skipped: local changes exist.");
        return;
    }

    if (typeof setSyncStatus === 'function') setSyncStatus(true);
    window.isSettingsLoading = true;
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
            window.isSettingsModified = false; // Reset modification flag on fresh load
            const s = json.settings;
            
            const setVal = (id, val, def = '') => {
                const el = document.getElementById(id);
                if (el) el.value = val || def;
            };

            setVal('setBankName', s.bank_name);
            setVal('setBankCode', s.bank_code);
            setVal('setBankBranch', s.bank_branch);
            setVal('setBranchCode', s.branch_code);
            setVal('setAccountName', s.account_name);
            setVal('setAccountNum', s.account_num);
            
            setVal('setWfOrder', s.wf_order);
            setVal('setWfOrderLbl', s.wf_order_lbl, '訂購單說明');
            setVal('setWfDeposit', s.wf_deposit);
            setVal('setWfDepositLbl', s.wf_deposit_lbl, '訂金規則');
            setVal('setWfDraft', s.wf_draft);
            setVal('setWfDraftLbl', s.wf_draft_lbl, '初稿天數');
            setVal('setWfEdit', s.wf_edit);
            setVal('setWfEditLbl', s.wf_edit_lbl, '修改次數說明');
            setVal('setWfDelivery', s.wf_delivery);
            setVal('setWfDeliveryLbl', s.wf_delivery_lbl, '交付內容說明');
            setVal('setWfRemark', s.wf_remark);
            setVal('setWfRemarkLbl', s.wf_remark_lbl, '其他說明');
            if (typeof window.initWorkflowAutoResize === 'function') window.initWorkflowAutoResize();

            // Add change tracking
            const settingsForm = document.getElementById('globalSettingsForm');
            if (settingsForm) {
                settingsForm.oninput = (event) => {
                    window.isSettingsModified = true;
                    if (event.target && event.target.closest('#workflowSettingsView') && event.target.tagName === 'TEXTAREA') {
                        resizeWorkflowTextarea(event.target);
                    }
                };
            }
        }
    } catch(e) { console.error("Fetch Settings Error:", e); }
    finally { 
        if (typeof window.setSyncStatus === 'function') window.setSyncStatus(false); 
        window.isSettingsLoading = false; // Clear loading flag
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (typeof window.initWorkflowAutoResize === 'function') window.initWorkflowAutoResize();
});

window.handleGlobalSettingsSubmit = async function(e) {
    if (e) e.preventDefault();
    
    if (window.isSettingsLoading) {
        Toast.fire({ icon: 'info', title: '設定讀取中', text: '請稍候再試' });
        return;
    }

    const getVal = (id) => document.getElementById(id)?.value || '';
    
    // Safety: Only block if the form is COMPLETELY empty but we have cached data
    const bankVal = getVal('setBankName');
    const remarkVal = getVal('setWfRemark');
    
    if (!bankVal && !remarkVal && window.sysSettingsCache && Object.keys(window.sysSettingsCache).length > 0) {
        const confirmed = await Swal.fire({
            title: '確認儲存空設定？',
            text: '偵測到表單大部份為空。如果您確定要清空這些設定，請點擊確定。',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: '確定清空並儲存',
            cancelButtonText: '取消'
        });
        if (!confirmed.isConfirmed) return;
    }

    if (typeof window.setSyncStatus === 'function') window.setSyncStatus(true);
    Swal.fire({
        title: '正在儲存設定...',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });
    
    const ensureStringLiteral = (val) => {
        if (!val) return '';
        const s = String(val);
        return s.startsWith('0') ? "'" + s : s;
    };

    const settings = {
        bank_name: getVal('setBankName'),
        bank_code: ensureStringLiteral(getVal('setBankCode')),
        bank_branch: getVal('setBankBranch'),
        branch_code: ensureStringLiteral(getVal('setBranchCode')),
        account_name: getVal('setAccountName'),
        account_num: ensureStringLiteral(getVal('setAccountNum')),
        
        wf_order: getVal('setWfOrder'),
        wf_order_lbl: getVal('setWfOrderLbl'),
        wf_deposit: getVal('setWfDeposit'),
        wf_deposit_lbl: getVal('setWfDepositLbl'),
        wf_draft: getVal('setWfDraft'),
        wf_draft_lbl: getVal('setWfDraftLbl'),
        wf_edit: getVal('setWfEdit'),
        wf_edit_lbl: getVal('setWfEditLbl'),
        wf_delivery: getVal('setWfDelivery'),
        wf_delivery_lbl: getVal('setWfDeliveryLbl'),
        wf_remark: getVal('setWfRemark'),
        wf_remark_lbl: getVal('setWfRemarkLbl')
    };
    
    try {
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(window.buildApiPayload('update_settings', { settings }))
        });
        const json = await res.json();
        Swal.close(); // Close loading

        if (json.success) {
            window.isSettingsModified = false;
            window.sysSettingsCache = settings; // Update cache
            Toast.fire({ icon: 'success', title: '系統設定已更新' });
        } else {
            Swal.fire('儲存失敗', json.error || '伺服器拒絕了請求', 'error');
        }
    } catch(e) { 
        Swal.close();
        console.error("Save Settings Error:", e);
        Swal.fire('連線錯誤', '無法連線至伺服器，請檢查網路連線', 'error');
    } finally { 
        if (typeof window.setSyncStatus === 'function') window.setSyncStatus(false); 
    }
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
    if (typeof window.initResizers === 'function') window.initResizers('memberTable');
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
    { group: '系統設定', icon: 'settings.svg', perms: [
        { key: 'set_v', label: '進入分頁' },
        { key: 'set_u', label: '修改設定' },
        { key: 'perm_m', label: '管理權限' }
    ]}
];

const ROLES = ['管理者', '副帳號', '主帳號'];

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
                // 1. 「管理者」欄位永遠不可改 (系統固定)
                // 2. 如果是「系統設定」群組，且目前登入者不是「管理者」，則全部設為不可改 (唯讀)
                let isDisabled = (role === '管理者'); 
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
    // 從快取開始建立新的矩陣，確保沒被修改到的 (例如 disabled 的系統設定) 數值能被保留
    const matrix = JSON.parse(JSON.stringify(window.rolePermissionsCache || {}));
    
    // 確保所有角色都有初始化物件
    ROLES.forEach(role => { 
        if (!matrix[role]) matrix[role] = {}; 
    });

    // 強制設定：管理者 (Super Admin) 永遠擁有所有權限
    PERM_DEFINITIONS.forEach(g => g.perms.forEach(p => { matrix['管理者'][p.key] = true; }));

    // 讀取畫面上「未被禁用」的勾選框來更新矩陣 (包含主帳號與副帳號的業務權限)
    const checkboxes = document.querySelectorAll('.perm-checkbox:not(:disabled)');
    checkboxes.forEach(cb => {
        const role = cb.getAttribute('data-role');
        const key = cb.getAttribute('data-key');
        matrix[role][key] = cb.checked;
    });

    setSyncStatus(true);
    try {
        const res = await fetch(GAS_WEB_APP_URL, {
            method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(window.buildApiPayload('update_role_permissions', { permissions: matrix }))
        });
        const json = await res.json();
        if (json.success) {
            window.rolePermissionsCache = matrix;
            Swal.fire({ icon: 'success', title: '權限設定已更新', text: '變更將在使用者下次登入時生效', timer: 2000, showConfirmButton: false });
        } else {
            Swal.fire('錯誤', '存檔失敗', 'error');
        }
    } catch (e) { Swal.fire('錯誤', '網路連線失敗', 'error'); }
    finally { setSyncStatus(false); }
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

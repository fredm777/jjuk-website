// Customer Management - Logic & CRUD
// ==========================================

// --- State ---
window.customerSortField = 'companyName';
window.customerSortOrder = 'asc';
window.allCustomers = [];
window.currentFilteredCustomers = [];
window.currentPage = 1;
window.itemsPerPage = parseInt(localStorage.getItem('st_pro_items_per_page')) || 7;
window.isCustomerModified = false;

window.fetchCustomers = async function() {
    if (!window.currentUser || !window.currentUser.sheetId) {
        console.warn(">> fetchCustomers skipped: No valid user or sheetId found.");
        return;
    }
    setSyncStatus(true);
    try {
        const json = await window.apiPost('get_customers');
        if (json.success) { 
            window.allCustomers = json.data || []; 
            window.currentFilteredCustomers = [...window.allCustomers];
            window.renderCustomers(); 
            if (typeof window.filterTasksByProject === 'function') window.filterTasksByProject();
        } else {
            // Display backend error (e.g. "Please fill in Spreadsheet ID")
            Swal.fire({
                title: '資料讀取受阻',
                text: json.error || '請確認個人設定中的試算表 ID 是否正確。',
                icon: 'info',
                confirmButtonColor: 'var(--primary)'
            });
        }
    } catch (err) { 
        console.error("Fetch Error:", err);
    } finally {
        setSyncStatus(false);
        const loading = document.getElementById('tableLoading');
        if (loading) loading.style.display = 'none';
        if (document.getElementById('projects') && document.getElementById('projects').classList.contains('active')) {
             if (typeof fetchProjects === 'function') fetchProjects();
        }
    }
}

window.changePage = (dir) => {
    const activeTab = document.querySelector('.tab-link.active');
    if (!activeTab) return;
    const tab = activeTab.dataset.tab;

    if (tab === 'customers') {
        const totalItems = window.currentFilteredCustomers ? window.currentFilteredCustomers.length : 0;
        const totalPages = Math.ceil(totalItems / window.itemsPerPage) || 1;
        window.currentPage += dir;
        if (window.currentPage < 1) window.currentPage = 1;
        if (window.currentPage > totalPages) window.currentPage = totalPages;
        window.renderCustomers();
    } else if (tab === 'projects') {
        const totalItems = window.currentFilteredProjects ? window.currentFilteredProjects.length : 0;
        const totalPages = Math.ceil(totalItems / window.projectItemsPerPage) || 1;
        window.projectPage += dir;
        if (window.projectPage < 1) window.projectPage = 1;
        if (window.projectPage > totalPages) window.projectPage = totalPages;
        window.renderProjects();
    }
};

window.toggleCustomerSort = function(field) {
    if (window.customerSortField === field) {
        window.customerSortOrder = (window.customerSortOrder === 'asc') ? 'desc' : 'asc';
    } else {
        window.customerSortField = field;
        window.customerSortOrder = 'asc';
    }
    window.renderCustomers();
};

window.updateCustomerSortHeaderUI = function() {
    document.querySelectorAll('#customerTable .sortable-header').forEach(th => {
        th.classList.remove('active', 'asc', 'desc');
        const icon = th.querySelector('.sort-icon');
        if (icon) icon.innerText = '';
    });
    
    const activeTh = document.getElementById(`th-cust-${window.customerSortField}`);
    if (activeTh) {
        activeTh.classList.add('active', window.customerSortOrder);
        const icon = activeTh.querySelector('.sort-icon');
        if (icon) {
            icon.innerText = window.customerSortOrder === 'asc' ? ' ↑' : ' ↓';
        }
    }
};

window.renderCustomers = function() {
    const tbody = document.getElementById('customerTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const loading = document.getElementById('tableLoading');
    const pagCont = document.getElementById('paginationContainer');
    if (loading) loading.style.display = 'none';
    if (pagCont) pagCont.style.display = 'flex';
    
    const totalItems = window.currentFilteredCustomers ? window.currentFilteredCustomers.length : 0;
    const totalPages = Math.ceil(totalItems / window.itemsPerPage) || 1;
    if (window.currentPage > totalPages) window.currentPage = totalPages;
    if (window.currentPage < 1) window.currentPage = 1;
    
    const pageInfo = document.getElementById('pageInfo');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    
    if (pageInfo) pageInfo.innerText = `第 ${window.currentPage} / ${totalPages} 頁 (共 ${totalItems} 筆)`;
    if (prevBtn) { prevBtn.disabled = (window.currentPage === 1); prevBtn.style.opacity = (window.currentPage === 1) ? '0.3' : '1'; }
    if (nextBtn) { nextBtn.disabled = (window.currentPage === totalPages); nextBtn.style.opacity = (window.currentPage === totalPages) ? '0.3' : '1'; }
    
    // Sorting logic
    window.updateCustomerSortHeaderUI();
    const sortedData = [...window.currentFilteredCustomers].sort((a, b) => {
        const valA = String(a[window.customerSortField] || '');
        const valB = String(b[window.customerSortField] || '');
        const res = valA.localeCompare(valB, 'zh-Hant');
        return window.customerSortOrder === 'asc' ? res : -res;
    });

    const startIndex = (window.currentPage - 1) * window.itemsPerPage;
    const paginatedData = sortedData.slice(startIndex, startIndex + window.itemsPerPage);
    
    if (paginatedData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center; padding: 60px 0; color: var(--text-muted); opacity: 0.6;">
                    <div style="margin-bottom: 20px;">
                        <img src="assets/icons/users.svg" style="width: 64px; height: 64px; filter: grayscale(1) brightness(1.5); opacity: 0.3;">
                    </div>
                    <p style="font-size: 0.9375rem;">目前沒有符合條件的客戶資料</p>
                </td>
            </tr>
        `;
        return;
    }

    paginatedData.forEach(item => {
        const tr = document.createElement('tr');
        const isInvoice = (item.invoiceInfo === 'v' || item.invoiceInfo === 'V');
        const invoiceHtml = isInvoice ? '<span class="invoice-badge"><i data-lucide="check"></i></span>' : '';
        
        tr.innerHTML = `<td>${escapeHtml(item.companyName || '')}</td><td>${escapeHtml(item.taxId || '')}</td><td>${escapeHtml(item.contact || '')}</td><td>${escapeHtml(item.phone || '')}</td><td style="text-align:center;">${invoiceHtml}</td>`;
        tr.ondblclick = () => showCustomerEditor('客戶明細與編輯', item);
        tbody.appendChild(tr);
    });
    
    if (window.lucide) lucide.createIcons();
}

window.switchSubView = async function(tabId, viewType) {
    // 1. Guard check for unsaved changes
    if (viewType === 'list' || (document.querySelector('.tab-link.active')?.dataset.tab !== tabId)) {
        let isDirty = false;
        let dirtyType = ''; // 'projects' or 'customers'
        
        // Detect which form is currently active and dirty
        if (document.getElementById('projectsEditView')?.classList.contains('active') && window.isQuotationModified) {
            isDirty = true;
            dirtyType = 'projects';
        } else if (document.getElementById('customersEditView')?.classList.contains('active') && window.isCustomerModified) {
            isDirty = true;
            dirtyType = 'customers';
        }

        if (isDirty) {
            const result = await Swal.fire({
                title: '尚未儲存',
                text: '內容已變更，是否要儲存？',
                icon: 'warning',
                showDenyButton: true,
                showCancelButton: false, // Ensure no 3rd gray button appears
                confirmButtonText: '儲存變更',
                denyButtonText: '直接離開',
                confirmButtonColor: '#10b981', // Green
                denyButtonColor: '#ef4444',    // Red
                allowOutsideClick: false       // Block until decision is made
            });

            if (result.isConfirmed) {
                // Option: Save Change
                console.log(">> Navigation Guard: User chose to SAVE before leaving.");
                if (dirtyType === 'projects') {
                    await window.handleQuotationSubmit(null, false);
                } else if (dirtyType === 'customers') {
                    await window.saveCustomer();
                }
                // Flag is reset inside save functions upon success
            } else if (result.isDenied) {
                // Option: Leave Directly
                console.log(">> Navigation Guard: User chose to LEAVE without saving.");
                if (dirtyType === 'projects') window.isQuotationModified = false;
                if (dirtyType === 'customers') window.isCustomerModified = false;
            } else {
                // Option: Dismissed (ESC or Outside click) -> STAY
                console.log(">> Navigation Guard: User chose to STAY.");
                return false; // Block navigation
            }
        }
    }

    const section = document.getElementById(tabId);
    if (!section) return;
    
    const listView = section.querySelector('.sub-view-stack[id$="ListView"]');
    const editView = section.querySelector('.sub-view-stack[id$="EditView"]');

    if (viewType === 'list') {
        if (editView) editView.classList.remove('active');
        setTimeout(() => {
            if (listView) listView.classList.add('active');
        }, editView ? 50 : 0); 
    } else {
        if (listView) listView.classList.remove('active');
        setTimeout(() => {
            if (editView) editView.classList.add('active');
        }, listView ? 50 : 0);
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return true;
}

window.showCustomerEditor = (title, data = null) => {
    if (!window.currentUser) return Toast.fire({ icon: 'warning', title: '請先登入' });
    
    // Check dynamic permissions instead of hardcoded role check
    const isUpdate = !!(data && data.rowIndex);
    if (isUpdate && !window.hasPermission('cust_u')) return Swal.fire('權限不足', '您的帳號級別無法編輯資料', 'error');
    if (!isUpdate && !window.hasPermission('cust_c')) return Swal.fire('權限不足', '您的帳號級別無法新增客戶', 'error');
    
    const titleEl = document.getElementById('viewTitleCustomer');
    const form = document.getElementById('customerForm');
    
    if (titleEl) titleEl.innerText = title;
    switchSubView('customers', 'edit');
    if (form) form.reset();
    
    const custErr = document.getElementById('customerError');
    if (custErr) { custErr.innerText = ''; custErr.classList.remove('active'); }
    
    const rowIdxEl = document.getElementById('rowIndex');
    const custIdEl = document.getElementById('customerId');
    if (rowIdxEl) rowIdxEl.value = data ? (data.rowIndex || '') : '';
    if (custIdEl) custIdEl.value = data ? (data.customerId || '') : '';
    
    if (data) {
        if (document.getElementById('companyName')) document.getElementById('companyName').value = data.companyName || '';
        
        // Tax ID handling
        let taxId = String(data.taxId || '');
        if (taxId.startsWith("'")) taxId = taxId.slice(1);
        if (document.getElementById('taxId')) document.getElementById('taxId').value = taxId;
        
        if (document.getElementById('nickname')) document.getElementById('nickname').value = data.nickname || '';
        if (document.getElementById('contact')) document.getElementById('contact').value = data.contact || '';
        
        // Phone handling
        let phone = String(data.phone || '');
        if (phone.startsWith("'")) phone = phone.slice(1);
        if (document.getElementById('phone')) document.getElementById('phone').value = phone;
        if (document.getElementById('email')) document.getElementById('email').value = data.email || '';
        if (document.getElementById('address')) document.getElementById('address').value = data.address || '';
        if (document.getElementById('invoiceInfo')) document.getElementById('invoiceInfo').checked = (data.invoiceInfo === 'v' || data.invoiceInfo === 'V');
    }
    
    if (window.lucide) lucide.createIcons();
    window.isCustomerModified = false;

    // Apply Permission State to Buttons
    const saveBtn = form ? form.querySelector('button[type="submit"]') : null;
    window.applyPermissionState(saveBtn, 'cust_u');
    
    const deleteBtn = document.getElementById('deleteCustomerBtn');
    if (deleteBtn) {
        deleteBtn.style.display = data ? 'block' : 'none';
        window.applyPermissionState(deleteBtn, 'cust_d');
    }
}

window.deleteCustomer = async function() {
    const rIndex = document.getElementById('rowIndex').value;
    const companyName = document.getElementById('companyName').value;
    
    if (!window.hasPermission('cust_d')) return Swal.fire('權限不足', '您的帳號級別無法執行刪除動作', 'error');

    const result = await Swal.fire({
        title: '確定要刪除？',
        text: `我們即將刪除客戶「${companyName}」，此動作無法復原。`,
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
        const json = await window.apiPost('delete_customer', {
            rowIndex: parseInt(rIndex)
        });
        if (json.success) {
            Toast.fire({ icon: 'success', title: '客戶資料已刪除' });
            window.switchSubView('customers', 'list');
            if (typeof window.fetchCustomers === 'function') window.fetchCustomers();
        } else {
            throw new Error(json.error);
        }
    } catch (e) {
        Swal.fire('刪除失敗', e.message || '請重新嘗試', 'error');
    } finally {
        setSyncStatus(false);
    }
}

window.saveCustomer = async function() {
    const rIndex = document.getElementById('rowIndex').value;
    const companyName = document.getElementById('companyName').value;
    let taxId = document.getElementById('taxId').value;
    let phone = document.getElementById('phone').value;

    // Auto prepend ' if starts with 0 to preserve leading zeros in Sheets
    if (taxId.startsWith('0')) taxId = "'" + taxId;
    if (phone.startsWith('0')) phone = "'" + phone;

    const isUpdate = !!rIndex;
    if (isUpdate && !window.hasPermission('cust_u')) return Swal.fire('權限不足', '您的帳號級別無法編輯資料', 'error');
    if (!isUpdate && !window.hasPermission('cust_c')) return Swal.fire('權限不足', '您的帳號級別無法新增客戶', 'error');

    const bodyData = {
        rowIndex: rIndex ? parseInt(rIndex) : null,
        companyName,
        taxId,
        nickname: document.getElementById('nickname').value,
        contact: document.getElementById('contact').value,
        phone,
        email: document.getElementById('email').value,
        address: document.getElementById('address').value || '',
        invoiceInfo: document.getElementById('invoiceInfo').checked ? 'v' : '',
        customerId: document.getElementById('customerId').value || ''
    };

    const originalData = JSON.parse(JSON.stringify(window.allCustomers));
    const custErr = document.getElementById('customerError');
    if (custErr) { custErr.innerText = ''; custErr.classList.remove('active'); }
    
    if (rIndex && parseInt(rIndex) !== -1) {
        const idx = window.allCustomers.findIndex(c => c.rowIndex == rIndex);
        if (idx !== -1) window.allCustomers[idx] = { ...window.allCustomers[idx], ...bodyData };
    } else {
        window.allCustomers.unshift({ ...bodyData, rowIndex: -1 });
    }
    
    window.currentFilteredCustomers = [...window.allCustomers];
    window.renderCustomers();
    setSyncStatus(true);

    try {
        const json = await window.apiPost(isUpdate ? 'update_customer' : 'add_customer', bodyData);
        if (json.success) { 
            Toast.fire({ icon: 'success', title: '客戶已儲存' });
            window.isCustomerModified = false;
            window.switchSubView('customers', 'list');
            if (typeof window.fetchCustomers === 'function') window.fetchCustomers(); 
        } else {
            throw new Error(json.error);
        }
    } catch (e) { 
        window.allCustomers = originalData;
        window.currentFilteredCustomers = [...window.allCustomers];
        window.renderCustomers();
        if (custErr) {
            custErr.innerText = '同步失敗: ' + (e.message || '請重新嘗試');
            custErr.classList.add('active');
        }
    } finally {
        setSyncStatus(false);
    }
}

window.filterCustomers = function(val) {
    const query = String(val).toLowerCase();
    window.currentFilteredCustomers = window.allCustomers.filter(c => {
        return Object.values(c).some(fieldVal => 
            String(fieldVal || '').toLowerCase().includes(query)
        );
    });
    window.currentPage = 1;
    window.renderCustomers();
}

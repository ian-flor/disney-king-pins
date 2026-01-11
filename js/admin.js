/**
 * Disney King Pins - Admin Dashboard
 * JavaScript for viewing and managing agreements
 * With Supabase Auth integration, autocomplete search, and copy member list
 */

// ============================================
// Configuration
// ============================================

// Demo password (used only when Supabase not configured)
const DEMO_PASSWORD = 'dkp2024';

// Pagination
const ITEMS_PER_PAGE = 20;
let currentPage = 1;
let allAgreements = [];
let filteredAgreements = [];

// Autocomplete state
let autocompleteIndex = -1;
let autocompleteResults = [];
let searchDebounceTimer = null;

// Demo mode flag
let isDemoMode = false;

// ============================================
// UI State Management
// ============================================

const UI = {
    loginCard: () => document.getElementById('login-card'),
    setPasswordCard: () => document.getElementById('set-password-card'),
    forgotPasswordCard: () => document.getElementById('forgot-password-card'),
    dashboard: () => document.getElementById('admin-dashboard'),
    adminEmail: () => document.getElementById('admin-email'),
    demoNotice: () => document.getElementById('demo-notice'),

    showLogin() {
        this.hideAll();
        this.loginCard().style.display = 'block';
        if (isDemoMode) {
            this.demoNotice().style.display = 'block';
        }
    },

    showSetPassword() {
        this.hideAll();
        const card = this.setPasswordCard();
        if (card) card.style.display = 'block';
    },

    showForgotPassword() {
        this.hideAll();
        const card = this.forgotPasswordCard();
        if (card) card.style.display = 'block';
    },

    showDashboard(email) {
        this.hideAll();
        this.dashboard().style.display = 'block';
        if (email && this.adminEmail()) {
            this.adminEmail().textContent = email;
        }
    },

    hideAll() {
        this.loginCard().style.display = 'none';
        const setPass = this.setPasswordCard();
        const forgotPass = this.forgotPasswordCard();
        if (setPass) setPass.style.display = 'none';
        if (forgotPass) forgotPass.style.display = 'none';
        this.dashboard().style.display = 'none';
    }
};

// ============================================
// Authentication
// ============================================

async function checkAuth() {
    const { AdminAuth } = window;

    // Check if Supabase is configured
    if (!AdminAuth || !AdminAuth.isConfigured()) {
        isDemoMode = true;
        checkDemoAuth();
        return;
    }

    // Check for invite/recovery flow first
    if (AdminAuth.hasAuthError()) {
        const errorMsg = AdminAuth.getAuthError();
        showLoginError(errorMsg || 'Authentication error');
        UI.showLogin();
        return;
    }

    if (AdminAuth.isInviteFlow() || AdminAuth.isRecoveryFlow()) {
        UI.showSetPassword();
        return;
    }

    // Check existing session
    const session = await AdminAuth.getSession();

    if (session) {
        const profile = await AdminAuth.getAdminProfile();
        UI.showDashboard(profile?.email || session.user.email);
        await loadData();
    } else {
        UI.showLogin();
    }
}

function checkDemoAuth() {
    const isLoggedIn = sessionStorage.getItem('dkp_admin_logged_in') === 'true';

    if (isLoggedIn) {
        UI.showDashboard('demo@example.com');
        loadData();
    } else {
        UI.showLogin();
    }
}

function showLoginError(message) {
    const errorDiv = document.getElementById('login-error');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }
}

function hideLoginError() {
    const errorDiv = document.getElementById('login-error');
    if (errorDiv) {
        errorDiv.style.display = 'none';
    }
}

function initLoginForm() {
    const loginForm = document.getElementById('login-form');
    const { AdminAuth } = window;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('adminEmail').value;
        const password = document.getElementById('adminPassword').value;
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        const btnText = submitBtn.querySelector('.btn-text');
        const btnSpinner = submitBtn.querySelector('.btn-spinner');

        hideLoginError();

        // Demo mode - simple password check
        if (isDemoMode) {
            if (password === DEMO_PASSWORD) {
                sessionStorage.setItem('dkp_admin_logged_in', 'true');
                UI.showDashboard(email || 'demo@example.com');
                loadData();
            } else {
                showLoginError('Incorrect password. Use: dkp2024');
            }
            return;
        }

        // Supabase Auth mode
        submitBtn.disabled = true;
        if (btnText) btnText.style.display = 'none';
        if (btnSpinner) btnSpinner.style.display = 'inline-flex';

        const result = await AdminAuth.signIn(email, password);

        if (result.success) {
            const profile = await AdminAuth.getAdminProfile();
            UI.showDashboard(profile?.email || email);
            await loadData();
        } else {
            showLoginError(result.error || 'Invalid email or password');
        }

        submitBtn.disabled = false;
        if (btnText) btnText.style.display = 'inline';
        if (btnSpinner) btnSpinner.style.display = 'none';
    });
}

function initSetPasswordForm() {
    const form = document.getElementById('set-password-form');
    if (!form) return;

    const { AdminAuth } = window;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const password = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const errorDiv = document.getElementById('set-password-error');
        const submitBtn = form.querySelector('button[type="submit"]');

        // Clear previous errors
        if (errorDiv) errorDiv.style.display = 'none';

        // Validate passwords match
        if (password !== confirmPassword) {
            if (errorDiv) {
                errorDiv.textContent = 'Passwords do not match';
                errorDiv.style.display = 'block';
            }
            return;
        }

        // Validate password strength
        if (AdminAuth) {
            const validation = AdminAuth.validatePassword(password);
            if (!validation.isValid) {
                if (errorDiv) {
                    errorDiv.innerHTML = validation.errors.join('<br>');
                    errorDiv.style.display = 'block';
                }
                return;
            }
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Setting password...';

        const result = await AdminAuth.setPassword(password);

        if (result.success) {
            const profile = await AdminAuth.getAdminProfile();
            UI.showDashboard(profile?.email || result.user?.email);
            await loadData();
        } else {
            if (errorDiv) {
                errorDiv.textContent = result.error || 'Failed to set password';
                errorDiv.style.display = 'block';
            }
        }

        submitBtn.disabled = false;
        submitBtn.textContent = 'Set Password & Continue';
    });
}

function initForgotPasswordForm() {
    const form = document.getElementById('forgot-password-form');
    if (!form) return;

    const { AdminAuth } = window;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('resetEmail').value;
        const errorDiv = document.getElementById('forgot-password-error');
        const successDiv = document.getElementById('forgot-password-success');
        const submitBtn = form.querySelector('button[type="submit"]');

        if (errorDiv) errorDiv.style.display = 'none';
        if (successDiv) successDiv.style.display = 'none';

        if (!AdminAuth || isDemoMode) {
            if (errorDiv) {
                errorDiv.textContent = 'Password reset not available in demo mode';
                errorDiv.style.display = 'block';
            }
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';

        const result = await AdminAuth.requestPasswordReset(email);

        if (result.success) {
            if (successDiv) {
                successDiv.textContent = 'Password reset link sent! Check your email.';
                successDiv.style.display = 'block';
            }
            form.reset();
        } else {
            if (errorDiv) {
                errorDiv.textContent = result.error || 'Failed to send reset email';
                errorDiv.style.display = 'block';
            }
        }

        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Reset Link';
    });

    // Back to login link
    const backToLogin = document.getElementById('backToLogin');
    if (backToLogin) {
        backToLogin.addEventListener('click', (e) => {
            e.preventDefault();
            UI.showLogin();
        });
    }
}

function initForgotPasswordLink() {
    const showForgotPassword = document.getElementById('showForgotPassword');
    if (showForgotPassword) {
        showForgotPassword.addEventListener('click', (e) => {
            e.preventDefault();
            if (isDemoMode) {
                alert('Password reset not available in demo mode. Use password: dkp2024');
            } else {
                UI.showForgotPassword();
            }
        });
    }
}

function initLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (!logoutBtn) return;

    logoutBtn.addEventListener('click', async () => {
        if (isDemoMode) {
            sessionStorage.removeItem('dkp_admin_logged_in');
            UI.showLogin();
            return;
        }

        const { AdminAuth } = window;
        if (AdminAuth) {
            await AdminAuth.signOut();
        }
        UI.showLogin();
    });
}

// ============================================
// Data Loading
// ============================================

async function loadData() {
    const { AdminAuth } = window;

    if (!isDemoMode && AdminAuth && AdminAuth.supabase) {
        await loadFromSupabase();
    } else {
        loadFromLocalStorage();
    }

    updateStats();
    filterAndRender();
    updateCopyListInfo();
}

async function loadFromSupabase() {
    const { AdminAuth } = window;

    try {
        const { data, error } = await AdminAuth.supabase
            .from('agreements')
            .select('*')
            .order('agreed_at', { ascending: false });

        if (error) {
            console.error('Supabase error:', error);
            if (error.code === 'PGRST301') {
                // RLS policy violation - not authenticated
                UI.showLogin();
                return;
            }
            return;
        }

        allAgreements = data || [];
    } catch (error) {
        console.error('Load error:', error);
    }
}

function loadFromLocalStorage() {
    try {
        allAgreements = JSON.parse(localStorage.getItem('dkp_agreements') || '[]');
        // Sort by date descending
        allAgreements.sort((a, b) => new Date(b.agreed_at) - new Date(a.agreed_at));
    } catch (error) {
        console.error('LocalStorage error:', error);
        allAgreements = [];
    }
}

// ============================================
// Statistics
// ============================================

function updateStats() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    let todayCount = 0;
    let weekCount = 0;
    let monthCount = 0;

    allAgreements.forEach(agreement => {
        const agreedDate = new Date(agreement.agreed_at);

        if (agreedDate >= today) todayCount++;
        if (agreedDate >= weekAgo) weekCount++;
        if (agreedDate >= monthAgo) monthCount++;
    });

    document.getElementById('totalCount').textContent = allAgreements.length;
    document.getElementById('todayCount').textContent = todayCount;
    document.getElementById('weekCount').textContent = weekCount;
    document.getElementById('monthCount').textContent = monthCount;
}

// ============================================
// Search with Autocomplete
// ============================================

function initSearch() {
    const searchInput = document.getElementById('searchInput');
    const dropdown = document.getElementById('autocompleteDropdown');

    // Debounced search
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            const value = e.target.value.trim();

            if (value.length >= 1) {
                showAutocomplete(value);
            } else {
                hideAutocomplete();
            }

            currentPage = 1;
            filterAndRender();
            updateCopyListInfo();
        }, 150);
    });

    // Keyboard navigation
    searchInput.addEventListener('keydown', (e) => {
        if (!dropdown.classList.contains('show')) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                navigateAutocomplete(1);
                break;
            case 'ArrowUp':
                e.preventDefault();
                navigateAutocomplete(-1);
                break;
            case 'Enter':
                e.preventDefault();
                selectAutocompleteItem();
                break;
            case 'Escape':
                hideAutocomplete();
                break;
        }
    });

    // Hide on click outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            hideAutocomplete();
        }
    });

    // Show on focus if has value
    searchInput.addEventListener('focus', () => {
        const value = searchInput.value.trim();
        if (value.length >= 1 && autocompleteResults.length > 0) {
            dropdown.classList.add('show');
        }
    });
}

function showAutocomplete(query) {
    const dropdown = document.getElementById('autocompleteDropdown');
    const lowerQuery = query.toLowerCase();

    // Find matching agreements
    autocompleteResults = allAgreements.filter(a => {
        const fullName = `${a.first_name} ${a.last_name}`.toLowerCase();
        const code = a.confirmation_code.toLowerCase();
        return fullName.includes(lowerQuery) || code.includes(lowerQuery);
    }).slice(0, 10); // Limit to 10 results

    if (autocompleteResults.length === 0) {
        hideAutocomplete();
        return;
    }

    // Build dropdown HTML
    dropdown.innerHTML = autocompleteResults.map((result, index) => {
        const fullName = `${result.first_name} ${result.last_name}`;
        const highlightedName = highlightMatch(fullName, query);
        const highlightedCode = highlightMatch(result.confirmation_code, query);

        return `
            <div class="autocomplete-item" data-index="${index}">
                <span class="name">${highlightedName}</span>
                <span class="code">${highlightedCode}</span>
            </div>
        `;
    }).join('');

    // Add click handlers
    dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
        item.addEventListener('click', () => {
            const index = parseInt(item.dataset.index);
            autocompleteIndex = index;
            selectAutocompleteItem();
        });
    });

    autocompleteIndex = -1;
    dropdown.classList.add('show');
}

function highlightMatch(text, query) {
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);

    if (index === -1) return escapeHtml(text);

    const before = escapeHtml(text.substring(0, index));
    const match = escapeHtml(text.substring(index, index + query.length));
    const after = escapeHtml(text.substring(index + query.length));

    return `${before}<mark>${match}</mark>${after}`;
}

function hideAutocomplete() {
    const dropdown = document.getElementById('autocompleteDropdown');
    dropdown.classList.remove('show');
    autocompleteIndex = -1;
}

function navigateAutocomplete(direction) {
    const items = document.querySelectorAll('.autocomplete-item');
    if (items.length === 0) return;

    // Remove highlight from current
    if (autocompleteIndex >= 0 && items[autocompleteIndex]) {
        items[autocompleteIndex].classList.remove('highlighted');
    }

    // Calculate new index
    autocompleteIndex += direction;
    if (autocompleteIndex < 0) autocompleteIndex = items.length - 1;
    if (autocompleteIndex >= items.length) autocompleteIndex = 0;

    // Add highlight to new
    items[autocompleteIndex].classList.add('highlighted');
    items[autocompleteIndex].scrollIntoView({ block: 'nearest' });
}

function selectAutocompleteItem() {
    if (autocompleteIndex < 0 || autocompleteIndex >= autocompleteResults.length) {
        hideAutocomplete();
        return;
    }

    const selected = autocompleteResults[autocompleteIndex];
    const searchInput = document.getElementById('searchInput');
    searchInput.value = `${selected.first_name} ${selected.last_name}`;

    hideAutocomplete();
    currentPage = 1;
    filterAndRender();
    updateCopyListInfo();
}

function filterAndRender() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();

    if (searchTerm) {
        filteredAgreements = allAgreements.filter(agreement => {
            const fullName = `${agreement.first_name} ${agreement.last_name}`.toLowerCase();
            const code = agreement.confirmation_code.toLowerCase();
            return fullName.includes(searchTerm) || code.includes(searchTerm);
        });
    } else {
        filteredAgreements = [...allAgreements];
    }

    renderTable();
    renderPagination();
}

// ============================================
// Copy Member List
// ============================================

function initCopyList() {
    const copyBtn = document.getElementById('copyListBtn');
    if (!copyBtn) return;

    copyBtn.addEventListener('click', () => {
        copyMemberList();
    });
}

function updateCopyListInfo() {
    const countEl = document.getElementById('copyListCount');
    const filterEl = document.getElementById('copyListFilter');

    if (countEl) {
        countEl.textContent = filteredAgreements.length;
    }

    if (filterEl) {
        const searchTerm = document.getElementById('searchInput').value.trim();
        if (searchTerm) {
            filterEl.textContent = `(filtered by "${searchTerm}")`;
        } else {
            filterEl.textContent = '(showing all)';
        }
    }
}

function copyMemberList() {
    if (filteredAgreements.length === 0) {
        alert('No members to copy');
        return;
    }

    // Create list with each name on its own line
    const memberList = filteredAgreements
        .map(a => `${a.first_name} ${a.last_name}`)
        .join('\n');

    // Copy to clipboard
    navigator.clipboard.writeText(memberList).then(() => {
        showCopySuccess();
    }).catch(err => {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = memberList;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            showCopySuccess();
        } catch (e) {
            console.error('Copy failed:', e);
            alert('Failed to copy. Please try again.');
        }
        document.body.removeChild(textarea);
    });
}

function showCopySuccess() {
    const btn = document.getElementById('copyListBtn');
    const icon = document.getElementById('copyListIcon');
    const check = document.getElementById('copyListCheck');
    const text = document.getElementById('copyListText');

    btn.classList.add('copied');
    if (icon) icon.style.display = 'none';
    if (check) check.style.display = 'inline';
    if (text) text.textContent = 'Copied!';

    setTimeout(() => {
        btn.classList.remove('copied');
        if (icon) icon.style.display = 'inline';
        if (check) check.style.display = 'none';
        if (text) text.textContent = 'Copy Names';
    }, 2000);
}

// ============================================
// Table Rendering
// ============================================

function renderTable() {
    const tableBody = document.getElementById('tableBody');
    const emptyState = document.getElementById('emptyState');

    // Calculate page slice
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const pageItems = filteredAgreements.slice(startIndex, endIndex);

    if (pageItems.length === 0) {
        tableBody.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    tableBody.innerHTML = pageItems.map(agreement => {
        const date = new Date(agreement.agreed_at);
        const formattedDate = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        return `
            <tr>
                <td class="code-cell">${escapeHtml(agreement.confirmation_code)}</td>
                <td>${escapeHtml(agreement.first_name)}</td>
                <td>${escapeHtml(agreement.last_name)}</td>
                <td class="date-cell">${formattedDate}</td>
            </tr>
        `;
    }).join('');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// Pagination
// ============================================

function renderPagination() {
    const pagination = document.getElementById('pagination');
    const totalPages = Math.ceil(filteredAgreements.length / ITEMS_PER_PAGE);

    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }

    let html = '';

    // Previous button
    html += `
        <button class="page-btn" onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
            &laquo; Prev
        </button>
    `;

    // Page numbers
    const maxButtons = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);

    if (endPage - startPage + 1 < maxButtons) {
        startPage = Math.max(1, endPage - maxButtons + 1);
    }

    if (startPage > 1) {
        html += `<button class="page-btn" onclick="goToPage(1)">1</button>`;
        if (startPage > 2) html += `<span style="padding: 0 8px;">...</span>`;
    }

    for (let i = startPage; i <= endPage; i++) {
        html += `
            <button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">
                ${i}
            </button>
        `;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<span style="padding: 0 8px;">...</span>`;
        html += `<button class="page-btn" onclick="goToPage(${totalPages})">${totalPages}</button>`;
    }

    // Next button
    html += `
        <button class="page-btn" onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
            Next &raquo;
        </button>
    `;

    pagination.innerHTML = html;
}

function goToPage(page) {
    const totalPages = Math.ceil(filteredAgreements.length / ITEMS_PER_PAGE);
    if (page < 1 || page > totalPages) return;

    currentPage = page;
    renderTable();
    renderPagination();

    // Scroll to top of table
    document.querySelector('.table-wrapper').scrollIntoView({ behavior: 'smooth' });
}

// Make goToPage available globally
window.goToPage = goToPage;

// ============================================
// Export to CSV
// ============================================

function initExport() {
    const exportBtn = document.getElementById('exportBtn');

    exportBtn.addEventListener('click', () => {
        exportToCSV();
    });
}

function exportToCSV() {
    if (allAgreements.length === 0) {
        alert('No data to export');
        return;
    }

    // Create CSV content
    const headers = ['Confirmation Code', 'First Name', 'Last Name', 'Date Agreed'];
    const rows = allAgreements.map(agreement => {
        const date = new Date(agreement.agreed_at).toISOString();
        return [
            agreement.confirmation_code,
            agreement.first_name,
            agreement.last_name,
            date
        ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');

    // Create download link
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `dkp-agreements-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ============================================
// Initialize
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Check if AdminAuth exists and is configured
    const { AdminAuth } = window;
    isDemoMode = !AdminAuth || !AdminAuth.isConfigured();

    // Initialize auth listeners (if Supabase configured)
    if (AdminAuth && AdminAuth.onAuthStateChange) {
        AdminAuth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT') {
                UI.showLogin();
            }
        });
    }

    // Initialize all forms and handlers
    initLoginForm();
    initSetPasswordForm();
    initForgotPasswordForm();
    initForgotPasswordLink();
    initLogout();
    initSearch();
    initExport();
    initCopyList();

    // Check auth state
    checkAuth();

    // Console message for demo mode
    if (isDemoMode) {
        console.info(
            '%c Disney King Pins Admin - Demo Mode ',
            'background: #1877F2; color: white; padding: 4px 8px; border-radius: 4px;',
            '\nSupabase is not configured. Using localStorage data and demo password.'
        );
    }
});

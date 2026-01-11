/**
 * Disney King Pins - Admin Dashboard
 * JavaScript for viewing and managing agreements
 */

// ============================================
// Configuration
// ============================================

// Supabase Configuration - Must match main.js
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

// Admin password (for demo - in production, use proper auth)
const ADMIN_PASSWORD = 'dkp2024';

// Pagination
const ITEMS_PER_PAGE = 20;
let currentPage = 1;
let allAgreements = [];
let filteredAgreements = [];

// Initialize Supabase client
let supabase = null;

function isSupabaseConfigured() {
    return SUPABASE_URL !== 'YOUR_SUPABASE_URL' &&
           SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY';
}

if (isSupabaseConfigured() && typeof window.supabase !== 'undefined') {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ============================================
// Authentication
// ============================================

function checkAuth() {
    const isLoggedIn = sessionStorage.getItem('dkp_admin_logged_in') === 'true';
    const loginCard = document.getElementById('login-card');
    const dashboard = document.getElementById('admin-dashboard');

    if (isLoggedIn) {
        loginCard.style.display = 'none';
        dashboard.style.display = 'block';
        loadData();
    } else {
        loginCard.style.display = 'block';
        dashboard.style.display = 'none';
    }
}

function initLogin() {
    const loginForm = document.getElementById('login-form');

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const password = document.getElementById('adminPassword').value;

        if (password === ADMIN_PASSWORD) {
            sessionStorage.setItem('dkp_admin_logged_in', 'true');
            checkAuth();
        } else {
            alert('Incorrect password');
        }
    });
}

// ============================================
// Data Loading
// ============================================

async function loadData() {
    if (isSupabaseConfigured() && supabase) {
        await loadFromSupabase();
    } else {
        loadFromLocalStorage();
    }

    updateStats();
    filterAndRender();
}

async function loadFromSupabase() {
    try {
        const { data, error } = await supabase
            .from('agreements')
            .select('*')
            .order('agreed_at', { ascending: false });

        if (error) {
            console.error('Supabase error:', error);
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
// Search & Filter
// ============================================

function initSearch() {
    const searchInput = document.getElementById('searchInput');

    searchInput.addEventListener('input', (e) => {
        currentPage = 1;
        filterAndRender();
    });
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
    initLogin();
    initSearch();
    initExport();
    checkAuth();

    if (!isSupabaseConfigured()) {
        console.info(
            '%c Disney King Pins Admin - Demo Mode ',
            'background: #1877F2; color: white; padding: 4px 8px; border-radius: 4px;',
            '\nSupabase is not configured. Using localStorage data.'
        );
    }
});

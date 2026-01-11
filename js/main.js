/**
 * Disney King Pins - Member Auction Rules Agreement
 * Main JavaScript for form handling and Supabase integration
 */

// ============================================
// Configuration
// ============================================

// Supabase Configuration - Replace with your own values
const SUPABASE_URL = 'https://qzbtatvwlpkemeziyfms.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_BsY8jGsfQjK6lW_-Bv9j9w_uXJSQxMO';

// Initialize Supabase client
let supabase = null;

// Check if Supabase is configured
function isSupabaseConfigured() {
    return SUPABASE_URL !== 'YOUR_SUPABASE_URL' &&
           SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY';
}

// Initialize Supabase if configured
if (isSupabaseConfigured() && typeof window.supabase !== 'undefined') {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ============================================
// Auction Post Template (for copy button)
// ============================================

const AUCTION_TEMPLATE = `***MEMBER AUCTION***

[ITEM DESCRIPTION - include edition size: LE XXX, OE, or LR]
[List any flaws, defects, or imperfections]

Starting Bid: $[AMOUNT]
Shipping: $[AMOUNT] within the U.S.; International $[AMOUNT] (or no international)
Ends: [DATE] @ [TIME] pm PST

*All bids must be in whole dollar increments.
*Payment Types Accepted: [Paypal and/or Venmo]

#disneykingpins #dkpauctions`;

// ============================================
// Utility Functions
// ============================================

/**
 * Generate a unique confirmation code
 * Format: DKP-XXXXXX (6 alphanumeric characters)
 */
function generateConfirmationCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'DKP-';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

/**
 * Simple hash function for IP (privacy-friendly)
 * We don't store the actual IP, just a hash for duplicate detection
 */
async function hashString(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Get user's approximate IP hash (for duplicate detection)
 * Uses a free API to get IP, then hashes it
 */
async function getIpHash() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return await hashString(data.ip + 'DKP_SALT_2024');
    } catch (error) {
        console.warn('Could not get IP hash:', error);
        return null;
    }
}

/**
 * Capitalize first letter of each word
 */
function capitalizeWords(str) {
    return str.trim().split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

/**
 * Validate form inputs
 */
function validateForm(firstName, lastName, agreed) {
    const errors = [];

    if (!firstName || firstName.trim().length < 1) {
        errors.push({ field: 'firstName', message: 'First name is required' });
    } else if (firstName.trim().length > 100) {
        errors.push({ field: 'firstName', message: 'First name is too long' });
    }

    if (!lastName || lastName.trim().length < 1) {
        errors.push({ field: 'lastName', message: 'Last name is required' });
    } else if (lastName.trim().length > 100) {
        errors.push({ field: 'lastName', message: 'Last name is too long' });
    }

    if (!agreed) {
        errors.push({ field: 'agreeCheckbox', message: 'You must agree to the rules' });
    }

    return errors;
}

/**
 * Show error message for a field
 */
function showFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    if (field) {
        field.classList.add('error');

        // Remove existing error message if any
        const existingError = field.parentElement.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }

        // Add new error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        field.parentElement.appendChild(errorDiv);
    }
}

/**
 * Clear all error states
 */
function clearErrors() {
    document.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
    document.querySelectorAll('.error-message').forEach(el => el.remove());
}

/**
 * Set loading state on submit button
 */
function setLoading(isLoading) {
    const submitBtn = document.getElementById('submitBtn');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoading = submitBtn.querySelector('.btn-loading');

    submitBtn.disabled = isLoading;
    btnText.style.display = isLoading ? 'none' : 'inline';
    btnLoading.style.display = isLoading ? 'flex' : 'none';
}

/**
 * Show success state
 */
function showSuccess(confirmationCode) {
    const formCard = document.getElementById('agreement-form-card');
    const successCard = document.getElementById('success-card');
    const codeElement = document.getElementById('confirmationCode');

    formCard.style.display = 'none';
    codeElement.textContent = confirmationCode;
    successCard.style.display = 'block';

    // Mark signature step as complete
    markSignatureComplete();

    // Scroll to success card
    successCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ============================================
// Database Functions
// ============================================

/**
 * Submit agreement to Supabase
 */
async function submitToSupabase(firstName, lastName, confirmationCode) {
    if (!supabase) {
        console.error('Supabase is not configured');
        return { success: false, error: 'Database not configured' };
    }

    try {
        const ipHash = await getIpHash();
        const userAgent = navigator.userAgent;

        const { data, error } = await supabase
            .from('agreements')
            .insert([
                {
                    first_name: firstName,
                    last_name: lastName,
                    confirmation_code: confirmationCode,
                    ip_hash: ipHash,
                    user_agent: userAgent
                }
            ])
            .select();

        if (error) {
            console.error('Supabase error:', error);

            // Handle unique constraint violation (duplicate confirmation code)
            if (error.code === '23505') {
                // Generate a new code and retry
                const newCode = generateConfirmationCode();
                return await submitToSupabase(firstName, lastName, newCode);
            }

            return { success: false, error: error.message };
        }

        return { success: true, data };
    } catch (error) {
        console.error('Submit error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Fallback: Store locally if Supabase is not configured
 */
function submitToLocalStorage(firstName, lastName, confirmationCode) {
    try {
        const agreements = JSON.parse(localStorage.getItem('dkp_agreements') || '[]');

        agreements.push({
            id: Date.now(),
            first_name: firstName,
            last_name: lastName,
            confirmation_code: confirmationCode,
            agreed_at: new Date().toISOString()
        });

        localStorage.setItem('dkp_agreements', JSON.stringify(agreements));
        return { success: true };
    } catch (error) {
        console.error('LocalStorage error:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// Scroll Progress & Form Lock
// ============================================

let formUnlocked = false;
let completedSteps = new Set();

/**
 * Check if element has been scrolled past (user has read it)
 * Returns true when the bottom of the element has scrolled above the bottom third of the viewport
 */
function isElementScrolledTo(element) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const windowHeight = window.innerHeight || document.documentElement.clientHeight;
    // Element is considered "read" when its bottom has scrolled above 70% of viewport height
    // This ensures user has scrolled through most of the section content
    return rect.bottom < windowHeight * 0.7;
}

/**
 * Initialize scroll progress tracking and form lock
 */
function initScrollProgress() {
    const formCard = document.getElementById('agreement-form-card');

    // Section elements to track (only track the 3 rules sections for scroll progress)
    // Step 4 (signature) is completed after form submission, not scroll
    const sections = [
        { id: 'section-posting', step: 1 },
        { id: 'section-bidding', step: 2 },
        { id: 'section-general', step: 3 }
    ];

    // Verify elements exist
    sections.forEach(s => {
        const el = document.getElementById(s.id);
        if (!el) {
            console.error(`Section element not found: ${s.id}`);
        }
    });

    // Check if already unlocked in this session
    if (sessionStorage.getItem('dkp_form_unlocked') === 'true') {
        // Mark all steps as completed (except step 4 unless form was submitted)
        for (let i = 1; i <= 3; i++) {
            completedSteps.add(i);
            updateStepUI(i, 'completed');
        }
        updateLineUI();
        unlockForm();
        return;
    }

    // Set first step as active initially
    updateStepUI(1, 'active');

    /**
     * Check scroll position and update progress
     */
    function checkScrollProgress() {
        sections.forEach(section => {
            const element = document.getElementById(section.id);

            if (!element) return;

            const isScrolledTo = isElementScrolledTo(element);

            if (isScrolledTo && !completedSteps.has(section.step)) {
                // Mark this step as completed
                completedSteps.add(section.step);
                updateStepUI(section.step, 'completed');
                updateLineUI();

                // Mark next step as active if exists and not completed
                const nextStep = section.step + 1;
                if (nextStep <= 4 && !completedSteps.has(nextStep)) {
                    updateStepUI(nextStep, 'active');
                }

                // Unlock form when all 3 rules sections are read
                if (section.step === 3 && !formUnlocked) {
                    unlockForm();
                }

                console.log(`Step ${section.step} completed:`, section.id);
            }
        });
    }

    // Throttled scroll handler
    let ticking = false;
    function onScroll() {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                checkScrollProgress();
                ticking = false;
            });
            ticking = true;
        }
    }

    window.addEventListener('scroll', onScroll, { passive: true });

    // Also check on initial load (in case page is already scrolled)
    setTimeout(() => {
        checkScrollProgress();
    }, 100);
}

/**
 * Update step UI state
 */
function updateStepUI(stepNumber, state) {
    const step = document.querySelector(`.progress-step[data-step="${stepNumber}"]`);
    if (!step) return;

    // Remove all states
    step.classList.remove('active', 'completed');

    // Add new state
    if (state) {
        step.classList.add(state);
    }
}

/**
 * Update connecting lines based on completed steps
 */
function updateLineUI() {
    for (let i = 1; i <= 3; i++) {
        const line = document.getElementById(`line-${i}`);
        if (line && completedSteps.has(i)) {
            line.classList.add('completed');
        }
    }
}

/**
 * Unlock the form
 */
function unlockForm() {
    const formCard = document.getElementById('agreement-form-card');

    if (formUnlocked) return;

    formUnlocked = true;
    sessionStorage.setItem('dkp_form_unlocked', 'true');

    // Remove locked class and add animation
    formCard.classList.remove('locked');
    formCard.classList.add('unlocking');

    // Mark step 4 as active (signature)
    updateStepUI(4, 'active');

    // Remove animation class after it completes
    setTimeout(() => {
        formCard.classList.remove('unlocking');
    }, 500);
}

/**
 * Mark signature step as complete (call after successful form submission)
 */
function markSignatureComplete() {
    completedSteps.add(4);
    updateStepUI(4, 'completed');
    const line3 = document.getElementById('line-3');
    if (line3) line3.classList.add('completed');
}

// ============================================
// Copy Template Button
// ============================================

/**
 * Initialize copy template button
 */
function initCopyButton() {
    const copyBtn = document.getElementById('copyTemplateBtn');
    if (!copyBtn) return;

    copyBtn.addEventListener('click', async (e) => {
        e.preventDefault();

        try {
            // Use clipboard API
            await navigator.clipboard.writeText(AUCTION_TEMPLATE);

            // Show success state
            copyBtn.classList.add('copied');

            // Reset after 2 seconds
            setTimeout(() => {
                copyBtn.classList.remove('copied');
            }, 2000);

        } catch (err) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = AUCTION_TEMPLATE;
            textArea.style.position = 'fixed';
            textArea.style.left = '-9999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();

            try {
                document.execCommand('copy');
                copyBtn.classList.add('copied');
                setTimeout(() => {
                    copyBtn.classList.remove('copied');
                }, 2000);
            } catch (fallbackErr) {
                console.error('Copy failed:', fallbackErr);
                alert('Unable to copy. Please select and copy the text manually.');
            }

            document.body.removeChild(textArea);
        }
    });
}

// ============================================
// Form Handling
// ============================================

function initForm() {
    const form = document.getElementById('agreement-form');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Check if form is unlocked
        if (!formUnlocked) {
            alert('Please scroll down and read all the rules before submitting.');
            return;
        }

        // Clear previous errors
        clearErrors();

        // Get form values
        const firstName = capitalizeWords(document.getElementById('firstName').value);
        const lastName = capitalizeWords(document.getElementById('lastName').value);
        const agreed = document.getElementById('agreeCheckbox').checked;

        // Validate
        const errors = validateForm(firstName, lastName, agreed);

        if (errors.length > 0) {
            errors.forEach(err => showFieldError(err.field, err.message));
            return;
        }

        // Set loading state
        setLoading(true);

        // Generate confirmation code
        const confirmationCode = generateConfirmationCode();

        // Submit to database
        let result;

        if (isSupabaseConfigured() && supabase) {
            result = await submitToSupabase(firstName, lastName, confirmationCode);
        } else {
            // Fallback to localStorage for testing/demo
            console.warn('Supabase not configured. Using localStorage as fallback.');
            result = submitToLocalStorage(firstName, lastName, confirmationCode);
        }

        // Handle result
        setLoading(false);

        if (result.success) {
            showSuccess(confirmationCode);
        } else {
            alert('There was an error submitting your agreement. Please try again.\n\nError: ' + result.error);
        }
    });

    // Clear error state on input
    document.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', () => {
            input.classList.remove('error');
            const errorMsg = input.parentElement.querySelector('.error-message');
            if (errorMsg) errorMsg.remove();
        });
    });
}

// ============================================
// Initialize
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initScrollProgress();
    initCopyButton();
    initForm();

    // Log configuration status
    if (!isSupabaseConfigured()) {
        console.info(
            '%c Disney King Pins - Demo Mode ',
            'background: #1877F2; color: white; padding: 4px 8px; border-radius: 4px;',
            '\nSupabase is not configured. Form submissions will be stored in localStorage.'
        );
    }
});

// ========================================================
// Auto Clicker & Form Filler Pro - Content Script
// Handles recording, smart element selection, option boxes,
// and rotating dynamic paragraph filling from TXT files.
// ========================================================

const contentSend = (msg) => {
    chrome.runtime.sendMessage(msg).catch(() => {});
};

const storageGet = (keys) => new Promise(resolve => chrome.storage.local.get(keys, resolve));
const storageSet = (items) => new Promise(resolve => chrome.storage.local.set(items, resolve));

// In-memory state
let recordedSteps = [];
let smartModeCached = true;
let recordingActive = false;
let recordingPaused = false;
let stopExecution = false;
let lastActiveFieldStepIndex = null;
let lastFieldPillEl = null;

// Initialize on load
const init = () => {
    chrome.storage.local.get(['isRecording', 'smartMode', 'steps'], (data) => {
        smartModeCached = data.smartMode !== undefined ? data.smartMode : true;
        recordedSteps = data.steps || [];
        if (data.isRecording) {
            startRecordingLocally();
        }
    });
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Storage synchronization
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
        if (changes.steps) {
            recordedSteps = changes.steps.newValue || [];
            updateBannerStepCount();
        }
        if (changes.isRecording) {
            if (changes.isRecording.newValue) {
                startRecordingLocally();
            } else {
                stopRecordingLocally();
            }
        }
        if (changes.smartMode !== undefined) {
            smartModeCached = changes.smartMode.newValue;
        }
    }
});

const saveSteps = () => {
    chrome.storage.local.set({ steps: recordedSteps });
};

// ========================================================
// CSS Selector & Resilient Element Identification
// ========================================================
const getCSSSelector = (el) => {
    if (!el || el === document || el === document.body) return 'body';
    if (el === document.documentElement) return 'html';
    if (el.nodeType !== 1) return '';

    // 1. Direct ID if valid and not dynamically generated noise
    if (el.id && typeof el.id === 'string') {
        const id = el.id.trim();
        // Ignore IDs that look like generated hashes or dynamic React/ember IDs
        if (!/[:\s]/.test(id) && !/^(:r|ember|react-|__)/.test(id) && !/\d{6,}/.test(id)) {
            try {
                const test = document.querySelectorAll(`#${CSS.escape(id)}`);
                if (test.length === 1) return `#${CSS.escape(id)}`;
            } catch (e) {}
        }
    }

    // 2. Name attribute (standard in forms)
    if (el.name && typeof el.name === 'string') {
        const sel = `${el.tagName.toLowerCase()}[name="${CSS.escape(el.name)}"]`;
        try {
            if (document.querySelectorAll(sel).length === 1) return sel;
        } catch (e) {}
    }

    // 3. Data-testid / data-id
    const testid = el.getAttribute('data-testid') || el.getAttribute('data-id') || el.getAttribute('data-qa');
    if (testid) {
        const sel = `[data-testid="${CSS.escape(testid)}"]`;
        try {
            if (document.querySelectorAll(sel).length === 1) return sel;
        } catch (e) {}
    }

    // 4. Role + aria-label
    const role = el.getAttribute('role');
    const ariaLabel = el.getAttribute('aria-label');
    if (role && ariaLabel) {
        const sel = `[role="${CSS.escape(role)}"][aria-label="${CSS.escape(ariaLabel)}"]`;
        try {
            if (document.querySelectorAll(sel).length === 1) return sel;
        } catch (e) {}
    }

    // 5. Placeholder
    if (el.placeholder && typeof el.placeholder === 'string') {
        const sel = `${el.tagName.toLowerCase()}[placeholder="${CSS.escape(el.placeholder)}"]`;
        try {
            if (document.querySelectorAll(sel).length === 1) return sel;
        } catch (e) {}
    }

    // 6. Hierarchy traversal fallback
    let path = [];
    let current = el;

    while (current && current.nodeType === 1 && current !== document.body && current !== document.documentElement) {
        let selector = current.tagName.toLowerCase();

        if (current.id && !/[:\s]/.test(current.id) && !/^(:r|ember|react-)/.test(current.id)) {
            path.unshift(`#${CSS.escape(current.id)}`);
            break;
        }

        if (current.name) {
            selector += `[name="${CSS.escape(current.name)}"]`;
            path.unshift(selector);
            break;
        }

        if (current.className && typeof current.className === 'string') {
            const classes = current.className.trim().split(/\s+/).filter(c => {
                return c.length > 0 && !c.includes(':') && !c.includes('/') && !/^css-/.test(c) && !/^[0-9]/.test(c);
            }).slice(0, 2);
            if (classes.length > 0) {
                selector += `.${classes.map(c => CSS.escape(c)).join('.')}`;
            }
        }

        const parent = current.parentElement;
        if (parent && current.tagName) {
            try {
                const siblings = Array.from(parent.children).filter(c => c.tagName === current.tagName);
                if (siblings.length > 1) {
                    const index = siblings.indexOf(current) + 1;
                    selector += `:nth-child(${index})`;
                }
            } catch (e) {}
        }

        path.unshift(selector);
        current = current.parentElement;
    }

    return path.join(' > ');
};

// ========================================================
// Form & Option Detection
// ========================================================
const isTextInputField = (el) => {
    if (!el || el.nodeType !== 1) return false;
    const tag = el.tagName.toLowerCase();
    if (tag === 'textarea') return true;
    if (el.isContentEditable) return true;
    if (tag === 'input') {
        const type = (el.type || 'text').toLowerCase();
        return ['text', 'email', 'tel', 'url', 'search', 'password', 'number'].includes(type);
    }
    return false;
};

const isOptionBox = (el) => {
    if (!el || el.nodeType !== 1) return false;
    const role = el.getAttribute('role');
    if (role === 'option' || role === 'menuitem' || role === 'menuitemradio') return true;

    // Check class or attributes
    const cls = typeof el.className === 'string' ? el.className.toLowerCase() : '';
    if (cls.includes('option') || cls.includes('dropdown-item') || cls.includes('select__option') || cls.includes('menu-item')) return true;

    // Inside a dropdown / listbox container
    const parentContainer = el.closest('[role="listbox"], [role="menu"], .dropdown-menu, .select-options, ul.options, select');
    if (parentContainer && (el.tagName === 'LI' || el.tagName === 'DIV' || el.tagName === 'SPAN' || el.tagName === 'BUTTON')) {
        return true;
    }
    return false;
};

// ========================================================
// Recording Logic
// ========================================================
const startRecordingLocally = () => {
    recordingActive = true;
    recordingPaused = false;

    // Event listeners for user interactions
    document.removeEventListener('click', recordClickHandler, true);
    document.addEventListener('click', recordClickHandler, true);

    document.removeEventListener('change', recordChangeHandler, true);
    document.addEventListener('change', recordChangeHandler, true);

    document.removeEventListener('blur', recordBlurHandler, true);
    document.addEventListener('blur', recordBlurHandler, true);

    document.removeEventListener('mouseover', highlightOnHover, true);
    document.addEventListener('mouseover', highlightOnHover, true);

    document.removeEventListener('mouseout', removeHighlight, true);
    document.addEventListener('mouseout', removeHighlight, true);

    document.removeEventListener('keydown', recordingKeyListener, true);
    document.addEventListener('keydown', recordingKeyListener, true);

    showRecordingBanner();
};

const stopRecordingLocally = () => {
    recordingActive = false;
    recordingPaused = false;

    document.removeEventListener('click', recordClickHandler, true);
    document.removeEventListener('change', recordChangeHandler, true);
    document.removeEventListener('blur', recordBlurHandler, true);
    document.removeEventListener('mouseover', highlightOnHover, true);
    document.removeEventListener('mouseout', removeHighlight, true);
    document.removeEventListener('keydown', recordingKeyListener, true);

    removeHighlight();
    removeFieldPill();
    hideRecordingBanner();
};

// Main Click Handler during recording
const recordClickHandler = (e) => {
    // Ignore clicks on our extension banner, field pills, or indicators
    if (e.target.closest('#acp-recorder-banner') || e.target.closest('.acp-field-pill') || e.target.closest('.acp-click-indicator')) {
        return;
    }

    if (!recordingActive || recordingPaused) return;

    const el = e.target;
    createClickIndicator(e.pageX, e.pageY, isOptionBox(el) ? 'option' : (isTextInputField(el) ? 'fill' : 'smart'));

    // --- CASE 1: Dropdown Option Box Clicked ---
    if (isOptionBox(el)) {
        const optionText = (el.textContent || '').trim();
        const optionValue = el.getAttribute('data-value') || el.getAttribute('value') || optionText;
        const step = {
            action: 'selectOption',
            isOption: true,
            optionText: optionText,
            value: optionValue,
            selector: getCSSSelector(el),
            tagName: el.tagName || '',
            elementText: optionText.substring(0, 60),
            delay: 1000,
            x: e.clientX,
            y: e.clientY
        };
        recordedSteps.push(step);
        saveSteps();
        showBannerToast(`Option: "${optionText.substring(0, 25)}"`);
        return;
    }

    // --- CASE 2: Native <select> Element Clicked ---
    if (el.tagName && el.tagName.toLowerCase() === 'select') {
        // Native select opens OS menu; change event will record the option selection
        return;
    }

    // --- CASE 3: Text Input / Textarea Field Clicked ---
    if (isTextInputField(el)) {
        const step = {
            action: 'fillStatic',
            selector: getCSSSelector(el),
            tagName: el.tagName || '',
            fieldType: el.type || el.tagName.toLowerCase(),
            nameAttr: el.name || undefined,
            idAttr: el.id || undefined,
            placeholder: el.placeholder || undefined,
            ariaLabel: el.getAttribute('aria-label') || undefined,
            value: el.value || el.textContent || '',
            delay: 1000,
            x: e.clientX,
            y: e.clientY
        };
        recordedSteps.push(step);
        lastActiveFieldStepIndex = recordedSteps.length - 1;
        saveSteps();

        showFieldDesignationPill(el, lastActiveFieldStepIndex);
        showBannerToast(`Field: <${el.tagName.toLowerCase()}>`);
        return;
    }

    // --- CASE 4: Standard Element Click (Button, Link, Dropdown Trigger, etc.) ---
    const step = {
        action: 'smartClick',
        selector: getCSSSelector(el),
        tagName: el.tagName || '',
        elementText: (el.textContent || '').trim().substring(0, 60),
        nameAttr: el.name || undefined,
        idAttr: el.id || undefined,
        ariaLabel: el.getAttribute('aria-label') || undefined,
        delay: 1000,
        x: e.clientX,
        y: e.clientY
    };
    recordedSteps.push(step);
    saveSteps();

    const label = el.textContent ? `"${el.textContent.trim().substring(0, 20)}"` : `<${el.tagName.toLowerCase()}>`;
    showBannerToast(`Click: ${label}`);
};

// Change Handler for native <select> and form inputs
const recordChangeHandler = (e) => {
    if (!recordingActive || recordingPaused) return;
    const el = e.target;
    if (!el || el.closest('#acp-recorder-banner')) return;

    // Native <select> option selection
    if (el.tagName && el.tagName.toLowerCase() === 'select') {
        const selOption = el.selectedOptions && el.selectedOptions[0];
        const optionText = selOption ? selOption.text : el.value;
        const step = {
            action: 'selectOption',
            selector: getCSSSelector(el),
            tagName: 'SELECT',
            value: el.value,
            optionText: optionText,
            optionIndex: el.selectedIndex,
            delay: 1000
        };
        recordedSteps.push(step);
        saveSteps();
        showBannerToast(`Select Option: "${optionText}"`);
        return;
    }

    // Input/Textarea change
    if (isTextInputField(el) && lastActiveFieldStepIndex !== null) {
        if (recordedSteps[lastActiveFieldStepIndex] && recordedSteps[lastActiveFieldStepIndex].action === 'fillStatic') {
            recordedSteps[lastActiveFieldStepIndex].value = el.value || el.textContent || '';
            saveSteps();
        }
    }
};

// Blur Handler to capture typed static text
const recordBlurHandler = (e) => {
    if (!recordingActive || recordingPaused) return;
    const el = e.target;
    if (!el || el.closest('#acp-recorder-banner')) return;

    if (isTextInputField(el) && lastActiveFieldStepIndex !== null) {
        if (recordedSteps[lastActiveFieldStepIndex] && recordedSteps[lastActiveFieldStepIndex].action === 'fillStatic') {
            recordedSteps[lastActiveFieldStepIndex].value = el.value || el.textContent || '';
            saveSteps();
        }
    }
};

// Key Listener
const recordingKeyListener = (e) => {
    if (e.key === 'Escape') {
        chrome.storage.local.set({ isRecording: false });
    }
};

// ========================================================
// On-Screen UI & Floating Banners
// ========================================================
const showRecordingBanner = () => {
    if (!document.body) return;

    let banner = document.getElementById('acp-recorder-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'acp-recorder-banner';
        document.body.appendChild(banner);
    }

    const stepCount = recordedSteps.length;

    banner.innerHTML = `
        <div class="acp-banner-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ff6b6b">
                <circle cx="12" cy="12" r="8"></circle>
            </svg>
        </div>
        <div class="acp-banner-text">
            <div style="display:flex; align-items:center; gap:6px;">
                <strong>Recording Active</strong>
                <span id="acp-banner-count" class="acp-step-badge">${stepCount} Steps</span>
            </div>
            <span><b>Esc</b> or button to finish · Click dropdowns & fields</span>
            <div id="acp-banner-toast" class="acp-banner-toast" style="display:none;"></div>
        </div>
        <div class="acp-banner-controls">
            <button id="acp-pause-btn" class="acp-field-pill-btn" style="padding:6px 10px;">Pause</button>
            <button id="acp-stop-btn">Finish</button>
        </div>
    `;

    document.getElementById('acp-stop-btn').onclick = (e) => {
        e.stopPropagation();
        chrome.storage.local.set({ isRecording: false });
    };

    const pauseBtn = document.getElementById('acp-pause-btn');
    pauseBtn.onclick = (e) => {
        e.stopPropagation();
        recordingPaused = !recordingPaused;
        pauseBtn.textContent = recordingPaused ? 'Resume' : 'Pause';
        showBannerToast(recordingPaused ? '⏸ Recording Paused' : '▶ Recording Resumed');
    };
};

const hideRecordingBanner = () => {
    const banner = document.getElementById('acp-recorder-banner');
    if (banner) banner.remove();
};

const updateBannerStepCount = () => {
    const countEl = document.getElementById('acp-banner-count');
    if (countEl) {
        countEl.textContent = `${recordedSteps.length} Steps`;
    }
};

const showBannerToast = (msg) => {
    const toast = document.getElementById('acp-banner-toast');
    if (toast) {
        toast.textContent = msg;
        toast.style.display = 'inline-block';
        clearTimeout(toast._timeout);
        toast._timeout = setTimeout(() => {
            if (toast) toast.style.display = 'none';
        }, 3000);
    }
    updateBannerStepCount();
};

// Floating Field Designation Pill (Static Text vs Dynamic Paragraph)
const showFieldDesignationPill = (el, stepIndex) => {
    removeFieldPill();
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const pill = document.createElement('div');
    pill.className = 'acp-field-pill';
    pill.id = 'acp-active-field-pill';
    pill.style.left = `${Math.max(10, rect.left + window.scrollX)}px`;
    pill.style.top = `${Math.max(10, rect.top + window.scrollY - 36)}px`;

    pill.innerHTML = `
        <span style="font-size:10px; color:#c4b5fd;">Field:</span>
        <button id="acp-set-para-btn" class="acp-field-pill-btn para-btn" title="Set this field to fill with next paragraph from TXT file on each rotation">
            📄 Set as Para Box (TXT)
        </button>
        <button id="acp-dismiss-pill-btn" class="acp-field-pill-btn" title="Keep as regular static text">
            ✓ Done
        </button>
    `;

    document.body.appendChild(pill);
    lastFieldPillEl = pill;

    document.getElementById('acp-set-para-btn').onclick = (e) => {
        e.stopPropagation();
        if (recordedSteps[stepIndex]) {
            recordedSteps[stepIndex].action = 'fillParagraph';
            saveSteps();
            showBannerToast('⭐ Designated as Dynamic Paragraph Field!');
        }
        removeFieldPill();
    };

    document.getElementById('acp-dismiss-pill-btn').onclick = (e) => {
        e.stopPropagation();
        removeFieldPill();
    };

    // Auto dismiss after 8s if no interaction
    setTimeout(() => {
        if (lastFieldPillEl === pill) removeFieldPill();
    }, 8000);
};

const removeFieldPill = () => {
    if (lastFieldPillEl) {
        lastFieldPillEl.remove();
        lastFieldPillEl = null;
    }
    const existing = document.getElementById('acp-active-field-pill');
    if (existing) existing.remove();
};

// Visual Hover Highlighting
let highlightEl = null;
const highlightOnHover = (e) => {
    if (highlightEl && highlightEl !== e.target) {
        highlightEl.classList.remove('acp-element-highlight');
    }
    if (e.target && e.target !== document.body && e.target !== document.documentElement && !e.target.closest('#acp-recorder-banner') && !e.target.closest('.acp-field-pill')) {
        e.target.classList.add('acp-element-highlight');
        highlightEl = e.target;
    }
};

const removeHighlight = () => {
    if (highlightEl) {
        highlightEl.classList.remove('acp-element-highlight');
        highlightEl = null;
    }
    document.querySelectorAll('.acp-element-highlight').forEach(el => el.classList.remove('acp-element-highlight'));
};

const createClickIndicator = (x, y, type = 'smart') => {
    const indicator = document.createElement('div');
    indicator.className = `acp-click-indicator ${type}`;
    indicator.style.left = `${x}px`;
    indicator.style.top = `${y}px`;
    document.body.appendChild(indicator);
    setTimeout(() => {
        indicator.style.opacity = '0';
        setTimeout(() => indicator.remove(), 400);
    }, 300);
};

// ========================================================
// Playback Engine & Form Filling Implementation
// ========================================================

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'runSteps') {
        executeSteps(msg.steps, msg.loop);
    } else if (msg.action === 'stop') {
        stopExecution = true;
    } else if (msg.action === 'startRecordingSession') {
        startRecordingLocally();
    } else if (msg.action === 'stopRecordingSession') {
        stopRecordingLocally();
    } else if (msg.action === 'testSingleStep') {
        executeStep(msg.step).then(() => {
            sendResponse({ success: true });
        }).catch(err => {
            sendResponse({ success: false, error: err.message });
        });
        return true;
    }
});

// React & Framework-compatible input value setter
const setNativeValue = (element, value) => {
    const proto = Object.getPrototypeOf(element);
    const valueDescriptor = Object.getOwnPropertyDescriptor(proto, 'value')
        || Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
        || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')
        || Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value');

    if (valueDescriptor && valueDescriptor.set) {
        valueDescriptor.set.call(element, value);
    } else {
        element.value = value;
    }
};

const isElementVisible = (el) => {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
};

// Robust multi-strategy element search
const findElementSmart = async (step) => {
    // 1. Selector
    if (step.selector) {
        try {
            const el = document.querySelector(step.selector);
            if (el && isElementVisible(el)) return el;
        } catch (e) {}
    }

    // 2. ID attribute
    if (step.idAttr) {
        try {
            const el = document.getElementById(step.idAttr);
            if (el && isElementVisible(el)) return el;
        } catch (e) {}
    }

    // 3. Name attribute
    if (step.nameAttr) {
        try {
            const el = document.querySelector(`[name="${CSS.escape(step.nameAttr)}"]`);
            if (el && isElementVisible(el)) return el;
        } catch (e) {}
    }

    // 4. Placeholder
    if (step.placeholder) {
        try {
            const el = document.querySelector(`[placeholder="${CSS.escape(step.placeholder)}"]`);
            if (el && isElementVisible(el)) return el;
        } catch (e) {}
    }

    // 5. Aria label
    if (step.ariaLabel) {
        try {
            const el = document.querySelector(`[aria-label="${CSS.escape(step.ariaLabel)}"]`);
            if (el && isElementVisible(el)) return el;
        } catch (e) {}
    }

    // 6. Option text matching (for dropdown options)
    if (step.isOption || step.action === 'selectOption') {
        const textToFind = (step.optionText || step.value || step.elementText || '').trim().toLowerCase();
        if (textToFind) {
            const candidates = document.querySelectorAll('[role="option"], [role="menuitem"], .dropdown-item, .option, li, div, button, span');
            for (const cand of candidates) {
                if (cand.textContent && cand.textContent.trim().toLowerCase() === textToFind && isElementVisible(cand)) {
                    return cand;
                }
            }
            for (const cand of candidates) {
                if (cand.textContent && cand.textContent.trim().toLowerCase().includes(textToFind) && isElementVisible(cand)) {
                    return cand;
                }
            }
        }
    }

    // 7. General text content (for buttons, links, etc.)
    if (step.elementText && step.tagName) {
        const textToFind = step.elementText.trim().toLowerCase();
        const candidates = document.querySelectorAll(step.tagName);
        for (const cand of candidates) {
            if (cand.textContent && cand.textContent.trim().toLowerCase() === textToFind && isElementVisible(cand)) {
                return cand;
            }
        }
        for (const cand of candidates) {
            if (cand.textContent && cand.textContent.trim().toLowerCase().includes(textToFind) && isElementVisible(cand)) {
                return cand;
            }
        }
    }

    // 8. Coordinates fallback
    if (typeof step.x === 'number' && typeof step.y === 'number') {
        const vx = step.clientX !== undefined ? step.clientX : step.x;
        const vy = step.clientY !== undefined ? step.clientY : step.y;
        const el = document.elementFromPoint(vx, vy);
        if (el) return el;
    }

    return null;
};

// Waits for element to appear (e.g. after a dropdown opens)
const waitForElement = async (step, timeoutMs = 2500) => {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
        const el = await findElementSmart(step);
        if (el) return el;
        await new Promise(r => setTimeout(r, 80));
    }
    return findElementSmart(step);
};

// Fill a form field (input, textarea, select, contenteditable)
const fillFormField = (el, text) => {
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.focus();

    const tag = el.tagName.toLowerCase();

    if (tag === 'select') {
        const option = Array.from(el.options).find(opt =>
            opt.textContent.trim().toLowerCase() === text.trim().toLowerCase() ||
            opt.value.trim().toLowerCase() === text.trim().toLowerCase() ||
            opt.textContent.toLowerCase().includes(text.trim().toLowerCase())
        );
        if (option) {
            el.selectedIndex = option.index;
            setNativeValue(el, option.value);
        } else if (el.options.length > 0) {
            el.selectedIndex = 0;
            setNativeValue(el, el.options[0].value);
        }
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (tag === 'textarea' || tag === 'input') {
        setNativeValue(el, text);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (el.isContentEditable) {
        try {
            document.execCommand('selectAll', false, null);
            document.execCommand('insertText', false, text);
        } catch (e) {
            el.innerText = text;
        }
        el.dispatchEvent(new Event('input', { bubbles: true }));
    }

    el.dispatchEvent(new Event('blur', { bubbles: true }));
};

// Select a dropdown option (native select or custom option box)
const selectDropdownOption = async (step) => {
    const el = await waitForElement(step);
    if (!el) return false;

    el.scrollIntoView({ behavior: 'smooth', block: 'center' });

    if (el.tagName && el.tagName.toLowerCase() === 'select') {
        // Native select
        const option = Array.from(el.options).find(opt =>
            (step.value && opt.value === step.value) ||
            (step.optionText && opt.text.trim().toLowerCase() === step.optionText.trim().toLowerCase()) ||
            (step.optionIndex !== undefined && opt.index === step.optionIndex)
        );
        if (option) {
            el.selectedIndex = option.index;
            setNativeValue(el, option.value);
        }
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
        return true;
    }

    // Custom option box (click on it)
    dispatchClickEvents(el);
    return true;
};

// Dispatch synthetic click events on element
const dispatchClickEvents = (el) => {
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.focus();

    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const mouseOpts = {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: cx,
        clientY: cy
    };

    el.dispatchEvent(new PointerEvent('pointerdown', mouseOpts));
    el.dispatchEvent(new MouseEvent('mousedown', mouseOpts));
    el.dispatchEvent(new PointerEvent('pointerup', mouseOpts));
    el.dispatchEvent(new MouseEvent('mouseup', mouseOpts));
    el.dispatchEvent(new MouseEvent('click', mouseOpts));
};

// Execute single step
const executeStep = async (step) => {
    if (stopExecution) return;

    // --- Dynamic Paragraph Fill ---
    if (step.action === 'fillParagraph' || step.action === 'fillField') {
        const data = await storageGet('paragraphs');
        const paragraphs = data.paragraphs || [];

        if (paragraphs.length === 0) {
            alert('⚠️ All paragraphs in your library have been used! The sequence will now stop.');
            stopExecution = true;
            return;
        }

        // Consume 1st paragraph (FIFO queue)
        const currentPara = paragraphs.shift();
        await storageSet({ paragraphs });

        const el = await waitForElement(step);
        if (el) {
            fillFormField(el, currentPara);
            createClickIndicator(el.getBoundingClientRect().left, el.getBoundingClientRect().top, 'fill');
        }
        return;
    }

    // --- Static Text Field Fill ---
    if (step.action === 'fillStatic') {
        const el = await waitForElement(step);
        if (el) {
            fillFormField(el, step.value || '');
            createClickIndicator(el.getBoundingClientRect().left, el.getBoundingClientRect().top, 'smart');
        }
        return;
    }

    // --- Dropdown Option Selection ---
    if (step.action === 'selectOption') {
        await selectDropdownOption(step);
        return;
    }

    // --- Smart Click or Coordinate Click ---
    const el = await waitForElement(step);
    if (el) {
        dispatchClickEvents(el);
    } else if (typeof step.x === 'number' && typeof step.y === 'number') {
        const vx = step.clientX !== undefined ? step.clientX : step.x;
        const vy = step.clientY !== undefined ? step.clientY : step.y;
        const target = document.elementFromPoint(vx, vy);
        if (target) dispatchClickEvents(target);
    }
};

// Master Sequence Runner
const executeSteps = async (steps, loop) => {
    stopExecution = false;
    const loopConfig = loop || { enabled: false, infinite: false, count: 1, delay: 2000 };
    const loopCount = loopConfig.enabled ? (loopConfig.infinite ? Infinity : (loopConfig.count || 1)) : 1;
    const rotationDelay = loopConfig.delay || 2000;

    let currentLoop = 0;

    while (currentLoop < loopCount && !stopExecution) {
        currentLoop++;

        for (let i = 0; i < steps.length; i++) {
            if (stopExecution) break;

            // Send real-time progress update to popup
            contentSend({
                action: 'progressUpdate',
                data: {
                    stepIndex: i,
                    totalSteps: steps.length,
                    currentLoop: currentLoop,
                    totalLoops: loopCount,
                    action: steps[i].action
                }
            });

            // Wait for step delay before execution
            await new Promise(r => setTimeout(r, steps[i].delay || 1000));
            if (stopExecution) break;

            await executeStep(steps[i]);
        }

        // If there is another rotation coming up, wait for rotationDelay
        if (currentLoop < loopCount && !stopExecution) {
            contentSend({
                action: 'progressUpdate',
                data: {
                    stepIndex: steps.length - 1,
                    totalSteps: steps.length,
                    currentLoop: currentLoop,
                    totalLoops: loopCount,
                    isBetweenRotations: true
                }
            });
            await new Promise(r => setTimeout(r, rotationDelay));
        }
    }

    contentSend({ action: 'executionFinished' });
};

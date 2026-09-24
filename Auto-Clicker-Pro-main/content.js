// ========================================================
// Auto Clicker & Form Filler Pro - Content Script
// Full implementation including:
// 1. Rotating Dynamic Paragraphs from TXT files
// 2. Dropdown & Option Box Selection
// 3. Clipboard Pasting Step
// 4. Area Selection & Color/Text Condition Branches
// 5. Smart Form Filling & Element Highlighting
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

// Condition branch recording state
let branchRecordingActive = false;
let conditionFlowType = null; // 'color' | 'text'
let conditionFlowState = null; // 'match' | 'nomatch'
let conditionArea = null;
let conditionTargetValue = null;
let branchMatchSteps = [];
let branchNoMatchSteps = [];

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

    const cls = typeof el.className === 'string' ? el.className.toLowerCase() : '';
    if (cls.includes('option') || cls.includes('dropdown-item') || cls.includes('select__option') || cls.includes('menu-item')) return true;

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
    branchRecordingActive = false;

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
    branchRecordingActive = false;

    document.removeEventListener('click', recordClickHandler, true);
    document.removeEventListener('change', recordChangeHandler, true);
    document.removeEventListener('blur', recordBlurHandler, true);
    document.removeEventListener('mouseover', highlightOnHover, true);
    document.removeEventListener('mouseout', removeHighlight, true);
    document.removeEventListener('keydown', recordingKeyListener, true);

    removeHighlight();
    removeFieldPill();
    hideRecordingBanner();
    hideAreaOverlay();
};

// Main Click Handler during recording
const recordClickHandler = (e) => {
    if (e.target.closest('#acp-recorder-banner') || e.target.closest('.acp-field-pill') || e.target.closest('.acp-click-indicator')) {
        return;
    }

    if (!recordingActive || recordingPaused) return;

    const el = e.target;
    createClickIndicator(e.pageX, e.pageY, isOptionBox(el) ? 'option' : (isTextInputField(el) ? 'fill' : 'smart'));

    // --- Branch Recording Mode (for Condition Match/No-Match Steps) ---
    if (branchRecordingActive) {
        const branchStep = {
            action: 'smartClick',
            selector: getCSSSelector(el),
            tagName: el.tagName || '',
            elementText: (el.textContent || '').trim().substring(0, 60),
            delay: 1000,
            x: e.clientX,
            y: e.clientY
        };
        if (conditionFlowState === 'match') {
            branchMatchSteps.push(branchStep);
            showBannerToast(`Match Step #${branchMatchSteps.length} recorded`);
        } else {
            branchNoMatchSteps.push(branchStep);
            showBannerToast(`No-Match Step #${branchNoMatchSteps.length} recorded`);
        }
        return;
    }

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

    // --- CASE 4: Standard Element Click ---
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

    if (isTextInputField(el) && lastActiveFieldStepIndex !== null) {
        if (recordedSteps[lastActiveFieldStepIndex] && recordedSteps[lastActiveFieldStepIndex].action === 'fillStatic') {
            recordedSteps[lastActiveFieldStepIndex].value = el.value || el.textContent || '';
            saveSteps();
        }
    }
};

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
        if (branchRecordingActive) {
            handleFinishBranch();
        } else {
            chrome.storage.local.set({ isRecording: false });
        }
    } else if ((e.key === 'c' || e.key === 'C') && !branchRecordingActive) {
        startColorConditionFlow();
    } else if ((e.key === 't' || e.key === 'T') && !branchRecordingActive) {
        startTextConditionFlow();
    }
};

// ========================================================
// Area Selection & Condition Branch Flow Implementation
// ========================================================
const startAreaSelectionFlow = () => {
    alert('Click OK, then click and drag to select an area box on the page.');
    document.body.classList.add('acp-area-selecting');

    const onMouseDown = (e) => {
        if (e.button !== 0) return;
        e.preventDefault(); e.stopPropagation();
        const startX = e.pageX, startY = e.pageY;
        const overlay = createAreaOverlay();

        const onMove = (me) => {
            const x = Math.min(startX, me.pageX), y = Math.min(startY, me.pageY);
            const w = Math.abs(me.pageX - startX), h = Math.abs(me.pageY - startY);
            overlay.style.left = x + 'px'; overlay.style.top = y + 'px';
            overlay.style.width = w + 'px'; overlay.style.height = h + 'px';
        };

        const onUp = (ue) => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.removeEventListener('mousedown', onMouseDown, true);
            document.body.classList.remove('acp-area-selecting');

            const w = Math.abs(ue.pageX - startX), h = Math.abs(ue.pageY - startY);
            if (w < 5 || h < 5) {
                overlay.remove();
                return;
            }

            const area = { x: Math.min(startX, ue.pageX), y: Math.min(startY, ue.pageY), width: w, height: h };
            chrome.storage.local.set({ selectedArea: area });
            showBannerToast(`Area Selected: ${w}x${h}px`);
            setTimeout(() => overlay.remove(), 1500);
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };

    document.addEventListener('mousedown', onMouseDown, true);
};

const startColorConditionFlow = () => {
    alert('Click OK, then DRAW A BOX around the area to scan for color.');
    document.body.classList.add('acp-area-selecting');

    const onMouseDown = (e) => {
        if (e.button !== 0) return;
        e.preventDefault(); e.stopPropagation();
        const startX = e.pageX, startY = e.pageY;
        const overlay = createAreaOverlay();

        const onMove = (me) => {
            const x = Math.min(startX, me.pageX), y = Math.min(startY, me.pageY);
            const w = Math.abs(me.pageX - startX), h = Math.abs(me.pageY - startY);
            overlay.style.left = x + 'px'; overlay.style.top = y + 'px';
            overlay.style.width = w + 'px'; overlay.style.height = h + 'px';
        };

        const onUp = (ue) => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.removeEventListener('mousedown', onMouseDown, true);
            document.body.classList.remove('acp-area-selecting');

            const w = Math.abs(ue.pageX - startX), h = Math.abs(ue.pageY - startY);
            if (w < 5 || h < 5) { overlay.remove(); return; }

            const area = { x: Math.min(startX, ue.pageX), y: Math.min(startY, ue.pageY), width: w, height: h };
            overlay.remove();

            const color = prompt('Enter color hex to detect (e.g. #3b82f6 or #ff0000):', '#3b82f6');
            if (!color) return;

            conditionFlowType = 'color';
            conditionArea = area;
            conditionTargetValue = color;
            conditionFlowState = 'match';
            branchMatchSteps = [];
            branchNoMatchSteps = [];
            branchRecordingActive = true;

            showRecordingBanner('match');
            alert('Record clicks for when color MATCHES. Press ESC when done with Match branch.');
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };

    document.addEventListener('mousedown', onMouseDown, true);
};

const startTextConditionFlow = () => {
    alert('Click OK, then DRAW A BOX around the text area to scan.');
    document.body.classList.add('acp-area-selecting');

    const onMouseDown = (e) => {
        if (e.button !== 0) return;
        e.preventDefault(); e.stopPropagation();
        const startX = e.pageX, startY = e.pageY;
        const overlay = createAreaOverlay();

        const onMove = (me) => {
            const x = Math.min(startX, me.pageX), y = Math.min(startY, me.pageY);
            const w = Math.abs(me.pageX - startX), h = Math.abs(me.pageY - startY);
            overlay.style.left = x + 'px'; overlay.style.top = y + 'px';
            overlay.style.width = w + 'px'; overlay.style.height = h + 'px';
        };

        const onUp = (ue) => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.removeEventListener('mousedown', onMouseDown, true);
            document.body.classList.remove('acp-area-selecting');

            const w = Math.abs(ue.pageX - startX), h = Math.abs(ue.pageY - startY);
            if (w < 5 || h < 5) { overlay.remove(); return; }

            const area = { x: Math.min(startX, ue.pageX), y: Math.min(startY, ue.pageY), width: w, height: h };
            overlay.remove();

            const text = prompt('Enter expected text to search for:');
            if (!text) return;

            conditionFlowType = 'text';
            conditionArea = area;
            conditionTargetValue = text;
            conditionFlowState = 'match';
            branchMatchSteps = [];
            branchNoMatchSteps = [];
            branchRecordingActive = true;

            showRecordingBanner('match');
            alert('Record clicks for when text MATCHES. Press ESC when done with Match branch.');
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };

    document.addEventListener('mousedown', onMouseDown, true);
};

const handleFinishBranch = () => {
    if (conditionFlowState === 'match') {
        conditionFlowState = 'nomatch';
        showRecordingBanner('nomatch');
        alert('Now record clicks for when condition DOES NOT MATCH. Press ESC when finished.');
    } else {
        // Complete condition step
        const condStep = {
            action: 'condition',
            conditionType: conditionFlowType,
            area: conditionArea,
            detectColor: conditionFlowType === 'color' ? conditionTargetValue : undefined,
            expectedText: conditionFlowType === 'text' ? conditionTargetValue : undefined,
            matchSteps: [...branchMatchSteps],
            noMatchSteps: [...branchNoMatchSteps],
            delay: 1000
        };
        recordedSteps.push(condStep);
        saveSteps();

        branchRecordingActive = false;
        conditionFlowState = null;
        showRecordingBanner();
        showBannerToast('Condition Step successfully added!');
    }
};

const createAreaOverlay = () => {
    let overlay = document.getElementById('acp-area-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'acp-area-overlay';
        overlay.style.position = 'absolute';
        overlay.style.border = '2px dashed #00bcd4';
        overlay.style.background = 'rgba(0,188,212,0.12)';
        overlay.style.zIndex = '2147483646';
        overlay.style.pointerEvents = 'none';
        document.body.appendChild(overlay);
    }
    return overlay;
};

const hideAreaOverlay = () => {
    const overlay = document.getElementById('acp-area-overlay');
    if (overlay) overlay.remove();
};

// ========================================================
// On-Screen UI & Floating Banners
// ========================================================
const showRecordingBanner = (branch = null) => {
    if (!document.body) return;

    let banner = document.getElementById('acp-recorder-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'acp-recorder-banner';
        document.body.appendChild(banner);
    }

    const stepCount = recordedSteps.length;
    let branchBadge = '';
    if (branch === 'match') {
        branchBadge = '<div class="acp-banner-branch match">Recording: MATCH Branch</div>';
    } else if (branch === 'nomatch') {
        branchBadge = '<div class="acp-banner-branch nomatch">Recording: NO-MATCH Branch</div>';
    }

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
            <span><b>Esc</b> Stop · <b>C</b> Color Cond · <b>T</b> Text Cond</span>
            ${branchBadge}
            <div id="acp-banner-toast" class="acp-banner-toast" style="display:none;"></div>
        </div>
        <div class="acp-banner-controls">
            <button id="acp-pause-btn" class="acp-field-pill-btn" style="padding:6px 10px;">Pause</button>
            <button id="acp-stop-btn">Finish</button>
        </div>
    `;

    document.getElementById('acp-stop-btn').onclick = (e) => {
        e.stopPropagation();
        if (branchRecordingActive) {
            handleFinishBranch();
        } else {
            chrome.storage.local.set({ isRecording: false });
        }
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

// Floating Field Designation Pill (Static Text vs Dynamic Paragraph vs Clipboard Paste)
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
        <button id="acp-set-paste-btn" class="acp-field-pill-btn" style="color:#fbbf24; border-color:rgba(245,158,11,0.3);" title="Set this field to paste system clipboard content">
            📋 Paste Clipboard
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

    document.getElementById('acp-set-paste-btn').onclick = (e) => {
        e.stopPropagation();
        if (recordedSteps[stepIndex]) {
            recordedSteps[stepIndex].action = 'pasteClipboard';
            saveSteps();
            showBannerToast('⭐ Designated as Clipboard Paste Field!');
        }
        removeFieldPill();
    };

    document.getElementById('acp-dismiss-pill-btn').onclick = (e) => {
        e.stopPropagation();
        removeFieldPill();
    };

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
    } else if (msg.action === 'startAreaSelection') {
        startAreaSelectionFlow();
    } else if (msg.action === 'startColorCondition') {
        startColorConditionFlow();
    } else if (msg.action === 'startTextCondition') {
        startTextConditionFlow();
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
    if (step.selector) {
        try {
            const el = document.querySelector(step.selector);
            if (el && isElementVisible(el)) return el;
        } catch (e) {}
    }

    if (step.idAttr) {
        try {
            const el = document.getElementById(step.idAttr);
            if (el && isElementVisible(el)) return el;
        } catch (e) {}
    }

    if (step.nameAttr) {
        try {
            const el = document.querySelector(`[name="${CSS.escape(step.nameAttr)}"]`);
            if (el && isElementVisible(el)) return el;
        } catch (e) {}
    }

    if (step.placeholder) {
        try {
            const el = document.querySelector(`[placeholder="${CSS.escape(step.placeholder)}"]`);
            if (el && isElementVisible(el)) return el;
        } catch (e) {}
    }

    if (step.ariaLabel) {
        try {
            const el = document.querySelector(`[aria-label="${CSS.escape(step.ariaLabel)}"]`);
            if (el && isElementVisible(el)) return el;
        } catch (e) {}
    }

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

    if (typeof step.x === 'number' && typeof step.y === 'number') {
        const vx = step.clientX !== undefined ? step.clientX : step.x;
        const vy = step.clientY !== undefined ? step.clientY : step.y;
        const el = document.elementFromPoint(vx, vy);
        if (el) return el;
    }

    return null;
};

// Waits for element to appear
const waitForElement = async (step, timeoutMs = 2500) => {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
        const el = await findElementSmart(step);
        if (el) return el;
        await new Promise(r => setTimeout(r, 80));
    }
    return findElementSmart(step);
};

// Fill a form field
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

// Select a dropdown option
const selectDropdownOption = async (step) => {
    const el = await waitForElement(step);
    if (!el) return false;

    el.scrollIntoView({ behavior: 'smooth', block: 'center' });

    if (el.tagName && el.tagName.toLowerCase() === 'select') {
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

// Condition Scanning Helpers
const scanAreaForColor = (area, targetColor) => {
    if (!area || !targetColor) return false;
    const target = targetColor.trim().toLowerCase();
    const all = document.querySelectorAll('*');
    for (const el of all) {
        if (!isElementVisible(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.left < area.x + area.width && r.right > area.x &&
            r.top < area.y + area.height && r.bottom > area.y) {
            const cs = window.getComputedStyle(el);
            if (colorMatches(cs.backgroundColor, target) || colorMatches(cs.color, target)) {
                return true;
            }
        }
    }
    return false;
};

const colorMatches = (rgbStr, targetHex) => {
    if (!rgbStr || !targetHex) return false;
    const match = rgbStr.match(/\d+/g);
    if (!match || match.length < 3) return false;
    const r = parseInt(match[0]), g = parseInt(match[1]), b = parseInt(match[2]);
    const hex = "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toLowerCase();
    return hex === targetHex.toLowerCase();
};

const scanAreaForText = (area, expectedText) => {
    if (!area || !expectedText) return false;
    const target = expectedText.trim().toLowerCase();
    const all = document.querySelectorAll('*');
    for (const el of all) {
        if (!isElementVisible(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.left < area.x + area.width && r.right > area.x &&
            r.top < area.y + area.height && r.bottom > area.y) {
            if (el.textContent && el.textContent.toLowerCase().includes(target)) {
                return true;
            }
        }
    }
    return false;
};

// Execute single step
const executeStep = async (step) => {
    if (stopExecution) return;

    // --- Dynamic Paragraph Fill (from TXT) ---
    if (step.action === 'fillParagraph' || step.action === 'fillField') {
        const data = await storageGet('paragraphs');
        const paragraphs = data.paragraphs || [];

        if (paragraphs.length === 0) {
            alert('⚠️ All paragraphs in your library have been used! The sequence will now stop.');
            stopExecution = true;
            return;
        }

        const currentPara = paragraphs.shift();
        await storageSet({ paragraphs });

        const el = await waitForElement(step);
        if (el) {
            fillFormField(el, currentPara);
            createClickIndicator(el.getBoundingClientRect().left, el.getBoundingClientRect().top, 'fill');
        }
        return;
    }

    // --- Clipboard Pasting Step ---
    if (step.action === 'pasteClipboard') {
        const el = await waitForElement(step);
        if (el) {
            let clipboardText = '';
            try {
                clipboardText = await navigator.clipboard.readText();
            } catch (e) {
                // If readText requires focused document, focus element first
                el.focus();
                try {
                    clipboardText = await navigator.clipboard.readText();
                } catch (err) {}
            }
            if (clipboardText) {
                fillFormField(el, clipboardText);
                createClickIndicator(el.getBoundingClientRect().left, el.getBoundingClientRect().top, 'fill');
            }
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

    // --- Condition Branch Step (Color or Text) ---
    if (step.action === 'condition') {
        let matched = false;
        if (step.conditionType === 'color') {
            matched = scanAreaForColor(step.area, step.detectColor);
        } else if (step.conditionType === 'text') {
            matched = scanAreaForText(step.area, step.expectedText);
        }
        const branchSteps = matched ? (step.matchSteps || []) : (step.noMatchSteps || []);
        for (const subStep of branchSteps) {
            if (stopExecution) break;
            await new Promise(r => setTimeout(r, subStep.delay || 500));
            await executeStep(subStep);
        }
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

            await new Promise(r => setTimeout(r, steps[i].delay || 1000));
            if (stopExecution) break;

            await executeStep(steps[i]);
        }

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

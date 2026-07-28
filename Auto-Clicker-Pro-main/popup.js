document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start');
    const startText = document.getElementById('startText');
    const stepList = document.getElementById('stepList');
    const stepCount = document.getElementById('stepCount');
    const loopEnabled = document.getElementById('loopEnabled');
    const loopSettingsDiv = document.getElementById('loopSettings');
    const loopCount = document.getElementById('loopCount');
    const loopInfinite = document.getElementById('loopInfinite');
    const progressBar = document.getElementById('progressBar');
    const loopCounter = document.getElementById('loopCounter');
    const editModal = document.getElementById('editModal');
    const editDelay = document.getElementById('editDelay');
    const saveEdit = document.getElementById('saveEdit');
    const cancelEdit = document.getElementById('cancelEdit');
    const clearStepsBtn = document.getElementById('clearSteps');
    const recordBtn = document.getElementById('recordBtn');
    const recordBtnText = recordBtn.querySelector('.text');

    const recordModal = document.getElementById('recordModal');
    const confirmRecord = document.getElementById('confirmRecord');
    const cancelRecord = document.getElementById('cancelRecord');

    const smartToggle = document.getElementById('smartToggle');
    const selectAreaBtn = document.getElementById('selectAreaBtn');
    const colorConditionBtn = document.getElementById('colorConditionBtn');
    const textConditionBtn = document.getElementById('textConditionBtn');

    const conditionModal = document.getElementById('conditionModal');
    const conditionAreaStatus = document.getElementById('conditionAreaStatus');
    const conditionMatchStatus = document.getElementById('conditionMatchStatus');
    const conditionNoMatchStatus = document.getElementById('conditionNoMatchStatus');
    const conditionComplete = document.getElementById('conditionComplete');
    const cancelCondition = document.getElementById('cancelCondition');
    const launchColorCondition = document.getElementById('launchColorCondition');
    const launchTextCondition = document.getElementById('launchTextCondition');

    let editIndex = null;
    let smartModeEnabled = false;

    // --- Smart Mode Toggle ---
    smartToggle.addEventListener('click', () => {
        smartModeEnabled = !smartModeEnabled;
        smartToggle.classList.toggle('active', smartModeEnabled);
        selectAreaBtn.disabled = !smartModeEnabled;
        colorConditionBtn.disabled = !smartModeEnabled;
        textConditionBtn.disabled = !smartModeEnabled;
        chrome.runtime.sendMessage({ action: 'toggleSmartMode', enabled: smartModeEnabled });
        chrome.storage.local.set({ smartMode: smartModeEnabled });
    });

    // --- Area Selection ---
    selectAreaBtn.addEventListener('click', () => {
        if (!smartModeEnabled) return;
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (tab && (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('https://chrome.google.com'))) {
                alert('Area selection is not allowed on this browser page. Please try on a regular website.');
                return;
            }
            chrome.runtime.sendMessage({ action: 'startAreaSelection' });
            window.close();
        });
    });

    // --- Condition Flow (launcher modal for inline flows) ---
    const showConditionLauncher = () => {
        if (!smartModeEnabled) return;
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (tab && (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('https://chrome.google.com'))) {
                alert('Conditions are not allowed on this browser page. Please try on a regular website.');
                return;
            }
            conditionAreaStatus.style.display = 'none';
            conditionMatchStatus.style.display = 'none';
            conditionNoMatchStatus.style.display = 'none';
            conditionComplete.style.display = 'none';
            launchColorCondition.disabled = false;
            launchTextCondition.disabled = false;
            conditionModal.style.display = 'flex';
        });
    };

    colorConditionBtn.addEventListener('click', showConditionLauncher);
    textConditionBtn.addEventListener('click', showConditionLauncher);

    cancelCondition.addEventListener('click', () => {
        conditionModal.style.display = 'none';
    });

    launchColorCondition.addEventListener('click', () => {
        conditionModal.style.display = 'none';
        chrome.runtime.sendMessage({ action: 'startColorCondition' });
        setTimeout(() => window.close(), 100);
    });

    launchTextCondition.addEventListener('click', () => {
        conditionModal.style.display = 'none';
        chrome.runtime.sendMessage({ action: 'startTextCondition' });
        setTimeout(() => window.close(), 100);
    });

    // --- Main UI Update ---
    function updateUI(isRunning, isRecording) {
        if (isRunning) {
            startText.textContent = 'Stop';
            startBtn.classList.add('running');
            startBtn.disabled = false;
            recordBtn.disabled = true;
            clearStepsBtn.disabled = true;
            loopEnabled.disabled = true;
            loopCount.disabled = true;
            loopInfinite.disabled = true;
            stepList.classList.add('running');
        } else if (isRecording) {
            recordBtnText.textContent = 'Stop';
            recordBtn.classList.add('recording');
            recordBtn.disabled = false;
            startBtn.disabled = true;
            clearStepsBtn.disabled = true;
            loopEnabled.disabled = true;
            loopCount.disabled = true;
            loopInfinite.disabled = true;
        } else {
            startText.textContent = 'Start Sequence';
            startBtn.classList.remove('running');
            recordBtnText.textContent = 'Record';
            recordBtn.classList.remove('recording');
            stepList.classList.remove('running');
            startBtn.disabled = false;
            recordBtn.disabled = false;
            clearStepsBtn.disabled = false;
            loopEnabled.disabled = false;
            handleLoopControlsChange();
            resetProgress();
        }
    }

    // --- Render Steps ---
    function renderSteps(steps = []) {
        stepList.innerHTML = '';
        stepCount.textContent = steps.length;

        if (steps.length === 0) {
            stepList.innerHTML = `<div class="empty-steps">No steps recorded yet<br><span style="font-size:10px;opacity:0.6">Click Record or right-click on a page to add steps</span></div>`;
            return;
        }

        steps.forEach((step, index) => {
            const li = document.createElement('li');
            li.dataset.index = index;

            if (step.action === 'clickAt') {
                li.classList.add('step-click');
                li.innerHTML = `
                    <div class="step-num">${index + 1}</div>
                    <div class="step-info">
                        <div class="step-title">
                            <span class="step-type-badge type-click">CLICK</span>
                            Position (${step.x}, ${step.y})
                        </div>
                        <div class="step-sub">Delay: <strong>${step.delay}ms</strong></div>
                    </div>
                    <div class="step-actions">
                        <button class="action-btn edit-btn" title="Edit Delay" data-index="${index}">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="action-btn remove-btn" title="Delete Step" data-index="${index}">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                `;
            } else if (step.action === 'fillField') {
                li.classList.add('step-fill');
                const tag = step.tagName || '';
                const fieldType = step.fieldType || 'field';
                const selector = step.selector || '';
                const shortSelector = selector.length > 25 ? selector.substring(0, 25) + '...' : selector;
                li.innerHTML = `
                    <div class="step-num">${index + 1}</div>
                    <div class="step-info">
                        <div class="step-title">
                            <span class="step-type-badge type-fill">FILL</span>
                            ${tag} (${fieldType})
                        </div>
                        <div class="step-sub">
                            <span class="tag fill-tag">${shortSelector || 'auto'}</span>
                            · ${step.delay}ms
                            <span class="fill-consume">→ consumes 1 paragraph</span>
                        </div>
                    </div>
                    <div class="step-actions">
                        <button class="action-btn edit-btn" title="Edit Delay" data-index="${index}">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="action-btn remove-btn" title="Delete Step" data-index="${index}">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                `;
            } else if (step.action === 'smartClick') {
                li.classList.add('step-smart');
                const tag = step.tagName || '';
                const text = step.elementText ? step.elementText.substring(0, 30) : '';
                const selector = step.selector || '';
                const shortSelector = selector.length > 25 ? selector.substring(0, 25) + '...' : selector;
                li.innerHTML = `
                    <div class="step-num">${index + 1}</div>
                    <div class="step-info">
                        <div class="step-title">
                            <span class="step-type-badge type-smart">SMART</span>
                            ${tag}${text ? ` "${text}"` : ''}
                        </div>
                        <div class="step-sub">
                            <span class="tag smart-tag">${shortSelector || 'auto'}</span>
                            · ${step.delay}ms
                        </div>
                    </div>
                    <div class="step-actions">
                        <button class="action-btn edit-btn" title="Edit Delay" data-index="${index}">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="action-btn remove-btn" title="Delete Step" data-index="${index}">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                `;
            } else if (step.action === 'condition') {
                li.classList.add('step-condition');
                const isColor = step.conditionType === 'color';
                const text = isColor ? (step.detectColor || '?') : (step.expectedText || '?');
                const matchCount = (step.matchSteps || []).length;
                const noMatchCount = (step.noMatchSteps || []).length;
                const condLabel = isColor ? `🎨 ${text}` : `📝 "${text}"`;
                li.innerHTML = `
                    <div class="step-num">${index + 1}</div>
                    <div class="step-info">
                        <div class="step-title">
                            <span class="step-type-badge type-condition">${isColor ? 'COLOR' : 'COND'}</span>
                            ${condLabel}
                        </div>
                        <div class="step-sub">
                            <div class="branch-preview">
                                <span class="branch-chip match-chip">Match: ${matchCount}</span>
                                <span class="branch-chip nomatch-chip">No-Match: ${noMatchCount}</span>
                            </div>
                        </div>
                    </div>
                    <div class="step-actions">
                        <button class="action-btn remove-btn" title="Delete Step" data-index="${index}">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                `;
            }

            stepList.appendChild(li);
        });

        document.querySelectorAll('.remove-btn').forEach((btn) =>
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeStep(parseInt(btn.dataset.index));
            })
        );
        document.querySelectorAll('.edit-btn').forEach((btn) =>
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                openEditModal(parseInt(btn.dataset.index));
            })
        );
    }

    // --- Start Sequence ---
    startBtn.addEventListener('click', () => {
        chrome.storage.local.get('isRunning', (data) => {
            if (data.isRunning) {
                chrome.runtime.sendMessage({ action: 'stopSequence' });
            } else {
                chrome.storage.local.get('steps', (res) => {
                    if (!res.steps || res.steps.length === 0) return;
                    const loopSettings = {
                        enabled: loopEnabled.checked,
                        infinite: loopInfinite.checked,
                        count: parseInt(loopCount.value) || 1
                    };
                    chrome.storage.local.set({ loopSettings }, () => {
                        chrome.runtime.sendMessage({ action: 'startSequence' });
                    });
                });
            }
        });
    });

    // --- Recording ---
    recordBtn.addEventListener('click', () => {
        chrome.storage.local.get('isRecording', (data) => {
            if (data.isRecording) {
                chrome.runtime.sendMessage({ action: 'stopRecording' });
            } else {
                recordModal.style.display = 'flex';
            }
        });
    });

    confirmRecord.addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (tab && (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('https://chrome.google.com'))) {
                alert('Recording is not allowed on this page (browser restricted). Please try on a regular website.');
                recordModal.style.display = 'none';
                return;
            }
            recordModal.style.display = 'none';
            chrome.runtime.sendMessage({ action: 'startRecording' });
            setTimeout(() => window.close(), 500);
        });
    });

    cancelRecord.addEventListener('click', () => {
        recordModal.style.display = 'none';
    });

    // --- Close Modals ---
    const closeAllModals = () => {
        editModal.style.display = 'none';
        recordModal.style.display = 'none';
        if (conditionModal.style.display === 'flex') {
            conditionModal.style.display = 'none';
        }
    };

    document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
        backdrop.addEventListener('click', closeAllModals);
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAllModals();
        }
    });

    // --- Step Operations ---
    function removeStep(index) {
        chrome.storage.local.get(['steps'], (data) => {
            let steps = data.steps || [];
            steps.splice(index, 1);
            chrome.storage.local.set({ steps });
        });
    }

    function clearAllSteps() {
        if (confirm('Are you sure you want to clear all steps?')) {
            chrome.storage.local.set({ steps: [] });
        }
    }

    function openEditModal(index) {
        chrome.storage.local.get(['steps'], (data) => {
            if (index >= 0 && index < data.steps.length) {
                editIndex = index;
                editDelay.value = data.steps[index].delay;
                editModal.style.display = 'flex';
                editDelay.focus();
                editDelay.select();
            }
        });
    }

    function saveDelayEdit() {
        if (editIndex === null) return;
        chrome.storage.local.get(['steps'], (data) => {
            let steps = data.steps || [];
            steps[editIndex].delay = parseInt(editDelay.value) || 1000;
            chrome.storage.local.set({ steps }, () => {
                editModal.style.display = 'none';
                editIndex = null;
            });
        });
    }

    function closeEditModal() {
        editModal.style.display = 'none';
        editIndex = null;
    }

    function updateProgress(data) {
        const { stepIndex, totalSteps, currentLoop, totalLoops } = data;
        const percent = totalSteps > 0 ? ((stepIndex + 1) / totalSteps) * 100 : 0;
        progressBar.style.width = `${percent}%`;

        document.querySelectorAll('#stepList li').forEach((li) => li.classList.remove('active'));
        const activeLi = document.querySelector(`#stepList li[data-index='${stepIndex}']`);
        if (activeLi) activeLi.classList.add('active');

        const totalLoopDisplay = totalLoops === Infinity ? '∞' : totalLoops;
        if (loopEnabled.checked && totalLoops > 1) {
            loopCounter.textContent = `Loop ${currentLoop} of ${totalLoopDisplay} · Step ${stepIndex + 1} of ${totalSteps}`;
        } else {
            loopCounter.textContent = `Step ${stepIndex + 1} of ${totalSteps}`;
        }
    }

    function resetProgress() {
        progressBar.style.width = '0%';
        loopCounter.textContent = '';
        document.querySelectorAll('#stepList li').forEach((li) => li.classList.remove('active'));
    }

    function handleLoopControlsChange() {
        const show = loopEnabled.checked;
        loopSettingsDiv.style.display = show ? 'flex' : 'none';
        loopCount.disabled = !show || loopInfinite.checked;
        if (!show) loopCounter.textContent = '';
    }

    loopEnabled.addEventListener('change', handleLoopControlsChange);
    loopInfinite.addEventListener('change', handleLoopControlsChange);
    clearStepsBtn.addEventListener('click', clearAllSteps);
    saveEdit.addEventListener('click', saveDelayEdit);
    cancelEdit.addEventListener('click', closeEditModal);

    // --- Content Library: TXT File Loading ---
    const loadTxtBtn = document.getElementById('loadTxtBtn');
    const clearTxtBtn = document.getElementById('clearTxtBtn');
    const noContentMsg = document.getElementById('noContentMsg');
    const paraPreview = document.getElementById('paraPreview');
    const paraCount = document.getElementById('paragraphCount');

    loadTxtBtn.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.txt';
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                const text = event.target.result;
                const paragraphs = text
                    .split(/\n\s*\n/)
                    .map(p => p.trim())
                    .filter(p => p.length > 0);
                if (paragraphs.length === 0) {
                    alert('No paragraphs found. Make sure paragraphs are separated by blank lines.');
                    return;
                }
                chrome.storage.local.set({ paragraphs }, () => {
                    updateParagraphUI(paragraphs);
                });
            };
            reader.readAsText(file);
        });
        input.click();
    });

    clearTxtBtn.addEventListener('click', () => {
        if (confirm('Clear all paragraphs?')) {
            chrome.storage.local.set({ paragraphs: [] }, () => {
                updateParagraphUI([]);
            });
        }
    });

    function updateParagraphUI(paragraphs) {
        if (paragraphs.length > 0) {
            noContentMsg.style.display = 'none';
            clearTxtBtn.style.display = 'inline-flex';
            paraPreview.style.display = 'block';
            const maxPreview = Math.min(paragraphs.length, 4);
            let html = paragraphs.slice(0, maxPreview).map((p, i) => {
                const previewText = p.replace(/^[\d.]+\s*/, '').substring(0, 55);
                const displayText = previewText + (p.length > 55 ? '...' : '');
                const match = p.match(/^(\d+\.?)\s*/);
                const label = match ? match[1] : (i + 1);
                return `<div class="para-item" title="${p.replace(/"/g, '&quot;').substring(0, 200)}">
                    <span class="para-num">${label}</span>
                    <span class="para-text">${displayText}</span>
                </div>`;
            }).join('');
            if (paragraphs.length > maxPreview) {
                html += `<div class="para-more">+ ${paragraphs.length - maxPreview} more paragraph${paragraphs.length - maxPreview > 1 ? 's' : ''}</div>`;
            }
            paraPreview.innerHTML = html;
            paraCount.textContent = paragraphs.length;
        } else {
            noContentMsg.style.display = 'block';
            clearTxtBtn.style.display = 'none';
            paraPreview.style.display = 'none';
            paraCount.textContent = '0';
        }
    }

    // --- Export/Import Steps ---
    document.getElementById('exportSteps').addEventListener('click', () => {
        chrome.storage.local.get('steps', (data) => {
            const steps = data.steps || [];
            const blob = new Blob([JSON.stringify(steps, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'auto-clicker-steps.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    });

    document.getElementById('importSteps').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const steps = JSON.parse(event.target.result);
                    if (Array.isArray(steps)) {
                        chrome.storage.local.set({ steps });
                    }
                } catch (err) {
                    alert('Invalid JSON file. Steps were not imported.');
                }
            };
            reader.readAsText(file);
        });
        input.click();
    });

    // --- Real-time Listeners ---
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.action === 'progressUpdate') {
            updateProgress(msg.data);
        }
    });

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local') {
            chrome.storage.local.get(['isRunning', 'isRecording', 'steps', 'smartMode', 'paragraphs'], (data) => {
                updateUI(data.isRunning, data.isRecording);
                if (changes.steps) {
                    renderSteps(changes.steps.newValue || []);
                }
                if (changes.smartMode) {
                    smartModeEnabled = changes.smartMode.newValue || false;
                    smartToggle.classList.toggle('active', smartModeEnabled);
                    selectAreaBtn.disabled = !smartModeEnabled;
                    colorConditionBtn.disabled = !smartModeEnabled;
                    textConditionBtn.disabled = !smartModeEnabled;
                }
                if (changes.paragraphs) {
                    updateParagraphUI(changes.paragraphs.newValue || []);
                }
            });
        }
    });

    // --- Initial Load ---
    function initializePopup() {
        chrome.storage.local.get([
            'steps', 'isRunning', 'isRecording', 'loopSettings', 'smartMode', 'paragraphs'
        ], (data) => {
            renderSteps(data.steps || []);
            updateUI(data.isRunning || false, data.isRecording || false);
            updateParagraphUI(data.paragraphs || []);

            const settings = data.loopSettings || { enabled: false, infinite: false, count: 5 };
            loopEnabled.checked = settings.enabled;
            loopInfinite.checked = settings.infinite;
            loopCount.value = settings.count;
            handleLoopControlsChange();

            smartModeEnabled = data.smartMode || false;
            smartToggle.classList.toggle('active', smartModeEnabled);
            selectAreaBtn.disabled = !smartModeEnabled;
            colorConditionBtn.disabled = !smartModeEnabled;
            textConditionBtn.disabled = !smartModeEnabled;
        });
    }

    initializePopup();
});

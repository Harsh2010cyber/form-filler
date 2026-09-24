// ========================================================
// Auto Clicker & Form Filler Pro - Popup Script
// Full UI orchestration, paragraph management, step editor,
// and real-time execution feedback.
// ========================================================

document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const startBtn = document.getElementById('start');
    const startText = document.getElementById('startText');
    const stepList = document.getElementById('stepList');
    const stepCount = document.getElementById('stepCount');

    // Loop controls
    const loopEnabled = document.getElementById('loopEnabled');
    const loopSettingsDiv = document.getElementById('loopSettings');
    const loopCount = document.getElementById('loopCount');
    const loopDelay = document.getElementById('loopDelay');
    const loopInfinite = document.getElementById('loopInfinite');
    const matchCountBtn = document.getElementById('matchCountBtn');

    // Progress
    const progressBar = document.getElementById('progressBar');
    const progressPercent = document.getElementById('progressPercent');
    const progressStatusLabel = document.getElementById('progressStatusLabel');
    const loopCounter = document.getElementById('loopCounter');

    // Step Actions
    const recordBtn = document.getElementById('recordBtn');
    const clearStepsBtn = document.getElementById('clearSteps');
    const exportStepsBtn = document.getElementById('exportSteps');
    const importStepsBtn = document.getElementById('importSteps');

    // Content Library
    const loadTxtBtn = document.getElementById('loadTxtBtn');
    const pasteTxtBtn = document.getElementById('pasteTxtBtn');
    const exportTxtBtn = document.getElementById('exportTxtBtn');
    const clearTxtBtn = document.getElementById('clearTxtBtn');
    const paragraphCount = document.getElementById('paragraphCount');
    const noContentMsg = document.getElementById('noContentMsg');
    const paraPreviewContainer = document.getElementById('paraPreviewContainer');
    const nextParaContent = document.getElementById('nextParaContent');
    const nextParaLength = document.getElementById('nextParaLength');
    const paraPreview = document.getElementById('paraPreview');

    // Smart bar
    const smartToggle = document.getElementById('smartToggle');
    const selectAreaBtn = document.getElementById('selectAreaBtn');
    const colorConditionBtn = document.getElementById('colorConditionBtn');
    const textConditionBtn = document.getElementById('textConditionBtn');

    // Modals
    const editModal = document.getElementById('editModal');
    const editStepType = document.getElementById('editStepType');
    const editValueGroup = document.getElementById('editValueGroup');
    const editValueLabel = document.getElementById('editValueLabel');
    const editStepValue = document.getElementById('editStepValue');
    const editDelay = document.getElementById('editDelay');
    const editSelector = document.getElementById('editSelector');
    const saveEdit = document.getElementById('saveEdit');
    const cancelEdit = document.getElementById('cancelEdit');

    const pasteModal = document.getElementById('pasteModal');
    const pasteContent = document.getElementById('pasteContent');
    const pasteDelimiter = document.getElementById('pasteDelimiter');
    const confirmPaste = document.getElementById('confirmPaste');
    const cancelPaste = document.getElementById('cancelPaste');

    const helpBtn = document.getElementById('helpBtn');
    const helpModal = document.getElementById('helpModal');
    const closeHelp = document.getElementById('closeHelp');

    const recordModal = document.getElementById('recordModal');
    const confirmRecord = document.getElementById('confirmRecord');
    const cancelRecord = document.getElementById('cancelRecord');

    let currentEditingIndex = null;
    let smartModeEnabled = true;

    // ========================================================
    // Smart Mode Toggle
    // ========================================================
    smartToggle.addEventListener('click', () => {
        smartModeEnabled = !smartModeEnabled;
        smartToggle.classList.toggle('active', smartModeEnabled);
        selectAreaBtn.disabled = !smartModeEnabled;
        colorConditionBtn.disabled = !smartModeEnabled;
        textConditionBtn.disabled = !smartModeEnabled;
        chrome.storage.local.set({ smartMode: smartModeEnabled });
    });

    // ========================================================
    // UI Updates
    // ========================================================
    function updateUI(isRunning, isRecording) {
        if (isRunning) {
            startText.textContent = 'Stop Sequence';
            startBtn.classList.add('running');
            startBtn.disabled = false;
            recordBtn.disabled = true;
            clearStepsBtn.disabled = true;
            loopEnabled.disabled = true;
            loopCount.disabled = true;
            loopDelay.disabled = true;
            loopInfinite.disabled = true;
            progressStatusLabel.textContent = 'Running';
        } else if (isRecording) {
            recordBtn.querySelector('.text').textContent = 'Stop';
            recordBtn.classList.add('recording');
            recordBtn.disabled = false;
            startBtn.disabled = true;
            clearStepsBtn.disabled = true;
            loopEnabled.disabled = true;
            progressStatusLabel.textContent = 'Recording on page...';
        } else {
            startText.textContent = 'Start Sequence';
            startBtn.classList.remove('running');
            recordBtn.querySelector('.text').textContent = 'Record';
            recordBtn.classList.remove('recording');
            startBtn.disabled = false;
            recordBtn.disabled = false;
            clearStepsBtn.disabled = false;
            loopEnabled.disabled = false;
            handleLoopControlsChange();
            progressStatusLabel.textContent = 'Ready';
        }
    }

    // ========================================================
    // Step List Rendering
    // ========================================================
    function renderSteps(steps = []) {
        stepList.innerHTML = '';
        stepCount.textContent = steps.length;

        if (steps.length === 0) {
            stepList.innerHTML = `
                <div class="empty-steps">
                    <strong>No steps recorded yet</strong><br>
                    <span>Click <b>Record</b> to record your form clicks & dropdowns, or right-click on the page</span>
                </div>
            `;
            return;
        }

        steps.forEach((step, index) => {
            const li = document.createElement('li');
            li.dataset.index = index;

            let badgeHtml = '';
            let titleText = '';
            let subText = '';
            let toggleParaBtnHtml = '';

            if (step.action === 'fillParagraph') {
                li.classList.add('step-para');
                badgeHtml = '<span class="step-type-badge type-para">📄 PARA BOX</span>';
                titleText = `${step.tagName || 'TEXT FIELD'} (Injects TXT Paragraph)`;
                subText = `${step.selector || 'auto'} · <span style="color:var(--success);">Consumes 1 paragraph per rotation</span>`;
                toggleParaBtnHtml = `<button class="toggle-para-btn is-para" data-index="${index}" title="Switch to fixed static text">✓ Para Box</button>`;
            } else if (step.action === 'fillStatic') {
                li.classList.add('step-static');
                badgeHtml = '<span class="step-type-badge type-static">✍️ STATIC TEXT</span>';
                const previewVal = step.value ? `"${step.value.substring(0, 25)}${step.value.length > 25 ? '...' : ''}"` : '(empty)';
                titleText = `${step.tagName || 'FIELD'}: ${previewVal}`;
                subText = `${step.selector || 'auto'} · Same info every rotation`;
                toggleParaBtnHtml = `<button class="toggle-para-btn" data-index="${index}" title="Convert into dynamic paragraph box from TXT file">📄 Set as Para Box</button>`;
            } else if (step.action === 'selectOption') {
                li.classList.add('step-select');
                badgeHtml = '<span class="step-type-badge type-select">🔽 OPTION</span>';
                titleText = `Select: "${step.optionText || step.value || 'Option'}"`;
                subText = `${step.selector || 'dropdown'} · Selects option in list`;
            } else if (step.action === 'smartClick') {
                li.classList.add('step-smart');
                badgeHtml = '<span class="step-type-badge type-smart">🎯 SMART CLICK</span>';
                titleText = step.elementText ? `Click: "${step.elementText.substring(0, 25)}"` : `<${(step.tagName || 'ELEMENT').toLowerCase()}>`;
                subText = `${step.selector || 'element'} · ${step.delay || 1000}ms`;
                if (step.tagName === 'TEXTAREA' || step.tagName === 'INPUT') {
                    toggleParaBtnHtml = `<button class="toggle-para-btn" data-index="${index}" title="Convert into dynamic paragraph box">📄 Set as Para Box</button>`;
                }
            } else {
                li.classList.add('step-click');
                badgeHtml = '<span class="step-type-badge type-click">🖱️ CLICK</span>';
                titleText = `Click at (${step.x || 0}, ${step.y || 0})`;
                subText = `Delay: ${step.delay || 1000}ms`;
            }

            li.innerHTML = `
                <div class="step-reorder-group">
                    <button class="reorder-btn move-up" data-index="${index}" title="Move Up" ${index === 0 ? 'disabled style="opacity:0.2;"' : ''}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"></polyline></svg>
                    </button>
                    <button class="reorder-btn move-down" data-index="${index}" title="Move Down" ${index === steps.length - 1 ? 'disabled style="opacity:0.2;"' : ''}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </button>
                </div>
                <div class="step-num">${index + 1}</div>
                <div class="step-info">
                    <div class="step-title">
                        ${badgeHtml}
                        <span style="overflow:hidden; text-overflow:ellipsis;">${titleText}</span>
                    </div>
                    <div class="step-sub">
                        ${subText}
                        <span style="margin-left:4px; opacity:0.7;">· ${step.delay || 1000}ms</span>
                    </div>
                </div>
                <div class="step-actions">
                    ${toggleParaBtnHtml}
                    <button class="action-btn test-btn" title="Test this step now" data-index="${index}">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                    </button>
                    <button class="action-btn edit-btn" title="Edit Step" data-index="${index}">
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

            stepList.appendChild(li);
        });

        // Bind Step Action Handlers
        document.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeStep(parseInt(btn.dataset.index));
            });
        });

        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                openEditModal(parseInt(btn.dataset.index));
            });
        });

        document.querySelectorAll('.test-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                testStep(parseInt(btn.dataset.index));
            });
        });

        document.querySelectorAll('.toggle-para-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleStepParaBox(parseInt(btn.dataset.index));
            });
        });

        document.querySelectorAll('.move-up').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                moveStep(parseInt(btn.dataset.index), -1);
            });
        });

        document.querySelectorAll('.move-down').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                moveStep(parseInt(btn.dataset.index), 1);
            });
        });
    }

    // Toggle a step between Dynamic Paragraph and Static Text
    function toggleStepParaBox(index) {
        chrome.storage.local.get(['steps'], (data) => {
            let steps = data.steps || [];
            if (!steps[index]) return;

            if (steps[index].action === 'fillParagraph') {
                steps[index].action = 'fillStatic';
            } else {
                steps[index].action = 'fillParagraph';
            }
            chrome.storage.local.set({ steps });
        });
    }

    // Move step up or down
    function moveStep(index, direction) {
        chrome.storage.local.get(['steps'], (data) => {
            let steps = data.steps || [];
            const target = index + direction;
            if (target < 0 || target >= steps.length) return;

            const temp = steps[index];
            steps[index] = steps[target];
            steps[target] = temp;
            chrome.storage.local.set({ steps });
        });
    }

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

    // Test a single step on active tab
    function testStep(index) {
        chrome.storage.local.get(['steps'], (data) => {
            const step = data.steps && data.steps[index];
            if (!step) return;

            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'testSingleStep',
                        step: step
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            alert('Could not test step. Make sure you are on a webpage.');
                        }
                    });
                }
            });
        });
    }

    // ========================================================
    // Step Edit Modal
    // ========================================================
    function openEditModal(index) {
        chrome.storage.local.get(['steps'], (data) => {
            const steps = data.steps || [];
            if (index < 0 || index >= steps.length) return;

            currentEditingIndex = index;
            const step = steps[index];

            editModalTitle.textContent = `Edit Step #${index + 1}`;
            editStepType.value = step.action || 'smartClick';
            editDelay.value = step.delay !== undefined ? step.delay : 1000;
            editSelector.value = step.selector || '';

            handleEditTypeChange();

            if (step.action === 'fillStatic') {
                editStepValue.value = step.value || '';
            } else if (step.action === 'selectOption') {
                editStepValue.value = step.optionText || step.value || '';
            }

            editModal.style.display = 'flex';
        });
    }

    function handleEditTypeChange() {
        const type = editStepType.value;
        if (type === 'fillStatic') {
            editValueGroup.style.display = 'block';
            editValueLabel.textContent = 'Static Text Value:';
            editStepValue.placeholder = 'Enter static text to fill every rotation...';
        } else if (type === 'selectOption') {
            editValueGroup.style.display = 'block';
            editValueLabel.textContent = 'Option Text or Value:';
            editStepValue.placeholder = 'Option label or value to select...';
        } else {
            editValueGroup.style.display = 'none';
        }
    }

    editStepType.addEventListener('change', handleEditTypeChange);

    saveEdit.addEventListener('click', () => {
        if (currentEditingIndex === null) return;
        chrome.storage.local.get(['steps'], (data) => {
            let steps = data.steps || [];
            if (!steps[currentEditingIndex]) return;

            const step = steps[currentEditingIndex];
            step.action = editStepType.value;
            step.delay = parseInt(editDelay.value) || 1000;
            step.selector = editSelector.value.trim() || step.selector;

            if (step.action === 'fillStatic') {
                step.value = editStepValue.value;
            } else if (step.action === 'selectOption') {
                step.optionText = editStepValue.value;
                step.value = editStepValue.value;
            }

            chrome.storage.local.set({ steps }, () => {
                editModal.style.display = 'none';
                currentEditingIndex = null;
            });
        });
    });

    cancelEdit.addEventListener('click', () => {
        editModal.style.display = 'none';
        currentEditingIndex = null;
    });

    // ========================================================
    // Content Library (Paragraph Management)
    // ========================================================

    // 1. Load TXT File
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
                const paragraphs = parseParagraphs(text, 'blankLines');

                if (paragraphs.length === 0) {
                    alert('No paragraphs detected in TXT file. Ensure paragraphs are separated by blank lines or line breaks.');
                    return;
                }

                chrome.storage.local.get(['paragraphs'], (existingData) => {
                    const current = existingData.paragraphs || [];
                    const merged = current.concat(paragraphs);
                    chrome.storage.local.set({ paragraphs: merged }, () => {
                        updateParagraphUI(merged);
                    });
                });
            };
            reader.readAsText(file);
        });
        input.click();
    });

    // 2. Paste TXT Modal
    pasteTxtBtn.addEventListener('click', () => {
        pasteContent.value = '';
        pasteModal.style.display = 'flex';
        pasteContent.focus();
    });

    confirmPaste.addEventListener('click', () => {
        const text = pasteContent.value;
        const mode = pasteDelimiter.value;
        const paragraphs = parseParagraphs(text, mode);

        if (paragraphs.length === 0) {
            alert('Please enter or paste some text paragraphs.');
            return;
        }

        chrome.storage.local.get(['paragraphs'], (existingData) => {
            const current = existingData.paragraphs || [];
            const merged = current.concat(paragraphs);
            chrome.storage.local.set({ paragraphs: merged }, () => {
                updateParagraphUI(merged);
                pasteModal.style.display = 'none';
            });
        });
    });

    cancelPaste.addEventListener('click', () => {
        pasteModal.style.display = 'none';
    });

    // 3. Save Remaining TXT File (Downloads the remaining paragraphs!)
    exportTxtBtn.addEventListener('click', () => {
        chrome.storage.local.get('paragraphs', (data) => {
            const paragraphs = data.paragraphs || [];
            if (paragraphs.length === 0) {
                alert('No remaining paragraphs to export.');
                return;
            }

            const content = paragraphs.join('\n\n');
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'remaining_paragraphs.txt';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    });

    // 4. Clear Paragraphs
    clearTxtBtn.addEventListener('click', () => {
        if (confirm('Clear all loaded paragraphs from the library?')) {
            chrome.storage.local.set({ paragraphs: [] }, () => {
                updateParagraphUI([]);
            });
        }
    });

    // Match loop count with paragraph count
    matchCountBtn.addEventListener('click', () => {
        chrome.storage.local.get('paragraphs', (data) => {
            const paragraphs = data.paragraphs || [];
            if (paragraphs.length > 0) {
                loopCount.value = paragraphs.length;
                loopEnabled.checked = true;
                handleLoopControlsChange();
            } else {
                alert('Load paragraphs into the library first.');
            }
        });
    });

    // Parse paragraphs helper
    function parseParagraphs(text, mode = 'blankLines') {
        if (!text) return [];
        let items = [];
        if (mode === 'singleLines') {
            items = text.split(/\r?\n/).map(p => p.trim()).filter(p => p.length > 0);
        } else {
            // Split by blank lines (one or more empty lines)
            items = text.split(/\r?\n\s*\r?\n+/).map(p => p.trim()).filter(p => p.length > 0);
        }
        return items;
    }

    // Render Paragraphs UI & Next-Up Box
    function updateParagraphUI(paragraphs = []) {
        paragraphCount.textContent = `${paragraphs.length} remaining`;

        if (paragraphs.length > 0) {
            noContentMsg.style.display = 'none';
            paraPreviewContainer.style.display = 'block';
            clearTxtBtn.style.display = 'inline-flex';
            exportTxtBtn.style.display = 'inline-flex';

            // Next Up Paragraph
            const nextPara = paragraphs[0];
            nextParaContent.textContent = nextPara;
            nextParaLength.textContent = `${nextPara.length} chars`;

            // Queue List (up to 8 previews)
            const remainingList = paragraphs.slice(1, 9);
            let html = remainingList.map((p, i) => {
                const preview = p.length > 55 ? p.substring(0, 55) + '...' : p;
                return `
                    <div class="para-item">
                        <span class="para-num">#${i + 2}</span>
                        <span class="para-text" title="${p.replace(/"/g, '&quot;').substring(0, 150)}">${preview}</span>
                        <button class="para-item-remove" data-index="${i + 1}" title="Remove this paragraph">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                `;
            }).join('');

            if (paragraphs.length > 9) {
                html += `<div class="para-more">+ ${paragraphs.length - 9} more in queue</div>`;
            }

            paraPreview.innerHTML = html;

            // Delete single paragraph handlers
            paraPreview.querySelectorAll('.para-item-remove').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const removeIdx = parseInt(btn.dataset.index);
                    deleteSingleParagraph(removeIdx);
                });
            });
        } else {
            noContentMsg.style.display = 'block';
            paraPreviewContainer.style.display = 'none';
            clearTxtBtn.style.display = 'none';
            exportTxtBtn.style.display = 'none';
        }
    }

    function deleteSingleParagraph(index) {
        chrome.storage.local.get(['paragraphs'], (data) => {
            let paras = data.paragraphs || [];
            if (index >= 0 && index < paras.length) {
                paras.splice(index, 1);
                chrome.storage.local.set({ paragraphs: paras }, () => {
                    updateParagraphUI(paras);
                });
            }
        });
    }

    // ========================================================
    // Sequence Execution & Recording
    // ========================================================
    startBtn.addEventListener('click', () => {
        chrome.storage.local.get('isRunning', (data) => {
            if (data.isRunning) {
                chrome.runtime.sendMessage({ action: 'stopSequence' });
            } else {
                chrome.storage.local.get(['steps', 'paragraphs'], (res) => {
                    const steps = res.steps || [];
                    if (steps.length === 0) {
                        alert('Please record at least 1 step before starting.');
                        return;
                    }

                    // Check if there is a fillParagraph step but no paragraphs
                    const hasParaStep = steps.some(s => s.action === 'fillParagraph' || s.action === 'fillField');
                    const paras = res.paragraphs || [];
                    if (hasParaStep && paras.length === 0) {
                        alert('Your sequence contains a Dynamic Paragraph field, but your Paragraph Library is empty. Please load a TXT file first!');
                        return;
                    }

                    const loopSettings = {
                        enabled: loopEnabled.checked,
                        infinite: loopInfinite.checked,
                        count: parseInt(loopCount.value) || 1,
                        delay: parseInt(loopDelay.value) || 2000
                    };

                    chrome.storage.local.set({ loopSettings }, () => {
                        chrome.runtime.sendMessage({ action: 'startSequence' });
                    });
                });
            }
        });
    });

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
                alert('Recording is restricted on browser internal pages. Please navigate to a regular webpage.');
                recordModal.style.display = 'none';
                return;
            }
            recordModal.style.display = 'none';
            chrome.runtime.sendMessage({ action: 'startRecording' });
            setTimeout(() => window.close(), 400);
        });
    });

    cancelRecord.addEventListener('click', () => {
        recordModal.style.display = 'none';
    });

    // Loop controls change
    function handleLoopControlsChange() {
        const show = loopEnabled.checked;
        loopSettingsDiv.style.display = show ? 'flex' : 'none';
        loopCount.disabled = !show || loopInfinite.checked;
        loopDelay.disabled = !show;
    }

    loopEnabled.addEventListener('change', handleLoopControlsChange);
    loopInfinite.addEventListener('change', handleLoopControlsChange);
    clearStepsBtn.addEventListener('click', clearAllSteps);

    // ========================================================
    // Progress Listener
    // ========================================================
    function updateProgress(data) {
        const { stepIndex, totalSteps, currentLoop, totalLoops, action, isBetweenRotations } = data;
        const totalLoopDisplay = totalLoops === Infinity ? '∞' : totalLoops;

        if (isBetweenRotations) {
            progressStatusLabel.textContent = `Completed Rotation ${currentLoop} · Waiting for next...`;
            return;
        }

        const percent = totalSteps > 0 ? Math.round(((stepIndex + 1) / totalSteps) * 100) : 0;
        progressBar.style.width = `${percent}%`;
        progressPercent.textContent = `${percent}%`;

        document.querySelectorAll('#stepList li').forEach(li => li.classList.remove('active'));
        const activeLi = document.querySelector(`#stepList li[data-index='${stepIndex}']`);
        if (activeLi) activeLi.classList.add('active');

        let actionDesc = '';
        if (action === 'fillParagraph') actionDesc = '📄 Filling Paragraph';
        else if (action === 'selectOption') actionDesc = '🔽 Selecting Option';
        else if (action === 'fillStatic') actionDesc = '✍️ Filling Field';
        else actionDesc = '🖱️ Clicking';

        loopCounter.textContent = `Rotation ${currentLoop} of ${totalLoopDisplay} · Step ${stepIndex + 1}/${totalSteps} (${actionDesc})`;
    }

    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.action === 'progressUpdate') {
            updateProgress(msg.data);
        } else if (msg.action === 'executionFinished') {
            progressBar.style.width = '100%';
            progressPercent.textContent = '100%';
            progressStatusLabel.textContent = 'Finished';
            loopCounter.textContent = 'All rotations completed!';
            setTimeout(() => {
                progressBar.style.width = '0%';
                progressPercent.textContent = '0%';
                progressStatusLabel.textContent = 'Ready';
                loopCounter.textContent = 'Sequence idle';
            }, 3000);
        }
    });

    // ========================================================
    // Export & Import Steps JSON
    // ========================================================
    exportStepsBtn.addEventListener('click', () => {
        chrome.storage.local.get('steps', (data) => {
            const steps = data.steps || [];
            const blob = new Blob([JSON.stringify(steps, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'form-filler-steps.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    });

    importStepsBtn.addEventListener('click', () => {
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
                    alert('Invalid JSON file format.');
                }
            };
            reader.readAsText(file);
        });
        input.click();
    });

    // ========================================================
    // Help & Tutorial Modal
    // ========================================================
    helpBtn.addEventListener('click', () => {
        helpModal.style.display = 'flex';
    });

    closeHelp.addEventListener('click', () => {
        helpModal.style.display = 'none';
    });

    // Modals backdrop dismissal
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', () => {
            editModal.style.display = 'none';
            recordModal.style.display = 'none';
            pasteModal.style.display = 'none';
            helpModal.style.display = 'none';
        });
    });

    // ========================================================
    // Live Storage Synchronization
    // ========================================================
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local') {
            chrome.storage.local.get(['isRunning', 'isRecording', 'steps', 'smartMode', 'paragraphs'], (data) => {
                updateUI(data.isRunning, data.isRecording);
                if (changes.steps) {
                    renderSteps(changes.steps.newValue || []);
                }
                if (changes.paragraphs) {
                    updateParagraphUI(changes.paragraphs.newValue || []);
                }
            });
        }
    });

    // ========================================================
    // Initial Load
    // ========================================================
    function initialize() {
        chrome.storage.local.get([
            'steps', 'isRunning', 'isRecording', 'loopSettings', 'smartMode', 'paragraphs'
        ], (data) => {
            renderSteps(data.steps || []);
            updateUI(data.isRunning || false, data.isRecording || false);
            updateParagraphUI(data.paragraphs || []);

            const settings = data.loopSettings || { enabled: true, infinite: false, count: 5, delay: 2000 };
            loopEnabled.checked = settings.enabled !== undefined ? settings.enabled : true;
            loopInfinite.checked = settings.infinite || false;
            loopCount.value = settings.count || 5;
            loopDelay.value = settings.delay || 2000;
            handleLoopControlsChange();

            smartModeEnabled = data.smartMode !== undefined ? data.smartMode : true;
            smartToggle.classList.toggle('active', smartModeEnabled);
        });
    }

    initialize();
});

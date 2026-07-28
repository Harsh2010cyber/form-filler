const sendMessageSafe = (target, msg) => {
    return chrome.tabs.sendMessage(target, msg).catch(() => {});
};

const runtimeSendSafe = (msg) => {
    return chrome.runtime.sendMessage(msg).catch(() => {});
};

// On install, set default state
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({
        isRunning: false,
        isRecording: false,
        runningTabId: null,
        steps: [],
        loopSettings: { enabled: false, infinite: false, count: 5 },
        smartMode: false,
        selectedArea: null,
        paragraphs: []
    });

    // Create Context Menus
    chrome.contextMenus.create({
        id: 'autoClickerMenu',
        title: '🚀 Auto Clicker Pro',
        contexts: ['all']
    });

    chrome.contextMenus.create({
        id: 'addStepLegacy', // Kept for single-click additions
        parentId: 'autoClickerMenu',
        title: '➕ Add Single Click Step',
        contexts: ['all']
    });
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'startSequence') {
        chrome.storage.local.get(['steps', 'isRunning', 'loopSettings'], (data) => {
            if (data.isRunning) return;
            if (data.steps && data.steps.length > 0) {
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    const currentTab = tabs[0];
                    if (currentTab) {
                        chrome.storage.local.set({ isRunning: true, runningTabId: currentTab.id });
                        sendMessageSafe(currentTab.id, {
                            action: 'runSteps',
                            steps: data.steps,
                            loop: data.loopSettings
                        });
                    }
                });
            }
        });
    }
    // Popup wants to stop the click sequence
    else if (msg.action === 'stopSequence') {
        chrome.storage.local.get(['runningTabId'], (data) => {
            if (data.runningTabId) {
                sendMessageSafe(data.runningTabId, { action: 'stop' });
            }
        });
    }
    // Content script finished execution
    else if (msg.action === 'executionFinished') {
        chrome.storage.local.set({ isRunning: false, runningTabId: null });
    }

    // Relay progress updates from content script to popup
    else if (msg.action === 'progressUpdate') {
        runtimeSendSafe(msg);
    }

    // --- Steps Updates ---
    else if (msg.action === 'updateSteps') {
        chrome.storage.local.set({ steps: msg.steps });
    }

    // --- Recording Actions ---
    else if (msg.action === 'startRecording') {
        chrome.storage.local.set({ isRecording: true }, () => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    sendMessageSafe(tabs[0].id, { action: 'startRecordingSession' });
                }
            });
            try { sendResponse({ ok: true }); } catch (e) {}
        });
        return true;
    } else if (msg.action === 'stopRecording') {
        chrome.storage.local.set({ isRecording: false }, () => {
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => {
                    sendMessageSafe(tab.id, { action: 'stopRecordingSession' });
                });
            });
        });
    }

    // --- Smart Mode Actions ---
    else if (msg.action === 'toggleSmartMode') {
        chrome.storage.local.set({ smartMode: msg.enabled });
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                sendMessageSafe(tabs[0].id, { action: 'toggleSmartMode', enabled: msg.enabled });
            }
        });
    }

    // --- Area Selection Actions ---
    else if (msg.action === 'startAreaSelection') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                sendMessageSafe(tabs[0].id, { action: 'startAreaSelection' });
            }
        });
    } else if (msg.action === 'stopAreaSelection') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                sendMessageSafe(tabs[0].id, { action: 'stopAreaSelection' });
            }
        });
    } else if (msg.action === 'areaSelected') {
        chrome.storage.local.set({ selectedArea: msg.area });
    } else if (msg.action === 'areaSelectionCancelled') {
        chrome.storage.local.set({ selectedArea: null });
    }

    // --- Branch Recording Actions ---
    else if (msg.action === 'startBranchRecording') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                sendMessageSafe(tabs[0].id, {
                    action: 'startBranchRecording',
                    branch: msg.branch
                });
            }
        });
    } else if (msg.action === 'stopBranchRecording') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                sendMessageSafe(tabs[0].id, { action: 'stopBranchRecording' });
            }
        });
    } else if (msg.action === 'getBranchSteps') {
        sendResponse({ steps: [] });
    } else if (msg.action === 'branchRecordingFinished') {
        chrome.storage.local.set({ isRecording: false });
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                sendMessageSafe(tabs[0].id, { action: 'stopRecordingSession' });
                sendMessageSafe(tabs[0].id, { action: 'stopBranchRecording' });
            }
        });
    }

    // --- Inline Condition Flows (from popup) ---
    else if (msg.action === 'startColorCondition') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                sendMessageSafe(tabs[0].id, { action: 'startColorCondition' });
            }
        });
    } else if (msg.action === 'startTextCondition') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                sendMessageSafe(tabs[0].id, { action: 'startTextCondition' });
            }
        });
    }

    return true;
});

// Context menu click handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
    // Legacy support for single step adding
    if (info.menuItemId === 'addStepLegacy') {
        chrome.storage.local.get(['steps', 'lastRightClick', 'smartMode'], (data) => {
            const steps = data.steps || [];
            const pos = data.lastRightClick || { x: 0, y: 0 };
            const smartMode = data.smartMode || false;

            if (smartMode && pos.selector) {
                steps.push({
                    action: 'smartClick',
                    x: pos.x,
                    y: pos.y,
                    delay: 1000,
                    selector: pos.selector,
                    tagName: pos.tagName || '',
                    elementText: pos.elementText || '',
                    attributes: pos.attributes || {}
                });
            } else {
                steps.push({
                    action: 'clickAt',
                    x: pos.x,
                    y: pos.y,
                    delay: 1000
                });
            }
            chrome.storage.local.set({ steps }, () => {
                // Notify popup to update its UI if it's open
                runtimeSendSafe({ action: 'stepsUpdated' });
            });
        });
    }
});

// --- Keyboard Shortcut: Ctrl+Shift+R to toggle recording ---
chrome.commands.onCommand.addListener((command) => {
    if (command === 'toggle-recording') {
        chrome.storage.local.get('isRecording', (data) => {
            if (data.isRecording) {
                chrome.storage.local.set({ isRecording: false });
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs[0]) {
                        sendMessageSafe(tabs[0].id, { action: 'stopRecordingSession' });
                    }
                });
            } else {
                chrome.storage.local.set({ isRecording: true });
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs[0]) {
                        sendMessageSafe(tabs[0].id, { action: 'startRecordingSession' });
                    }
                });
            }
        });
    }
});

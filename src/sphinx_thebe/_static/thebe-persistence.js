/**
 * Thebe cell persistence: auto-saves code cell content to localStorage,
 * and adds Export / Import / Reset buttons next to the launch button in the header.
 */

const PERSISTENCE_PREFIX = "sphinx_thebe_";

function _persistenceKey(cellId) {
  return `${PERSISTENCE_PREFIX}${location.hostname}${location.pathname}_${cellId}`;
}

function _stableCellId(codeCell, fallbackIndex) {
  const el = codeCell.querySelector("[data-thebe-id]");
  return el ? el.getAttribute("data-thebe-id") : `cell-${fallbackIndex}`;
}

function _makeHeaderButton(title, text) {
  const btn = document.createElement("button");
  btn.classList.add("thebelab-button");
  btn.title = title;
  btn.innerText = text;
  return btn;
}

/**
 * Called once per code cell after Thebe has rendered it.
 * Silently auto-saves CodeMirror content to localStorage on every change.
 */
function setupCellPersistence(codeCell, index) {
  const cmEl = codeCell.querySelector(".CodeMirror");
  if (!cmEl || !cmEl.CodeMirror) return;

  const cm = cmEl.CodeMirror;
  const cellId = _stableCellId(codeCell, index);
  const key = _persistenceKey(cellId);
  const originalContent = cm.getValue();

  // Restore previously saved content if present
  const saved = localStorage.getItem(key);
  if (saved !== null) {
    cm.setValue(saved);
  }

  // Auto-save on every change
  cm.on("change", () => {
    try {
      localStorage.setItem(key, cm.getValue());
    } catch (_) {}
  });
}

/**
 * Adds Export / Import / Reset buttons to the header area next to the
 * Thebe launch button. Called once after Thebe has fully initialised.
 */
function setupPersistenceControls() {
  const launchBtn = document.querySelector(".thebe-launch-button");
  if (!launchBtn || !launchBtn.parentElement) return;

  const exportBtn = _makeHeaderButton(thebeExportTitle, thebeExportLabel);
  exportBtn.onclick = _exportProgress;

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".json";
  fileInput.style.display = "none";
  fileInput.onchange = _importProgress;

  const importBtn = _makeHeaderButton(thebeImportTitle, thebeImportLabel);
  importBtn.onclick = () => fileInput.click();

  const resetBtn = _makeHeaderButton(thebeResetTitle, thebeResetLabel);
  resetBtn.onclick = _showResetDialog;

  launchBtn.parentElement.insertBefore(exportBtn, launchBtn);
  launchBtn.parentElement.insertBefore(importBtn, launchBtn);
  launchBtn.parentElement.insertBefore(resetBtn, launchBtn);
  launchBtn.parentElement.insertBefore(fileInput, launchBtn);
}

function _exportProgress() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(PERSISTENCE_PREFIX)) {
      data[key] = localStorage.getItem(key);
    }
  }

  const payload = JSON.stringify({
    exportDate: new Date().toISOString(),
    pageUrl: location.href,
    data,
  }, null, 2);

  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
  a.download = `thebe-progress-${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function _importProgress(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const { data } = JSON.parse(e.target.result);
      if (!data || typeof data !== "object") throw new Error("invalid format");
      Object.entries(data).forEach(([key, value]) => {
        if (key.startsWith(PERSISTENCE_PREFIX)) {
          localStorage.setItem(key, value);
        }
      });
      location.reload();
    } catch (_) {
      alert(thebeImportError);
    }
  };
  reader.readAsText(file);
  event.target.value = "";
}

function _showResetDialog() {
  const backdrop = document.createElement("div");
  backdrop.style.cssText = `
    position:fixed; inset:0; background:rgba(0,0,0,.45);
    z-index:10000; display:flex; align-items:center; justify-content:center;
  `;

  const dialog = document.createElement("div");
  dialog.style.cssText = `
    background:#fff; border-radius:6px; padding:24px; max-width:320px;
    box-shadow:0 4px 20px rgba(0,0,0,.3); font-family:sans-serif;
  `;

  dialog.innerHTML = `
    <h3 style="margin:0 0 12px">${thebeResetTitle}</h3>
    <p style="margin:0 0 16px; color:#555; font-size:.9em">${thebeResetWarning}</p>
    <div style="display:flex; flex-direction:column; gap:8px;">
      <button id="_thebe-reset-page" style="padding:8px 14px; border:none; border-radius:4px;
        background:#e6a817; color:#000; cursor:pointer; font-weight:500;">${thebeResetPage}</button>
      <button id="_thebe-reset-all" style="padding:8px 14px; border:none; border-radius:4px;
        background:#c0392b; color:#fff; cursor:pointer; font-weight:500;">${thebeResetAll}</button>
      <button id="_thebe-reset-cancel" style="padding:8px 14px; border:none; border-radius:4px;
        background:#6c757d; color:#fff; cursor:pointer;">${thebeResetCancel}</button>
    </div>
  `;

  backdrop.appendChild(dialog);
  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();

  dialog.querySelector("#_thebe-reset-page").onclick = () => {
    _clearKeys(key => key.includes(location.pathname));
    close();
    location.reload();
  };

  dialog.querySelector("#_thebe-reset-all").onclick = () => {
    _clearKeys(() => true);
    close();
    location.reload();
  };

  dialog.querySelector("#_thebe-reset-cancel").onclick = close;
  backdrop.onclick = (e) => { if (e.target === backdrop) close(); };
}

function _clearKeys(predicate) {
  const toRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(PERSISTENCE_PREFIX) && predicate(key)) {
      toRemove.push(key);
    }
  }
  toRemove.forEach(key => localStorage.removeItem(key));
}

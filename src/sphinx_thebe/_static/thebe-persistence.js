/**
 * Thebe cell persistence: auto-saves code cell content to localStorage,
 * and adds Export / Import / Reset buttons next to the launch button in the header.
 */

const PERSISTENCE_PREFIX = "sphinx_thebe_";

function _persistenceKey(cellId) {
  return `${PERSISTENCE_PREFIX}${location.hostname}${location.pathname}_${cellId}`;
}

function _stableCellId(codeCell, fallbackIndex) {
  return `cell-${fallbackIndex}`;
}

const _ICONS = {
  export: "fa-solid fa-file-export",
  import: "fa-solid fa-file-import",
  reset: "fa-solid fa-rotate-left",
};

function _makeHeaderButton(title, iconClass) {
  const btn = document.createElement("button");
  btn.classList.add("thebe-persist-btn");
  btn.title = title;
  btn.setAttribute("aria-label", title);
  const icon = document.createElement("i");
  icon.className = iconClass;
  icon.setAttribute("aria-hidden", "true");
  btn.appendChild(icon);
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
 * Finds the direct child of the launch button's ancestor container that wraps
 * the GitHub repository link, so we can insert our buttons after it.
 * Returns null if no GitHub link is found in the header.
 */
function _findGithubItem(launchBtn) {
  const header = document.querySelector("header, .bd-header, #navbar-main");
  if (!header) return null;
  const githubLink = header.querySelector("a[href*='github.com']");
  if (!githubLink) return null;

  // Walk up from launchBtn to find the container that also holds the GitHub link
  let container = launchBtn.parentElement;
  while (container && !container.contains(githubLink)) {
    container = container.parentElement;
  }
  if (!container) return null;

  // Find the direct child of that container wrapping the GitHub link
  let item = githubLink;
  while (item.parentElement !== container) {
    item = item.parentElement;
  }
  return item;
}

/**
 * Adds Export / Import / Reset buttons to the header, after the GitHub button.
 * Falls back to inserting before the launch button if GitHub is not found.
 * Called once after Thebe has fully initialised.
 */
function setupPersistenceControls() {
  const launchBtn = document.querySelector(".thebe-launch-button");
  if (!launchBtn || !launchBtn.parentElement) return;

  const exportBtn = _makeHeaderButton(thebeExportTitle, _ICONS.export);
  exportBtn.onclick = _exportProgress;

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".json";
  fileInput.style.display = "none";
  fileInput.onchange = _importProgress;
  document.body.appendChild(fileInput);

  const importBtn = _makeHeaderButton(thebeImportTitle, _ICONS.import);
  importBtn.onclick = () => fileInput.click();

  const resetBtn = _makeHeaderButton(thebeResetTitle, _ICONS.reset);
  resetBtn.onclick = _showResetDialog;

  const githubItem = _findGithubItem(launchBtn);
  if (githubItem) {
    let ref = githubItem;
    [exportBtn, importBtn, resetBtn].forEach(btn => { ref.after(btn); ref = btn; });
  } else {
    const parent = launchBtn.parentElement;
    [exportBtn, importBtn, resetBtn].forEach(btn => parent.insertBefore(btn, launchBtn));
  }
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

const starter = {
  html: `<!-- HTML Starter -->
<div class="card">
  <h1>CodePath LiveLab</h1>
  <p>Practice HTML, CSS, and JS live!</p>
  <button id="action-btn">Click Me</button>
</div>`,
  css: `/* CSS Starter */
body {
  font-family: 'Segoe UI', system-ui, sans-serif;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  margin: 0;
  background: #f3f4f6;
  color: #1f2937;
}

.card {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  text-align: center;
  max-width: 350px;
}

h1 {
  color: #10b981;
  margin-top: 0;
}

button {
  background: #10b981;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  font-size: 1rem;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

button:hover {
  background: #059669;
}`,
  js: `// JS Starter
const button = document.getElementById('action-btn');
button.addEventListener('click', () => {
  console.log('Hello from JavaScript!');
  alert('Button clicked! Check the output console.');
});`
};

function buildDocument(code) {
  const html = String(code.html || "");
  const css = String(code.css || "");
  const js = String(code.js || "").replace(/<\/script/gi, "<\\/script");

  const interceptor = `<script>
const parentOrigin = "*";
const original = { log: console.log, warn: console.warn, error: console.error, info: console.info };
["log", "warn", "error", "info"].forEach(level => {
  console[level] = (...args) => {
    original[level](...args);
    parent.postMessage({ type: "console", level, args: args.map(value => { try { return typeof value === "string" ? value : JSON.stringify(value, null, 2); } catch { return String(value); } }) }, parentOrigin);
  };
});
window.onerror = function(message, source, line, col) {
  parent.postMessage({ type: "console", level: "error", args: [message + " (line " + line + ")"] }, parentOrigin);
  const box = document.createElement("pre");
  box.style.cssText = "white-space:pre-wrap;background:#fee2e2;color:#991b1b;padding:10px;font-family:monospace;";
  box.textContent = "JavaScript Error: " + message + " (line " + line + ")";
  document.body.appendChild(box);
};
<\/script>`;

  const styledStyle = `<style>${css}</style>`;
  const scriptTag = `<script>${js}<\/script>`;

  if (html.toLowerCase().includes("<html")) {
    let doc = html;
    
    // Inject console interceptor and styles at the beginning of head or html
    if (doc.toLowerCase().includes("<head>")) {
      doc = doc.replace(/<head>/i, `<head>${interceptor}${styledStyle}`);
    } else {
      doc = doc.replace(/<html([^>]*)>/i, `<html$1><head>${interceptor}${styledStyle}</head>`);
    }

    // Inject user script at the end of body or document
    if (doc.toLowerCase().includes("</body>")) {
      doc = doc.replace(/<\/body>/i, `${scriptTag}</body>`);
    } else {
      doc = doc + scriptTag;
    }
    return doc;
  }

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${interceptor}
<style>${css}</style>
</head>
<body>
${html}
${scriptTag}
</body>
</html>`;
}

function renderPreview(iframe, code) {
  if (!iframe) return;
  iframe.srcdoc = buildDocument(code);
}

function clearConsole(output) {
  if (output) output.innerHTML = '<div class="console-empty">No output yet.</div>';
}

function renderCapturedOutput(output, entries = []) {
  if (!output) return;
  clearConsole(output);
  if (!entries.length) return;
  output.innerHTML = '';
  entries.forEach(entry => {
    const line = document.createElement('div');
    const level = entry?.level || 'log';
    const prefix = level === 'error' ? '✕' : level === 'warn' ? '⚠' : level === 'info' ? 'ⓘ' : '>';
    line.className = `console-line ${level}`;
    line.textContent = `${prefix} ${(entry.args || []).join(' ')}`;
    output.appendChild(line);
  });
  output.scrollTop = output.scrollHeight;
}

function attachConsole(iframe, output, onOutput = () => {}) {
  if (!iframe || !output) return;
  if (iframe.__consoleHandler) window.removeEventListener("message", iframe.__consoleHandler);
  iframe.__consoleHandler = event => {
    if (event.source !== iframe.contentWindow || event.data?.type !== "console") return;
    const payload = { level: event.data.level, args: event.data.args || [] };
    onOutput(payload);
    output.querySelector('.console-empty')?.remove();
    const line = document.createElement("div");
    line.className = `console-line ${event.data.level}`;
    const prefix = event.data.level === "error" ? "✕" : event.data.level === "warn" ? "⚠" : ">";
    line.textContent = `${prefix} ${(event.data.args || []).join(" ")}`;
    output.appendChild(line);
    output.scrollTop = output.scrollHeight;
  };
  window.addEventListener("message", iframe.__consoleHandler);
}

function runCode(iframe, output, code, onOutput = () => {}) {
  clearConsole(output);
  attachConsole(iframe, output, onOutput);
  renderPreview(iframe, code);
}

function activeLanguage(group) {
  return document.querySelector(`.code-tab[data-group="${group}"].active`)?.dataset.lang || "html";
}

function modeCode(code, language) {
  if (language === "html") return { html: code.html, css: "", js: "" };
  if (language === "css") return { html: code.html, css: code.css, js: "" };
  return { html: "", css: "", js: code.js };
}

function updateRunLabel(group, buttonId) {
  const language = activeLanguage(group);
  const labels = { html: "▶ Run HTML", css: "▶ Run CSS", js: "▶ Run JavaScript" };
  const button = document.getElementById(buttonId);
  if (button) button.textContent = labels[language];
}

function downloadProject(code, name = "codelab-project") {
  const files = {
    "index.html": `<!doctype html>\n<html><head><meta charset="utf-8"><link rel="stylesheet" href="style.css"></head><body>${code.html}\n<script src="script.js"><\/script></body></html>`,
    "style.css": code.css,
    "script.js": code.js
  };
  Object.entries(files).forEach(([filename, content]) => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([content], {type:"text/plain"}));
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 500);
  });
  toast(`${name} files downloaded`);
}

function setupWorkspaceControls(root, onLayout) {
  root?.querySelectorAll("[data-layout]").forEach(button => button.addEventListener("click", () => onLayout(button.dataset.layout)));
}

function setupTabs() {
  document.querySelectorAll(".view-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".view-tab").forEach(x => x.classList.remove("active"));
      document.querySelectorAll(".view").forEach(x => x.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.view)?.classList.add("active");
    });
  });

  document.querySelectorAll(".code-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      const group = btn.dataset.group;
      document.querySelectorAll(`.code-tab[data-group="${group}"]`).forEach(x => x.classList.remove("active"));
      btn.classList.add("active");

      const map = {
        teacher:{html:"tHtml",css:"tCss",js:"tJs"},
        student:{html:"sHtml",css:"sCss",js:"sJs"},
        mine:{html:"mHtml",css:"mCss",js:"mJs"},
        teacherwatch:{html:"wHtml",css:"wCss",js:"wJs"}
      }[group];

      if (!map) return;
      Object.values(map).forEach(id => document.getElementById(id)?.classList.remove("active"));
      document.getElementById(map[btn.dataset.lang])?.classList.add("active");

      const previewMap = { teacher: "tPreview", student: "sPreview", mine: "mPreview", teacherwatch: "wPreview" };
      const preview = document.getElementById(previewMap[group]);
      preview?.closest(".preview-card")?.classList.toggle("console-mode", btn.dataset.lang === "js");
      updateRunLabel(group, {teacher:"runTeacher", mine:"runStudent", student:"runStudent", teacherwatch:null}[group]);
    });
  });
}

function toast(message) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
}

function debounce(fn, wait=180) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

setupTabs();
document.addEventListener("keydown", event => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { document.querySelector(".view.active .btn.secondary")?.click(); event.preventDefault(); }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") { document.querySelector("#saveProject, #downloadTeacher")?.click(); event.preventDefault(); }
});
document.querySelectorAll("textarea.editor").forEach(editor => editor.addEventListener("keydown", event => {
  if (event.key !== "Tab") return;
  event.preventDefault(); const start = editor.selectionStart;
  editor.value = editor.value.slice(0, start) + "  " + editor.value.slice(editor.selectionEnd);
  editor.selectionStart = editor.selectionEnd = start + 2; editor.dispatchEvent(new Event("input", {bubbles:true}));
}));

function insertSymbol(textarea, symbol) {
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  textarea.value = text.slice(0, start) + symbol + text.slice(end);
  textarea.selectionStart = textarea.selectionEnd = start + symbol.length;
  textarea.focus();
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function initSymbolBars() {
  document.querySelectorAll(".symbol-bar").forEach(bar => {
    bar.querySelectorAll(".sym-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const card = bar.closest(".editor-card");
        if (!card) return;
        const activeTextarea = card.querySelector("textarea.editor.active");
        if (activeTextarea) {
          insertSymbol(activeTextarea, btn.dataset.sym || btn.textContent);
        }
      });
    });
  });
}

initSymbolBars();

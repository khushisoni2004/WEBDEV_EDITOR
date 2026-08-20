const starter = {
  html: `<main class="card">
  <h1>Hello Web Developers 👋</h1>
  <p>Edit HTML, CSS and JavaScript and see the output live.</p>
  <button id="helloBtn">Click Me</button>
</main>`,
  css: `body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  font-family: Arial, sans-serif;
  background: #eef2ff;
}
.card {
  width: min(520px, 85%);
  padding: 30px;
  background: white;
  border-radius: 20px;
  box-shadow: 0 18px 45px rgba(0,0,0,.12);
}
button {
  padding: 10px 18px;
  border: 0;
  border-radius: 10px;
  cursor: pointer;
}`,
  js: `document.getElementById("helloBtn")?.addEventListener("click", () => {
  alert("JavaScript is working!");
});`
};

function buildDocument(code) {
  const js = String(code.js || "").replace(/<\/script/gi, "<\\/script");
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>${code.css || ""}</style>
</head>
<body>
${code.html || ""}
<script>
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
${js}
<\/script>
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

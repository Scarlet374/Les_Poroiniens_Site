// js/pages/series-detail/LNReader/data.js
import { state } from "./state.js";

function sanitize(html) {
  const allowedTags = new Set(["P","BR","EM","I","STRONG","B","U","S","HR","H1","H2","H3","H4","H5","H6","UL","OL","LI","BLOCKQUOTE","CODE","PRE","IMG","A","SPAN","DIV","FIGURE","FIGCAPTION"]);
  const allowedAttrs = new Set(["href","target","rel","src","alt","title","loading","width","height","class","style"]);
  const tmp = document.createElement("div"); tmp.innerHTML = html;
  const walker = document.createTreeWalker(tmp, NodeFilter.SHOW_ELEMENT);
  const drop = [];
  while (walker.nextNode()) {
    const el = walker.currentNode;
    if (!allowedTags.has(el.tagName)) { drop.push(el); continue; }
    [...el.attributes].forEach(a => { if (!allowedAttrs.has(a.name)) el.removeAttribute(a.name); });
    if (el.tagName === "A") { el.target = "_blank"; el.rel = "noopener"; }
  }
  drop.forEach(n => n.replaceWith(...n.childNodes));
  return tmp.innerHTML;
}

function mdToHtml(md) {
  let h = md.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  h = h.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">');
  h = h.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
  h = h.replace(/^### (.*)$/gm, '<h3>$1</h3>').replace(/^## (.*)$/gm, '<h2>$1</h2>').replace(/^# (.*)$/gm, '<h1>$1</h1>');
  // paragraphes
  h = h.split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g,"<br>")}</p>`).join("");
  return h;
}
function txtToHtml(txt) {
  return txt.split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g,"<br>")}</p>`).join("");
}

export async function fetchChapterHtml() {
  const file = state.currentChapter.file;
  if (!file) throw new Error("Chapitre LN sans 'file'.");

  const res = await fetch(file);
  if (!res.ok) throw new Error(`Impossible de charger le fichier (${res.status})`);
  const raw = await res.text();

  const ext = (file.split(".").pop() || "").toLowerCase();
  let html = (ext === "html" || ext === "htm") ? raw : (ext === "md" ? mdToHtml(raw) : txtToHtml(raw));
  return sanitize(html);
}
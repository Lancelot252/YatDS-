import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const websiteDir = path.dirname(fileURLToPath(import.meta.url));
const sourceDir = path.resolve(websiteDir, "../讲义");

function contentHash(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function slugify(value) {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "section";
}

function inline(value) {
  const codeTokens = [];
  const noteTokens = [];
  let result = value.replace(/`([^`]+)`/g, (_, code) => {
    const token = `\u0000CODE${codeTokens.length}\u0000`;
    codeTokens.push(`<code>${escapeHtml(code)}</code>`);
    return token;
  });
  result = result.replace(/\[\^([\w-]+)\]/g, (_, label) => {
    const token = `\u0000NOTE${noteTokens.length}\u0000`;
    noteTokens.push(`<sup class="term-note-ref"><a href="#term-note-${escapeHtml(label)}" aria-label="查看术语注释 ${escapeHtml(label)}">${escapeHtml(label)}</a></sup>`);
    return token;
  });
  result = escapeHtml(result)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/~~([^~\n]+)~~/g, "<del>$1</del>")
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, '<a href="$2">$1</a>');
  codeTokens.forEach((token, index) => {
    result = result.replace(`\u0000CODE${index}\u0000`, token);
  });
  noteTokens.forEach((token, index) => {
    result = result.replace(`\u0000NOTE${index}\u0000`, token);
  });
  return result;
}

function isTableDivider(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function tableCells(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(cell => inline(cell.trim()));
}

function openingFence(line) {
  const match = line.match(/^(`{3,}|~{3,})([\w+-]*)\s*$/);
  return match ? { marker: match[1][0], length: match[1].length, language: match[2] || "text" } : null;
}

function closesFence(line, fence) {
  const match = line.match(/^(`{3,}|~{3,})\s*$/);
  return Boolean(match && match[1][0] === fence.marker && match[1].length >= fence.length);
}

function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const output = [];
  let index = 0;
  let headingCount = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }

    const fence = openingFence(line);
    if (fence) {
      const code = [];
      index += 1;
      while (index < lines.length && !closesFence(lines[index], fence)) code.push(lines[index++]);
      if (index < lines.length) index += 1;
      output.push(`<pre data-language="${escapeHtml(fence.language)}"><code>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }

    const heading = line.match(/^(#{3,6})\s+(.+)$/);
    if (heading) {
      const level = Math.min(4, heading[1].length - 1);
      const title = inline(heading[2].trim());
      const id = `${slugify(heading[2])}-${++headingCount}`;
      output.push(`<h${level} id="${id}">${title}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
      output.push("<hr />");
      index += 1;
      continue;
    }

    const image = line.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/);
    if (image) {
      const alt = image[1].trim();
      const caption = (image[3] || alt).trim();
      const source = image[2];
      let outputSource = source;
      if (!/^https?:\/\//.test(source)) {
        const sourcePath = path.resolve(sourceDir, source);
        const relativeSourcePath = path.relative(sourceDir, sourcePath);
        if (relativeSourcePath.startsWith("..") || path.isAbsolute(relativeSourcePath)) {
          throw new Error(`Local image must stay inside the lecture directory: ${source}`);
        }
        const destinationPath = path.resolve(websiteDir, relativeSourcePath);
        fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
        const imageData = fs.readFileSync(sourcePath);
        fs.writeFileSync(destinationPath, imageData);
        const encodedPath = relativeSourcePath.split(path.sep).map(encodeURIComponent).join("/");
        outputSource = `${encodedPath}?v=${contentHash(imageData)}`;
      }
      output.push(`<figure class="course-figure"><img src="${escapeHtml(outputSource)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" />${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ""}</figure>`);
      index += 1;
      continue;
    }

    const termNote = line.match(/^\[\^([\w-]+)\]:\s+(.+)$/);
    if (termNote) {
      output.push(`<p class="term-note" id="term-note-${escapeHtml(termNote[1])}"><sup>${escapeHtml(termNote[1])}</sup>${inline(termNote[2])}</p>`);
      index += 1;
      continue;
    }

    if (index + 1 < lines.length && line.includes("|") && isTableDivider(lines[index + 1])) {
      const headers = tableCells(line);
      index += 2;
      const rows = [];
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        rows.push(tableCells(lines[index++]));
      }
      output.push(`<div class="table-wrap"><table><thead><tr>${headers.map(cell => `<th>${cell}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) quote.push(lines[index++].replace(/^>\s?/, ""));
      output.push(`<blockquote><p>${inline(quote.join(" "))}</p></blockquote>`);
      continue;
    }

    const unordered = line.match(/^\s*[-+*]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      const tag = ordered ? "ol" : "ul";
      const items = [];
      const pattern = ordered ? /^\s*\d+[.)]\s+(.+)$/ : /^\s*[-+*]\s+(.+)$/;
      while (index < lines.length) {
        const match = lines[index].match(pattern);
        if (!match) break;
        items.push(inline(match[1]));
        index += 1;
      }
      output.push(`<${tag}>${items.map(item => `<li>${item}</li>`).join("")}</${tag}>`);
      continue;
    }

    const paragraph = [line.trim()];
    index += 1;
    while (index < lines.length && lines[index].trim()) {
      const next = lines[index];
      if (
        openingFence(next) || /^(#{3,6})\s+/.test(next) || /^>\s?/.test(next) ||
        /^\s*[-+*]\s+/.test(next) || /^\s*\d+[.)]\s+/.test(next) ||
        (index + 1 < lines.length && next.includes("|") && isTableDivider(lines[index + 1]))
      ) break;
      paragraph.push(next.trim());
      index += 1;
    }
    const paragraphText = paragraph.join(" ");
    const paragraphClass = paragraphText.startsWith("图片来源：") ? ` class="figure-source"` : "";
    output.push(`<p${paragraphClass}>${inline(paragraphText)}</p>`);
  }

  return output.join("\n");
}

function splitChapter(markdown, fileIndex) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const h1 = lines.find(line => /^#\s+/.test(line))?.replace(/^#\s+/, "").trim() || `章节 ${fileIndex}`;
  const title = h1.replace(/^第[一二三四五六七八九十百\d]+周[：:]\s*/, "");
  const sections = [];
  let currentTitle = "";
  let currentLines = [];
  let fence = null;

  function commit() {
    if (!currentTitle) return;
    const content = currentLines.join("\n").trim();
    const shortTitle = currentTitle.replace(/^[一二三四五六七八九十百\d]+[、.．]\s*/, "");
    sections.push({
      title: currentTitle,
      shortTitle,
      html: markdownToHtml(content),
      text: `${currentTitle}\n${content}`.replace(/[`*_#[\]()>|~-]/g, " ").replace(/\s+/g, " ").trim()
    });
  }

  for (const line of lines.slice(1)) {
    if (fence) {
      if (closesFence(line, fence)) fence = null;
    } else {
      fence = openingFence(line);
    }
    if (!fence && /^##\s+/.test(line)) {
      commit();
      currentTitle = line.replace(/^##\s+/, "").trim();
      currentLines = [];
    } else if (currentTitle) {
      currentLines.push(line);
    }
  }
  commit();
  return { title, sourceTitle: h1, sections };
}

const chapters = Array.from({ length: 12 }, (_, index) => {
  const filename = `week${index + 1}.md`;
  return splitChapter(fs.readFileSync(path.join(sourceDir, filename), "utf8"), index + 1);
});

const payload = {
  title: "YatDS 人机协作课程讲义",
  generatedAt: new Date().toISOString(),
  chapters
};

const destination = path.join(websiteDir, "content.js");
const generatedContent = `window.LECTURE_DATA = ${JSON.stringify(payload)};\n`;
fs.writeFileSync(destination, generatedContent);

const indexPath = path.join(websiteDir, "index.html");
const indexHtml = fs.readFileSync(indexPath, "utf8");
const versionedIndexHtml = indexHtml.replace(
  /<script src="\.\/content\.js(?:\?v=[^"]*)?"><\/script>/,
  `<script src="./content.js?v=${contentHash(generatedContent)}"></script>`
);
if (versionedIndexHtml === indexHtml && !indexHtml.includes('<script src="./content.js?v=')) {
  throw new Error("Unable to find the content.js script tag in index.html");
}
fs.writeFileSync(indexPath, versionedIndexHtml);

console.log(`Generated ${destination}`);
console.log(`${chapters.length} chapters, ${chapters.reduce((sum, chapter) => sum + chapter.sections.length, 0)} content pages`);

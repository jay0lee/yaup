/**
 * YAUP - Lightweight, Safe Markdown Parser
 * Zero-dependency parser with built-in HTML entity escaping for XSS protection
 */

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function parseMarkdown(markdownText) {
  if (!markdownText) return "";

  // 1. Normalize line endings and escape HTML
  let src = escapeHtml(markdownText.replace(/\r\n/g, "\n"));

  // 2. Blockquotes
  src = src.replace(/^>\s?(.*)$/gm, "<blockquote>$1</blockquote>");

  // 3. Horizontal rules
  src = src.replace(/^---$/gm, "<hr />");

  // 4. Headers (# through ####)
  src = src.replace(/^#### (.*$)/gm, "<h4>$1</h4>");
  src = src.replace(/^### (.*$)/gm, "<h3>$1</h3>");
  src = src.replace(/^## (.*$)/gm, "<h2>$1</h2>");
  src = src.replace(/^# (.*$)/gm, "<h1>$1</h1>");

  // 5. Bold & Italic
  src = src.replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>");
  src = src.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  src = src.replace(/__(.*?)__/g, "<strong>$1</strong>");
  src = src.replace(/\*(.*?)\*/g, "<em>$1</em>");
  src = src.replace(/_(.*?)_/g, "<em>$1</em>");

  // 6. Links [text](url) - ensure only http, https, mailto
  src = src.replace(/\[(.*?)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // 7. Inline code
  src = src.replace(/`([^`]+)`/g, "<code>$1</code>");

  // 8. Lists (ordered and unordered)
  const lines = src.split("\n");
  const output = [];
  let inUl = false;
  let inOl = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const ulMatch = line.match(/^(\s*)[-*]\s+(.*)$/);
    const olMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);

    if (ulMatch) {
      if (!inUl) {
        if (inOl) { output.push("</ol>"); inOl = false; }
        output.push("<ul>");
        inUl = true;
      }
      output.push(`<li>${ulMatch[2]}</li>`);
    } else if (olMatch) {
      if (!inOl) {
        if (inUl) { output.push("</ul>"); inUl = false; }
        output.push("<ol>");
        inOl = true;
      }
      output.push(`<li>${olMatch[2]}</li>`);
    } else {
      if (inUl) { output.push("</ul>"); inUl = false; }
      if (inOl) { output.push("</ol>"); inOl = false; }

      // Check if heading or block tag
      if (line.match(/^<(h[1-4]|blockquote|hr|ul|ol)/i)) {
        output.push(line);
      } else if (line.trim().length > 0) {
        output.push(`<p>${line}</p>`);
      }
    }
  }

  if (inUl) output.push("</ul>");
  if (inOl) output.push("</ol>");

  return output.join("\n");
}

export const esc = (x) =>
  String(x ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]
  );

export function markdown(source) {
  const blocks = [],
    inline = [];
  let text = esc(String(source ?? '').replace(/\r\n?/g, '\n')).replace(
    /^[ \t]*```[^\n]*\n([\s\S]*?)^[ \t]*```[ \t]*$/gm,
    (_, code) => {
      blocks.push(
        `<pre class="article-code"><code>${code.replace(/\n$/, '')}</code></pre>`
      );
      return `@@CODE${blocks.length - 1}@@`;
    }
  );
  // Protect code spans before processing emphasis and links inside prose.
  text = text.replace(/`([^`\n]+)`/g, (_, code) => {
    inline.push(`<code>${code}</code>`);
    return `@@INLINE${inline.length - 1}@@`;
  });
  text = text
    .replace(
      /!\[([^\]]*)\]\((\/course-assets\/[\w.-]+)\)/g,
      '<figure><img src="$2" alt="$1" loading="lazy"><figcaption>$1</figcaption></figure>'
    )
    .replace(
      /\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1 ↗</a>'
    )
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  let html = '';
  const lists = [];
  const closeList = () => {
    const list = lists.pop();
    html += '</li></' + list.tag + '>';
  };
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const item = line.match(/^(\s*)([-*]|\d+\.) (.+)$/);
    if (item) {
      const indent = item[1].length,
        tag = /\d/.test(item[2]) ? 'ol' : 'ul';
      while (lists.length && lists.at(-1).indent > indent) closeList();
      if (
        lists.length &&
        lists.at(-1).indent === indent &&
        lists.at(-1).tag !== tag
      )
        closeList();
      if (!lists.length || lists.at(-1).indent < indent) {
        html += '<' + tag + '>';
        lists.push({ indent, tag });
      } else html += '</li>';
      html += '<li>' + item[3];
      continue;
    }
    while (lists.length) closeList();
    const h = line.match(/^(#{1,6}) (.+)$/);
    if (h) html += `<h${h[1].length}>${h[2]}</h${h[1].length}>`;
    else if (/^@@CODE\d+@@$/.test(line)) html += line;
    else if (line.startsWith('<figure>')) html += line;
    else if (/^---+$/.test(line.trim())) html += '<hr>';
    else html += `<p>${line}</p>`;
  }
  while (lists.length) closeList();
  return html
    .replace(/@@INLINE(\d+)@@/g, (match, i) => inline[+i] ?? match)
    .replace(/@@CODE(\d+)@@/g, (match, i) => blocks[+i] ?? match);
}

const TAGS = {
	'': ['<em>','</em>'],
	_: ['<strong>','</strong>'],
	'*': ['<strong>','</strong>'],
	'~': ['<s>','</s>'],
	'\n': ['<br />'],
	' ': ['<br />'],
	'-': ['<hr />']
};

/** Outdent a string based on the first indented line's leading whitespace
 *	@private
 */
function outdent(str) {
	return str.replace(RegExp('^'+(str.match(/^(\t| )+/) || '')[0], 'gm'), '');
}

/** Encode special attribute characters to HTML entities in a String.
 *	@private
 */
function encodeAttr(str) {
	return (str+'').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Split one table row into trimmed cell strings, dropping optional outer pipes.
 *	@private
 */
function rowCells(row) {
	return row.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
}

/** Parse Markdown into an HTML String. */
export default function snarkdown(md, prevLinks) {
	return parse(md, prevLinks);
}

function parse(md, prevLinks, nested) {
	let tokenizer = /((?:^|\n+)(?:\n---+|\* \*(?: \*)+)\n)|(?:^``` *(\w*)\n([\s\S]*?)\n```$)|((?:(?:^|\n+)(?:\t|  {2,}).+)+\n*)|((?:(?:^|\n)([>*+-]|\d+\.)\s+.*)+)|(?:!\[([^\]]*?)\]\(([^)]+?)\))|(\[)|(\](?:\(([^)]+?)\))?)|(?:(?:^|\n+)([^\s].*)\n(-{3,}|={3,})(?:\n+|$))|(?:(?:^|\n+)(#{1,6})\s*(.+)(?:\n+|$))|(?:`([^`].*?)`)|(  \n(?:[ \t]*\n)*|\n(?:[ \t]*\n)+|__|\*\*|[_*]|~~)|(?:^|\n+)([^\n]*\|[^\n]*\n)(\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?)\n?((?:[^\n]*\|[^\n]*\n?)*)|(\bhttps?:\/\/(?:&(?!quot;|lt;|gt;)|\](?!\()|[^\s<>"&\]])*[^\s<>"&.,:;!?')\]*_~])/gm,
		context = [],
		out = '',
		blocks = [],
		links = prevLinks || {},
		last = 0,
		chunk, prev, token, inner, t, kind;

	function tag(token) {
		let desc = TAGS[token[1] || ''];
		let end = context[context.length-1] == token;
		if (!desc) return token;
		if (!desc[1]) return desc[0];
		if (end) context.pop();
		else context.push(token);
		return desc[end|0];
	}

	function flush() {
		let str = '';
		while (context.length) str += tag(context[context.length-1]);
		return str;
	}

	function endParagraph() {
		out = (out + flush()).replace(/^\s+|\s+$/g, '');
		if (out) blocks.push([out, 1]);
		out = '';
	}

	md = md.replace(/^\[(.+?)\]:\s*(.+)$/gm, (s, name, url) => {
		links[name.toLowerCase()] = url;
		return '';
	}).replace(/^\n+|\n+$/g, '');

	while ( (token=tokenizer.exec(md)) ) {
		prev = md.substring(last, token.index);
		last = tokenizer.lastIndex;
		chunk = token[0];
		kind = 0;
		if (prev.match(/[^\\](\\\\)*\\$/)) {
			// escaped
		}
		// Code/Indent blocks:
		else if (t = (token[3] || token[4])) {
			chunk = '<pre class="code '+(token[4]?'poetry':token[2].toLowerCase())+'"><code'+(token[2] ? ` class="language-${token[2].toLowerCase()}"` : '')+'>'+outdent(encodeAttr(t).replace(/^\n+|\n+$/g, ''))+'</code></pre>';
			kind = 1;
		}
		// > Quotes, -* lists:
		else if (t = token[6]) {
			if (t.match(/\./)) {
				token[5] = token[5].replace(/^\d+/gm, '');
			}
			inner = parse(outdent(token[5].replace(/^\s*[>*+.-]/gm, '')), 0, 1);
			if (t=='>') t = 'blockquote';
			else {
				t = t.match(/\./) ? 'ol' : 'ul';
				inner = inner.replace(/^(.*)(\n|$)/gm, '<li>$1</li>');
			}
			chunk = '<'+t+'>' + inner + '</'+t+'>';
			kind = 1;
		}
		// Images:
		else if (token[8]) {
			chunk = `<img src="${encodeAttr(token[8])}" alt="${encodeAttr(token[7])}">`;
		}
		// Links:
		else if (token[10]) {
			out = out.replace('<a>', `<a href="${encodeAttr(token[11] || links[prev.toLowerCase()])}">`);
			chunk = flush() + '</a>';
		}
		else if (token[9]) {
			chunk = '<a>';
		}
		// Headings:
		else if (token[12] || token[14]) {
			t = 'h' + (token[14] ? token[14].length : (token[13]>'=' ? 1 : 2));
			chunk = '<'+t+'>' + parse(token[12] || token[15], links, 1) + '</'+t+'>';
			kind = 1;
		}
		// `code`:
		else if (token[16]) {
			chunk = '<code>'+encodeAttr(token[16])+'</code>';
		}
		// Blank line: paragraph break
		else if (!nested && /\n[ \t]*\n/.test(token[17])) {
			kind = 2;
		}
		// Inline formatting: *em*, **strong** & friends
		else if (token[17] || token[1]) {
			chunk = tag(token[17] || '--');
			kind = token[1] ? 1 : 0;
		}
		// Tables:
		else if (token[18]) {
			let rowHtml = (line, name) => '<tr>'+rowCells(line).map(c => '<'+name+'>'+parse(c, links, 1)+'</'+name+'>').join('')+'</tr>';
			chunk = '<table><thead>'+rowHtml(token[18], 'th')+'</thead><tbody>'+(token[20].match(/[^\n]+/g)||[]).map(line => rowHtml(line, 'td')).join('')+'</tbody></table>';
			kind = 1;
		}
		// Bare URLs, unless already inside a link's text:
		else if (token[21] && out.indexOf('<a>') < 0) {
			chunk = `<a href="${encodeAttr(token[21])}">${token[21]}</a>`;
		}
		out += prev;
		if (nested || !kind) {
			out += chunk;
		}
		else {
			endParagraph();
			if (kind==1) blocks.push([chunk]);
		}
	}

	out += md.substring(last);
	if (nested) return (out + flush()).replace(/^\n+|\n+$/g, '');

	endParagraph();
	return blocks.length==1 && blocks[0][1] ? blocks[0][0] : blocks.map(b => b[1] ? '<p>'+b[0]+'</p>' : b[0]).join('');
}

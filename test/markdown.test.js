import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractExecutableCommands, renderMarkdown } from '../index.js';

test('normalizes input and renders paragraphs with note-style line breaks', () => {
  assert.equal(renderMarkdown('hello world'), '<p>hello world</p>');
  assert.equal(renderMarkdown('line one\nline two'), '<p>line one<br>line two</p>');
  assert.equal(renderMarkdown('first\n\nsecond'), '<p>first</p>\n<p>second</p>');
  assert.equal(renderMarkdown('windows\r\nclassic\rnewlines'), '<p>windows<br>classic<br>newlines</p>');
  assert.equal(renderMarkdown(''), '');
  assert.equal(renderMarkdown(null), '');
  assert.equal(renderMarkdown(undefined), '');
  assert.equal(renderMarkdown(42), '<p>42</p>');
  assert.equal(renderMarkdown('a\u0000b'), '<p>ab</p>');
});

test('supports ATX and Setext headings', () => {
  assert.equal(renderMarkdown('# Title'), '<h1>Title</h1>');
  assert.equal(renderMarkdown('###### Deep'), '<h6>Deep</h6>');
  assert.equal(renderMarkdown('## Has **bold**'), '<h2>Has <strong>bold</strong></h2>');
  assert.equal(renderMarkdown('Title\n====='), '<h1>Title</h1>');
  assert.equal(renderMarkdown('Subtitle\n--------'), '<h2>Subtitle</h2>');
  assert.equal(renderMarkdown('####### text'), '<p>####### text</p>');
});

test('supports CommonMark emphasis, escapes, and code spans', () => {
  assert.equal(
    renderMarkdown('**bold** __strong__ *italic* _emphasis_'),
    '<p><strong>bold</strong> <strong>strong</strong> <em>italic</em> <em>emphasis</em></p>');
  assert.equal(renderMarkdown('***both***'), '<p><em><strong>both</strong></em></p>');
  assert.equal(renderMarkdown('\\*literal\\*'), '<p>*literal*</p>');
  assert.equal(renderMarkdown('run `npm start` now'), '<p>run <code>npm start</code> now</p>');
  assert.equal(renderMarkdown('`` a ` b ``'), '<p><code>a ` b</code></p>');
  assert.equal(renderMarkdown('`**not bold**`'), '<p><code>**not bold**</code></p>');
});

test('supports fenced and indented code blocks with escaped output', () => {
  assert.equal(
    renderMarkdown('```js\n<script>alert(1)</script>\n**literal**\n```'),
    '<pre><code class="language-js">&lt;script&gt;alert(1)&lt;/script&gt;\n**literal**\n</code></pre>');
  assert.equal(
    renderMarkdown('~~~ css extra\nbody { color: red; }\n~~~'),
    '<pre><code class="language-css">body { color: red; }\n</code></pre>');
  assert.equal(renderMarkdown('    <b>indented</b>'), '<pre><code>&lt;b&gt;indented&lt;/b&gt;\n</code></pre>');
  assert.equal(renderMarkdown('```\nunclosed'), '<pre><code>unclosed\n</code></pre>');
});

test('supports thematic breaks and hard line breaks', () => {
  assert.equal(renderMarkdown('before\n\n---\n\nafter'), '<p>before</p>\n<hr />\n<p>after</p>');
  assert.equal(renderMarkdown('one  \ntwo'), '<p>one<br />\ntwo</p>');
  assert.equal(renderMarkdown('one\\\ntwo'), '<p>one<br />\ntwo</p>');
});

test('supports block quotes, including nesting and multiple blocks', () => {
  assert.equal(renderMarkdown('> quoted'), '<blockquote>\n<p>quoted</p>\n</blockquote>');
  assert.equal(
    renderMarkdown('> outer\n>\n> > inner'),
    '<blockquote>\n<p>outer</p>\n<blockquote>\n<p>inner</p>\n</blockquote>\n</blockquote>');
  assert.equal(
    renderMarkdown('> first\n\ntext'),
    '<blockquote>\n<p>first</p>\n</blockquote>\n<p>text</p>');
});

test('supports loose, tight, ordered, and nested lists', () => {
  assert.equal(renderMarkdown('- one\n- two'), '<ul>\n<li>one</li>\n<li>two</li>\n</ul>');
  assert.equal(renderMarkdown('3. first\n4. second'), '<ol start="3">\n<li>first</li>\n<li>second</li>\n</ol>');
  assert.equal(
    renderMarkdown('- parent\n  - child\n  - child two'),
    '<ul>\n<li>parent\n<ul>\n<li>child</li>\n<li>child two</li>\n</ul>\n</li>\n</ul>');
  assert.equal(
    renderMarkdown('- first\n\n- second'),
    '<ul>\n<li>\n<p>first</p>\n</li>\n<li>\n<p>second</p>\n</li>\n</ul>');
});

test('supports inline links, titles, reference links, and autolinks', () => {
  assert.equal(
    renderMarkdown('[site](https://example.com)'),
    '<p><a href="https://example.com" rel="noopener noreferrer">site</a></p>');
  assert.equal(
    renderMarkdown('[site](https://example.com "Example")'),
    '<p><a href="https://example.com" title="Example" rel="noopener noreferrer">site</a></p>');
  assert.equal(
    renderMarkdown('[docs][guide]\n\n[guide]: https://example.com/docs "Guide"'),
    '<p><a href="https://example.com/docs" title="Guide" rel="noopener noreferrer">docs</a></p>');
  assert.equal(
    renderMarkdown('<https://example.com/a?b=1&c=2>'),
    '<p><a href="https://example.com/a?b=1&amp;c=2" rel="noopener noreferrer">https://example.com/a?b=1&amp;c=2</a></p>');
  assert.equal(
    renderMarkdown('<me@example.com>'),
    '<p><a href="mailto:me@example.com" rel="noopener noreferrer">me@example.com</a></p>');
});

test('unsafe and ambiguous links never create anchors', () => {
  for (const url of [
    'javascript:alert',
    'data:text/html,hello',
    'file:///etc/passwd',
    'vbscript:msgbox',
    '//evil.example/path',
    '/relative/path',
    '#fragment'
  ]) {
    const html = renderMarkdown(`[label](${url})`);
    assert.equal(html.includes('<a '), false, url);
    assert.equal(html, '<p>label</p>', url);
  }
  assert.equal(
    renderMarkdown('[x](javascript&#x3A;alert)'),
    '<p>x</p>');
});

test('renders safe images and suppresses request-capable unsafe images', () => {
  assert.equal(
    renderMarkdown('![alt *text*](https://example.com/image.png "Image")'),
    '<p><img src="https://example.com/image.png" alt="alt text" title="Image" /></p>');
  assert.equal(renderMarkdown('![alt](javascript:alert)'), '<p>alt</p>');
  assert.equal(renderMarkdown('![alt](data:image/png;base64,AAAA)'), '<p>alt</p>');
  assert.equal(renderMarkdown('![alt](/relative.png)'), '<p>alt</p>');
});

test('raw HTML is escaped in inline and block contexts', () => {
  assert.equal(
    renderMarkdown('<script>alert("xss")</script>'),
    '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  assert.equal(
    renderMarkdown('before <img src=x onerror=alert(1)> after'),
    '<p>before &lt;img src=x onerror=alert(1)&gt; after</p>');
  assert.equal(
    renderMarkdown('<div>\n**not parsed inside HTML**\n</div>'),
    '&lt;div&gt;\n**not parsed inside HTML**\n&lt;/div&gt;');
});

test('escapes text and attributes exactly once', () => {
  assert.equal(renderMarkdown('a & "b" <c>'), '<p>a &amp; &quot;b&quot; &lt;c&gt;</p>');
  assert.equal(renderMarkdown('&copy; &#169; &#xA9;'), '<p>© © ©</p>');
  assert.equal(
    renderMarkdown('[x](https://example.com/?a=1&b=2 "A & B")'),
    '<p><a href="https://example.com/?a=1&amp;b=2" title="A &amp; B" rel="noopener noreferrer">x</a></p>');
});

test('marks e fences and extracts only their shell commands', () => {
  const source = [
    '```e',
    'printf "first"',
    '```',
    '',
    '```js',
    'console.log("not executable");',
    '```',
    '',
    '~~~e label',
    'printf "second"',
    '~~~'
  ].join('\n');
  assert.deepEqual(extractExecutableCommands(source), ['printf "first"\n', 'printf "second"\n']);
  assert.match(renderMarkdown(source), /<pre data-executable="true"><code class="language-e">printf/);
  assert.equal((renderMarkdown(source).match(/data-executable="true"/g) ?? []).length, 2);
});

test('handles Unicode without splitting or normalizing user text', () => {
  assert.equal(renderMarkdown('こんにちは 👩🏽‍💻 café'), '<p>こんにちは 👩🏽‍💻 café</p>');
  assert.equal(renderMarkdown('# Привет\n\nمرحبا'), '<h1>Привет</h1>\n<p>مرحبا</p>');
});

test('handles long documents deterministically without shared renderer state', () => {
  const source = Array.from({ length: 500 }, (_, index) => `## Section ${index}\n\n- item ${index}\n- **bold ${index}**`).join('\n\n');
  const first = renderMarkdown(source);
  const second = renderMarkdown(source);
  assert.equal(second, first);
  assert.match(first, /^<h2>Section 0<\/h2>/);
  assert.match(first, /<h2>Section 499<\/h2>/);
  assert.equal((first.match(/<h2>/g) ?? []).length, 500);
});

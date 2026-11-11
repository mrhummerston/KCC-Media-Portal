/* =====================================================================
   KCC PAGE EDITOR v2  (teacher edit mode)
   ---------------------------------------------------------------------
   - Students never see any of this. It switches on only after the teacher
     signs in through the footer link (#teachLink).
   - Edits are a small list saved to edits.js. Pictures and files the teacher
     drops in are saved as separate files in an "uploads" folder. "Save"
     makes a bundle (.zip) holding both. Upload them to GitHub next to the
     page and commit.
   - Page contract (what a page must do): see DEVELOPER-SUMMARY.md.
       KCCEdit.after(viewKey, rootEl, {container: '#main-grid'})  after drawing a view
       KCCEdit.ready()                                            once, at start-up
       window.route()                                             redraws the current view
   ===================================================================== */
(function () {
  'use strict';
  var CFG = window.KCC_EDIT_CFG || {};
  var DRAFT_KEY = CFG.draft || 'kcc-page-edits-draft', FLAG = CFG.flag || 'kcc-teacher', EDIT_FLAG = CFG.editFlag || 'kcc-editing';
  var EDITS_VAR = CFG.editsVar || 'PAGE_EDITS', EDITS_FILE = CFG.file || 'edits.js', UPLOADS = (CFG.uploads || 'uploads/').replace(/\/?$/, '/');
  var PASSWORD = CFG.password || 'Media123', PASSWORD_HASH = CFG.passwordHash || '';
  var TEXT_SEL = 'h1,h2,h3,h4,p,li,figcaption,td,summary,blockquote,.badge,.kb-btn';
  var BLOCK_SEL = '.kb,.panel,.fig,.tile,.tip,.folio-box,.idea,.visual,.head,ol.steps>li,ul.plain>li,ul.chips>li,ul.stops>li,ul.triangle>li,ul.checks>li';
  var UI_SEL = '#kbTop,#kbChip,#kbBar,#kbPop,#kbAdd,#kbFab,#kbModal,#kbDrop,#kbLine,#kbToast,#kbHint,#kbRz,.kb-ui';
  var SKIP = '.qcard,.slot,.fields,dialog,.topbar,.foot,.printdoc,.fb,.qsum,.state,.err,.busy,.back,.opts,[data-noedit],' + UI_SEL;
  /* text elements inside blocks the teacher added: these become editable */
  var ADDED_TEXT = 'h1,h2,h3,h4,p,blockquote,figcaption,.kb-sum,.kb-btn,ul,ol,.kb-term,.kb-def,.kb-who,th,td';

  var FONTS = [['Page default', ''], ['Atkinson Hyperlegible', '"Atkinson Hyperlegible","Segoe UI",sans-serif'], ['Bricolage Grotesque', '"Bricolage Grotesque","Segoe UI",sans-serif'],
    ['Inter', '"Inter",system-ui,sans-serif'], ['Open Sans', '"Open Sans",system-ui,sans-serif'], ['Roboto', '"Roboto",system-ui,sans-serif'], ['Lexend (easy to read)', '"Lexend",system-ui,sans-serif'],
    ['Playfair Display', '"Playfair Display",Georgia,serif'], ['Georgia', 'Georgia,serif'], ['Segoe UI', '"Segoe UI",system-ui,sans-serif'], ['Arial', 'Arial,Helvetica,sans-serif'],
    ['Verdana', 'Verdana,Geneva,sans-serif'], ['Trebuchet MS', '"Trebuchet MS",sans-serif'], ['Comic Neue', '"Comic Neue","Comic Sans MS",cursive'], ['Comic Sans MS', '"Comic Sans MS","Comic Sans",cursive'],
    ['Times New Roman', '"Times New Roman",Times,serif'], ['Courier New', '"Courier New",monospace']];
  var PALETTES = [
    { id: 'ocean', name: 'Ocean', accent: '#2b5be0', hover: '#1e45b8', tint: '#e8eefc' },
    { id: 'coral', name: 'Coral', accent: '#e5484d', hover: '#c93338', tint: '#fdeced' },
    { id: 'forest', name: 'Forest', accent: '#1f8a57', hover: '#166b43', tint: '#e4f5ec' },
    { id: 'grape', name: 'Grape', accent: '#7a4fd6', hover: '#6139b8', tint: '#f1e8ff' },
    { id: 'sun', name: 'Sunshine', accent: '#d98a00', hover: '#b27100', tint: '#fff3d6' },
    { id: 'slate', name: 'Slate', accent: '#334155', hover: '#1e293b', tint: '#e9edf2' }];
  var PAIRS = [
    { id: 'modern', name: 'Modern', display: '"Bricolage Grotesque","Segoe UI",sans-serif', body: '"Atkinson Hyperlegible","Segoe UI",sans-serif' },
    { id: 'clean', name: 'Clean', display: '"Inter",system-ui,sans-serif', body: '"Inter",system-ui,sans-serif' },
    { id: 'classic', name: 'Classic', display: '"Playfair Display",Georgia,serif', body: '"Open Sans",system-ui,sans-serif' },
    { id: 'friendly', name: 'Friendly', display: '"Lexend",system-ui,sans-serif', body: '"Lexend",system-ui,sans-serif' },
    { id: 'playful', name: 'Playful', display: '"Comic Neue","Comic Sans MS",cursive', body: '"Open Sans",system-ui,sans-serif' }];
  var SWATCH = ['#111827', '#4b5563', '#9ca3af', '#ffffff', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];
  var FILLS = ['#ffffff', '#f3f4f6', '#fff1a8', '#ffe3de', '#dcfce7', '#dbeafe', '#ede9fe', '#fce7f3', '#111827', '#2b5be0'];

  function q(s, r) { return (r || document).querySelector(s); }
  function qa(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function blank() { return { v: 2, text: {}, style: {}, block: {}, order: {}, hide: {}, cols: {}, add: {}, global: {}, move: {} }; }
  function norm(e) { var b = blank(); if (e && typeof e === 'object') Object.keys(b).forEach(function (k) { if (k !== 'v' && e[k] !== undefined && e[k] !== null) b[k] = e[k]; }); return b; }
  function copy(e) { return norm(JSON.parse(JSON.stringify(e))); }
  function snap(e) { return JSON.parse(JSON.stringify(e)); }
  function nf(s) { return String(s || '').replace(/["'\s]/g, '').toLowerCase(); }
  function fontVal(v) { for (var i = 0; i < FONTS.length; i++) if (nf(FONTS[i][1]) === nf(v)) return FONTS[i][1]; return ''; }
  function slug(s) { return String(s || '').toLowerCase().replace(/<[^>]*>/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 36); }
  var idN = 0;
  function newId() { return 'add-' + Date.now().toString(36) + (++idN).toString(36) + Math.random().toString(36).slice(2, 5); }
  function rgbToHex(rgb) { var m = String(rgb).match(/\d+/g); if (!m) return '#000000'; return '#' + m.slice(0, 3).map(function (n) { return ('0' + (+n).toString(16)).slice(-2); }).join(''); }
  function toHex(c) { if (!c || c === 'transparent' || /rgba\(.*,\s*0\)/.test(c)) return '#ffffff'; return /^#[0-9a-f]{6}$/i.test(c) ? c : rgbToHex(c); }
  function fmtSize(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }

  /* ---------- state ---------- */
  var pub = norm(window[EDITS_VAR]);
  var teacher = false, editing = false;
  try { teacher = sessionStorage.getItem(FLAG) === '1'; editing = teacher && sessionStorage.getItem(EDIT_FLAG) === '1'; } catch (e) {}
  var E = pub;
  if (teacher) { try { var dr = localStorage.getItem(DRAFT_KEY); E = dr ? norm(JSON.parse(dr)) : copy(pub); } catch (e) { E = copy(pub); } }
  var hist = [snap(E)], redo = [], sel = null, curView = null, curRoot = null, mainC = null, dragEl = null, presenting = false, draftWarned = false, freeMode = false;

  /* ---------- safe HTML (the only iframes allowed are YouTube, privacy mode) ---------- */
  var YT = /^https:\/\/www\.youtube-nocookie\.com\/embed\/[A-Za-z0-9_-]{6,15}(\?[A-Za-z0-9=&_%-]*)?$/;
  function clean(html) {
    var t = document.createElement('template'); t.innerHTML = String(html || '');
    qa('script,object,embed,style,link,meta,form,input,textarea,select,button,base', t.content).forEach(function (n) { n.remove(); });
    qa('iframe', t.content).forEach(function (f) {
      if (!YT.test(f.getAttribute('src') || '')) { f.remove(); return; }
      Array.prototype.slice.call(f.attributes).forEach(function (a) { if (['src', 'title', 'allow', 'allowfullscreen', 'loading', 'referrerpolicy', 'class'].indexOf(a.name) < 0) f.removeAttribute(a.name); });
    });
    qa('*', t.content).forEach(function (n) {
      Array.prototype.slice.call(n.attributes).forEach(function (a) {
        var nm = a.name.toLowerCase();
        if (nm.slice(0, 2) === 'on' || nm === 'srcdoc' || ((nm === 'href' || nm === 'src' || nm === 'xlink:href') && /^\s*(javascript|data:text|vbscript):/i.test(a.value))) n.removeAttribute(a.name);
      });
    });
    return t.innerHTML;
  }

  /* ---------- whole-page design: palette, fonts, roundness, spacing, text size ---------- */
  function applyGlobal() {
    var g = E.global || {}, st = document.documentElement.style;
    function set(k, v) { if (v) st.setProperty(k, v); else st.removeProperty(k); }
    var pal = PALETTES.filter(function (p) { return p.id === g.pal; })[0];
    set('--accent', pal ? pal.accent : ''); set('--accent-hover', pal ? pal.hover : ''); set('--kb-tint', pal ? pal.tint : '');
    set('--body', g.body); set('--display', g.display);
    set('--kb-radius', g.radius != null ? g.radius + 'px' : ''); set('--kb-gap', g.gap != null ? g.gap + 'px' : '');
    st.fontSize = g.scale && g.scale !== 100 ? g.scale + '%' : '';
  }
  applyGlobal();

  /* ---------- naming every piece so edits can find it again ---------- */
  function blockBase(el) {
    var im = el.matches('.fig') ? el.querySelector('img[data-img]') : null;
    if (im) return 'fig:' + im.getAttribute('data-img');
    if (el.matches('.tile')) return 'tile:' + (el.getAttribute('href') || '').replace('#unit/', '');
    var h = el.querySelector('h1,h2,h3');
    if (el.matches('.panel,.kb')) return 'panel:' + slug((h && h.textContent) || el.textContent.slice(0, 30));
    return el.tagName.toLowerCase() + ':' + slug(el.textContent.slice(0, 40));
  }
  function usedKeys() {
    var u = {};
    qa('[data-kb],[data-kt],[data-kc]').forEach(function (n) { ['data-kb', 'data-kt', 'data-kc'].forEach(function (a) { var v = n.getAttribute(a); if (v) u[v] = 1; }); });
    return u;
  }
  function tagAll(root, vk, blocks, container) {
    var u = usedKeys();
    function mk(base) { var k = base, n = 1; while (u[k]) { n++; k = base + '~' + n; } u[k] = 1; return k; }
    if (blocks) {
      qa(BLOCK_SEL, root).forEach(function (el) {
        if (el.hasAttribute('data-kb') || el.closest(SKIP)) return;
        el.setAttribute('data-kb', mk(vk + '|b|' + blockBase(el)));
      });
      qa('[data-kb]', root).forEach(function (el) {
        var p = el.parentElement; if (!p || p.hasAttribute('data-kc')) return;
        var anc = p.closest('[data-kb]');
        p.setAttribute('data-kc', mk(vk + '|c|' + (p.id || (p.className && String(p.className).split(' ')[0]) || p.tagName.toLowerCase()) + '|' + (anc ? anc.getAttribute('data-kb') : '-')));
      });
      if (container) {
        var m = root.matches && root.matches(container) ? root : q(container, root);
        if (m && !m.hasAttribute('data-kc')) m.setAttribute('data-kc', mk(vk + '|c|' + (m.id || 'main') + '|-'));
        mainC = m || mainC;
      }
      qa('[data-kb]', root).forEach(function (el) { if (el.__home === undefined) el.__home = el.parentElement ? el.parentElement.getAttribute('data-kc') : null; });
    }
    qa(TEXT_SEL, root).forEach(function (el) {
      if (el.hasAttribute('data-kt') || el.closest(SKIP) || el.closest('[data-added]')) return;
      if (!el.textContent.trim() || el.querySelector(TEXT_SEL)) return;
      el.setAttribute('data-kt', mk(vk + '|t|' + el.tagName.toLowerCase() + ':' + slug(el.textContent)));
      el.__orig = el.innerHTML;
    });
  }

  /* ---------- putting the edits onto the page ---------- */
  var STYLE_PROPS = { ff: 'fontFamily', fs: 'fontSize', c: 'color', fw: 'fontWeight', fi: 'fontStyle', td: 'textDecoration', ta: 'textAlign', lh: 'lineHeight', tr: 'transform' };
  var SHADOW = { soft: '0 6px 20px rgba(15,23,42,.10)', lift: '0 16px 44px rgba(15,23,42,.22)' };
  function setTextStyle(el, s) { Object.keys(STYLE_PROPS).forEach(function (k) { el.style[STYLE_PROPS[k]] = (s && s[k]) || ''; }); }
  function readTextStyle(el) { var o = {}; Object.keys(STYLE_PROPS).forEach(function (k) { var v = el.style[STYLE_PROPS[k]]; if (v) o[k] = v; }); return o; }
  function figTarget(el) {
    if (!el || !el.matches) return null;
    if (el.matches('.fig')) return el;
    return el.getAttribute('data-added') === 'pic' ? q('.fig', el) : null;
  }
  function applyImg(im, o) {
    o = o || {};
    im.style.aspectRatio = o.ar || ''; im.style.objectFit = o.ar || o.fit ? (o.fit || 'cover') : ''; im.style.objectPosition = o.pos || '';
    if (o.ar) { im.style.width = '100%'; im.style.height = 'auto'; } else { im.style.height = ''; if (im.style.width === '100%') im.style.width = ''; }
    if (o.alt !== undefined) im.setAttribute('alt', o.alt);
  }
  function readImg(im) { var o = {}; if (im.style.aspectRatio) o.ar = im.style.aspectRatio.replace(/\s/g, ''); if (im.style.objectFit) o.fit = im.style.objectFit; if (im.style.objectPosition) o.pos = im.style.objectPosition; if (im.getAttribute('alt')) o.alt = im.getAttribute('alt'); return o; }
  function applyBlock(el, b) {
    b = b || {}; var s = el.style;
    function put(prop, v) { if (v === undefined || v === null || v === '') s.removeProperty(prop); else s.setProperty(prop, v); }
    if (!el.hasAttribute('data-kt')) { if (b.tr) { s.transform = b.tr; el.setAttribute('data-kfree', '1'); } else if (el.hasAttribute('data-kfree')) { s.transform = ''; el.removeAttribute('data-kfree'); } }
    s.gridColumn = b.span ? (b.span === 'full' ? '1 / -1' : 'span ' + b.span) : '';
    put('background', b.bg);
    if (b.bdw !== undefined || b.bd) { var w = b.bdw === undefined ? 2 : b.bdw; s.borderStyle = w ? 'solid' : 'none'; s.borderWidth = w ? w + 'px' : ''; if (b.bd) s.borderColor = b.bd; }
    else { s.removeProperty('border-style'); s.removeProperty('border-width'); s.removeProperty('border-color'); }
    put('opacity', b.op); put('border-radius', b.rad === 'full' ? '999px' : (b.rad != null ? b.rad + 'px' : '')); put('box-shadow', b.sh ? SHADOW[b.sh] : '');
    put('padding', b.pad != null ? b.pad + 'px' : '');
    var fg = figTarget(el);
    if (!fg) { put('width', b.bw ? b.bw + 'px' : ''); put('max-width', b.bw ? '100%' : ''); put('min-height', b.bh ? b.bh + 'px' : ''); }
    if (b.al) { s.marginLeft = b.al === 'left' ? '0' : 'auto'; s.marginRight = b.al === 'right' ? '0' : 'auto'; } else if (!fg) { s.marginLeft = ''; s.marginRight = ''; }
    if (fg) {
      fg.style.width = b.w ? b.w + 'px' : ''; fg.style.maxWidth = b.w ? '100%' : '';
      fg.style.marginLeft = b.align === 'center' || b.align === 'right' ? 'auto' : (b.align === 'left' ? '0' : '');
      fg.style.marginRight = b.align === 'center' || b.align === 'left' ? 'auto' : (b.align === 'right' ? '0' : '');
      var im = q('img', fg); if (im) { if (b.src) im.src = b.src; if (b.img) applyImg(im, b.img); }
    }
  }
  function buildAdded(rec) {
    var el, im, cap;
    if (rec.type === 'li') { el = document.createElement('li'); el.innerHTML = clean(rec.html); }
    else if (rec.type === 'pic' || rec.type === 'fig') {
      var fig = '<figure class="fig' + (rec.type === 'pic' ? ' center' : '') + '"><img alt=""><figcaption></figcaption></figure>';
      if (rec.type === 'pic') { el = document.createElement('section'); el.className = 'panel wide'; el.innerHTML = fig; }
      else { el = document.createElement('div'); el.innerHTML = fig; el = el.firstChild; }
      im = q('img', el); im.src = rec.src || ''; cap = q('figcaption', el); cap.innerHTML = clean(rec.cap || 'Type a caption');
    } else {
      el = document.createElement('section'); var c = rec.cls || '';
      el.className = /(^|\s)kb(\s|$)/.test(c) ? c : 'panel c' + (c ? ' ' + c : ''); el.innerHTML = clean(rec.html);
      qa('[data-slot]', el).forEach(function (s) { s.setAttribute('data-kc', rec.id + '#' + s.getAttribute('data-slot')); });
    }
    el.setAttribute('data-kb', rec.id); el.setAttribute('data-added', rec.type); el.setAttribute('data-aid', rec.id);
    return el;
  }
  function blockKids(c) { return Array.prototype.slice.call(c.children).filter(function (k) { return k.hasAttribute('data-kb'); }); }
  function reorder(c, keys) {
    var kids = Array.prototype.slice.call(c.children), idx = [];
    kids.forEach(function (k, i) { if (k.hasAttribute('data-kb')) idx.push(i); });
    var blocks = idx.map(function (i) { return kids[i]; });
    var sorted = blocks.slice().sort(function (a, b) {
      var ia = keys.indexOf(a.getAttribute('data-kb')), ib = keys.indexOf(b.getAttribute('data-kb'));
      if (ia < 0) ia = 1e6 + blocks.indexOf(a); if (ib < 0) ib = 1e6 + blocks.indexOf(b); return ia - ib;
    });
    var out = kids.slice(); idx.forEach(function (pos, n) { out[pos] = sorted[n]; });
    out.forEach(function (k) { c.appendChild(k); });
  }
  function recordOrder(c) { E.order[c.getAttribute('data-kc')] = blockKids(c).map(function (k) { return k.getAttribute('data-kb'); }); }
  function findContainer(key, root) { if (!key) return null; return qa('[data-kc]', root || document).filter(function (c) { return c.getAttribute('data-kc') === key; })[0] || null; }
  function applyAll(root) {
    var seen = [], rounds = 0;
    function pending() { var all = qa('[data-kc]', root); if (root.hasAttribute && root.hasAttribute('data-kc') && all.indexOf(root) < 0) all.push(root); return all.filter(function (c) { return seen.indexOf(c) < 0; }); }
    var cs = pending();
    while (cs.length && rounds++ < 10) {
      cs.forEach(function (c) {
        seen.push(c);
        (E.add[c.getAttribute('data-kc')] || []).forEach(function (rec) {
          var have = Array.prototype.slice.call(c.children).some(function (k) { return k.getAttribute('data-aid') === rec.id; });
          if (!have) c.appendChild(buildAdded(rec));
        });
      });
      cs = pending();
    }
    qa('[data-kb]', root).forEach(function (el) {
      var to = E.move[el.getAttribute('data-kb')]; if (!to) return;
      var tc = findContainer(to, root); if (tc && !el.contains(tc) && el.parentElement !== tc) tc.appendChild(el);
    });
    qa('[data-kt]', root).forEach(function (el) {
      var k = el.getAttribute('data-kt');
      if (E.text[k] !== undefined) el.innerHTML = clean(E.text[k]); else if (el.__orig !== undefined && el.innerHTML !== el.__orig) el.innerHTML = el.__orig;
      setTextStyle(el, E.style[k]);
      if (E.style[k] && E.style[k].tr) el.setAttribute('data-kfree', '1'); else el.removeAttribute('data-kfree');
    });
    qa('[data-kb]', root).forEach(function (el) {
      var k = el.getAttribute('data-kb'); applyBlock(el, E.block[k]); el.classList.toggle('ed-hidden', !!E.hide[k]);
    });
    var all = qa('[data-kc]', root); if (root.hasAttribute && root.hasAttribute('data-kc') && all.indexOf(root) < 0) all.push(root);
    all.forEach(function (c) {
      var ck = c.getAttribute('data-kc'); if (E.order[ck]) reorder(c, E.order[ck]);
      var n = E.cols[ck]; c.style.gridTemplateColumns = n ? 'repeat(' + n + ',minmax(0,1fr))' : '';
    });
  }
  /* a design block with nothing in it is invisible to students (teachers still see it) */
  function markEmptyDesigns(root) { qa('.kb-d', root).forEach(function (d) { d.classList.toggle('kb-d-empty', !q('.kb-slot > [data-kb]', d) && !q('.kb-herobg-img', d)); }); }

  /* ---------- called by the page after it draws something ---------- */
  function after(viewKey, root, opts) {
    var blocks = !(opts && opts.blocks === false);
    curView = viewKey; curRoot = root; mainC = null; deselect();
    tagAll(root, viewKey, blocks, opts && opts.container);
    applyAll(root); markEmptyDesigns(root); if (document.body.classList.contains('kb-arrange') && typeof labelAll === 'function') labelAll();
    if (teacher) resolveAssets(root);
    if (editing) decorate(root); else undecorate(root);
    if (editing) place();
  }
  function focusView(viewKey, root) { curView = viewKey; curRoot = root; deselect(); if (editing) decorate(root); else undecorate(root); }
  function undecorate(root) { qa('[contenteditable]', root).forEach(function (n) { n.removeAttribute('contenteditable'); n.removeAttribute('spellcheck'); }); }
  function decorate(root) {
    qa('[data-kt]', root).forEach(function (el) { el.setAttribute('contenteditable', 'true'); el.setAttribute('spellcheck', 'false'); });
    var addedBlocks = qa('[data-added]', root); if (root.hasAttribute && root.hasAttribute('data-added')) addedBlocks.unshift(root);
    addedBlocks.forEach(function (b) {
      if (b.getAttribute('data-added') === 'li') { b.setAttribute('contenteditable', 'true'); return; }
      qa(ADDED_TEXT, b).forEach(function (t) {
        if (t.parentElement && t.parentElement.closest('[contenteditable="true"]')) return;
        t.setAttribute('contenteditable', 'true'); t.setAttribute('spellcheck', 'false');
      });
    });
    qa('img', root).forEach(function (i) { i.draggable = false; });
    qa('a', root).forEach(function (a) { a.draggable = false; });
  }

  /* ---------- changes, undo and the draft ---------- */
  var draftT = null;
  function sizeKB() { return Math.round(JSON.stringify(pruned()).length / 1024 * 10) / 10; }
  function changedFromPublished() { return JSON.stringify(pruned()) !== JSON.stringify(pruneOf(pub)); }
  function saveDraft() {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(E)); draftWarned = false; }
    catch (e) { if (!draftWarned) { draftWarned = true; toast('Your changes are too big to keep as a draft. Press Save now so you do not lose them.'); } }
    status();
  }
  function dirty() { clearTimeout(draftT); draftT = setTimeout(saveDraft, 300); status(); if (typeof scheduleOutline === 'function') scheduleOutline(); }
  function commit() { if (JSON.stringify(E) === JSON.stringify(hist[hist.length - 1])) { dirty(); return; } hist.push(snap(E)); if (hist.length > 60) hist.shift(); redo = []; dirty(); histBtns(); }
  function rerender() {
    deselect();
    if (curView === 'folio') { saveDraft(); location.reload(); return; }
    var y = window.scrollY; if (window.route) window.route(); window.scrollTo(0, y); applyGlobal(); status(); histBtns();
  }
  function undo() { commit(); if (hist.length < 2) return; redo.push(hist.pop()); E = norm(snap(hist[hist.length - 1])); dirty(); applyGlobal(); rerender(); }
  function redoIt() { if (!redo.length) return; var s = redo.pop(); hist.push(s); E = norm(snap(s)); dirty(); applyGlobal(); rerender(); }
  function pruneOf(e) {
    var o = copy(e);
    ['text', 'style', 'block', 'order', 'hide', 'cols', 'add', 'global', 'move'].forEach(function (k) {
      Object.keys(o[k]).forEach(function (x) { var v = o[k][x]; if (v === undefined || v === null || (typeof v === 'object' && !Object.keys(v).length)) delete o[k][x]; });
    });
    Object.keys(o.add).forEach(function (ck) { if (!o.add[ck].length) delete o.add[ck]; });
    return o;
  }
  function pruned() { return pruneOf(E); }

  /* ---------- selection ---------- */
  function textOf(el) { return el && el.closest ? el.closest('[contenteditable="true"]') : null; }
  function blockOf(el) { return el && el.closest ? el.closest('[data-kb]') : null; }
  function select(el) {
    var pb = selBlock();
    if (sel) sel.classList.remove('ed-sel');
    sel = el; if (sel) sel.classList.add('ed-sel');
    if (selBlock() !== pb) { freeMode = false; closePop(); }
    refresh();
  }
  function deselect() { select(null); }
  function selBlock() { return sel ? (sel.hasAttribute('data-kb') ? sel : blockOf(sel)) : null; }
  function selText() { return sel && sel.getAttribute && sel.getAttribute('contenteditable') === 'true' ? sel : null; }
  function selImg() {
    if (!sel) return null; if (sel.tagName === 'IMG') return sel;
    var b = selBlock(); if (b && sel === b && b.matches('.fig')) return q('img', b); return null;
  }
  function textTargets() {
    if (!sel) return [];
    if (selText()) return [sel];
    return qa('[contenteditable="true"]', sel).filter(function (n) { return !n.parentElement.closest('[contenteditable="true"]') || n.matches('[data-kt]'); });
  }
  function containerOf() { var b = selBlock(); var c = b ? b.parentElement : (sel && sel.hasAttribute && sel.hasAttribute('data-kc') ? sel : null); return c && c.hasAttribute('data-kc') ? c : mainC; }
  function blk(k) { return E.block[k] || (E.block[k] = {}); }
  function recFor(block) {
    var id = block.getAttribute('data-aid'), found = null;
    Object.keys(E.add).forEach(function (ck) { E.add[ck].forEach(function (r) { if (r.id === id) found = r; }); });
    return found;
  }

  /* ---------- keeping what was typed ---------- */
  function normSlides(c) { qa('.kb-slides-stage img', c).forEach(function (im, i) { if (i) im.setAttribute('hidden', ''); else im.removeAttribute('hidden'); }); var n = q('.kb-count', c); if (n) n.textContent = '1 / ' + qa('.kb-slides-stage img', c).length; }
  function stripDeco(node) {
    var c = node.cloneNode(true);
    [c].concat(qa('*', c)).forEach(function (n) {
      ['contenteditable', 'spellcheck', 'draggable', 'data-kt', 'data-kb', 'data-kc', 'data-added', 'data-aid'].forEach(function (a) { n.removeAttribute(a); });
      n.classList && n.classList.remove('ed-sel', 'ed-hidden', 'ed-drop');
    });
    qa('[data-path]', c).forEach(function (i) { var p = i.getAttribute('data-path'); if (/^(IMG|VIDEO|SOURCE)$/.test(i.tagName)) i.setAttribute('src', p); else i.setAttribute('href', p); i.removeAttribute('data-path'); });
    qa('[data-slot]', c).forEach(function (s) { s.innerHTML = ''; });
    qa('.kb-d-empty', c).forEach(function (d) { d.classList.remove('kb-d-empty'); });
    qa('.kb-slides', c).forEach(normSlides);
    return c;
  }
  function saveAdded(block) {
    var rec = recFor(block); if (!rec) return;
    var c = stripDeco(block);
    if (rec.type === 'li' || rec.type === 'panel') rec.html = clean(c.innerHTML);
    else { var cap = q('figcaption', c); rec.cap = cap ? clean(cap.innerHTML) : ''; }
    dirty();
  }
  function persistText(el) {
    var added = el.closest('[data-added]');
    if (added && !el.hasAttribute('data-kt')) { saveAdded(added); return; }
    var k = el.getAttribute('data-kt'), s = readTextStyle(el);
    if (Object.keys(s).length) E.style[k] = s; else delete E.style[k];
    var html = clean(el.innerHTML);
    if (el.__orig !== undefined && html === clean(el.__orig)) delete E.text[k]; else E.text[k] = html;
    dirty();
  }
  function patchStyle(patch) {
    textTargets().forEach(function (el) {
      Object.keys(patch).forEach(function (k) { el.style[STYLE_PROPS[k]] = patch[k] || ''; });
      persistText(el);
    });
    commit(); refresh(); fitBlock();
  }
  function fmt(kind) {
    var s = window.getSelection(), t = selText();
    if (t && s && s.rangeCount && !s.isCollapsed && t.contains(s.anchorNode) && document.execCommand) {
      document.execCommand(kind === 'b' ? 'bold' : kind === 'i' ? 'italic' : 'underline'); persistText(t); commit(); return;
    }
    var tt = textTargets()[0]; if (!tt) return; var cs = getComputedStyle(tt);
    if (kind === 'b') patchStyle({ fw: parseInt(cs.fontWeight, 10) >= 600 ? '400' : '700' });
    if (kind === 'i') patchStyle({ fi: cs.fontStyle === 'italic' ? 'normal' : 'italic' });
    if (kind === 'u') patchStyle({ td: /underline/.test(cs.textDecorationLine || cs.textDecoration) ? 'none' : 'underline' });
  }
  function fitBlock() { /* blocks grow with their text; nothing to measure */ place(); }
  document.addEventListener('input', function (e) {
    if (!editing) return;
    var el = e.target.closest && e.target.closest('[contenteditable="true"]'); if (!el) return;
    if (el.hasAttribute('data-kt')) persistText(el); else { var b = el.closest('[data-added]'); if (b) saveAdded(b); }
    place();
  });
  document.addEventListener('focusout', function (e) { if (!editing) return; var el = e.target.closest && e.target.closest('[contenteditable="true"]'); if (el) commit(); });
  document.addEventListener('paste', function (e) {
    if (!editing || !(e.target.closest && e.target.closest('[contenteditable="true"]'))) return;
    var cd = e.clipboardData || window.clipboardData; if (cd && cd.files && cd.files.length) return;
    e.preventDefault(); var t = cd.getData('text/plain'); document.execCommand && document.execCommand('insertText', false, t);
  });

  /* ---------- block operations ---------- */
  function setBlock(patch, done) {
    var b = selBlock(); if (!b) return; var k = b.getAttribute('data-kb'), r = blk(k);
    Object.keys(patch).forEach(function (x) { if (patch[x] === null || patch[x] === undefined) delete r[x]; else r[x] = patch[x]; });
    if (!Object.keys(r).length) delete E.block[k];
    applyBlock(b, E.block[k]); if (done !== false) { commit(); refresh(); } else place();
  }
  function moveBlock(dir) {
    var b = selBlock(); if (!b) return;
    var sib = b; do { sib = dir < 0 ? sib.previousElementSibling : sib.nextElementSibling; } while (sib && !sib.hasAttribute('data-kb'));
    if (!sib) return;
    if (dir < 0) b.parentElement.insertBefore(b, sib); else b.parentElement.insertBefore(b, sib.nextSibling);
    if (b.parentElement.hasAttribute('data-kc')) recordOrder(b.parentElement);
    commit(); place(); b.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  function setCols(n) {
    var c = containerOf(); if (!c) return; var ck = c.getAttribute('data-kc');
    if (n) E.cols[ck] = n; else delete E.cols[ck];
    c.style.gridTemplateColumns = n ? 'repeat(' + n + ',minmax(0,1fr))' : ''; commit(); place();
  }
  function evictOriginals(block) {
    qa('[data-kb]', block).forEach(function (el) {
      if (el === block || el.hasAttribute('data-added')) return;
      var home = findContainer(el.__home); delete E.move[el.getAttribute('data-kb')]; if (home) home.appendChild(el);
    });
  }
  function dropTree(block) {
    qa('[data-added]', block).forEach(function (x) { if (x !== block) delete E.block[x.getAttribute('data-kb')]; });
    qa('[data-slot]', block).forEach(function (s) { var k = s.getAttribute('data-kc'); delete E.add[k]; delete E.order[k]; });
  }
  function deleteSel() {
    var b = selBlock(); if (!b) return; var k = b.getAttribute('data-kb'), pc = b.parentElement;
    if (b.hasAttribute('data-added')) {
      evictOriginals(b); dropTree(b);
      var ck = pc.getAttribute('data-kc'); E.add[ck] = (E.add[ck] || []).filter(function (r) { return r.id !== k; }); if (!E.add[ck].length) delete E.add[ck];
      delete E.block[k]; deselect(); b.remove(); if (pc.hasAttribute('data-kc')) recordOrder(pc); markEmptyDesigns(curRoot || document); toast('Deleted. Press Undo to bring it back.');
    } else { E.hide[k] = 1; b.classList.add('ed-hidden'); deselect(); toast('Hidden from students. Select it and press Restore to bring it back.'); }
    commit(); place();
  }
  function restoreSel() { var b = selBlock(); if (!b) return; delete E.hide[b.getAttribute('data-kb')]; b.classList.remove('ed-hidden'); commit(); refresh(); }
  function insertRecord(c, rec, ref) {
    var ck = c.getAttribute('data-kc'); E.add[ck] = (E.add[ck] || []).concat(rec);
    var el = buildAdded(rec); c.insertBefore(el, ref || null); applyBlock(el, E.block[rec.id]); decorate(c); resolveAssets(el); recordOrder(c); return el;
  }
  function cloneTree(rec) {
    var c = JSON.parse(JSON.stringify(rec)); c.id = newId(); var br = E.block[rec.id]; if (br) E.block[c.id] = JSON.parse(JSON.stringify(br));
    Object.keys(E.add).filter(function (k) { return k.indexOf(rec.id + '#') === 0; }).forEach(function (k) {
      var nk = c.id + k.slice(rec.id.length), kids = E.add[k], copies = kids.map(cloneTree); E.add[nk] = copies;
      if (E.order[k]) E.order[nk] = E.order[k].map(function (id) { var i = kids.map(function (r) { return r.id; }).indexOf(id); return i >= 0 ? copies[i].id : id; });
    });
    return c;
  }
  function duplicateSel() {
    var b = selBlock(); if (!b) return; var c = b.parentElement; if (!c.hasAttribute('data-kc')) return;
    var rec;
    if (b.hasAttribute('data-added')) { var src = recFor(b); if (!src) return; rec = cloneTree(src); }
    else { var cl = stripDeco(b); rec = { id: newId(), type: 'panel', cls: String(b.className).replace(/\bed-\S+/g, '').trim(), html: clean(cl.innerHTML) }; }
    var el = insertTree(c, { rec: rec }, b.nextElementSibling); commit(); select(el); el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); toast('Duplicated.');
  }
  /* build a block (and everything inside it) from a description: {def, html, slots:{s1:[...]}} or an existing record */
  function insertTree(c, node, ref) {
    var rec = node.rec, d = node.def;
    if (!rec) { var id = newId(); if (d.bh) blk(id).bh = d.bh; rec = { id: id, type: 'panel', cls: d.cls, html: node.html || d.html }; }
    var el = insertRecord(c, rec, ref);
    qa('[data-slot]', el).forEach(function (s) { (E.add[s.getAttribute('data-kc')] || []).forEach(function (r) { if (!q('[data-aid="' + r.id + '"]', s)) s.appendChild(buildAdded(r)); }); });
    Object.keys(node.slots || {}).forEach(function (sn) { var sc = qa('[data-slot]', el).filter(function (s) { return s.getAttribute('data-slot') === sn && s.closest('[data-kb]') === el; })[0]; if (sc) node.slots[sn].forEach(function (ch) { insertTree(sc, ch, null); }); });
    decorate(el); resolveAssets(el); markEmptyDesigns(c); return el;
  }
  /* move a block anywhere (another place in the page, or into a design block) and remember it */
  function moveBlockTo(b, c, ref) {
    var oldC = b.parentElement, ock = oldC && oldC.getAttribute('data-kc'), nck = c.getAttribute('data-kc'), k = b.getAttribute('data-kb');
    if (ock !== nck) {
      if (b.hasAttribute('data-added')) { var rec = recFor(b); if (rec) { E.add[ock] = (E.add[ock] || []).filter(function (r) { return r.id !== rec.id; }); if (!E.add[ock].length) delete E.add[ock]; E.add[nck] = (E.add[nck] || []).concat(rec); } }
      else { if (nck === b.__home) delete E.move[k]; else E.move[k] = nck; }
    }
    c.insertBefore(b, ref || null);
    if (ock !== nck && oldC && oldC.hasAttribute('data-kc')) recordOrder(oldC);
    recordOrder(c); markEmptyDesigns(curRoot || document); commit();
  }

  /* ---------- uploaded pictures and files: kept in this browser until they are published ---------- */
  var ADB = null;
  function adb() {
    if (ADB) return ADB;
    ADB = new Promise(function (res, rej) {
      try { var r = indexedDB.open('kcc-edit-assets-' + DRAFT_KEY, 1); r.onupgradeneeded = function () { r.result.createObjectStore('a'); }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; } catch (e) { rej(e); }
    });
    return ADB;
  }
  function putAsset(path, blob) {
    return adb().then(function (d) { return new Promise(function (res, rej) { var t = d.transaction('a', 'readwrite'); t.objectStore('a').put(blob, path); t.oncomplete = function () { res(); }; t.onerror = function () { rej(t.error); }; }); });
  }
  function getAsset(path) {
    return adb().then(function (d) { return new Promise(function (res) { var r = d.transaction('a').objectStore('a').get(path); r.onsuccess = function () { res(r.result || null); }; r.onerror = function () { res(null); }; }); }).catch(function () { return null; });
  }
  /* a stored copy if this browser has one, otherwise the published file from the site */
  function xhrBlob(url) { return new Promise(function (res) { var x = new XMLHttpRequest(); x.open('GET', url); x.responseType = 'blob'; x.onload = function () { res((x.status === 200 || x.status === 0) && x.response && x.response.size ? x.response : null); }; x.onerror = function () { res(null); }; try { x.send(); } catch (e) { res(null); } }); }
  function getBlob(path) { return getAsset(path).then(function (b) { return b || xhrBlob(path); }); }
  var urlCache = {};
  function assetURL(path) {
    if (urlCache[path]) return Promise.resolve(urlCache[path]);
    return getAsset(path).then(function (b) { return b ? (urlCache[path] = URL.createObjectURL(b)) : null; });
  }
  /* while editing, show the copy kept in this browser (the published file may not be uploaded yet) */
  function resolveAssets(root) {
    qa('img[src^="' + UPLOADS + '"],video[src^="' + UPLOADS + '"]', root).forEach(function (img) {
      var p = img.getAttribute('src');
      assetURL(p).then(function (u) { if (u) { img.setAttribute('data-path', p); img.src = u; } });
    });
  }
  function saveAsset(name, ext, blob) {
    var base = slug(String(name || 'file').replace(/\.[^.]+$/, '')) || 'file', path = UPLOADS + base + '-' + Math.random().toString(36).slice(2, 7) + '.' + ext;
    urlCache[path] = URL.createObjectURL(blob);
    return putAsset(path, blob).then(function () { return path; });
  }
  function usedAssets() {
    var s = JSON.stringify(pruned()), re = new RegExp(UPLOADS.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&') + '[A-Za-z0-9._-]+', 'g'), seen = {}, out = [];
    (s.match(re) || []).forEach(function (p) { if (!seen[p]) { seen[p] = 1; out.push(p); } });
    return out;
  }

  /* ---------- pictures: shrink for the web ---------- */
  function decodeImage(file) {
    return new Promise(function (res, rej) {
      var u = URL.createObjectURL(file), im = new Image();
      im.onload = function () { res({ im: im, url: u }); }; im.onerror = function () { URL.revokeObjectURL(u); rej(new Error('I could not read ' + (file.name || 'that picture') + '. Try a JPG or PNG.')); }; im.src = u;
    });
  }
  function processImage(file, maxSide) {
    maxSide = maxSide || 1600; var png = /png|webp/.test(file.type);
    if (/gif/.test(file.type) && file.size < 3 * 1048576) return Promise.resolve({ blob: file, ext: 'gif', name: file.name });
    return decodeImage(file).then(function (d) {
      var im = d.im, k = Math.min(1, maxSide / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas');
      c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
      var g = c.getContext('2d'); if (!png) { g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); } g.drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(d.url);
      return new Promise(function (res, rej) { c.toBlob(function (b) { b ? res({ blob: b, ext: png ? 'png' : 'jpg', name: file.name, w: c.width, h: c.height }) : rej(new Error('Could not shrink ' + file.name)); }, png ? 'image/png' : 'image/jpeg', 0.86); });
    });
  }
  function addPicture(file) { return processImage(file).then(function (r) { return saveAsset(r.name, r.ext, r.blob).then(function (path) { return { path: path, name: r.name.replace(/\.[^.]+$/, '') }; }); }); }

  /* ---------- PDF pages as pictures (PDF.js is only loaded when a PDF is dropped) ---------- */
  function getText(url) { return new Promise(function (res, rej) { var x = new XMLHttpRequest(); x.open('GET', url); x.onload = function () { (x.status === 200 || x.status === 0) && x.responseText ? res(x.responseText) : rej(new Error('Could not load ' + url)); }; x.onerror = function () { rej(new Error('Could not load ' + url)); }; x.send(); }); }
  function loadScript(src) { return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = function () { rej(new Error('Could not load ' + src)); }; document.head.appendChild(s); }); }
  var pdfP = null;
  function pdfJs() {
    if (pdfP) return pdfP; var c = CFG.pdfjs || {};
    var lib = c.lib || 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', wk = c.worker || 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    pdfP = (window.pdfjsLib ? Promise.resolve() : loadScript(lib)).then(function () { return getText(wk); }).then(function (txt) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([txt], { type: 'text/javascript' })); return window.pdfjsLib;
    });
    pdfP.catch(function () { pdfP = null; }); return pdfP;
  }
  function renderPdf(file, onPage) {
    return pdfJs().then(function (lib) { return file.arrayBuffer().then(function (buf) { return lib.getDocument({ data: buf }).promise; }); }).then(function (doc) {
      var n = Math.min(doc.numPages, 60), out = [];
      function next(i) {
        if (i > n) return Promise.resolve({ pages: out, total: doc.numPages });
        return doc.getPage(i).then(function (pg) {
          var v0 = pg.getViewport({ scale: 1 }), v = pg.getViewport({ scale: 1100 / v0.width }), c = document.createElement('canvas'); c.width = Math.round(v.width); c.height = Math.round(v.height);
          var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
          return pg.render({ canvasContext: g, viewport: v }).promise.then(function () {
            return new Promise(function (res) { c.toBlob(function (b) { out.push({ blob: b, w: c.width, h: c.height }); if (onPage) onPage(i, n); res(); }, 'image/jpeg', 0.82); });
          });
        }).then(function () { return next(i + 1); });
      }
      return next(1);
    });
  }

  /* ---------- zip: write one (for publishing) and read one (Office files hold a preview picture) ---------- */
  var CRC_T = (function () { var tb = [], c, n, k; for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; tb[n] = c >>> 0; } return tb; })();
  function crc32(u8) { var c = 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zipBlob(entries) {
    var enc = new TextEncoder(), parts = [], cd = [], off = 0, d = new Date(), tm = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), dt = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    return entries.reduce(function (chain, e) {
      return chain.then(function () {
        return e.blob.arrayBuffer().then(function (ab) {
          var crc = crc32(new Uint8Array(ab)), nm = enc.encode(e.name), sz = e.blob.size;
          var lh = new DataView(new ArrayBuffer(30)); lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(10, tm, true); lh.setUint16(12, dt, true); lh.setUint32(14, crc, true); lh.setUint32(18, sz, true); lh.setUint32(22, sz, true); lh.setUint16(26, nm.length, true);
          var ch = new DataView(new ArrayBuffer(46)); ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(12, tm, true); ch.setUint16(14, dt, true); ch.setUint32(16, crc, true); ch.setUint32(20, sz, true); ch.setUint32(24, sz, true); ch.setUint16(28, nm.length, true); ch.setUint32(42, off, true);
          parts.push(new Uint8Array(lh.buffer), nm, e.blob); cd.push(new Uint8Array(ch.buffer), nm); off += 30 + nm.length + sz;
        });
      });
    }, Promise.resolve()).then(function () {
      var cdSize = cd.reduce(function (s, x) { return s + x.length; }, 0), eo = new DataView(new ArrayBuffer(22));
      eo.setUint32(0, 0x06054b50, true); eo.setUint16(8, entries.length, true); eo.setUint16(10, entries.length, true); eo.setUint32(12, cdSize, true); eo.setUint32(16, off, true);
      return new Blob(parts.concat(cd, [new Uint8Array(eo.buffer)]), { type: 'application/zip' });
    });
  }
  function readZipIndex(file) {
    var tail = Math.min(file.size, 65557);
    return file.slice(file.size - tail).arrayBuffer().then(function (ab) {
      var v = new DataView(ab), i; for (i = ab.byteLength - 22; i >= 0; i--) if (v.getUint32(i, true) === 0x06054b50) break;
      if (i < 0) throw new Error('not a zip');
      var n = v.getUint16(i + 10, true), cdSize = v.getUint32(i + 12, true), cdOff = v.getUint32(i + 16, true);
      return file.slice(cdOff, cdOff + cdSize).arrayBuffer().then(function (cb) {
        var cv = new DataView(cb), out = {}, p = 0, dec = new TextDecoder();
        for (var k = 0; k < n; k++) {
          if (cv.getUint32(p, true) !== 0x02014b50) throw new Error('damaged zip');
          var nl = cv.getUint16(p + 28, true), el = cv.getUint16(p + 30, true), cl = cv.getUint16(p + 32, true);
          out[dec.decode(new Uint8Array(cb, p + 46, nl))] = { method: cv.getUint16(p + 10, true), csize: cv.getUint32(p + 20, true), off: cv.getUint32(p + 42, true) };
          p += 46 + nl + el + cl;
        }
        return out;
      });
    });
  }
  function readZipEntry(file, e, type) {
    return file.slice(e.off, e.off + 30).arrayBuffer().then(function (hb) {
      var h = new DataView(hb), start = e.off + 30 + h.getUint16(26, true) + h.getUint16(28, true), raw = file.slice(start, start + e.csize);
      if (e.method === 0) return raw.arrayBuffer().then(function (ab) { return new Blob([ab], { type: type || '' }); });
      if (e.method === 8 && typeof DecompressionStream !== 'undefined') return new Response(raw.stream().pipeThrough(new DecompressionStream('deflate-raw'))).blob().then(function (b) { return b.slice(0, b.size, type || ''); });
      throw new Error('unsupported zip');
    });
  }
  /* PowerPoint and Word usually keep a small preview of the first slide or page inside the file */
  function officeThumb(file) {
    return readZipIndex(file).then(function (idx) {
      var name = ['docProps/thumbnail.jpeg', 'docProps/thumbnail.jpg', 'docProps/thumbnail.png'].filter(function (n) { return idx[n]; })[0];
      if (!name) return null;
      return readZipEntry(file, idx[name], /png$/.test(name) ? 'image/png' : 'image/jpeg').then(function (b) { return b.size > 200 ? { blob: b, ext: /png$/.test(name) ? 'png' : 'jpg' } : null; });
    }).catch(function () { return null; });
  }

  /* ---------- the publish bundle ---------- */
  function editsText() { return '/* Page edits. Put this file next to the page (replace the old ' + EDITS_FILE + '), with the "' + UPLOADS + '" folder, then commit. */\nwindow.' + EDITS_VAR + ' = ' + JSON.stringify(pruned(), null, 1) + ';\n'; }
  function downloadBlob(blob, name) {
    var a = document.createElement('a'), u = URL.createObjectURL(blob); a.className = 'kb-ui'; a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 60000);
  }
  function pageName() { return (CFG.name || document.title || 'page').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 50) || 'page'; }
  function saveBundle() {
    var paths = usedAssets();
    return Promise.all(paths.map(function (p) { return getAsset(p).then(function (b) { return { p: p, b: b }; }); })).then(function (list) {
      var have = list.filter(function (x) { return x.b; }), missing = list.filter(function (x) { return !x.b; }).map(function (x) { return x.p; });
      var js = new Blob([editsText()], { type: 'text/javascript' }), size = js.size;
      if (!have.length) { downloadBlob(js, EDITS_FILE); return { kind: 'js', files: 0, missing: missing, size: size }; }
      var readme = new Blob(['HOW TO PUBLISH\r\n\r\n1. Unzip this file.\r\n2. In GitHub, open the folder that holds the page, then choose Add file > Upload files.\r\n3. Drag in ' + EDITS_FILE + ' and the "' + UPLOADS.replace('/', '') + '" folder. (If asked, replace the old ' + EDITS_FILE + '.)\r\n4. Click Commit changes. The site updates in about a minute.\r\n'], { type: 'text/plain' });
      var ents = [{ name: EDITS_FILE, blob: js }, { name: 'HOW TO PUBLISH.txt', blob: readme }].concat(have.map(function (x) { return { name: x.p, blob: x.b }; }));
      return zipBlob(ents).then(function (z) { downloadBlob(z, pageName() + ' - publish.zip'); have.forEach(function (x) { size += x.b.size; }); return { kind: 'zip', files: have.length, missing: missing, size: size }; });
    });
  }

  /* ---------- icons (small line icons, 24 x 24) ---------- */
  var IC = {
    heading: '<path d="M6 5v14M18 5v14M6 12h12"/>', text: '<path d="M4 7h16M4 12h16M4 17h10"/>', quote: '<path d="M6 17c0-4 1-7 4-9M14 17c0-4 1-7 4-9"/><path d="M5 17h5v-5H5zM13 17h5v-5h-5z"/>',
    callout: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M12 9v4M12 15.6v.4"/>', button: '<rect x="3" y="8" width="18" height="8" rx="4"/><path d="M8 12h8"/>', divider: '<path d="M4 12h16"/><path d="M12 6v.01M12 18v.01"/>',
    spacer: '<path d="M12 4v16M8 8l4-4 4 4M8 16l4 4 4-4"/>', objective: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/>', vocab: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 5v14M5.5 10h2.5M5.5 14h2.5"/>',
    prompt: '<path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/>', criteria: '<path d="M4 7l2 2 3-3M4 16l2 2 3-3M13 8h7M13 17h7"/>', steps: '<circle cx="6" cy="7" r="2"/><circle cx="6" cy="17" r="2"/><path d="M12 7h8M12 17h8"/>',
    accordion: '<rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="13" width="18" height="6" rx="2"/><path d="M16 7h2"/>', image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-8 9"/>',
    gallery: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>', video: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9l5 3-5 3z"/>',
    file: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/>', slides: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>', imgtext: '<rect x="3" y="5" width="8" height="14" rx="2"/><path d="M14 8h7M14 12h7M14 16h5"/>',
    hero: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 15h10M7 11h6"/>', cols2: '<rect x="3" y="5" width="8" height="14" rx="2"/><rect x="13" y="5" width="8" height="14" rx="2"/>', cols3: '<rect x="2.5" y="5" width="5.5" height="14" rx="1.5"/><rect x="9.2" y="5" width="5.5" height="14" rx="1.5"/><rect x="16" y="5" width="5.5" height="14" rx="1.5"/>',
    cards: '<rect x="3" y="4" width="8" height="16" rx="2"/><rect x="13" y="4" width="8" height="16" rx="2"/><path d="M5.5 14h3M15.5 14h3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>', down: '<path d="M12 5v14M6 13l6 6 6-6"/>', undo: '<path d="M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10"/>', redo: '<path d="M15 7l5 5-5 5M20 12H9a5 5 0 0 0 0 10"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', play: '<path d="M7 4l13 8-13 8z"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', brush: '<path d="M4 20c3 0 4-2 4-4l8-8 3 3-8 8c-2 0-4 1-7 1z"/><path d="M14 6l3-3 4 4-3 3"/>',
    layout: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M10 10v10"/>', link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>', grip: '<circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2 0-2 1-3 3-3h2a3 3 0 0 0 3-3c0-6-5-10-10-10z"/><circle cx="8" cy="11" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16.5" cy="10" r="1"/>', upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
    crop: '<path d="M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14"/>', swap: '<path d="M4 8h14l-3-3M20 16H6l3 3"/>', move: '<path d="M12 3v18M3 12h18M8 7l4-4 4 4M8 17l4 4 4-4M7 8l-4 4 4 4M17 8l4 4-4 4"/>', save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
    rect: '<rect x="3" y="4" width="18" height="16" rx="3"/>', tint: '<rect x="3" y="4" width="18" height="16" rx="3" fill="currentColor" fill-opacity=".15"/>', side: '<rect x="3" y="5" width="6" height="14" rx="2"/><rect x="11" y="5" width="10" height="14" rx="2"/>', table: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M3 15h18M9 5v14"/>', media: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M10 9l5 3-5 3z"/>', task: '<path d="M5 5h14v14H5z"/><path d="M8 12l3 3 5-6"/>', subheading: '<path d="M5 6v12M15 6v12M5 12h10M19 10v8"/>', arrange: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>', page: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h7"/>', eyeoff: '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 4M6.2 6.3C3.6 8 2 12 2 12s4 7 10 7c1.4 0 2.700-.3 3.800-.8"/>',
    check: '<path d="M5 12l5 5 9-10"/>', chevron: '<path d="M6 9l6 6 6-6"/>', text2: '<path d="M4 18L10 5l6 13M6 14h8M18 8h3M19.5 8v10"/>', bold: '<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/>', italic: '<path d="M10 5h8M6 19h8M14 5l-4 14"/>', underline: '<path d="M7 4v7a5 5 0 0 0 10 0V4M5 20h14"/>',
    full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>', sparkle: '<path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/>', moon: '<path d="M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z"/>'
  };
  function ico(n, s) { return '<svg class="kb-i" viewBox="0 0 24 24" width="' + (s || 20) + '" height="' + (s || 20) + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IC[n] || '') + '</svg>'; }

  /* ---------- ELEMENTS (what you put inside a design block) and DESIGN BLOCKS (the boxes) ---------- */
  var DROP_IMG = '<div class="kb-drop" data-drop="image"><b>Drop a picture here</b><span>or click to choose one</span></div>';
  var DROP_MEDIA = '<div class="kb-drop kb-drop-media" data-drop="media"><b>Drop images, videos, PDFs or Word files here</b><span class="kb-drop-btns"><span role="button" tabindex="0" data-mact="upload">Choose files</span><span role="button" tabindex="0" data-mact="link">Paste a link</span></span></div>';
  var ELEMENTS = [
    { id: 'heading', group: 'Text', name: 'Heading', desc: 'A big title', cls: 'kb kb-heading wide', html: '<h1>Your heading</h1>' },
    { id: 'subheading', group: 'Text', name: 'Subheading', desc: 'A smaller title', cls: 'kb kb-heading kb-subheading wide', html: '<h2>Your subheading</h2>' },
    { id: 'text', group: 'Text', name: 'Text', desc: 'A paragraph or two', cls: 'kb kb-text wide', html: '<p>Click here and start typing. Select words to change how they look, or use the toolbar above.</p>' },
    { id: 'quote', group: 'Text', name: 'Quote', desc: 'A pull quote with a name', cls: 'kb kb-quote wide', html: '<blockquote><p>\u201CA good question is worth more than a quick answer.\u201D</p></blockquote><p class="kb-who">Name, role</p>' },
    { id: 'callout', group: 'Text', name: 'Callout', desc: 'A tip or reminder that stands out', cls: 'kb kb-callout wide', html: '<div class="kb-ico" aria-hidden="true">\uD83D\uDCA1</div><div class="kb-body"><p><b>Tip:</b> Write something your students should remember.</p></div>' },
    { id: 'task', group: 'Text', name: 'Task box', desc: 'A highlighted task for students', cls: 'kb kb-task wide', html: '<p><b>TASK:</b> Tell students exactly what to do.</p>' },
    { id: 'button', group: 'Text', name: 'Button', desc: 'A big link button', cls: 'kb kb-button wide', html: '<div class="kb-btnwrap"><a class="kb-btn" href="#">Button text</a></div>' },
    { id: 'divider', group: 'Text', name: 'Divider', desc: 'A thin line between parts', cls: 'kb kb-divider wide', html: '<hr>' },
    { id: 'spacer', group: 'Text', name: 'Space', desc: 'Empty room. Drag the corner to size it', cls: 'kb kb-spacer wide', html: '', bh: 60 },

    { id: 'media', group: 'Media', name: 'Media', desc: 'Pictures, videos, PDFs, Word files or a link', cls: 'kb kb-media wide', html: DROP_MEDIA, icon: 'media' },
    { id: 'table', group: 'Lesson', name: 'Table', desc: 'Rows and columns, like a worksheet', cls: 'kb kb-tablewrap wide', icon: 'table',
      html: '<table class="kb-table"><thead><tr><th>Heading</th><th>Heading</th><th>Heading</th></tr></thead><tbody><tr><td>Write here</td><td></td><td></td></tr><tr><td>Write here</td><td></td><td></td></tr><tr><td>Write here</td><td></td><td></td></tr></tbody></table>' },
    { id: 'objective', group: 'Lesson', name: 'Learning intent', desc: 'What students will be able to do', cls: 'kb kb-objective wide', html: '<p><b>Learning Intent:</b> By the end of this lesson, students will be able to...</p>' },
    { id: 'criteria', group: 'Lesson', name: 'Success criteria', desc: 'A tick list of \u201CI can\u2026\u201D', cls: 'kb kb-criteria', html: '<h3>Success criteria</h3><ul><li>I can\u2026</li><li>I can\u2026</li><li>I can\u2026</li></ul>' },
    { id: 'vocab', group: 'Lesson', name: 'Vocabulary card', desc: 'A keyword and its meaning', cls: 'kb kb-vocab', html: '<p class="kb-term">Keyword</p><p class="kb-def">Write the meaning in words your students will understand.</p>' },
    { id: 'prompt', group: 'Lesson', name: 'Discussion prompt', desc: 'A question for the class', cls: 'kb kb-prompt wide', html: '<p>Discuss: What do you notice, and why do you think that happens?</p>' },
    { id: 'steps', group: 'Lesson', name: 'Numbered steps', desc: 'Do this, then this', cls: 'kb kb-steps wide', html: '<h3>Steps</h3><ol><li>First step</li><li>Second step</li><li>Third step</li></ol>' }
  ];
  var DESIGNS = [
    { id: 'rect', design: true, name: 'Big rectangle', desc: 'A clean box. Drop elements inside', cls: 'kb kb-d kb-d-rect wide', html: '<div class="kb-slot" data-slot="s1"></div>', icon: 'rect' },
    { id: 'tint', design: true, name: 'Colour box', desc: 'A tinted box in your page colour', cls: 'kb kb-d kb-d-tint wide', html: '<div class="kb-slot" data-slot="s1"></div>', icon: 'tint' },
    { id: 'cols2', design: true, name: 'Two columns', desc: 'Two boxes side by side', cls: 'kb kb-d kb-d-cols2 wide', html: '<div class="kb-slot" data-slot="s1"></div><div class="kb-slot" data-slot="s2"></div>', icon: 'cols2' },
    { id: 'cols3', design: true, name: 'Three columns', desc: 'Three boxes in a row', cls: 'kb kb-d kb-d-cols3 wide', html: '<div class="kb-slot" data-slot="s1"></div><div class="kb-slot" data-slot="s2"></div><div class="kb-slot" data-slot="s3"></div>', icon: 'cols3' },
    { id: 'side', design: true, name: 'Side and main', desc: 'A narrow box beside a wide one', cls: 'kb kb-d kb-d-side wide', html: '<div class="kb-slot" data-slot="s1"></div><div class="kb-slot" data-slot="s2"></div>', icon: 'side' },
    { id: 'cards', design: true, name: 'Three cards', desc: 'A row of cards for pictures and text', cls: 'kb kb-d kb-d-cards wide', html: '<div class="kb-slot" data-slot="s1"></div><div class="kb-slot" data-slot="s2"></div><div class="kb-slot" data-slot="s3"></div>', icon: 'cards' },
    { id: 'banner', design: true, name: 'Banner', desc: 'A big picture with words on top', cls: 'kb kb-d kb-d-banner wide', html: '<div class="kb-herobg"><div class="kb-drop kb-drop-hero" data-drop="hero"><b>Drop a banner picture here</b><span>or click to choose one</span></div></div><div class="kb-slot kb-herotext" data-slot="s1"></div>', icon: 'hero' },
    { id: 'open', design: true, name: 'Click to open', desc: 'A section students open to read', cls: 'kb kb-d kb-d-open wide', html: '<details open><summary><span class="kb-sum">Click to open</span></summary><div class="kb-slot" data-slot="s1"></div></details>', icon: 'accordion' }
  ];
  function blockDef(id) { return ELEMENTS.concat(DESIGNS).filter(function (b) { return b.id === id; })[0]; }
  function EL(id, over) { var n = { def: blockDef(id) }; if (over) Object.keys(over).forEach(function (k) { n[k] = over[k]; }); return n; }
  function DB(id, slots) { return { def: blockDef(id), slots: slots }; }
  function H1(t) { return EL('heading', { html: '<h1>' + t + '</h1>' }); } function H2(t) { return EL('subheading', { html: '<h2>' + t + '</h2>' }); } function TX(t) { return EL('text', { html: '<p>' + t + '</p>' }); }
  function TABLE(cols, rows) { return EL('table', { html: '<table class="kb-table"><thead><tr>' + cols.map(function (c) { return '<th>' + c + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.map(function (r) { return '<tr>' + cols.map(function (c, i) { return '<td>' + (r[i] || '') + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>' }); }

  /* ---------- whole-page layouts: design blocks with elements already placed in them ---------- */
  var TEMPLATES = [
    { id: 'lesson', name: 'Lesson page', desc: 'Page title, introduction, media, lesson steps and revision', wire: ['hero', 'bar', 'half', 'steps', 'rect'],
      parts: [DB('banner', { s1: [H1('Lesson title'), TX('What we are learning, and why it matters.')] }), DB('rect', { s1: [H2('Introduction'), EL('objective'), TX('Set the scene for the lesson in a sentence or two.')] }),
        DB('cols2', { s1: [EL('media')], s2: [H2('Watch and notice'), TX('Tell students what to look and listen for.'), EL('task')] }), DB('rect', { s1: [H2('Lesson steps'), EL('steps'), EL('callout')] }),
        DB('tint', { s1: [H2('Revision'), EL('criteria'), EL('vocab'), EL('prompt')] })] },
    { id: 'analyse', name: 'Analyse a scene', desc: 'A task, the scene, and a table to fill in', wire: ['bar', 'half', 'table', 'table'],
      parts: [DB('rect', { s1: [H1('Analysing a scene'), EL('task', { html: '<p><b>TASK:</b> Watch the scene, then complete the table below.</p>' })] }), DB('cols2', { s1: [EL('media')], s2: [H2('What to look for'), TX('List the codes and conventions students should notice.')] }),
        DB('rect', { s1: [H2('Specific scene analysis'), TABLE(['Codes used', 'How are the codes used?', 'What is the meaning created?'], [['Audio codes'], ['Technical codes'], ['Symbolic codes']])] }), DB('tint', { s1: [H2('Reflect'), EL('prompt')] })] },
    { id: 'values', name: 'Values and examples', desc: 'Introduction, a clip, and a Value / Examples table', wire: ['bar', 'half', 'table'],
      parts: [DB('rect', { s1: [H1('A hero\u2019s values'), TX('Explain the idea in your own words.')] }), DB('side', { s1: [EL('vocab')], s2: [EL('media')] }), EL('task', { html: '<p><b>TASK:</b> Find examples of each value in the film and add them to the table.</p>' }),
        DB('rect', { s1: [TABLE(['Value', 'Examples from the film'], [['Responsibility'], ['Family'], ['Identity'], ['Courage']])] })] },
    { id: 'compare', name: 'Compare and contrast', desc: 'Two clips side by side with a summary table', wire: ['bar', 'half', 'half', 'table'],
      parts: [DB('rect', { s1: [H1('Comparing the two'), EL('task')] }), DB('cols2', { s1: [H2('First'), EL('media'), TX('Notes about the first.')], s2: [H2('Second'), EL('media'), TX('Notes about the second.')] }),
        DB('rect', { s1: [H2('Lesson summary'), TABLE(['', 'First', 'Second'], [['What changed'], ['Why it matters']])] })] },
    { id: 'resources', name: 'Resource hub', desc: 'A heading and three cards, each with a picture', wire: ['bar', 'cards'],
      parts: [DB('rect', { s1: [H1('Resources'), TX('Everything you need for this unit in one place.')] }), DB('cards', { s1: [EL('media'), H2('Card title'), TX('A short description.')], s2: [EL('media'), H2('Card title'), TX('A short description.')], s3: [EL('media'), H2('Card title'), TX('A short description.')] }), EL('button')] },
    { id: 'showcase', name: 'Gallery showcase', desc: 'Banner, intro, a gallery and a quote', wire: ['hero', 'bar', 'grid', 'bar'],
      parts: [DB('banner', { s1: [H1('Our best work'), TX('A showcase of student photos.')] }), DB('rect', { s1: [EL('media')] }), EL('quote')] },
    { id: 'weekly', name: 'Weekly plan', desc: 'Three columns for the parts of the week, with success criteria', wire: ['bar', 'cols', 'half'],
      parts: [DB('rect', { s1: [H1('This week'), TX('What we will cover, lesson by lesson.')] }), DB('cols3', { s1: [H2('Lesson 1'), TX('Focus and activities.')], s2: [H2('Lesson 2'), TX('Focus and activities.')], s3: [H2('Lesson 3'), TX('Focus and activities.')] }), DB('tint', { s1: [EL('criteria')] }), EL('button')] },
    { id: 'faq', name: 'Questions and answers', desc: 'A heading and click-to-open answers', wire: ['bar', 'acc', 'acc', 'acc'],
      parts: [DB('rect', { s1: [H1('Questions'), TX('Click a question to see the answer.')] }), DB('open', { s1: [TX('The answer goes here.')] }), DB('open', { s1: [TX('The answer goes here.')] }), DB('open', { s1: [TX('The answer goes here.')] })] }
  ];

  /* =====================================================================
     THE INTERFACE
     ===================================================================== */
  var ui = {}, popKind = null, popAnchor = null;
  var NAMES = { heading: 'Heading', text: 'Text', quote: 'Quote', callout: 'Callout', button: 'Button', divider: 'Divider', spacer: 'Space', objective: 'Learning intent', criteria: 'Success criteria', vocab: 'Vocabulary', prompt: 'Prompt',
    steps: 'Steps', acc: 'Click to open', image: 'Picture', gallery: 'Gallery', 'video-block': 'Video', file: 'File', slides: 'Slides', hero: 'Banner', imgtext: 'Picture + text', cols: 'Columns', cards: 'Cards', media: 'Media', tablewrap: 'Table', task: 'Task box' };
  var DNAMES = { rect: 'Big rectangle', tint: 'Colour box', cols2: 'Two columns', cols3: 'Three columns', side: 'Side and main', cards: 'Three cards', banner: 'Banner', open: 'Click to open' };

  function toast(msg, ms) {
    var t = ui.toast || q('#kbToast'); if (!t) return; t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, ms || 5000);
  }
  function build() {
    if (q('#kbTop')) return;
    function mk(tag, id, cls, html, attrs) { var e = document.createElement(tag); if (id) e.id = id; e.className = 'kb-ui' + (cls ? ' ' + cls : ''); if (html) e.innerHTML = html; Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); }); document.body.appendChild(e); return e; }
    ui.top = mk('div', 'kbTop', '', '<div class="kbt-l"><span class="kbt-badge">' + ico('brush', 16) + ' Editing</span><label class="kb-sr" for="kbPage">Page</label><select id="kbPage"></select></div>' +
      '<div class="kbt-m"><button type="button" id="kbUndo" class="kbu-btn" aria-label="Undo" title="Undo (Ctrl+Z)">' + ico('undo', 18) + '</button><button type="button" id="kbRedo" class="kbu-btn" aria-label="Redo" title="Redo (Ctrl+Y)">' + ico('redo', 18) + '</button><span id="kbStatus" class="kbt-status" role="status"></span></div>' +
      '<div class="kbt-r"><button type="button" id="kbArrange" class="kbu-txt" aria-pressed="false" title="Zoom out so the whole page fits and rearrange it">' + ico('arrange', 17) + '<span>Arrange</span></button><button type="button" id="kbPreview" class="kbu-txt">' + ico('eye', 17) + '<span>Preview</span></button><button type="button" id="kbPresent" class="kbu-txt">' + ico('play', 16) + '<span>Present</span></button>' +
      '<span class="kb-split"><button type="button" id="kbSave" class="kbu-pri">' + ico('save', 17) + '<span>Save changes</span></button><button type="button" id="kbSaveMore" class="kbu-pri kbu-caret" aria-label="More save options" aria-haspopup="menu">' + ico('chevron', 16) + '</button></span>' +
      '<button type="button" id="kbExit" class="kbu-txt"><span>Exit</span></button></div>', { role: 'toolbar', 'aria-label': 'Page editor' });
    ui.fab = mk('button', 'kbFab', '', ico('plus', 20) + '<span>Add</span>', { type: 'button', 'aria-label': 'Add to your page' });
    ui.chip = mk('div', 'kbChip', '', '', { hidden: '' }); ui.bar = mk('div', 'kbBar', '', '', { hidden: '', role: 'toolbar', 'aria-label': 'Format the selection' });
    ui.pop = mk('div', 'kbPop', '', '', { hidden: '', role: 'dialog', 'aria-label': 'Options' });
    ui.rz = mk('div', 'kbRz', '', '', { hidden: '', title: 'Drag to resize' }); ui.line = mk('div', 'kbLine', '', '', { hidden: '' });
    ui.drop = mk('div', 'kbDrop', '', '<div>' + ico('upload', 30) + '<b>Drop to add to your page</b><span>Several pictures become a gallery. PDF, Word and PowerPoint files ask what you want to do.</span></div>', { hidden: '' });
    ui.toast = mk('div', 'kbToast', '', '', { hidden: '', role: 'status', 'aria-live': 'polite' });
    ui.modal = mk('div', 'kbModal', '', '<div class="kbm-card" role="dialog" aria-modal="true"></div>', { hidden: '' });
    ui.ghost = mk('div', 'kbGhost', '', '', { hidden: '' });
    ui.back = mk('button', 'kbBack', '', ico('brush', 16) + '<span>Back to editing</span>', { type: 'button', hidden: '' });
    ui.file = document.createElement('input'); ui.file.type = 'file'; ui.file.multiple = true; ui.file.hidden = true; ui.file.id = 'kbFile'; ui.file.className = 'kb-ui'; document.body.appendChild(ui.file);
    ui.add = mk('aside', 'kbAdd', '', '', { 'aria-label': 'Add to your page', 'aria-hidden': 'true' });
    buildAdd(); wireUi();
  }

  /* ---------- the Add drawer: design blocks, elements, layouts, this page, theme ---------- */
  var addTab = 'blocks', outT = null;
  var TABS = [['blocks', 'Blocks'], ['elements', 'Elements'], ['layouts', 'Layouts'], ['page', 'On page'], ['theme', 'Theme']];
  function buildAdd() {
    ui.add.innerHTML = '<div class="kba-head"><b>Add to your page</b><button type="button" id="kbAddClose" class="kbu-btn" aria-label="Close">' + ico('x', 18) + '</button></div>' +
      '<div class="kba-tabs" role="tablist">' + TABS.map(function (x) { return '<button type="button" role="tab" data-tab="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div><div class="kba-body" id="kbAddBody"></div>';
    renderAdd();
  }
  function tileHtml(b) { return '<button type="button" class="kba-tile" draggable="true" data-block="' + b.id + '" data-s="' + esc((b.name + ' ' + b.desc).toLowerCase()) + '"><span class="kba-ic">' + ico(b.icon || b.id, 22) + '</span><b>' + b.name + '</b><small>' + b.desc + '</small></button>'; }
  function snippet(b) { var t = q('h1,h2,h3,.kb-term,p,li,figcaption,.kb-sum,th', b), s = t ? t.textContent.trim().replace(/\s+/g, ' ') : ''; return s.slice(0, 36); }
  function outlineRows(cont, depth) {
    var h = '';
    blockKids(cont).forEach(function (b) {
      var k = b.getAttribute('data-kb'), hid = !!E.hide[k], on = b === selBlock();
      h += '<div class="kbo-i' + (hid ? ' hid' : '') + (on ? ' on' : '') + '" draggable="true" data-key="' + esc(k) + '" style="padding-left:' + (8 + depth * 18) + 'px"><span class="kbo-g" aria-hidden="true">' + ico('grip', 14) + '</span><button type="button" class="kbo-n" data-oselect="' + esc(k) + '"><b>' + esc(blockLabel(b)) + '</b><small>' + esc(snippet(b)) + '</small></button><button type="button" class="kbo-e" data-ohide="' + esc(k) + '" aria-label="' + (hid ? 'Show ' : 'Hide ') + esc(blockLabel(b)) + '" title="' + (hid ? 'Show' : 'Hide from students') + '">' + ico(hid ? 'eyeoff' : 'eye', 15) + '</button></div>';
      qa('.kb-slot[data-kc]', b).filter(function (s) { return s.closest('[data-kb]') === b; }).forEach(function (s) { h += outlineRows(s, depth + 1); });
    });
    return h;
  }
  function outlineHtml() {
    var c = containerNow() || (curRoot && q('[data-kc]', curRoot)); if (!c) return '<p class="kba-note">Open a page to see its blocks.</p>';
    var rows = outlineRows(c, 0);
    return '<p class="kba-note">Every block on this page, in order. <b>Click</b> one to jump to it. <b>Drag</b> one onto the page to move it, even into a design block. The eye hides it from students.</p><div class="kbo">' + (rows || '<p class="kba-note">Nothing here yet.</p>') + '</div>';
  }
  function scheduleOutline() { clearTimeout(outT); outT = setTimeout(function () { if (arrange) labelAll(); if (ui.add && addTab === 'page' && document.body.classList.contains('kb-add-open')) renderAdd(); }, 200); }
  function renderAdd() {
    qa('.kba-tabs [role=tab]', ui.add).forEach(function (t) { var on = t.getAttribute('data-tab') === addTab; t.setAttribute('aria-selected', on ? 'true' : 'false'); t.classList.toggle('on', on); });
    var body = q('#kbAddBody'), keep = body.scrollTop, h = '';
    if (addTab === 'blocks') {
      h += '<p class="kba-note"><b>Design blocks</b> are the boxes a page is built from. Drag one onto the page, then drag <b>Elements</b> into it. They snap into place.</p><div class="kba-grid">' + DESIGNS.map(tileHtml).join('') + '</div>';
    } else if (addTab === 'elements') {
      h += '<div class="kba-up"><div>' + ico('upload', 22) + '</div><div><b>Pictures and files</b><span>Drag them anywhere on the page, or</span></div><button type="button" id="kbPick" class="kbu-pri small">Choose files</button></div>';
      h += '<label class="kba-search"><span class="kb-sr">Search elements</span><input type="search" id="kbSearch" placeholder="Search elements" autocomplete="off"></label>';
      ['Text', 'Media', 'Lesson'].forEach(function (g) { h += '<h3 class="kba-g" data-g="' + g + '">' + g + '</h3><div class="kba-grid" data-g="' + g + '">' + ELEMENTS.filter(function (b) { return b.group === g; }).map(tileHtml).join('') + '</div>'; });
    } else if (addTab === 'layouts') {
      h += '<p class="kba-note">Start a page from a ready-made design. Every word, picture and box can be changed afterwards.</p><div class="kba-lay">' + TEMPLATES.map(function (x) {
        return '<button type="button" class="kba-card" data-tpl="' + x.id + '"><span class="kba-wire">' + x.wire.map(function (w) { return '<i class="w-' + w + '"></i>'; }).join('') + '</span><b>' + x.name + '</b><small>' + x.desc + '</small></button>';
      }).join('') + '</div>';
    } else if (addTab === 'page') {
      h += outlineHtml();
    } else {
      var g = E.global || {};
      h += '<div class="kba-sec"><b>Colours</b><div class="kba-sw">' + PALETTES.map(function (p) { return '<button type="button" class="kba-dot" data-pal="' + p.id + '" style="background:' + p.accent + '" aria-label="' + p.name + '" aria-pressed="' + (g.pal === p.id) + '" title="' + p.name + '"></button>'; }).join('') + '</div></div>';
      h += '<div class="kba-sec"><b>Fonts</b><div class="kba-pairs">' + PAIRS.map(function (p) { return '<button type="button" class="kba-pair" data-pair="' + p.id + '" aria-pressed="' + (g.body === p.body && g.display === p.display) + '"><span style="font-family:' + p.display + '">Aa</span><small style="font-family:' + p.body + '">' + p.name + '</small></button>'; }).join('') + '</div></div>';
      h += '<div class="kba-sec"><b>Corners</b>' + seg('rad', [['0', 'Square'], ['8', 'Soft'], ['16', 'Round'], ['28', 'Pill']], g.radius == null ? '' : String(g.radius)) + '</div>';
      h += '<div class="kba-sec"><b>Spacing</b>' + seg('gap', [['10', 'Tight'], ['20', 'Normal'], ['32', 'Roomy']], g.gap == null ? '' : String(g.gap)) + '</div>';
      h += '<div class="kba-sec"><b>Text size</b><div class="kbp-step"><button type="button" class="kbu-btn" data-scale="-10" aria-label="Smaller text">A\u2212</button><span id="kbScaleV">' + (g.scale || 100) + '%</span><button type="button" class="kbu-btn" data-scale="10" aria-label="Bigger text">A+</button></div></div>';
      h += '<div class="kba-sec"><button type="button" class="kbu-txt" data-resetdesign="1">Reset the design</button></div>';
    }
    body.innerHTML = h; body.scrollTop = keep;
  }
  function seg(act, opts, val) { return '<div class="kbp-seg" role="group">' + opts.map(function (o) { return '<button type="button" data-' + act + '="' + o[0] + '" aria-pressed="' + (String(val) === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>'; }
  function openAdd(on, tab) {
    if (tab) { addTab = tab; renderAdd(); }
    document.body.classList.toggle('kb-add-open', !!on); ui.add.setAttribute('aria-hidden', on ? 'false' : 'true'); ui.fab.hidden = !!on || !editing;
    if (on) setTimeout(place, 260);
  }
  function setGlobal(patch) {
    Object.keys(patch).forEach(function (k) { if (patch[k] === null || patch[k] === undefined || patch[k] === '') delete E.global[k]; else E.global[k] = patch[k]; });
    applyGlobal(); commit(); renderAdd(); place();
  }

  /* ---------- the block chip (above the selected block) ---------- */
  function blockLabel(b) {
    var dm = /\bkb-d-([a-z0-9]+)/.exec(b.className || ''); if (dm && DNAMES[dm[1]]) return DNAMES[dm[1]]; if (/\bkb-subheading\b/.test(b.className || '')) return 'Subheading';
    var m = /\bkb-([a-z0-9-]+)/.exec(b.className || ''); if (m) { var k = m[1]; if (NAMES[k]) return NAMES[k]; if (k === 'video') return 'Video'; if (k === 'acc') return 'Click to open'; }
    if (b.matches('.fig')) return 'Picture'; if (b.matches('.tile')) return 'Tile'; if (b.matches('.panel')) return 'Section'; return 'Block';
  }
  function cbtn(act, icon, label, extra) { return '<button type="button" class="kbc-b" data-act="' + act + '" aria-label="' + label + '" title="' + label + '"' + (extra || '') + '>' + ico(icon, 17) + '<span>' + label + '</span></button>'; }
  function renderChip() {
    if (!ui.chip) return; var b = selBlock();
    if (!editing || presenting || !b) { ui.chip.hidden = true; return; }
    var k = b.getAttribute('data-kb'), hid = !!E.hide[k], h = '<span class="kbc-grip" title="Press and drag to move" aria-label="Press and drag to move this block">' + ico('grip', 16) + '</span><span class="kbc-name">' + esc(blockLabel(b)) + '</span>';
    if (hid) h += cbtn('restore', 'eye', 'Restore');
    else h += cbtn('style', 'brush', 'Style', ' aria-haspopup="dialog" aria-expanded="' + (popKind === 'style') + '"') + cbtn('layout', 'layout', 'Layout', ' aria-haspopup="dialog" aria-expanded="' + (popKind === 'layout') + '"') + cbtn('dup', 'copy', 'Duplicate') + cbtn('del', 'trash', b.hasAttribute('data-added') ? 'Delete' : 'Hide');
    ui.chip.innerHTML = h; ui.chip.hidden = false;
  }

  /* ---------- the floating toolbar (text and pictures) ---------- */
  function tbtn(act, icon, label, opts) {
    opts = opts || {}; return '<button type="button" class="kbb' + (opts.label ? ' kbb-l' : '') + '" data-act="' + act + '" aria-label="' + label + '" title="' + label + '"' + (opts.pop ? ' aria-haspopup="dialog" aria-expanded="' + (popKind === act) + '"' : '') + (opts.on !== undefined ? ' aria-pressed="' + opts.on + '"' : '') + '>' + (icon === 'color' ? '<span class="kbb-dot" style="background:' + opts.color + '"></span>' : ico(icon, 18)) + (opts.label ? '<span>' + opts.label + '</span>' : '') + (opts.pop ? ico('chevron', 13) : '') + '</button>';
  }
  function renderBar() {
    if (!ui.bar) return; var t = selText(), im = selImg();
    if (!editing || presenting || !(t || im)) { ui.bar.hidden = true; return; }
    var h = '';
    if (t) {
      var cs = getComputedStyle(t), b = parseInt(cs.fontWeight, 10) >= 600, i = cs.fontStyle === 'italic', u = /underline/.test(cs.textDecorationLine || '');
      h += tbtn('text', 'text2', 'Text style, font and size', { label: 'Text', pop: true }) + '<span class="kbb-sep"></span>' + tbtn('b', 'bold', 'Bold', { on: b }) + tbtn('i', 'italic', 'Italic', { on: i }) + tbtn('u', 'underline', 'Underline', { on: u }) + '<span class="kbb-sep"></span>' + tbtn('color', 'color', 'Text colour', { color: toHex(cs.color), pop: true }) + tbtn('link', 'link', 'Add a link', { pop: true });
    } else {
      h += tbtn('replace', 'swap', 'Replace this picture', { label: 'Replace' }) + tbtn('shape', 'crop', 'Shape, focus and description', { label: 'Shape & focus', pop: true });
    }
    ui.bar.innerHTML = h; ui.bar.hidden = false;
  }

  /* ---------- keeping everything in the right place ---------- */
  function onScreen(r) { return r.bottom > 56 && r.top < window.innerHeight; }
  function place() {
    if (!ui.chip) return;
    if (!editing || presenting) { [ui.chip, ui.bar, ui.rz].forEach(function (e) { e.hidden = true; }); return; }
    var b = selBlock(), a = selText() || selImg(), vw = window.innerWidth, top0 = 62, pad = 8;
    if (b && !document.body.contains(b)) b = null; if (a && !document.body.contains(a)) a = null;
    if (!b && !a) { ui.chip.hidden = true; ui.bar.hidden = true; ui.rz.hidden = true; return; }
    var chipRect = null;
    if (b) {
      var r = b.getBoundingClientRect(); renderChipIfNeeded();
      if (!onScreen(r)) { ui.chip.hidden = true; ui.bar.hidden = true; ui.rz.hidden = true; if (popKind) closePop(); return; }
      ui.chip.hidden = false; var cw = ui.chip.offsetWidth, ch = ui.chip.offsetHeight;
      var ct = r.top - ch - 8; if (ct < top0) ct = Math.min(r.top + 6, window.innerHeight - ch - 8); ct = Math.max(top0, ct);
      var cl = Math.max(pad, Math.min(r.left, vw - cw - pad)); ui.chip.style.top = Math.round(ct) + 'px'; ui.chip.style.left = Math.round(cl) + 'px';
      chipRect = { l: cl, t: ct, r: cl + cw, b: ct + ch };
      ui.rz.hidden = false; ui.rz.style.left = Math.round(Math.min(r.right - 14, vw - 22)) + 'px'; ui.rz.style.top = Math.round(r.bottom - 14) + 'px';
    } else { ui.chip.hidden = true; ui.rz.hidden = true; }
    if (a && !ui.bar.hidden) {
      var ar = a.getBoundingClientRect(), bw = ui.bar.offsetWidth, bh = ui.bar.offsetHeight;
      var bt = ar.top - bh - 10; if (bt < top0) bt = ar.bottom + 10; if (bt + bh > window.innerHeight - 8) bt = Math.max(top0, window.innerHeight - bh - 8);
      var bl = Math.max(pad, Math.min(ar.left + ar.width / 2 - bw / 2, vw - bw - pad));
      if (chipRect && bl < chipRect.r + 6 && bl + bw > chipRect.l - 6 && bt < chipRect.b + 4 && bt + bh > chipRect.t - 4) { var up = chipRect.t - bh - 8; bt = up >= top0 ? up : chipRect.b + 8; }
      ui.bar.style.top = Math.round(bt) + 'px'; ui.bar.style.left = Math.round(bl) + 'px';
    }
    if (popKind && popAnchor) positionPop();
  }
  var lastChipKey = '';
  function renderChipIfNeeded() { var b = selBlock(), key = b ? b.getAttribute('data-kb') + '|' + !!E.hide[b.getAttribute('data-kb')] + '|' + popKind : ''; if (key !== lastChipKey) { lastChipKey = key; renderChip(); } }
  function refresh() { if (!ui.chip) return; lastChipKey = ''; renderChip(); renderBar(); place(); histBtns(); scheduleOutline(); }
  function histBtns() { if (!ui.top) return; var u = q('#kbUndo'), r = q('#kbRedo'); if (u) u.disabled = hist.length < 2; if (r) r.disabled = !redo.length; status(); }
  function status() {
    var s = q('#kbStatus'); if (!s) return; var ch = changedFromPublished();
    s.textContent = ch ? '\u25CF Not published yet' : '\u2713 Matches the published page'; s.className = 'kbt-status ' + (ch ? 'warn' : 'ok');
    var sv = q('#kbSave'); if (sv) sv.classList.toggle('dirty', ch);
  }

  /* ---------- popovers ---------- */
  function openPop(kind, anchor) {
    if (popKind === kind) { closePop(); return; }
    popKind = kind; popAnchor = anchor; ui.pop.innerHTML = popHtml(kind); ui.pop.hidden = false; ui.pop.setAttribute('data-kind', kind); ui.pop.setAttribute('aria-label', kind + ' options');
    positionPop(); lastChipKey = ''; renderChipIfNeeded(); qa('[aria-haspopup]', ui.bar).forEach(function (b) { b.setAttribute('aria-expanded', String(b.getAttribute('data-act') === kind)); });
    var f = q('input[type=text],input[type=url]', ui.pop); if (f) setTimeout(function () { f.focus(); }, 30);
  }
  function closePop() { if (!popKind || !ui.pop) return; popKind = null; popAnchor = null; ui.pop.hidden = true; ui.pop.innerHTML = ''; lastChipKey = ''; qa('[aria-haspopup]', ui.bar).forEach(function (b) { b.setAttribute('aria-expanded', 'false'); }); if (editing) renderChipIfNeeded(); }
  function repop() { if (popKind) { var k = popKind, a = popAnchor; var sc = ui.pop.scrollTop; ui.pop.innerHTML = popHtml(k); ui.pop.scrollTop = sc; positionPop(); } }
  function positionPop() {
    var a = popAnchor; if (!a || !document.body.contains(a)) { var sel2 = popKind === 'style' || popKind === 'layout' ? q('[data-act="' + popKind + '"]', ui.chip) : q('[data-act="' + popKind + '"]', ui.bar); a = sel2 || a; popAnchor = a; }
    if (!a) return; var r = a.getBoundingClientRect(), w = ui.pop.offsetWidth, h = ui.pop.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
    var t = r.bottom + 8; if (t + h > vh - 8) t = Math.max(60, r.top - h - 8); if (t + h > vh - 8) t = Math.max(60, vh - h - 8);
    ui.pop.style.top = Math.round(t) + 'px'; ui.pop.style.left = Math.round(Math.max(8, Math.min(r.left, vw - w - 8))) + 'px';
  }

  /* =====================================================================
     POPOVERS: each one gathers a whole group of tools behind one button
     ===================================================================== */
  var TYPE = [['Title', '48px', '800'], ['Heading', '32px', '700'], ['Subheading', '22px', '600'], ['Body', '18px', '400'], ['Small', '14px', '400']];
  function sec(label, inner) { return '<div class="kbp-sec"><div class="kbp-label">' + label + '</div>' + inner + '</div>'; }
  function pseg(a, opts, val) { return '<div class="kbp-seg" role="group">' + opts.map(function (o) { return '<button type="button" data-a="' + a + '" data-v="' + o[0] + '" aria-pressed="' + (String(val == null ? '' : val) === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>'; }
  function swatches(a, colors, cur, none) {
    return '<div class="kbp-sw">' + colors.map(function (c) { return '<button type="button" class="kbp-s" data-a="' + a + '" data-v="' + c + '" style="background:' + c + '" aria-label="' + c + '" aria-pressed="' + (!!cur && String(cur).toLowerCase() === c) + '"></button>'; }).join('') +
      (none ? '<button type="button" class="kbp-s none" data-a="' + a + '" data-v="none" aria-label="No fill" title="No fill" aria-pressed="' + (cur === 'transparent') + '">\u2205</button>' : '') +
      '<label class="kbp-s custom" title="Pick any colour"><input type="color" data-a="' + a + '-in" value="' + toHex(cur) + '" aria-label="Pick any colour"></label></div>';
  }
  function alignIcon(a) { var d = a === 'left' ? 'M4 6h16M4 12h10M4 18h14' : a === 'center' ? 'M4 6h16M7 12h10M5 18h14' : 'M4 6h16M10 12h10M6 18h14'; return '<svg class="kb-i" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="' + d + '"/></svg>'; }
  function accentOf() { var p = PALETTES.filter(function (x) { return x.id === (E.global || {}).pal; })[0]; return p ? p.accent : (getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#2b5be0'); }

  function popHtml(kind) {
    var tt = textTargets()[0], cs = tt ? getComputedStyle(tt) : null, b = selBlock(), r = b ? (E.block[b.getAttribute('data-kb')] || {}) : {};
    if (kind === 'text') {
      var fs = cs ? Math.round(parseFloat(cs.fontSize)) : 18, cur = tt && tt.style.fontFamily ? fontVal(tt.style.fontFamily) : '', ta = cs ? (cs.textAlign === 'start' ? 'left' : cs.textAlign === 'end' ? 'right' : cs.textAlign) : 'left';
      return sec('Style', '<div class="kbp-type">' + TYPE.map(function (t) { return '<button type="button" data-a="type" data-v="' + t[1] + '|' + t[2] + '" style="font-size:' + (t[0] === 'Title' ? 19 : t[0] === 'Heading' ? 17 : t[0] === 'Small' ? 12 : 14) + 'px;font-weight:' + t[2] + '">' + t[0] + '</button>'; }).join('') + '</div>') +
        sec('Font', '<div class="kbp-fonts">' + FONTS.map(function (f) { return '<button type="button" data-a="font" data-v="' + esc(f[1]) + '" aria-pressed="' + (f[1] === cur) + '" style="font-family:' + (f[1] ? esc(f[1]) : 'inherit') + '">' + f[0] + '</button>'; }).join('') + '</div>') +
        sec('Size and alignment', '<div class="kbp-row"><div class="kbp-step"><button type="button" class="kbu-btn" data-a="size" data-v="-2" aria-label="Smaller">\u2212</button><span>' + fs + ' px</span><button type="button" class="kbu-btn" data-a="size" data-v="2" aria-label="Bigger">+</button></div>' +
          '<div class="kbp-seg icons" role="group">' + ['left', 'center', 'right'].map(function (a) { return '<button type="button" data-a="align" data-v="' + a + '" aria-label="Align ' + a + '" aria-pressed="' + (ta === a) + '">' + alignIcon(a) + '</button>'; }).join('') + '</div></div>') +
        sec('Colour', swatches('tc', SWATCH.concat([accentOf()]), cs ? toHex(cs.color) : '')) + '<div class="kbp-foot"><button type="button" class="kbu-txt" data-a="resettext">Clear my text styling</button></div>';
    }
    if (kind === 'color') return sec('Text colour', swatches('tc', SWATCH.concat([accentOf()]), cs ? toHex(cs.color) : ''));
    if (kind === 'link') {
      var t = selText(), a = t && (t.matches('a') ? t : t.querySelector('a')), href = a ? a.getAttribute('href') || '' : '';
      return sec('Link to', '<input type="url" data-a="link-in" value="' + esc(href === '#' ? '' : href) + '" placeholder="https://\u2026 or #unit/lesson1 or uploads/file.pdf" aria-label="Web address"><p class="kbp-hint">' + (t && t.matches('.kb-btn') ? 'This is where the button goes when clicked.' : 'Select some words first, then add the link.') + '</p>') +
        '<div class="kbp-foot"><button type="button" class="kbu-pri small" data-a="link-ok">Apply link</button><button type="button" class="kbu-txt" data-a="link-no">Remove link</button></div>';
    }
    if (kind === 'style' && b) {
      return sec('Fill', swatches('bf', FILLS, r.bg, true)) +
        sec('Border', pseg('bdw', [['0', 'None'], ['1', 'Thin'], ['3', 'Medium'], ['6', 'Thick']], r.bdw) + '<label class="kbp-inl">Colour <input type="color" data-a="bd-in" value="' + toHex(r.bd || '#2b5be0') + '" aria-label="Border colour"></label>') +
        sec('Corners', pseg('rad', [['0', 'Square'], ['10', 'Soft'], ['20', 'Round'], ['full', 'Pill']], r.rad)) + sec('Shadow', pseg('sh', [['', 'None'], ['soft', 'Soft'], ['lift', 'Lifted']], r.sh || '')) +
        sec('Padding', pseg('pad', [['12', 'Tight'], ['24', 'Normal'], ['40', 'Roomy']], r.pad)) +
        sec('Opacity', '<div class="kbp-row"><input type="range" min="20" max="100" step="5" value="' + Math.round((r.op == null ? 1 : r.op) * 100) + '" data-a="op" aria-label="Opacity"><output>' + Math.round((r.op == null ? 1 : r.op) * 100) + '%</output></div>') +
        '<div class="kbp-foot"><button type="button" class="kbu-txt" data-a="resetstyle">Reset this block\u2019s style</button></div>';
    }
    if (kind === 'layout' && b) {
      var c = b.parentElement, ck = c && c.getAttribute('data-kc'), cols = ck ? E.cols[ck] : '', grid = c && getComputedStyle(c).display === 'grid';
      return sec('Width', pseg('span', [['', 'Auto'], ['1', 'Half'], ['full', 'Full width']], r.span == null ? '' : String(r.span))) + sec('Alignment', pseg('al', [['', 'Default'], ['left', 'Left'], ['center', 'Centre'], ['right', 'Right']], r.al || '')) +
        sec('Size', '<p class="kbp-hint">Drag the round handle at the corner of the block to make it bigger or smaller.</p><button type="button" class="kbu-txt" data-a="resetsize">Reset size</button>') +
        sec('Order', '<div class="kbp-row"><button type="button" class="kbu-txt" data-a="up">' + ico('up', 16) + ' Earlier</button><button type="button" class="kbu-txt" data-a="down">' + ico('down', 16) + ' Later</button></div>') +
        (q('.kb-table', b) ? sec('Table', '<div class="kbp-row"><button type="button" class="kbu-txt" data-a="trow+">+ Row</button><button type="button" class="kbu-txt" data-a="trow-">\u2212 Row</button><button type="button" class="kbu-txt" data-a="tcol+">+ Column</button><button type="button" class="kbu-txt" data-a="tcol-">\u2212 Column</button></div><p class="kbp-hint">Click a cell first to add or remove next to it. Otherwise it works on the end of the table.</p>') : '') +
        (grid ? sec('Columns in this section', pseg('cols', [['', 'Auto'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']], cols || '')) : '') +
        sec('Place anywhere', '<div class="kbp-row"><button type="button" class="kbu-txt" data-a="free" aria-pressed="' + freeMode + '">' + ico('move', 16) + ' ' + (freeMode ? 'Drag the block now' : 'Drag it freely') + '</button><button type="button" class="kbu-txt" data-a="resetpos">Reset position</button></div><p class="kbp-hint">Computers only. Phones keep the normal layout.</p>');
    }
    if (kind === 'shape') {
      var im = selImg(); if (!im) return ''; var o = readImg(im), pos = o.pos || '50% 50%';
      var grid9 = ['0% 0%', '50% 0%', '100% 0%', '0% 50%', '50% 50%', '100% 50%', '0% 100%', '50% 100%', '100% 100%'].map(function (p) { return '<button type="button" data-a="pos" data-v="' + p + '" aria-label="Focus ' + p + '" aria-pressed="' + (pos === p) + '"></button>'; }).join('');
      return sec('Shape', pseg('ar', [['', 'Original'], ['1/1', 'Square'], ['4/3', '4:3'], ['3/2', '3:2'], ['16/9', 'Wide'], ['3/4', 'Tall']], o.ar || '')) + sec('Fit', pseg('fit', [['cover', 'Fill the shape'], ['contain', 'Show all of it']], o.fit || 'cover')) +
        sec('Focus point', '<div class="kbp-focus">' + grid9 + '</div>') + sec('Describe the picture', '<input type="text" data-a="alt-in" value="' + esc(o.alt || '') + '" placeholder="e.g. A student painting a heart with light" aria-label="Picture description"><p class="kbp-hint">Read aloud to students who cannot see the picture.</p>') +
        '<div class="kbp-foot"><button type="button" class="kbu-txt" data-a="replace">' + ico('swap', 16) + ' Replace</button><button type="button" class="kbu-txt danger" data-a="removeimg">' + ico('trash', 16) + ' Remove picture</button></div>';
    }
    if (kind === 'save') {
      return '<div class="kbp-menu" role="menu"><button type="button" role="menuitem" data-a="save">' + ico('save', 17) + ' Save changes<small>Downloads your edits and any pictures and files</small></button><button type="button" role="menuitem" data-a="dlpage">' + ico('file', 17) + ' Download this page<small>One .html file you can open anywhere</small></button>' +
        '<button type="button" role="menuitem" data-a="clearadded">' + ico('trash', 17) + ' Clear what I added<small>Removes added blocks on this page</small></button><button type="button" role="menuitem" data-a="discard">' + ico('undo', 17) + ' Discard unsaved changes<small>Goes back to the published page</small></button></div>';
    }
    return '';
  }

  var savedRange = null;
  function popAct(a, v, el) {
    var b = selBlock(), im = selImg();
    switch (a) {
      case 'type': var p = v.split('|'); patchStyle({ fs: p[0], fw: p[1] }); repop(); break;
      case 'font': patchStyle({ ff: v }); repop(); break;
      case 'size': var tt = textTargets(); tt.forEach(function (t) { var cur = parseFloat(getComputedStyle(t).fontSize); t.style.fontSize = Math.max(10, Math.min(120, Math.round(cur + (+v)))) + 'px'; persistText(t); }); commit(); repop(); place(); break;
      case 'align': patchStyle({ ta: v }); repop(); break;
      case 'tc': patchStyle({ c: v }); repop(); break;
      case 'tc-in': tcLive(v); break;
      case 'resettext': patchStyle({ ff: '', fs: '', c: '', fw: '', fi: '', td: '', ta: '', lh: '' }); repop(); break;
      case 'link-ok': applyLink(q('[data-a="link-in"]', ui.pop).value.trim()); break;
      case 'link-no': applyLink(''); break;
      case 'bf': setBlock({ bg: v === 'none' ? 'transparent' : v }); repop(); break;
      case 'bf-in': setBlock({ bg: v }, false); break;
      case 'bdw': setBlock({ bdw: +v, bd: (E.block[b.getAttribute('data-kb')] || {}).bd || '#cbd5e1' }); repop(); break;
      case 'bd-in': setBlock({ bd: v, bdw: ((E.block[b.getAttribute('data-kb')] || {}).bdw) || 2 }, false); break;
      case 'rad': setBlock({ rad: v === 'full' ? 'full' : +v }); repop(); break;
      case 'sh': setBlock({ sh: v || null }); repop(); break;
      case 'pad': setBlock({ pad: +v }); repop(); break;
      case 'op': setBlock({ op: +v / 100 >= 1 ? null : +v / 100 }, false); q('output', ui.pop).textContent = v + '%'; break;
      case 'resetstyle': ['bg', 'bd', 'bdw', 'rad', 'sh', 'pad', 'op'].forEach(function (k) { var o = blk(b.getAttribute('data-kb')); delete o[k]; }); setBlock({}); repop(); break;
      case 'span': setBlock({ span: v === '' ? null : (v === 'full' ? 'full' : +v) }); repop(); break;
      case 'al': setBlock({ al: v || null }); repop(); break;
      case 'resetsize': setBlock({ bw: null, bh: null }); repop(); break;
      case 'up': moveBlock(-1); break;
      case 'down': moveBlock(1); break;
      case 'cols': setCols(v ? +v : 0); repop(); break;
      case 'free': freeMode = !freeMode; document.body.classList.toggle('kb-free', freeMode); closePop(); if (freeMode) toast('Now drag the block anywhere you like. Press Esc when you are done.'); break;
      case 'resetpos': setBlock({ tr: null }); break;
      case 'trow+': case 'trow-': case 'tcol+': case 'tcol-': tableOp(a); repop(); break;
      case 'ar': setImg({ ar: v || '', fit: v ? (readImg(im).fit || 'cover') : '' }); repop(); break;
      case 'fit': setImg({ fit: v }); repop(); break;
      case 'pos': setImg({ pos: v }); repop(); break;
      case 'alt-in': setImg({ alt: v }, true); break;
      case 'replace': pickReplace(im); break;
      case 'removeimg': removeImg(im); break;
      case 'save': closePop(); doSave(); break;
      case 'dlpage': closePop(); downloadPage(); break;
      case 'clearadded': closePop(); clearAdded(); break;
      case 'discard': closePop(); discardAll(); break;
    }
  }
  function tcLive(v) { textTargets().forEach(function (t) { t.style.color = v; persistText(t); }); place(); }
  function setImg(p, quiet) {
    var im = selImg(); if (!im) return; var o = readImg(im); Object.keys(p).forEach(function (k) { o[k] = p[k]; }); if (o.ar === '') { delete o.ar; if (!p.fit) delete o.fit; } if (p.pos === '50% 50%') delete o.pos;
    applyImg(im, o); persistImg(im); if (!quiet) commit(); else dirty(); place();
  }
  function persistImg(im) {
    var b = blockOf(im); if (!b) return;
    if (b.hasAttribute('data-added')) saveAdded(b); else { var o = readImg(im); blk(b.getAttribute('data-kb')).img = o; if (!Object.keys(o).length) delete blk(b.getAttribute('data-kb')).img; dirty(); }
  }
  function applyLink(url) {
    var t = selText(); if (!t) return; closePop(); if (url && !/^(https?:|mailto:|tel:|#|uploads\/|\.\/|\/)/i.test(url)) url = /^[\w.-]+\.[a-z]{2,}/i.test(url) ? 'https://' + url : url;
    if (t.matches('.kb-btn')) { t.setAttribute('href', url || '#'); persistText(t); commit(); toast(url ? 'Button link saved.' : 'Button link removed.'); return; }
    if (savedRange) { var s = window.getSelection(); s.removeAllRanges(); s.addRange(savedRange); }
    if (url) document.execCommand('createLink', false, url); else document.execCommand('unlink'); persistText(t); commit();
  }
  function removeImg(im) {
    if (!im) return; var host = im.closest('figure,.kb-side,.kb-card,.kb-herobg'), b = blockOf(im); closePop();
    if (im.closest('.kb-grid') && host && host.tagName === 'FIGURE') { host.remove(); if (!q('.kb-grid figure', b)) { q('.kb-grid', b).innerHTML = '<div class="kb-drop" data-drop="gallery"><b>Drop several pictures here</b><span>or click to choose them</span></div>'; decorate(b); } }
    else { var d = document.createElement('div'); d.className = 'kb-drop' + (im.closest('.kb-card') ? ' kb-drop-sm' : '') + (im.closest('.kb-herobg') ? ' kb-drop-hero' : ''); d.setAttribute('data-drop', im.closest('.kb-herobg') ? 'hero' : 'image'); d.innerHTML = '<b>Drop a picture here</b><span>or click to choose one</span>'; im.replaceWith(d); }
    if (b && b.hasAttribute('data-added')) saveAdded(b); commit(); deselect(); if (b) select(b);
  }

  /* ---------- opening a popover from a button ---------- */
  function barAct(act, el) {
    if (act === 'b' || act === 'i' || act === 'u') { fmt(act); renderBar(); place(); return; }
    if (act === 'replace') { pickReplace(selImg()); return; }
    if (act === 'link') { var s = window.getSelection(); savedRange = s && s.rangeCount ? s.getRangeAt(0).cloneRange() : null; }
    openPop(act, el);
  }
  function chipAct(act, el) {
    if (act === 'style' || act === 'layout') { openPop(act, el); return; }
    closePop();
    if (act === 'dup') duplicateSel(); else if (act === 'del') deleteSel(); else if (act === 'restore') restoreSel();
  }

  /* ---------- top bar and page level actions ---------- */
  function doSave() {
    saveBundle().then(function (r) { dirtyDownloaded = JSON.stringify(pruned()); showPublish(r); }).catch(function (err) { toast('I could not make the file (' + ((err && err.message) || 'unknown error') + ').'); });
  }
  var dirtyDownloaded = '';
  function showPublish(r) {
    var steps = r.kind === 'zip' ?
      '<ol class="kbm-steps"><li><b>Unzip</b> the file that just downloaded.</li><li>In GitHub, open the folder that holds this page, then choose <b>Add file \u203A Upload files</b>.</li><li>Drag in <b>' + esc(EDITS_FILE) + '</b> and the <b>' + esc(UPLOADS.replace('/', '')) + '</b> folder (' + r.files + (r.files === 1 ? ' file' : ' files') + ', ' + fmtSize(r.size) + ' in all).</li><li>Click <b>Commit changes</b>. Students see it in about a minute.</li></ol>' :
      '<ol class="kbm-steps"><li>In GitHub, open the folder that holds this page, then choose <b>Add file \u203A Upload files</b>.</li><li>Drag in <b>' + esc(EDITS_FILE) + '</b> (replace the old one).</li><li>Click <b>Commit changes</b>. Students see it in about a minute.</li></ol>';
    var warn = r.missing && r.missing.length ? '<p class="kbm-warn">' + r.missing.length + ' picture' + (r.missing.length === 1 ? ' or file is' : 's or files are') + ' used on the page but not saved in this browser. If you already published ' + (r.missing.length === 1 ? 'it' : 'them') + ' before, that is fine.</p>' : '';
    openModal({ title: '\u2713 Your changes are saved', html: '<p>Nothing is live until you upload them.</p>' + steps + warn, buttons: [{ id: 'ok', label: 'Got it', primary: true }] });
  }
  function discardAll() {
    openModal({ title: 'Discard all unsaved changes?', html: '<p>The page goes back to how it is published right now. Pictures you added but have not published stay in this browser.</p>', buttons: [{ id: 'no', label: 'Keep editing' }, { id: 'yes', label: 'Discard changes', primary: true, danger: true }] }).then(function (r) {
      if (r !== 'yes') return; E = copy(pub); hist = [snap(E)]; redo = []; try { localStorage.removeItem(DRAFT_KEY); } catch (e) {} applyGlobal(); rerender(); toast('Back to the published page.');
    });
  }
  function clearAdded() {
    var added = qa('[data-added]'); if (!added.length) { toast('Nothing has been added to this page yet.'); return; }
    openModal({ title: 'Clear what you added?', html: '<p>This removes the ' + added.length + (added.length === 1 ? ' block' : ' blocks') + ' you added to this page. You can press Undo straight after to bring ' + (added.length === 1 ? 'it' : 'them') + ' back.</p>', buttons: [{ id: 'no', label: 'Keep them' }, { id: 'yes', label: 'Clear them', primary: true, danger: true }] }).then(function (r) {
      if (r !== 'yes') return; deselect(); var cs = qa('[data-kc]');
      added.forEach(function (x) { delete E.block[x.getAttribute('data-kb')]; x.remove(); });
      cs.forEach(function (c) { var ck = c.getAttribute('data-kc'); if (E.add[ck]) { var ids = E.add[ck].map(function (x) { return x.id; }); delete E.add[ck]; if (E.order[ck]) E.order[ck] = E.order[ck].filter(function (x) { return ids.indexOf(x) < 0; }); } });
      commit(); toast('Cleared. Press Undo to bring them back.');
    });
  }
  function inlineAssets(root) {
    return Promise.all(qa('img', root).map(function (im) {
      var p = im.getAttribute('data-path') || (im.getAttribute('src') || ''); if (p.indexOf(UPLOADS) !== 0 && !im.getAttribute('data-path')) return null;
      p = im.getAttribute('data-path') || p; return getBlob(p).then(function (b) { return b ? new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { im.setAttribute('src', fr.result); im.removeAttribute('data-path'); res(); }; fr.readAsDataURL(b); }) : null; });
    })).then(function () {
      return Promise.all(qa('a[href^="' + UPLOADS + '"]', root).map(function (a) {
        return getBlob(a.getAttribute('href')).then(function (b) { if (b && b.size < 6 * 1048576) return new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { a.setAttribute('href', fr.result); res(); }; fr.readAsDataURL(b); }); });
      }));
    });
  }
  function downloadPage() {
    deselect(); var root = curRoot || document.body, c = root.cloneNode(true);
    [c].concat(qa('*', c)).forEach(function (n) { ['contenteditable', 'spellcheck', 'draggable', 'data-kt', 'data-kb', 'data-kc', 'data-added', 'data-aid'].forEach(function (a) { n.removeAttribute(a); }); if (n.classList) n.classList.remove('ed-sel', 'ed-drop'); });
    qa('.ed-hidden', c).forEach(function (n) { n.remove(); }); qa(UI_SEL, c).forEach(function (n) { n.remove(); });
    inlineAssets(c).then(function () {
      var title = ((q('h1', c) || {}).textContent || document.title || 'Page').trim(), css = qa('style').map(function (s) { return s.textContent; }).join('\n'), links = qa('link[rel="stylesheet"]').map(function (l) { return l.outerHTML; }).join('\n');
      var st = document.documentElement.getAttribute('style') || '';
      var html = '<!DOCTYPE html>\n<html lang="en" style="' + esc(st) + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + esc(title) + '</title>' + links + '<style>' + css + '</style></head><body><main class="wrap">' + c.outerHTML + '</main><script>' + SLIDES_RUNTIME + '<\/script></body></html>';
      downloadBlob(new Blob([html], { type: 'text/html' }), title.replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 60) + '.html'); toast('Saved this page as a single file.');
    });
  }

  /* ---------- wiring ---------- */
  function wireUi() {
    var $id = function (i) { return q('#' + i); };
    $id('kbUndo').addEventListener('click', undo); $id('kbRedo').addEventListener('click', redoIt);
    $id('kbSave').addEventListener('click', doSave); $id('kbSaveMore').addEventListener('click', function (e) { openPop('save', e.currentTarget); });
    $id('kbPreview').addEventListener('click', function () { setEditing(false); });
    $id('kbPresent').addEventListener('click', function () { present(true); });
    $id('kbExit').addEventListener('click', exit); ui.back.addEventListener('click', function () { setEditing(true); });
    ui.fab.addEventListener('click', function () { openAdd(true); });
    $id('kbPage').addEventListener('change', function (e) { var v = e.target.value; if (v) location.hash = v; });
    [ui.bar, ui.chip, ui.top].forEach(function (el) { el.addEventListener('mousedown', function (e) { if (!e.target.closest('input,select,textarea')) e.preventDefault(); }); });
    ui.bar.addEventListener('click', function (e) { var b = e.target.closest('[data-act]'); if (b) barAct(b.getAttribute('data-act'), b); });
    ui.chip.addEventListener('click', function (e) { var b = e.target.closest('[data-act]'); if (b) chipAct(b.getAttribute('data-act'), b); });
    ui.pop.addEventListener('mousedown', function (e) { if (!e.target.closest('input,select,textarea')) e.preventDefault(); });
    ui.pop.addEventListener('click', function (e) { var b = e.target.closest('[data-a]'); if (!b || b.tagName === 'INPUT' || b.tagName === 'LABEL') return; popAct(b.getAttribute('data-a'), b.getAttribute('data-v'), b); });
    ui.pop.addEventListener('input', function (e) { var t = e.target; if (t.matches('input[data-a]')) popAct(t.getAttribute('data-a'), t.value, t); });
    ui.pop.addEventListener('change', function (e) { var t = e.target; if (t.matches('input[type=color],input[type=range]')) { commit(); repop(); } else if (t.getAttribute('data-a') === 'alt-in') commit(); });
    ui.pop.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.getAttribute('data-a') === 'link-in') { e.preventDefault(); applyLink(e.target.value.trim()); } });
    document.addEventListener('pointerdown', function (e) { if (popKind && !e.target.closest('#kbPop,#kbBar,#kbChip,#kbTop')) closePop(); }, true);
    /* the Add drawer */
    ui.add.addEventListener('click', function (e) {
      var t = e.target;
      if (t.closest('#kbAddClose')) { openAdd(false); return; }
      var tab = t.closest('[data-tab]'); if (tab) { addTab = tab.getAttribute('data-tab'); renderAdd(); return; }
      if (t.closest('#kbPick')) { pickFiles(); return; }
      var os = t.closest('[data-oselect]'); if (os) { var ob = blockByKey(os.getAttribute('data-oselect')); if (ob) { select(ob); ob.scrollIntoView({ block: 'center', behavior: 'smooth' }); } return; }
      var oh = t.closest('[data-ohide]'); if (oh) { var hb = blockByKey(oh.getAttribute('data-ohide')); if (hb) { var hk = hb.getAttribute('data-kb'); if (E.hide[hk]) delete E.hide[hk]; else E.hide[hk] = 1; hb.classList.toggle('ed-hidden', !!E.hide[hk]); commit(); renderAdd(); } return; }
      var bt = t.closest('[data-block]'); if (bt) { addBlock(bt.getAttribute('data-block')); return; }
      var tp = t.closest('[data-tpl]'); if (tp) { addTemplate(tp.getAttribute('data-tpl')); return; }
      var pal = t.closest('[data-pal]'); if (pal) { setGlobal({ pal: pal.getAttribute('data-pal') }); return; }
      var pr = t.closest('[data-pair]'); if (pr) { var p = PAIRS.filter(function (x) { return x.id === pr.getAttribute('data-pair'); })[0]; setGlobal({ body: p.body, display: p.display }); return; }
      var rd = t.closest('[data-rad]'); if (rd) { setGlobal({ radius: +rd.getAttribute('data-rad') }); return; }
      var gp = t.closest('[data-gap]'); if (gp) { setGlobal({ gap: +gp.getAttribute('data-gap') }); return; }
      var sc = t.closest('[data-scale]'); if (sc) { var cur = (E.global.scale || 100) + (+sc.getAttribute('data-scale')); setGlobal({ scale: Math.max(80, Math.min(140, cur)) === 100 ? null : Math.max(80, Math.min(140, cur)) }); return; }
      if (t.closest('[data-resetdesign]')) { E.global = {}; applyGlobal(); commit(); renderAdd(); return; }
    });
    ui.add.addEventListener('input', function (e) {
      if (e.target.id !== 'kbSearch') return; var v = e.target.value.trim().toLowerCase();
      qa('.kba-tile', ui.add).forEach(function (t) { t.hidden = !!v && t.getAttribute('data-s').indexOf(v) < 0; });
      qa('.kba-g', ui.add).forEach(function (g) { var grid = q('.kba-grid[data-g="' + g.getAttribute('data-g') + '"]', ui.add); var any = qa('.kba-tile', grid).some(function (t) { return !t.hidden; }); g.hidden = grid.hidden = !any; });
    });
    ui.add.addEventListener('dragstart', function (e) { var t = e.target.closest && e.target.closest('[data-block]'); if (!t) return; e.dataTransfer.setData('text/kb-block', t.getAttribute('data-block')); e.dataTransfer.effectAllowed = 'copy'; dragBlockId = t.getAttribute('data-block'); });
    ui.add.addEventListener('dragend', function () { dragBlockId = null; dragKey = null; hideLine(); });

    /* selecting things on the page */
    document.addEventListener('click', function (e) {
      if (!editing || presenting) return;
      if (suppressClick) { e.preventDefault(); e.stopPropagation(); return; }
      var t = e.target; if (!t.closest || t.closest(UI_SEL)) return;
      var a = t.closest('a'), href = a ? (a.getAttribute('href') || '') : '';
      if (a && /^#./.test(href) && (a.hasAttribute('data-kb') || !a.closest('[contenteditable="true"]'))) return;   /* lessons, tiles and tabs open as normal */
      if (a && !t.closest('.kb-slides-bar')) e.preventDefault(); if (t.closest('summary')) e.preventDefault();
      var drop = t.closest('.kb-drop'); if (drop) { var mb = t.closest('[data-mact]'); if (mb && mb.getAttribute('data-mact') === 'link') askLink({ type: 'drop', el: drop }); else pickForDrop(drop); return; }
      var im = t.closest('img'); if (im && blockOf(im) && !im.closest('.kb-slides')) { select(im); return; }
      var tx = textOf(t); if (tx) { select(tx); return; }
      var bl = blockOf(t); if (bl) { select(bl); return; }
      if (t.closest('main,#main,.wrap')) deselect();
    }, true);
    document.addEventListener('focusin', function (e) { if (!editing || presenting) return; var t = e.target; if (t.closest && !t.closest(UI_SEL)) { var tx = textOf(t); if (tx && tx !== sel) select(tx); } });
    document.addEventListener('keyup', function (e) { if (editing && sel && selText() && /Arrow|Backspace|Delete|Enter/.test(e.key)) { renderBar(); place(); } });
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', place, { passive: true }); window.addEventListener('resize', place);

    /* resizing with the corner handle */
    var rs = null;
    ui.rz.addEventListener('pointerdown', function (e) { var b = selBlock(); if (!b) return; e.preventDefault(); ui.rz.setPointerCapture(e.pointerId); var r0 = b.getBoundingClientRect(); rs = { b: b, x: e.clientX, y: e.clientY, w: r0.width, h: r0.height, fig: !!figTarget(b) }; closePop(); });
    ui.rz.addEventListener('pointermove', function (e) {
      if (!rs) return; var w = Math.round(Math.max(120, rs.w + e.clientX - rs.x)), h = Math.round(Math.max(40, rs.h + e.clientY - rs.y));
      if (rs.fig) { var fg = figTarget(rs.b); fg.style.width = w + 'px'; fg.style.maxWidth = '100%'; } else { rs.b.style.maxWidth = '100%'; rs.b.style.width = w + 'px'; if (rs.b.matches('.kb-spacer') || e.shiftKey === false && rs.h < 400 && false) rs.b.style.minHeight = h + 'px'; else rs.b.style.minHeight = h + 'px'; }
      place();
    });
    function endRz(e) { if (!rs) return; var b = rs.b, k = b.getAttribute('data-kb'), o = blk(k); if (rs.fig) o.w = Math.round(parseFloat(figTarget(b).style.width)); else { o.bw = Math.round(parseFloat(b.style.width)); o.bh = Math.round(parseFloat(b.style.minHeight)); } rs = null; try { ui.rz.releasePointerCapture(e.pointerId); } catch (x) {} commit(); place(); }
    ui.rz.addEventListener('pointerup', endRz); ui.rz.addEventListener('pointercancel', endRz);

    /* placing a block anywhere */
    var fm = null;
    document.addEventListener('pointerdown', function (e) {
      if (!freeMode || !editing) return; var b = selBlock(); if (!b || !b.contains(e.target) || e.target.closest(UI_SEL)) return; e.preventDefault();
      var o = blk(b.getAttribute('data-kb')), m = /translate\(\s*(-?[\d.]+)px\s*,\s*(-?[\d.]+)px\s*\)/.exec(o.tr || ''); fm = { b: b, x: e.clientX, y: e.clientY, ox: m ? +m[1] : 0, oy: m ? +m[2] : 0 };
    }, true);
    document.addEventListener('pointermove', function (e) { if (!fm) return; var dx = Math.round(fm.ox + e.clientX - fm.x), dy = Math.round(fm.oy + e.clientY - fm.y); fm.b.style.transform = 'translate(' + dx + 'px, ' + dy + 'px)'; fm.b.setAttribute('data-kfree', '1'); place(); });
    document.addEventListener('pointerup', function () { if (!fm) return; var b = fm.b, k = b.getAttribute('data-kb'); fm = null; blk(k).tr = b.style.transform; commit(); place(); });

    wireDrop(); wireDrag();
  }
  function onKey(e) {
    if (!teacher) return;
    if (presenting) { if (e.key === 'Escape') present(false); return; }
    if (!editing) { if (e.key === 'Escape' && ui.back && !ui.back.hidden) setEditing(true); return; }
    var inText = e.target.closest && e.target.closest('[contenteditable="true"],input,select,textarea'), mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (e.key === 'Escape') {
      if (ui.modal && !ui.modal.hidden) { closeModal(); return; } if (popKind) { closePop(); return; } if (freeMode) { freeMode = false; document.body.classList.remove('kb-free'); return; }
      if (document.body.classList.contains('kb-add-open') && !sel) { openAdd(false); return; } if (inText && document.activeElement && document.activeElement.blur) document.activeElement.blur(); if (sel) deselect(); return;
    }
    if (mod && !inText && k === 'z') { e.preventDefault(); e.shiftKey ? redoIt() : undo(); return; }
    if (mod && !inText && k === 'y') { e.preventDefault(); redoIt(); return; }
    if (inText) return;
    if (mod && k === 'd') { e.preventDefault(); duplicateSel(); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selBlock()) { e.preventDefault(); deleteSel(); }
  }

  /* =====================================================================
     PRESS AND DRAG ANY BLOCK. ARRANGE VIEW. TABLES.
     ===================================================================== */
  var bd = null, dragging = null, dragSpot = null, lastPt = null, suppressClick = false, scrollV = 0, scrollRaf = 0, arrange = false;
  var INTERACTIVE = 'button,input,select,textarea,summary,[role="button"],.kb-drop,#kbRz,.kb-slides-bar a,.kb-filecard,.kb-linkcard';
  function bdDown(e) {
    if (!editing || presenting || freeMode || e.button > 0 || bd) return;
    var t = e.target, grip = t.closest && t.closest('.kbc-grip');
    if (!grip && t.closest && t.closest(UI_SEL)) return;
    var b = grip ? selBlock() : blockOf(t); if (!b) return;
    if (!grip && t.closest && t.closest(INTERACTIVE) && !arrange) return;
    var inText = !grip && !arrange && !!textOf(t);
    bd = { b: b, x0: e.clientX, y0: e.clientY, inText: inText, hold: false, timer: null };
    if (inText) bd.timer = setTimeout(function () { if (bd && !dragging) { bd.hold = true; document.body.classList.add('kb-holding'); } }, 380);
    window.addEventListener('pointermove', bdMove, true); window.addEventListener('pointerup', bdUp, true); window.addEventListener('pointercancel', bdUp, true);
  }
  function cancelBd() { if (bd) clearTimeout(bd.timer); bd = null; document.body.classList.remove('kb-holding'); window.removeEventListener('pointermove', bdMove, true); window.removeEventListener('pointerup', bdUp, true); window.removeEventListener('pointercancel', bdUp, true); }
  function bdMove(e) {
    if (!bd) return; var d = Math.hypot(e.clientX - bd.x0, e.clientY - bd.y0);
    if (!dragging) {
      if (bd.inText && !bd.hold) { if (d > 5) cancelBd(); return; }
      if (d < 6) return; startDrag(e);
    }
    moveDrag(e);
  }
  function startDrag() {
    clearTimeout(bd.timer); dragging = bd.b; suppressClick = true; select(dragging); closePop();
    document.body.classList.add('kb-dragging'); dragging.classList.add('ed-dragging');
    var s = window.getSelection && window.getSelection(); if (s) s.removeAllRanges(); if (document.activeElement && document.activeElement.blur && document.activeElement !== document.body) document.activeElement.blur();
    ui.ghost.textContent = blockLabel(dragging); ui.ghost.hidden = false; scrollLoop();
  }
  function moveDrag(e) {
    lastPt = { x: e.clientX, y: e.clientY }; ui.ghost.style.left = (e.clientX + 16) + 'px'; ui.ghost.style.top = (e.clientY + 14) + 'px';
    dragSpot = spotAt(e.clientX, e.clientY, dragging); showLine(dragSpot);
    scrollV = e.clientY < 90 ? -Math.ceil((90 - e.clientY) / 5) : e.clientY > window.innerHeight - 90 ? Math.ceil((e.clientY - (window.innerHeight - 90)) / 5) : 0;
  }
  function scrollLoop() {
    if (!dragging) return;
    if (scrollV && lastPt) { window.scrollBy(0, scrollV); dragSpot = spotAt(lastPt.x, lastPt.y, dragging); showLine(dragSpot); }
    scrollRaf = requestAnimationFrame(scrollLoop);
  }
  function bdUp() {
    var d = dragging, spot = dragSpot; cancelBd();
    if (d) {
      document.body.classList.remove('kb-dragging'); d.classList.remove('ed-dragging'); ui.ghost.hidden = true; hideLine(); cancelAnimationFrame(scrollRaf); scrollV = 0; dragging = null; dragSpot = null;
      if (spot && !(spot.c === d.parentElement && spot.ref === d.nextElementSibling)) moveBlockTo(d, spot.c, spot.ref);
      setTimeout(function () { suppressClick = false; }, 80); place();
    }
  }

  /* ---------- Arrange: every block shrinks to a card so the whole page fits on one screen ---------- */
  function labelAll() { qa('[data-kb]', curRoot || document).forEach(function (b) { var s = snippet(b); b.setAttribute('data-label', blockLabel(b) + (s ? '  \u00B7  ' + s : '')); }); }
  function setArrange(on) {
    arrange = !!on; document.body.classList.toggle('kb-arrange', arrange); var bt = q('#kbArrange'); if (bt) bt.setAttribute('aria-pressed', String(arrange));
    closePop(); deselect();
    if (arrange) { labelAll(); toast('Arrange: press and drag any card to a new place, even into a box. Press Arrange again when you are done.', 5000); }
    else qa('[data-label]').forEach(function (n) { n.removeAttribute('data-label'); });
    place();
  }

  /* ---------- tables ---------- */
  function tableOp(op) {
    var b = selBlock(), tb = b && q('.kb-table', b); if (!tb) return;
    var cell = selText(); cell = cell && /^(TD|TH)$/.test(cell.tagName) && tb.contains(cell) ? cell : null;
    var body = q('tbody', tb) || tb, rows = qa('tr', tb), cols = rows[0] ? rows[0].cells.length : 0, tr = cell && cell.closest('tr'), ci = cell ? cell.cellIndex : cols - 1;
    if (op === 'trow+') {
      var nr = document.createElement('tr'); for (var i = 0; i < cols; i++) nr.appendChild(document.createElement('td'));
      if (tr && tr.parentElement === body) body.insertBefore(nr, tr.nextSibling); else if (tr && tr.parentElement.tagName === 'THEAD') body.insertBefore(nr, body.firstChild); else body.appendChild(nr);
    } else if (op === 'trow-') {
      var bodyRows = qa('tr', body); if (bodyRows.length < 2) { toast('A table needs at least one row.'); return; } (tr && tr.parentElement === body ? tr : bodyRows[bodyRows.length - 1]).remove();
    } else if (op === 'tcol+') {
      rows.forEach(function (r) { var c = document.createElement(r.parentElement.tagName === 'THEAD' ? 'th' : 'td'); r.insertBefore(c, r.cells[ci + 1] || null); });
    } else if (op === 'tcol-') {
      if (cols < 2) { toast('A table needs at least one column.'); return; } rows.forEach(function (r) { if (r.cells[ci]) r.deleteCell(ci); });
    }
    decorate(b); saveAdded(b); commit(); place();
  }

  function wireDrag() {
    document.addEventListener('pointerdown', bdDown, true);
    q('#kbArrange').addEventListener('click', function () { setArrange(!arrange); });
    ui.add.addEventListener('dragstart', function (e) {
      var o = e.target.closest && e.target.closest('[data-key]'); if (!o) return;
      e.dataTransfer.setData('text/kb-key', o.getAttribute('data-key')); e.dataTransfer.effectAllowed = 'move'; dragKey = o.getAttribute('data-key');
    });
  }

  /* =====================================================================
     SNAPPING THINGS INTO PLACE: blocks, elements, pictures, files, links
     ===================================================================== */
  var dragBlockId = null, dragKey = null;
  function hasFiles(dt) { return !!dt && Array.prototype.indexOf.call(dt.types || [], 'Files') > -1; }
  function isImage(f) { return (/^image\//.test(f.type || '') && !/svg/.test(f.type || '')) || /\.(jpe?g|png|gif|webp|bmp)$/i.test(f.name || ''); }
  function isVideo(f) { return /^video\/(mp4|webm|ogg)/.test(f.type || '') || /\.(mp4|webm|ogv|m4v)$/i.test(f.name || ''); }
  function containerNow() { return mainC && document.body.contains(mainC) ? mainC : null; }
  function blockByKey(k) { return qa('[data-kb]').filter(function (b) { return b.getAttribute('data-kb') === k; })[0] || null; }
  /* blocks can be dropped on the page itself or inside a design block's slot (never inside themselves) */
  function acceptsBlocks(c, ex) {
    if (!c) return false; if (ex && ex.contains(c)) return false;
    return c === mainC || c.classList.contains('kb-slot') || !!(ex && c === ex.parentElement);
  }
  function containerAt(x, y, ex) {
    var el = document.elementFromPoint(x, y), c = el && el.closest ? el.closest('[data-kc]') : null;
    while (c && !acceptsBlocks(c, ex)) c = c.parentElement ? c.parentElement.closest('[data-kc]') : null;
    return c || (ex && ex.parentElement && ex.parentElement.hasAttribute('data-kc') ? ex.parentElement : containerNow());
  }
  function spotIn(c, x, y, ex) {
    var kids = blockKids(c).filter(function (k) { return k !== ex; }), cr = c.getBoundingClientRect();
    if (!kids.length) return { c: c, ref: null, line: { x: cr.left + 8, y: cr.top + 8, w: Math.max(24, cr.width - 16), h: 4 } };
    var best = null, bd = 1e12;
    kids.forEach(function (k) { var r = k.getBoundingClientRect(), dx = x < r.left ? r.left - x : x > r.right ? x - r.right : 0, dy = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0, d = dx * dx + dy * dy * 4; if (d < bd) { bd = d; best = { k: k, r: r }; } });
    var r = best.r, side = c === mainC && r.width < cr.width * 0.7, inRow = y >= r.top && y <= r.bottom, before = side && inRow ? x < r.left + r.width / 2 : y < r.top + r.height / 2;
    return { c: c, ref: before ? best.k : best.k.nextElementSibling, line: side && inRow ? { x: (before ? r.left - 9 : r.right + 5), y: r.top, w: 4, h: r.height } : { x: cr.left + 4, y: before ? r.top - 11 : r.bottom + 7, w: cr.width - 8, h: 4 } };
  }
  function spotAt(x, y, ex) { var c = containerAt(x, y, ex); return c ? spotIn(c, x, y, ex) : null; }
  /* where a block goes when you click it in the drawer instead of dragging it */
  function defaultSpot(forDesign) {
    var b = selBlock(), c = containerNow();
    if (b) {
      if (forDesign) { var top = b; while (top.parentElement && top.parentElement.classList.contains('kb-slot')) top = top.parentElement.closest('[data-kb]') || top; if (top.parentElement && top.parentElement.hasAttribute('data-kc')) return { c: top.parentElement, ref: top.nextElementSibling }; }
      else {
        if (b.classList.contains('kb-d')) { var slots = qa('.kb-slot[data-kc]', b).filter(function (s) { return s.closest('[data-kb]') === b; }), emp = slots.filter(function (s) { return !s.children.length; })[0] || slots[0]; if (emp) return { c: emp, ref: null }; }
        var pc = b.parentElement; if (pc && pc.hasAttribute('data-kc') && acceptsBlocks(pc)) return { c: pc, ref: b.nextElementSibling };
      }
    }
    return c ? { c: c, ref: null } : null;
  }
  function showLine(s) { if (!s) { hideLine(); return; } var l = ui.line; l.hidden = false; l.style.left = Math.round(s.line.x) + 'px'; l.style.top = Math.round(s.line.y) + 'px'; l.style.width = Math.round(s.line.w) + 'px'; l.style.height = Math.round(s.line.h) + 'px'; markOver(s.c); }
  function hideLine() { if (ui.line) ui.line.hidden = true; markOver(null); }
  function markOver(c) { qa('.kb-over').forEach(function (x) { if (x !== c) x.classList.remove('kb-over'); }); if (c && c.classList.contains('kb-slot')) c.classList.add('kb-over'); }

  /* what is under the pointer that a dropped picture or file should fill? */
  function fillTarget(el) {
    if (!el || !el.closest || el.closest(UI_SEL)) return null;
    var d = el.closest('.kb-drop'); if (d) return { type: 'drop', el: d };
    var g = el.closest('.kb-gallery, .kb-media .kb-grid'); if (g) return { type: 'gallery', el: g };
    var im = el.closest('img'); if (im && blockOf(im) && !im.closest('.kb-slides')) return { type: 'img', el: im };
    return null;
  }
  function markDrop(t) { qa('.ed-drop').forEach(function (x) { x.classList.remove('ed-drop'); }); if (t) t.el.classList.add('ed-drop'); }

  function wireDrop() {
    var depth = 0;
    document.addEventListener('dragenter', function (e) { if (editing && !presenting && hasFiles(e.dataTransfer)) { depth++; ui.drop.hidden = false; } });
    document.addEventListener('dragleave', function (e) { if (hasFiles(e.dataTransfer)) { depth = Math.max(0, depth - 1); if (!depth) ui.drop.hidden = true; } });
    document.addEventListener('dragend', function () { dragBlockId = null; dragKey = null; hideLine(); markDrop(null); depth = 0; ui.drop.hidden = true; });
    document.addEventListener('dragover', function (e) {
      if (!editing || presenting) return; var dt = e.dataTransfer; if (!dt) return;
      var file = hasFiles(dt), blockDrag = !!dragBlockId || Array.prototype.indexOf.call(dt.types || [], 'text/kb-block') > -1, keyDrag = !!dragKey || Array.prototype.indexOf.call(dt.types || [], 'text/kb-key') > -1;
      if (!file && !blockDrag && !keyDrag) return; if (e.target.closest && e.target.closest('#kbAdd,#kbTop,#kbModal')) return;
      e.preventDefault(); dt.dropEffect = keyDrag ? 'move' : 'copy';
      var ft = file ? fillTarget(e.target) : null; markDrop(ft); if (ft) { hideLine(); return; }
      showLine(spotAt(e.clientX, e.clientY, keyDrag ? blockByKey(dragKey) : null));
    });
    document.addEventListener('drop', function (e) {
      if (!editing || presenting) return; var dt = e.dataTransfer; if (!dt) return;
      var files = Array.prototype.slice.call(dt.files || []), bid = (dt.getData && dt.getData('text/kb-block')) || dragBlockId, key = (dt.getData && dt.getData('text/kb-key')) || dragKey;
      if (e.target.closest && e.target.closest('#kbAdd,#kbTop,#kbModal')) { depth = 0; ui.drop.hidden = true; return; }
      var ft = files.length ? fillTarget(e.target) : null; depth = 0; ui.drop.hidden = true; markDrop(null);
      var movedEl = key ? blockByKey(key) : null, s = null;
      if (!files.length) { s = spotAt(e.clientX, e.clientY, movedEl); } hideLine();
      if (key && movedEl && !files.length) { e.preventDefault(); dragKey = null; if (s) { moveBlockTo(movedEl, s.c, s.ref); select(movedEl); } return; }
      if (bid && !files.length) { e.preventDefault(); dragBlockId = null; addBlock(bid, s); return; }
      if (files.length) { e.preventDefault(); handleFiles(files, spotAt(e.clientX, e.clientY, null), ft); }
    });
    document.addEventListener('paste', function (e) {
      if (!editing || presenting) return; var cd = e.clipboardData; if (!cd || !cd.files || !cd.files.length) return;
      if (e.target.closest && e.target.closest('input,textarea')) return; e.preventDefault(); handleFiles(Array.prototype.slice.call(cd.files), defaultSpot(), null);
    });
    ui.modal.addEventListener('click', function (e) {
      var b = e.target.closest('[data-r]'); if (b) { closeModal(b.getAttribute('data-r')); return; }
      var c = e.target.closest('[data-file] button'); if (c) { if (c.disabled) return; qa('button', c.parentElement).forEach(function (x) { x.setAttribute('aria-pressed', String(x === c)); }); return; }
      if (e.target === ui.modal) closeModal(null);
    });
  }

  /* ---------- modal windows ---------- */
  var modalResolve = null;
  function openModal(o) {
    var card = q('.kbm-card', ui.modal);
    card.innerHTML = '<h2>' + o.title + '</h2><div class="kbm-body">' + o.html + '</div><div class="kbm-btns">' + o.buttons.map(function (b) { return '<button type="button" class="' + (b.primary ? 'kbu-pri' + (b.danger ? ' danger' : '') : 'kbu-txt') + '" data-r="' + b.id + '">' + b.label + '</button>'; }).join('') + '</div>';
    ui.modal.hidden = false; document.body.classList.add('kb-modal-open'); var f = q('input[type=url],input[type=text]', card) || q('.kbu-pri', card) || q('button', card); if (f) setTimeout(function () { f.focus(); }, 30);
    return new Promise(function (res) { modalResolve = res; });
  }
  function closeModal(v) { ui.modal.hidden = true; document.body.classList.remove('kb-modal-open'); var r = modalResolve; modalResolve = null; if (r) r(v || null); }

  /* ---------- adding design blocks, elements and whole layouts ---------- */
  function insertDef(d, spot, over) { return insertTree(spot.c, { def: d, html: over && over.html }, spot.ref); }
  function addBlock(id, spot) {
    var d = blockDef(id); if (!d) return; spot = spot || defaultSpot(!!d.design);
    if (!spot) { toast('Blocks can be added on lesson pages. Open a lesson from the page menu at the top.'); return; }
    var el = insertDef(d, spot); commit(); select(el); el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    toast(d.design ? 'Added \u201C' + d.name + '\u201D. Now drag Elements into it.' : 'Added \u201C' + d.name + '\u201D. Click any words to change them.');
  }
  function addTemplate(id) {
    var t = TEMPLATES.filter(function (x) { return x.id === id; })[0]; if (!t) return; var spot = defaultSpot(true); if (!spot) { toast('Open a lesson page first. Layouts are placed on lesson pages.'); return; }
    var first = null; t.parts.forEach(function (p) { var el = insertTree(spot.c, p, spot.ref); if (!first) first = el; });
    commit(); select(first); first.scrollIntoView({ block: 'start', behavior: 'smooth' }); toast('Added the \u201C' + t.name + '\u201D layout.'); openAdd(false);
  }

  /* ---------- picking files with the file chooser ---------- */
  function pickFiles(o) {
    o = o || {}; ui.file.accept = o.accept || ''; ui.file.multiple = true;
    ui.file.onchange = function () { var f = Array.prototype.slice.call(ui.file.files); ui.file.value = ''; if (f.length) handleFiles(f, o.spot || defaultSpot(), o.ft || null, o.force); };
    ui.file.click();
  }
  function pickForDrop(d) {
    var kind = d.getAttribute('data-drop'), multi = kind === 'gallery' || kind === 'media'; ui.file.accept = kind === 'media' ? '' : 'image/*'; ui.file.multiple = multi;
    ui.file.onchange = function () { var f = Array.prototype.slice.call(ui.file.files); if (kind !== 'media') f = f.filter(isImage); ui.file.value = ''; if (f.length) handleFiles(f, null, { type: kind === 'gallery' ? 'gallery' : 'drop', el: d }); };
    ui.file.click();
  }
  function pickReplace(im) {
    if (!im) return; closePop(); ui.file.accept = 'image/*'; ui.file.multiple = false;
    ui.file.onchange = function () { var f = ui.file.files[0]; ui.file.value = ''; if (f) handleFiles([f], null, { type: 'img', el: im }); };
    ui.file.click();
  }

  /* ---------- the Media element: whatever you give it becomes the right thing ---------- */
  function handleFiles(files, spot, ft, force) {
    var imgs = files.filter(isImage), vids = files.filter(isVideo), docs = files.filter(function (f) { return !isImage(f) && !isVideo(f); });
    spot = spot || defaultSpot(); if (!spot && !ft) { toast('Open a page first.'); return Promise.resolve(); }
    var first = ft, p = Promise.resolve(); function use() { var f = first; first = null; return f; }
    function relay(el) { if (el && el.parentElement && el.parentElement.hasAttribute('data-kc')) spot = { c: el.parentElement, ref: el.nextElementSibling }; }
    if (imgs.length) p = p.then(function () { return placeImages(imgs, use(), spot).then(relay); });
    vids.forEach(function (v) { p = p.then(function () { return placeVideo(v, use(), spot).then(relay); }); });
    if (docs.length) p = p.then(function () { return placeDocs(docs, spot, force, use(), relay); });
    return p.catch(function (err) { toast((err && err.message) || 'Something went wrong adding that.'); });
  }
  function nextSpot(el) { return { c: el.parentElement, ref: el.nextElementSibling }; }
  function picEl(path, name) { var im = document.createElement('img'); im.setAttribute('data-path', path); im.src = urlCache[path] || path; im.alt = name || ''; return im; }
  var ADDMORE = '<div class="kb-drop kb-drop-add" data-drop="gallery"><b>+ Add more</b></div>';
  function figHtml(p) { return '<figure class="kb-m-img"><img src="' + esc(p.path) + '" alt="' + esc(p.name) + '"><figcaption></figcaption></figure>'; }
  function gridHtml(pics) { return '<div class="kb-grid">' + pics.map(function (p) { return '<figure><img src="' + esc(p.path) + '" alt="' + esc(p.name) + '"><figcaption></figcaption></figure>'; }).join('') + ADDMORE + '</div>'; }
  /* put finished media where it belongs: inside the Media block that was dropped on, or in a new Media block */
  function sink(html, ft, spot) {
    var d = ft && ft.type === 'drop' && ft.el.getAttribute('data-drop') === 'media' ? ft.el : null;
    if (d) { var b = blockOf(d), tp = document.createElement('template'); tp.innerHTML = clean(html); d.replaceWith(tp.content); resolveAssets(b); decorate(b); saveAdded(b); commit(); select(b); return b; }
    var el = insertDef(blockDef('media'), spot, { html: html }); commit(); select(el); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); return el;
  }
  function addToGrid(block, pics) {
    var grid = q('.kb-grid', block); qa('.kb-drop', grid).forEach(function (d) { d.remove(); });
    pics.forEach(function (p) { var f = document.createElement('figure'); f.appendChild(picEl(p.path, p.name)); f.appendChild(document.createElement('figcaption')); grid.appendChild(f); });
    var tp = document.createElement('template'); tp.innerHTML = ADDMORE; grid.appendChild(tp.content); decorate(block); saveAdded(block);
  }
  function placeImages(files, ft, spot) {
    toast('Adding ' + files.length + (files.length === 1 ? ' picture' : ' pictures') + '\u2026', 60000);
    return Promise.all(files.map(addPicture)).then(function (pics) {
      var done = 'Added ' + pics.length + (pics.length === 1 ? ' picture.' : ' pictures.');
      if (ft && ft.type === 'gallery') { var gb = blockOf(ft.el); addToGrid(gb, pics); commit(); toast(done); return gb; }
      if (ft && ft.type === 'img') {
        var first = pics.shift(), target = ft.el, b = blockOf(target); target.setAttribute('data-path', first.path); target.src = urlCache[first.path]; persistImg(target); if (b && !b.hasAttribute('data-added')) blk(b.getAttribute('data-kb')).src = first.path;
        var more = null; if (pics.length) { more = sink(gridHtml(pics), null, b ? nextSpot(b) : spot); } commit(); if (b) select(b); toast(done); return more || b;
      }
      if (ft && ft.type === 'drop' && ft.el.getAttribute('data-drop') !== 'media') {
        var f1 = pics.shift(), dz = ft.el, kind = dz.getAttribute('data-drop'), bb = blockOf(dz), im = picEl(f1.path, f1.name); if (kind === 'hero') im.className = 'kb-herobg-img'; dz.replaceWith(im); if (bb && bb.hasAttribute('data-added')) saveAdded(bb);
        var extra = pics.length ? sink(gridHtml(pics), null, bb ? nextSpot(bb) : spot) : null; commit(); markEmptyDesigns(curRoot || document); if (bb) select(bb); toast(done); return extra || bb;
      }
      var el = sink(pics.length === 1 ? figHtml(pics[0]) : gridHtml(pics), ft, spot); toast(done + (pics.length > 1 ? ' They are in a gallery. Drop more on it to add to it.' : '')); return el;
    });
  }
  function placeVideo(f, ft, spot) {
    var big = f.size > 25 * 1048576; toast('Adding the video\u2026', 60000);
    return saveAsset(f.name, extOf(f), f).then(function (path) {
      var el = sink('<figure class="kb-m-vid"><video controls preload="metadata" src="' + esc(path) + '"></video><figcaption></figcaption></figure>', ft, spot);
      toast(big ? 'Video added. It is over 25 MB, which GitHub\u2019s upload page will refuse. A YouTube link is a better choice for long videos.' : 'Video added.', big ? 9000 : 5000); return el;
    });
  }
  /* pasted links */
  function normUrl(u) { u = String(u || '').trim(); if (!u || /\s/.test(u)) return ''; u = /^[a-z][a-z0-9+.-]*:/i.test(u) ? u : 'https://' + u; try { var x = new URL(u); return /^https?:$/.test(x.protocol) && (/\./.test(x.hostname) || x.hostname === 'localhost') ? u : ''; } catch (e) { return ''; } }
  function ytId(u) { var m = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{6,15})/.exec(u || ''); return m && m[1]; }
  function linkHtml(u) {
    var id = ytId(u);
    if (id) return '<figure class="kb-m-vid"><div class="kb-video' + (/shorts\//.test(u) ? ' kb-video-v' : '') + '"><iframe src="https://www.youtube-nocookie.com/embed/' + id + '" title="Video" loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div><figcaption></figcaption></figure>';
    if (/\.(jpe?g|png|gif|webp)(\?|#|$)/i.test(u)) return '<figure class="kb-m-img"><img src="' + esc(u) + '" alt=""><figcaption></figcaption></figure>';
    if (/\.(mp4|webm|ogv)(\?|#|$)/i.test(u)) return '<figure class="kb-m-vid"><video controls preload="metadata" src="' + esc(u) + '"></video><figcaption></figcaption></figure>';
    var host = ''; try { host = new URL(u).hostname.replace(/^www\./, ''); } catch (e) {}
    return '<a class="kb-linkcard" href="' + esc(u) + '" target="_blank" rel="noopener"><span class="kb-fileico kb-k-link">LINK</span><span class="kb-filemeta"><b>' + esc(host || u) + '</b><small>' + esc(u.slice(0, 80)) + '</small></span><span class="kb-dl">Open</span></a>';
  }
  function askLink(ft, spot) {
    spot = spot || defaultSpot();
    return openModal({ title: 'Paste a link', html: '<p>A <b>YouTube</b> link becomes a video player. A link to a picture or video file shows it. Any other web address becomes a link card students can click.</p><input type="url" id="kbLinkIn" placeholder="https://\u2026" aria-label="Web address">', buttons: [{ id: 'no', label: 'Cancel' }, { id: 'ok', label: 'Add', primary: true }] }).then(function (r) {
      if (r !== 'ok') return; var u = normUrl(q('#kbLinkIn').value); if (!u) { toast('That does not look like a web address. Copy it from the address bar of the page you want.'); return; }
      var el = sink(linkHtml(u), ft, spot); toast(ytId(u) ? 'Video added.' : 'Link added.'); return el;
    });
  }

  /* ---------- PDF, PowerPoint, Word, Excel and other files ---------- */
  var KIND = { pdf: 'PDF', slides: 'PowerPoint', doc: 'Word', sheet: 'Excel', other: 'File' };
  function kindOf(f) { var n = (f.name || '').toLowerCase(); if (/\.pdf$/.test(n) || f.type === 'application/pdf') return 'pdf'; if (/\.(pptx?|odp|ppsx?)$/.test(n)) return 'slides'; if (/\.(docx?|odt|rtf)$/.test(n)) return 'doc'; if (/\.(xlsx?|ods|csv)$/.test(n)) return 'sheet'; return 'other'; }
  function extOf(f) { var m = /\.([A-Za-z0-9]{1,6})$/.exec(f.name || ''); return m ? m[1].toLowerCase() : 'bin'; }
  function fileCardHtml(path, name, k, size) {
    var ext = extOf({ name: name });
    return '<a class="kb-filecard" href="' + esc(path) + '" download="' + esc(name) + '"><span class="kb-fileico kb-k-' + k + '">' + esc((k === 'other' ? ext : KIND[k]).toUpperCase().slice(0, 4)) + '</span><span class="kb-filemeta"><b class="kb-filename">' + esc(name) + '</b><small>' + KIND[k] + ' \u00B7 ' + fmtSize(size) + '</small></span><span class="kb-dl">Download</span></a>';
  }
  function docHtml(it) {
    if (it.choice !== 'preview') return saveAsset(it.f.name, extOf(it.f), it.f).then(function (path) { return fileCardHtml(path, it.f.name, it.k, it.f.size); });
    if (it.k !== 'pdf') {
      return Promise.all([saveAsset(it.f.name, extOf(it.f), it.f), saveAsset(it.f.name + '-preview', it.thumb.ext, it.thumb.blob)]).then(function (paths) {
        return '<figure class="kb-m-img"><img src="' + esc(paths[1]) + '" alt="Preview of the first page of ' + esc(it.f.name) + '"><figcaption>Preview of ' + esc(it.f.name) + ' (first ' + (it.k === 'slides' ? 'slide' : 'page') + ')</figcaption></figure>' + fileCardHtml(paths[0], it.f.name, it.k, it.f.size);
      });
    }
    var name = it.f.name.replace(/\.pdf$/i, ''); toast('Making pictures of the pages\u2026', 120000);
    return renderPdf(it.f, function (i, n) { toast('Making pictures of page ' + i + ' of ' + n + '\u2026', 120000); }).then(function (r) {
      return Promise.all(r.pages.map(function (p, i) { return saveAsset(name + '-page-' + (i + 1), 'jpg', p.blob); })).then(function (paths) {
        return saveAsset(it.f.name, 'pdf', it.f).then(function (pdf) {
          var imgs = paths.map(function (p, i) { return '<img src="' + esc(p) + '" alt="' + esc(name) + ', page ' + (i + 1) + '"' + (i ? ' hidden' : '') + '>'; }).join('');
          toast('Added ' + paths.length + ' pages from \u201C' + it.f.name + '\u201D' + (r.total > paths.length ? ' (the first ' + paths.length + ' of ' + r.total + ')' : '') + '.');
          return '<div class="kb-slides"><div class="kb-slides-stage">' + imgs + '</div><span class="kb-prev" role="button" tabindex="0" data-act="prev" aria-label="Previous page">\u2039</span><span class="kb-next" role="button" tabindex="0" data-act="next" aria-label="Next page">\u203A</span><div class="kb-slides-bar"><span class="kb-count">1 / ' + paths.length + '</span><a class="kb-dl-btn" href="' + esc(pdf) + '" download="' + esc(it.f.name) + '">Download ' + esc(it.f.name) + '</a></div></div>';
        });
      });
    }).catch(function (err) { toast('I could not turn that PDF into pictures (' + ((err && err.message) || 'unknown error') + '). It was attached instead.', 9000); it.choice = 'attach'; return docHtml(it); });
  }
  function placeDocs(docs, spot, force, ft, relay) {
    return Promise.all(docs.map(function (f) { var k = kindOf(f); return (k === 'slides' || k === 'doc') && /\.(pptx|docx|ppsx)$/i.test(f.name) ? officeThumb(f).then(function (t) { return { f: f, k: k, thumb: t }; }) : Promise.resolve({ f: f, k: k, thumb: null }); })).then(function (items) {
      items.forEach(function (it) { it.canPreview = it.k === 'pdf' || !!it.thumb; });
      if (force) { items.forEach(function (it) { it.choice = force === 'attach' ? 'attach' : (it.canPreview ? 'preview' : 'attach'); }); return items; }
      var rows = items.map(function (it, i) {
        var tip = it.k === 'pdf' ? 'Shows every page, like slides' : (it.thumb ? 'Shows the first slide or page as a picture' : 'No preview picture is saved inside this file');
        var big = it.f.size > 25 * 1048576 ? '<small class="kbm-warn">Over 25 MB. GitHub\u2019s upload page may refuse it.</small>' : '';
        return '<div class="kbm-file"><span class="kbm-ftype">' + KIND[it.k].toUpperCase().slice(0, 4) + '</span><div class="kbm-fname"><b>' + esc(it.f.name) + '</b><small>' + fmtSize(it.f.size) + '</small>' + big + '</div>' +
          '<div class="kbp-seg" data-file="' + i + '"><button type="button" data-v="preview" aria-pressed="' + it.canPreview + '"' + (it.canPreview ? '' : ' disabled') + ' title="' + tip + '">Show image preview</button><button type="button" data-v="attach" aria-pressed="' + !it.canPreview + '">Attach file</button></div>' +
          (it.canPreview ? '' : '<p class="kbm-tip">' + (it.k === 'sheet' || it.k === 'other' ? '' : 'To show every slide or page, save it as a PDF and drop that in.') + '</p>') + '</div>';
      }).join('');
      var cap = items.length === 1 ? 'You dropped a file.' : 'You dropped ' + items.length + ' files.';
      return openModal({ title: 'What should I do with ' + (items.length === 1 ? 'this file' : 'these files') + '?', html: '<p>' + cap + ' <b>Show image preview</b> puts pictures on the page. <b>Attach file</b> adds a download button.</p><div class="kbm-files">' + rows + '</div>', buttons: [{ id: 'no', label: 'Cancel' }, { id: 'ok', label: 'Add to page', primary: true }] }).then(function (r) {
        if (r !== 'ok') return null; items.forEach(function (it, i) { var s = q('.kbm-card [data-file="' + i + '"] [aria-pressed="true"]'); it.choice = s ? s.getAttribute('data-v') : 'attach'; }); return items;
      });
    }).then(function (items) {
      if (!items) return; var cur = spot, chain = Promise.resolve(), made = 0, target = ft;
      items.forEach(function (it) {
        chain = chain.then(function () { return docHtml(it).then(function (html) { var t = target; target = null; var el = sink(html, t, cur); made++; if (el && el.parentElement) { cur = nextSpot(el); if (relay) relay(el); } }); });
      });
      return chain.then(function () { toast(made === 1 ? 'Added to your page.' : 'Added ' + made + ' items to your page.'); });
    });
  }

  /* ---------- the slide viewer: this part runs for everyone, students included ---------- */
  function slidesRuntime() {
    function go(box, d) {
      var imgs = box.querySelectorAll('.kb-slides-stage img'), cur = 0; if (!imgs.length) return;
      imgs.forEach(function (im, i) { if (!im.hasAttribute('hidden')) cur = i; });
      var n = (cur + d + imgs.length) % imgs.length; imgs.forEach(function (im, i) { if (i === n) im.removeAttribute('hidden'); else im.setAttribute('hidden', ''); });
      var c = box.querySelector('.kb-count'); if (c) c.textContent = (n + 1) + ' / ' + imgs.length;
    }
    document.addEventListener('click', function (e) { var t = e.target.closest && e.target.closest('.kb-slides [data-act]'); if (t) go(t.closest('.kb-slides'), t.getAttribute('data-act') === 'next' ? 1 : -1); });
    document.addEventListener('keydown', function (e) {
      var box = e.target.closest && e.target.closest('.kb-slides'); if (!box || e.target.closest('[contenteditable="true"]')) return;
      if (e.key === 'ArrowRight') { go(box, 1); e.preventDefault(); } else if (e.key === 'ArrowLeft') { go(box, -1); e.preventDefault(); }
      else if ((e.key === 'Enter' || e.key === ' ') && e.target.getAttribute('data-act')) { go(box, e.target.getAttribute('data-act') === 'next' ? 1 : -1); e.preventDefault(); }
    });
  }
  var SLIDES_RUNTIME = '(' + slidesRuntime.toString() + ')();';
  slidesRuntime();

  /* =====================================================================
     SIGNING IN, MODES, START-UP
     ===================================================================== */
  function verify(p) {
    if (PASSWORD_HASH && window.crypto && window.crypto.subtle) return window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(p)).then(function (b) { return Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('') === PASSWORD_HASH; });
    return Promise.resolve(p === PASSWORD);
  }
  function login() {
    var p = window.prompt('Teacher password'); if (p === null) return;
    verify(p).then(function (ok) {
      if (!ok) { window.alert('That password is not right.'); return; }
      try { sessionStorage.setItem(FLAG, '1'); sessionStorage.setItem(EDIT_FLAG, '1'); } catch (e) {} location.reload();
    });
  }
  function leave() { try { sessionStorage.removeItem(FLAG); sessionStorage.removeItem(EDIT_FLAG); } catch (e) {} location.reload(); }
  function exit() {
    if (!changedFromPublished()) { leave(); return; }
    openModal({ title: 'Leave editing?', html: '<p>You have changes that are not published yet. They stay saved as a draft in this browser, and students will not see them until you save and upload them.</p>', buttons: [{ id: 'no', label: 'Keep editing' }, { id: 'save', label: 'Save changes first' }, { id: 'yes', label: 'Leave', primary: true }] }).then(function (r) {
      if (r === 'yes') leave(); else if (r === 'save') doSave();
    });
  }
  function setEditing(on) {
    editing = !!on; try { sessionStorage.setItem(EDIT_FLAG, on ? '1' : '0'); } catch (e) {}
    document.body.classList.toggle('kb-editing', editing); document.body.classList.toggle('kb-preview', !editing && teacher);
    if (!ui.top) return; ui.top.hidden = !editing; ui.back.hidden = editing; ui.fab.hidden = !editing || document.body.classList.contains('kb-add-open');
    if (!editing) { closePop(); deselect(); openAdd(false); if (curRoot) undecorate(curRoot); toast('Previewing the page as students see it.', 2500); }
    else if (curRoot) decorate(curRoot);
    place();
  }
  var wasEditing = false;
  function present(on) {
    if (on === presenting) return; presenting = on; document.body.classList.toggle('kb-present', on);
    if (on) {
      wasEditing = editing; deselect(); closePop(); openAdd(false); if (curRoot) undecorate(curRoot);
      try { var p = document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); if (p && p.catch) p.catch(function () {}); } catch (x) {}
      toast('Press Esc to leave Present mode', 3000);
    } else {
      if (document.fullscreenElement && document.exitFullscreen) { try { document.exitFullscreen(); } catch (x) {} }
      if (wasEditing && curRoot) decorate(curRoot);
    }
    place();
  }
  document.addEventListener('fullscreenchange', function () { if (!document.fullscreenElement && presenting) present(false); });

  function pageOptions() {
    if (CFG.pages) return CFG.pages;
    var o = [{ v: '#unit', t: 'Unit home' }]; (window.CONCEPTS || []).forEach(function (c) { o.push({ v: '#unit/' + c.id, t: c.title }); });
    if (!CFG.noFolio && q('#viewFolio')) o.push({ v: '#folio', t: 'My Folio (text only)' }); return o;
  }
  function syncPage() {
    var s = q('#kbPage'); if (!s) return; var h = location.hash || '', opts = pageOptions(), hit = opts.filter(function (o) { return o.v === h; })[0] || opts.filter(function (o) { return h.indexOf(o.v) === 0 && o.v !== '#unit'; })[0];
    s.value = hit ? hit.v : (opts[0] || {}).v;
  }
  function showHint() {
    var seen = false; try { seen = localStorage.getItem('kcc-editor-hint-v2') === '1'; } catch (e) {} if (seen || q('#kbHint')) return;
    var h = document.createElement('div'); h.id = 'kbHint'; h.className = 'kb-ui';
    h.innerHTML = '<b>Welcome to the editor</b><ul><li><b>Click</b> any words or picture to change it.</li><li><b>Drag</b> pictures, PDFs, Word or PowerPoint files straight onto the page.</li><li>Press <b>Add</b> on the left for blocks and ready-made layouts.</li></ul><button type="button" class="kbu-pri small">Got it</button>';
    document.body.appendChild(h); q('button', h).addEventListener('click', function () { h.remove(); try { localStorage.setItem('kcc-editor-hint-v2', '1'); } catch (e) {} });
  }
  function ready() {
    var s = q('#teachLink'); if (s) s.addEventListener('click', function (e) { e.preventDefault(); login(); });
    if (!teacher) return;
    build(); var sel2 = q('#kbPage'); sel2.innerHTML = pageOptions().map(function (o) { return '<option value="' + esc(o.v) + '">' + esc(o.t) + '</option>'; }).join('');
    window.addEventListener('hashchange', syncPage); syncPage(); setEditing(editing); histBtns(); if (editing) showHint();
  }

  window.KCCEdit = { after: after, focus: focusView, ready: ready, editing: function () { return editing; }, isTeacher: function () { return teacher; },
    _t: { get E() { return E; }, set E(v) { E = v; }, select: select, selBlock: selBlock, addBlock: addBlock, addTemplate: addTemplate, handleFiles: handleFiles, defaultSpot: defaultSpot, spotAt: spotAt, undo: undo, redoIt: redoIt, pruned: pruned, getAsset: getAsset, usedAssets: usedAssets,
      saveBundle: saveBundle, setEditing: setEditing, present: present, deleteSel: deleteSel, duplicateSel: duplicateSel, popAct: popAct, openPop: openPop, closePop: closePop, openAdd: openAdd, hist: function () { return hist.length; }, get editing() { return editing; }, get sel() { return sel; }, get popKind() { return popKind; }, urlCache: urlCache, renderPdf: renderPdf, officeThumb: officeThumb, clean: clean, mainC: function () { return mainC; } } };
})();

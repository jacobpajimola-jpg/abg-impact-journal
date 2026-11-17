/* PowerPoint (.pptx) templates: read the slides, list the text boxes and pictures an administrator can map to
 * content, fill only those, and keep everything else in the file exactly as it was (slide size, backgrounds,
 * branding, images, fonts, colors, alignment, other shapes).
 *
 * Works in the browser (DOMParser) and in Node tests (pass @xmldom/xmldom through setXml). */
import JSZip from 'jszip';

const NS = {
  p: 'http://schemas.openxmlformats.org/presentationml/2006/main',
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  rel: 'http://schemas.openxmlformats.org/package/2006/relationships',
  ct: 'http://schemas.openxmlformats.org/package/2006/content-types',
};
const IMAGE_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';
const EMU_PER_PT = 12700;
let XML = {
  parse: s => new DOMParser().parseFromString(s, 'application/xml'),
  serialize: d => new XMLSerializer().serializeToString(d),
};
export function setXml(impl){ XML = impl; }

/* ---------- small DOM helpers (namespace-aware, work with both DOM implementations) ---------- */
const kids = (el, ns, name) => { const out = []; if (!el) return out; for (let n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 1 && n.namespaceURI === ns && (!name || n.localName === name)) out.push(n); return out; };
const kid = (el, ns, name) => kids(el, ns, name)[0] || null;
const path = (el, steps) => { let cur = el; for (const [ns, name] of steps) { cur = kid(cur, ns, name); if (!cur) return null; } return cur; };
const all = (el, ns, name) => (el ? Array.from(el.getElementsByTagNameNS(ns, name)) : []);
const num = (v, d) => { const n = parseInt(v, 10); return isFinite(n) ? n : d; };
const dirOf = p => p.slice(0, p.lastIndexOf('/') + 1);
function resolve(base, target){
  if (target.startsWith('/')) return target.slice(1);
  const parts = (dirOf(base) + target).split('/'); const out = [];
  for (const s of parts) { if (s === '..') out.pop(); else if (s !== '.') out.push(s); }
  return out.join('/');
}
const relsPath = p => dirOf(p) + '_rels/' + p.slice(p.lastIndexOf('/') + 1) + '.rels';

async function loadZip(input){ return input instanceof JSZip ? input : JSZip.loadAsync(input); }
async function readXml(zip, p){ const f = zip.file(p); return f ? XML.parse(await f.async('string')) : null; }
async function readRels(zip, p){
  const d = await readXml(zip, relsPath(p)); const map = {};
  if (d) for (const r of all(d.documentElement, NS.rel, 'Relationship')) map[r.getAttribute('Id')] = {type: r.getAttribute('Type'), target: r.getAttribute('TargetMode') === 'External' ? null : resolve(p, r.getAttribute('Target'))};
  return {doc: d, map};
}

/* ---------- geometry ---------- */
function xfrmOf(el){
  const spPr = kid(el, NS.p, 'spPr') || kid(el, NS.p, 'grpSpPr');
  const x = spPr && kid(spPr, NS.a, 'xfrm');
  if (!x) return null;
  const off = kid(x, NS.a, 'off'), ext = kid(x, NS.a, 'ext');
  if (!off || !ext) return null;
  const r = {x: num(off.getAttribute('x'), 0), y: num(off.getAttribute('y'), 0), w: num(ext.getAttribute('cx'), 0), h: num(ext.getAttribute('cy'), 0), rot: num(x.getAttribute('rot'), 0)};
  const chOff = kid(x, NS.a, 'chOff'), chExt = kid(x, NS.a, 'chExt');
  if (chOff && chExt) r.ch = {x: num(chOff.getAttribute('x'), 0), y: num(chOff.getAttribute('y'), 0), w: num(chExt.getAttribute('cx'), 1) || 1, h: num(chExt.getAttribute('cy'), 1) || 1};
  return r;
}
/* a group's children use the group's own coordinate space */
function mapThrough(groups, b){
  let r = Object.assign({}, b);
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i]; if (!g.ch) continue;
    const sx = g.w / g.ch.w, sy = g.h / g.ch.h;
    r = {x: g.x + (r.x - g.ch.x) * sx, y: g.y + (r.y - g.ch.y) * sy, w: r.w * sx, h: r.h * sy, rot: r.rot};
  }
  return r;
}

/* ---------- text ---------- */
function paraText(p){
  let s = '';
  for (let n = p.firstChild; n; n = n.nextSibling) {
    if (n.nodeType !== 1 || n.namespaceURI !== NS.a) continue;
    if (n.localName === 'r' || n.localName === 'fld') { const t = kid(n, NS.a, 't'); s += t ? (t.textContent || '') : ''; }
    else if (n.localName === 'br') s += '\n';
  }
  return s;
}
function bodyText(txBody){ return kids(txBody, NS.a, 'p').map(paraText).join('\n'); }
function firstRunProps(txBody){
  for (const p of kids(txBody, NS.a, 'p')) { for (const r of kids(p, NS.a, 'r')) { const rp = kid(r, NS.a, 'rPr'); if (rp) return rp; } }
  for (const p of kids(txBody, NS.a, 'p')) { const e = kid(p, NS.a, 'endParaRPr'); if (e) return e; }
  return null;
}
function styleOf(txBody){
  const rp = firstRunProps(txBody);
  const lvl = path(txBody, [[NS.a, 'lstStyle'], [NS.a, 'lvl1pPr'], [NS.a, 'defRPr']]);
  const sz = num(rp && rp.getAttribute('sz'), num(lvl && lvl.getAttribute('sz'), 0));
  const fill = rp && path(rp, [[NS.a, 'solidFill'], [NS.a, 'srgbClr']]);
  const latin = rp && kid(rp, NS.a, 'latin');
  const p0 = kids(txBody, NS.a, 'p').find(p => kid(p, NS.a, 'r')) || kid(txBody, NS.a, 'p');
  const pPr = p0 && kid(p0, NS.a, 'pPr');
  const bodyPr = kid(txBody, NS.a, 'bodyPr');
  return {
    size: sz ? sz / 100 : 0, bold: rp && rp.getAttribute('b') === '1', italic: rp && rp.getAttribute('i') === '1',
    color: fill ? '#' + fill.getAttribute('val') : '', font: latin ? latin.getAttribute('typeface') : '',
    align: ({ctr: 'center', r: 'right', just: 'justify'})[pPr && pPr.getAttribute('algn')] || 'left',
    anchor: ({ctr: 'middle', b: 'bottom'})[bodyPr && bodyPr.getAttribute('anchor')] || 'top',
    wrap: !(bodyPr && bodyPr.getAttribute('wrap') === 'none'),
    autofit: bodyPr ? (kid(bodyPr, NS.a, 'spAutoFit') ? 'grow' : kid(bodyPr, NS.a, 'normAutofit') ? 'shrink' : 'none') : 'none',
    insets: bodyPr ? {l: num(bodyPr.getAttribute('lIns'), 91440), r: num(bodyPr.getAttribute('rIns'), 91440), t: num(bodyPr.getAttribute('tIns'), 45720), b: num(bodyPr.getAttribute('bIns'), 45720)} : {l: 91440, r: 91440, t: 45720, b: 45720},
  };
}

/* rough width of a string in ems for a typical sans-serif face: good enough to warn before text overflows a box */
const NARROW = /[ilj.,;:'!|()[\]{}\-tfr ]/, WIDE = /[MWmw@%#&]/;
function emWidth(s){ let w = 0; for (const ch of s) w += NARROW.test(ch) ? 0.3 : WIDE.test(ch) ? 0.85 : /[A-Z0-9]/.test(ch) ? 0.64 : 0.52; return w; }
export function wrapLines(text, widthPt, sizePt, measure){
  const m = measure || (s => emWidth(s) * sizePt);
  const lines = [];
  for (const para of String(text).split('\n')) {
    const words = para.split(/(\s+)/).filter(x => x !== '');
    let cur = '';
    for (const w of words) {
      const next = cur + w;
      if (!cur || m(next.trimEnd()) <= widthPt) { cur = next; continue; }
      lines.push(cur.trimEnd()); cur = w.trimStart();
      /* a single word wider than the box is broken by characters */
      while (cur && m(cur) > widthPt) { let k = cur.length; while (k > 1 && m(cur.slice(0, k)) > widthPt) k--; lines.push(cur.slice(0, k)); cur = cur.slice(k); }
    }
    lines.push(cur.trimEnd());
  }
  return lines;
}
/* does the text fit a box (EMU) at a font size? */
export function fitInBox(text, box, style, sizePt){
  const ins = style.insets || {l: 91440, r: 91440, t: 45720, b: 45720};
  const w = Math.max(1, (box.w - ins.l - ins.r) / EMU_PER_PT), h = Math.max(1, (box.h - ins.t - ins.b) / EMU_PER_PT);
  const lines = style.wrap === false ? String(text).split('\n') : wrapLines(text, w, sizePt);
  const tooWide = style.wrap === false && lines.some(l => emWidth(l) * sizePt > w);
  const height = lines.length * sizePt * 1.2;
  /* a box set to grow with its text still has a designed size: growing past it would push into other elements */
  const limit = h;
  return {fits: !tooWide && height <= limit + 0.5, lines: lines.length, height, available: limit};
}

/* ---------- inspection ---------- */
async function slideOrder(zip){
  const pres = await readXml(zip, 'ppt/presentation.xml');
  if (!pres) throw new Error('This file is not a PowerPoint presentation (.pptx).');
  const rels = (await readRels(zip, 'ppt/presentation.xml')).map;
  const sz = kid(pres.documentElement, NS.p, 'sldSz');
  const list = path(pres.documentElement, [[NS.p, 'sldIdLst']]);
  const slides = kids(list, NS.p, 'sldId').map(s => (rels[s.getAttributeNS(NS.r, 'id')] || {}).target).filter(Boolean);
  return {width: num(sz && sz.getAttribute('cx'), 12192000), height: num(sz && sz.getAttribute('cy'), 6858000), slides};
}
function phOf(el){
  const nv = kid(el, NS.p, 'nvSpPr') || kid(el, NS.p, 'nvPicPr');
  const ph = nv && path(nv, [[NS.p, 'nvPr'], [NS.p, 'ph']]);
  return ph ? {type: ph.getAttribute('type') || 'body', idx: ph.getAttribute('idx') || ''} : null;
}
function cNvPr(el){ const nv = kid(el, NS.p, 'nvSpPr') || kid(el, NS.p, 'nvPicPr') || kid(el, NS.p, 'nvGrpSpPr') || kid(el, NS.p, 'nvGraphicFramePr') || kid(el, NS.p, 'nvCxnSpPr'); return nv ? kid(nv, NS.p, 'cNvPr') : null; }
/* placeholders without their own position take it from the slide layout, then the master */
async function layoutBoxes(zip, slidePath){
  const out = [];
  const lay = Object.values((await readRels(zip, slidePath)).map).find(r => r.type && /slideLayout$/.test(r.type));
  if (!lay || !lay.target) return out;
  for (const p of [lay.target, Object.values((await readRels(zip, lay.target)).map).map(r => r.type && /slideMaster$/.test(r.type) ? r.target : null).find(Boolean)]) {
    if (!p) continue;
    const d = await readXml(zip, p); if (!d) continue;
    for (const sp of all(d.documentElement, NS.p, 'sp')) { const ph = phOf(sp), b = xfrmOf(sp); if (ph && b) out.push({ph, b}); }
  }
  return out;
}
function findPh(boxes, ph){
  return (boxes.find(x => ph.idx && x.ph.idx === ph.idx) || boxes.find(x => x.ph.type === ph.type) || {}).b || null;
}
function suggestId(name, text){
  const m = String(text || '').match(/\{\{\s*([\w .-]+?)\s*\}\}/) || String(name || '').match(/^(?:abg|field)[:_ -]\s*([\w .-]+)$/i);
  return m ? m[1].trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') : '';
}

/* Everything an administrator can map, slide by slide. Positions are in EMU (914400 per inch). */
export async function inspectPptx(input){
  const zip = await loadZip(input);
  const order = await slideOrder(zip);
  const slides = [];
  for (let i = 0; i < order.slides.length; i++) {
    const sp = order.slides[i];
    const doc = await readXml(zip, sp); if (!doc) continue;
    const boxes = await layoutBoxes(zip, sp);
    const rels = (await readRels(zip, sp)).map;
    const tree = path(doc.documentElement, [[NS.p, 'cSld'], [NS.p, 'spTree']]);
    const shapes = [];
    const walk = (parent, groups) => {
      for (let n = parent.firstChild; n; n = n.nextSibling) {
        if (n.nodeType !== 1 || n.namespaceURI !== NS.p) continue;
        const c = cNvPr(n); const id = c ? c.getAttribute('id') : ''; const name = c ? c.getAttribute('name') : '';
        if (n.localName === 'grpSp') { const g = xfrmOf(n); walk(n, g ? groups.concat([g]) : groups); continue; }
        const ph = phOf(n);
        let b = xfrmOf(n) || (ph ? findPh(boxes, ph) : null);
        if (!b) continue;
        b = mapThrough(groups, b);
        const base = {key: (i + 1) + ':' + id, slide: i + 1, id, name, placeholder: ph, x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h), rot: b.rot || 0, grouped: groups.length > 0};
        if (n.localName === 'sp') {
          const tx = kid(n, NS.p, 'txBody'); if (!tx) continue;
          const text = bodyText(tx);
          shapes.push(Object.assign(base, {kind: 'text', text, style: styleOf(tx), suggest: suggestId(name, text)}));
        } else if (n.localName === 'pic') {
          const blip = path(n, [[NS.p, 'blipFill'], [NS.a, 'blip']]);
          const rid = blip && blip.getAttributeNS(NS.r, 'embed');
          shapes.push(Object.assign(base, {kind: 'picture', media: rid && rels[rid] ? rels[rid].target : '', descr: c ? (c.getAttribute('descr') || '') : '', suggest: suggestId(name, c ? c.getAttribute('descr') : '')}));
        }
      }
    };
    if (tree) walk(tree, []);
    slides.push({index: i + 1, path: sp, shapes});
  }
  return {kind: 'pptx', width: order.width, height: order.height, pages: slides.length, slides};
}

/* ---------- filling ---------- */
function setText(doc, txBody, text, sizePt){
  const ps = kids(txBody, NS.a, 'p');
  const tmpl = ps.find(p => kid(p, NS.a, 'r')) || ps[0] || null;
  const pPr = tmpl && kid(tmpl, NS.a, 'pPr');
  const run = tmpl && kid(tmpl, NS.a, 'r');
  const rPr0 = (run && kid(run, NS.a, 'rPr')) || (tmpl && kid(tmpl, NS.a, 'endParaRPr'));
  const end0 = (tmpl && kid(tmpl, NS.a, 'endParaRPr')) || null;
  ps.forEach(p => txBody.removeChild(p));
  const mk = n => doc.createElementNS(NS.a, 'a:' + n);
  const props = (src, tag) => {
    const e = src ? src.cloneNode(true) : mk(tag);
    if (src && src.localName !== tag) { const c = mk(tag); for (const at of Array.from(src.attributes)) c.setAttribute(at.name, at.value); for (let k = src.firstChild; k; k = k.nextSibling) c.appendChild(k.cloneNode(true)); return sized(c); }
    return sized(e);
  };
  const sized = e => { if (sizePt) e.setAttribute('sz', String(Math.round(sizePt * 100))); return e; };
  for (const line of String(text).split('\n')) {
    const p = mk('p');
    if (pPr) p.appendChild(pPr.cloneNode(true));
    if (line) { const r = mk('r'); r.appendChild(props(rPr0, 'rPr')); const t = mk('t'); t.appendChild(doc.createTextNode(line)); r.appendChild(t); p.appendChild(r); }
    p.appendChild(props(end0 || rPr0, 'endParaRPr'));
    txBody.appendChild(p);
  }
}
function findShape(doc, id){
  for (const tag of ['sp', 'pic']) for (const el of all(doc.documentElement, NS.p, tag)) { const c = cNvPr(el); if (c && c.getAttribute('id') === String(id)) return el; }
  return null;
}
const MIME_EXT = {'image/png': 'png', 'image/jpeg': 'jpeg', 'image/jpg': 'jpeg', 'image/webp': 'webp'};
async function ensureContentType(zip, ext, mime){
  const d = await readXml(zip, '[Content_Types].xml');
  if (all(d.documentElement, NS.ct, 'Default').some(e => (e.getAttribute('Extension') || '').toLowerCase() === ext)) return;
  const e = d.createElementNS(NS.ct, 'Default'); e.setAttribute('Extension', ext); e.setAttribute('ContentType', mime);
  d.documentElement.insertBefore(e, d.documentElement.firstChild);
  zip.file('[Content_Types].xml', XML.serialize(d));
}
async function setPicture(zip, slidePath, doc, pic, img, n){
  const ext = MIME_EXT[img.type] || 'png';
  const media = 'ppt/media/abg-' + n + '-' + Date.now().toString(36) + '.' + ext;
  zip.file(media, img.bytes);
  await ensureContentType(zip, ext, img.type || 'image/png');
  const rp = relsPath(slidePath);
  const rd = (await readXml(zip, rp)) || XML.parse('<Relationships xmlns="' + NS.rel + '"/>');
  const used = new Set(all(rd.documentElement, NS.rel, 'Relationship').map(r => r.getAttribute('Id')));
  let k = 1; while (used.has('rIdAbg' + k)) k++;
  const rel = rd.createElementNS(NS.rel, 'Relationship');
  rel.setAttribute('Id', 'rIdAbg' + k); rel.setAttribute('Type', IMAGE_REL); rel.setAttribute('Target', '../media/' + media.split('/').pop());
  rd.documentElement.appendChild(rel);
  zip.file(rp, XML.serialize(rd));
  const blipFill = kid(pic, NS.p, 'blipFill');
  const blip = kid(blipFill, NS.a, 'blip');
  blip.setAttributeNS(NS.r, 'r:embed', 'rIdAbg' + k);
  /* fill the frame like "cover": crop the new image to the frame's shape instead of stretching it */
  const old = kid(blipFill, NS.a, 'srcRect'); if (old) blipFill.removeChild(old);
  const b = xfrmOf(pic);
  if (b && img.width && img.height && b.w && b.h) {
    const fr = b.w / b.h, ir = img.width / img.height;
    const src = doc.createElementNS(NS.a, 'a:srcRect');
    if (ir > fr) { const c = Math.round((1 - fr / ir) / 2 * 100000); src.setAttribute('l', String(c)); src.setAttribute('r', String(c)); }
    else if (ir < fr) { const c = Math.round((1 - ir / fr) / 2 * 100000); src.setAttribute('t', String(c)); src.setAttribute('b', String(c)); }
    blipFill.insertBefore(src, blip.nextSibling);
  }
}

/* Fill a template. fields: the version's field mapping; values: {fieldId: {text} | {image: {bytes, type, width, height}}}.
 * Returns the new file and a report per field: whether the text fits its box and at what size. Text that can't fit is
 * reported, not squeezed into an unreadable size: the caller stops and asks for a shorter version. */
export async function fillPptx(input, fields, values){
  const zip = await loadZip(input instanceof JSZip ? input : (input.slice ? input.slice(0) : input));
  const order = await slideOrder(zip);
  const docs = {}; const report = [];
  let n = 0;
  for (const f of fields) {
    const t = f.target || {};
    if (t.kind !== 'pptx_shape') continue;
    const slidePath = order.slides[(t.slide || 1) - 1];
    if (!slidePath) { report.push({id: f.id, ok: false, error: 'Slide ' + t.slide + ' is missing from this file.'}); continue; }
    const doc = docs[slidePath] || (docs[slidePath] = await readXml(zip, slidePath));
    const el = findShape(doc, t.shapeId);
    if (!el) { report.push({id: f.id, ok: false, error: 'The mapped element is missing from slide ' + t.slide + '.'}); continue; }
    const v = values[f.id];
    if (f.type === 'image') {
      if (!v || !v.image) { report.push({id: f.id, ok: true, kept: true}); continue; }
      if (el.localName !== 'pic') { report.push({id: f.id, ok: false, error: 'This field is mapped to a text box, not a picture.'}); continue; }
      await setPicture(zip, slidePath, doc, el, v.image, ++n);
      report.push({id: f.id, ok: true});
      continue;
    }
    const tx = kid(el, NS.p, 'txBody');
    if (!tx) { report.push({id: f.id, ok: false, error: 'This field is mapped to a picture, not a text box.'}); continue; }
    const text = v && typeof v.text === 'string' ? v.text : null;
    if (text == null) { report.push({id: f.id, ok: true, kept: true}); continue; }
    const style = styleOf(tx);
    const box = mapBox(el) || {w: 0, h: 0};
    const base = (f.format && f.format.size) || style.size || 18;
    const min = Math.min(base, (f.format && f.format.minSize) || base);
    let size = base, fit = box.w ? fitInBox(text, box, style, size) : {fits: true};
    while (!fit.fits && size - 0.5 >= min) { size -= 0.5; fit = fitInBox(text, box, style, size); }
    setText(doc, tx, text, size !== (style.size || 0) ? size : 0);
    report.push({id: f.id, ok: fit.fits, size, shrunk: size < base, error: fit.fits ? '' : 'The text is too long for this box (' + fit.lines + ' lines; about ' + Math.max(1, Math.floor(fit.available / (size * 1.2))) + ' fit).'});
  }
  for (const [p, d] of Object.entries(docs)) zip.file(p, XML.serialize(d));
  const out = await zip.generateAsync({type: 'uint8array', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'});
  return {bytes: out, report};
}
function mapBox(el){
  /* fitting uses the element's own size (group scaling, if any, is close enough for a warning) */
  return xfrmOf(el);
}

/* ---------- preview ---------- */
function solid(el){ const c = el && path(el, [[NS.a, 'solidFill'], [NS.a, 'srgbClr']]); return c ? '#' + c.getAttribute('val') : ''; }
async function bgOf(zip, partPath, doc){
  const bgPr = path(doc.documentElement, [[NS.p, 'cSld'], [NS.p, 'bg'], [NS.p, 'bgPr']]);
  if (!bgPr) return null;
  const color = solid(bgPr);
  const blip = path(bgPr, [[NS.a, 'blipFill'], [NS.a, 'blip']]);
  if (blip) { const rid = blip.getAttributeNS(NS.r, 'embed'); const r = (await readRels(zip, partPath)).map[rid]; if (r && r.target) return {media: r.target, color}; }
  return color ? {color} : null;
}
/* An approximate picture of each slide (pictures, backgrounds and text at their positions) for previews in the app.
 * The PowerPoint file itself is the real result; the preview says so. */
export async function previewPptx(input, values, fields){
  const zip = await loadZip(input);
  const info = await inspectPptx(zip);
  const media = {};
  const want = async p => { if (p && !media[p] && zip.file(p)) media[p] = await zip.file(p).async('uint8array'); };
  const byKey = {};
  (fields || []).forEach(f => { if (f.target && f.target.kind === 'pptx_shape') byKey[f.target.slide + ':' + f.target.shapeId] = f; });
  const slides = [];
  for (const s of info.slides) {
    const doc = await readXml(zip, s.path);
    let bg = await bgOf(zip, s.path, doc);
    const items = [];
    const lay = Object.values((await readRels(zip, s.path)).map).find(r => r.type && /slideLayout$/.test(r.type));
    if (lay && lay.target) {
      const ld = await readXml(zip, lay.target);
      const mst = Object.values((await readRels(zip, lay.target)).map).find(r => r.type && /slideMaster$/.test(r.type));
      const md = mst && mst.target ? await readXml(zip, mst.target) : null;
      if (!bg && ld) bg = await bgOf(zip, lay.target, ld);
      if (!bg && md) bg = await bgOf(zip, mst.target, md);
      /* non-placeholder pictures on the master and layout (logos, frames) */
      for (const [pp, d] of [[mst && mst.target, md], [lay.target, ld]]) {
        if (!d) continue;
        const rels = (await readRels(zip, pp)).map;
        for (const pic of all(d.documentElement, NS.p, 'pic')) { if (phOf(pic)) continue; const b = xfrmOf(pic); const blip = path(pic, [[NS.p, 'blipFill'], [NS.a, 'blip']]); const r = blip && rels[blip.getAttributeNS(NS.r, 'embed')]; if (b && r && r.target) { await want(r.target); items.push({type: 'pic', media: r.target, x: b.x, y: b.y, w: b.w, h: b.h}); } }
      }
    }
    if (bg && bg.media) await want(bg.media);
    for (const sh of s.shapes) {
      const f = byKey[sh.key]; const v = f ? (values || {})[f.id] : null;
      if (sh.kind === 'picture') {
        if (v && v.image && v.image.url) items.push({type: 'pic', url: v.image.url, cover: true, x: sh.x, y: sh.y, w: sh.w, h: sh.h, field: f.id});
        else { await want(sh.media); items.push({type: 'pic', media: sh.media, x: sh.x, y: sh.y, w: sh.w, h: sh.h, field: f ? f.id : ''}); }
      } else {
        const text = v && typeof v.text === 'string' ? v.text : sh.text;
        items.push({type: 'text', text, style: Object.assign({}, sh.style, v && v.size ? {size: v.size} : {}), x: sh.x, y: sh.y, w: sh.w, h: sh.h, field: f ? f.id : '', filled: !!(v && typeof v.text === 'string')});
      }
    }
    slides.push({index: s.index, bg, items});
  }
  return {width: info.width, height: info.height, slides, media};
}

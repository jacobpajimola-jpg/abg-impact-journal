/* PDF templates. Two supported set-ups:
 *  A. The PDF has fillable form fields: each field is mapped to content and filled.
 *  B. The PDF is flat (most Canva exports): an administrator draws content regions on the page, and text or an image
 *     is placed only inside them, over the original page kept as a fixed background.
 * A region that covers text already printed in the PDF is refused: writing over it would leave two texts on top of each
 * other. The template has to be exported with that area left blank instead.
 * Coordinates for regions are PDF points from the page's top-left corner. */
import { PDFDocument, StandardFonts, rgb, pushGraphicsState, popGraphicsState, rectangle, clip, endPath, PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup } from 'pdf-lib';

export const PDF_FONTS = [
  {id: 'Helvetica', label: 'Sans serif (Helvetica)', std: StandardFonts.Helvetica},
  {id: 'Helvetica-Bold', label: 'Sans serif bold', std: StandardFonts.HelveticaBold},
  {id: 'Helvetica-Oblique', label: 'Sans serif italic', std: StandardFonts.HelveticaOblique},
  {id: 'Times-Roman', label: 'Serif (Times)', std: StandardFonts.TimesRoman},
  {id: 'Times-Bold', label: 'Serif bold', std: StandardFonts.TimesRomanBold},
  {id: 'Times-Italic', label: 'Serif italic', std: StandardFonts.TimesRomanItalic},
];

const hex = c => { const m = String(c || '').replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i); return m ? rgb(parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255) : rgb(0.12, 0.16, 0.27); };

function fieldType(f){ return f instanceof PDFTextField ? 'text' : f instanceof PDFCheckBox ? 'checkbox' : f instanceof PDFDropdown ? 'dropdown' : f instanceof PDFRadioGroup ? 'radio' : 'other'; }

/* Pages and fillable fields */
export async function inspectPdf(bytes){
  let doc;
  try { doc = await PDFDocument.load(bytes, {updateMetadata: false}); }
  catch (e) { throw new Error(/encrypt/i.test(e.message || '') ? 'This PDF is password-protected or encrypted. Export it again from Canva without a password.' : 'This file is not a readable PDF.'); }
  const pages = doc.getPages().map((p, i) => { const {width, height} = p.getSize(); return {index: i + 1, width: Math.round(width * 100) / 100, height: Math.round(height * 100) / 100, rotation: p.getRotation().angle || 0}; });
  const refs = doc.getPages().map(p => p.ref);
  const fields = [];
  let form = null;
  try { form = doc.getForm(); } catch (e) {}
  if (form) for (const f of form.getFields()) {
    const type = fieldType(f);
    for (const w of f.acroField.getWidgets()) {
      const r = w.getRectangle(); const pref = w.P();
      let page = pref ? refs.findIndex(x => x.toString() === pref.toString()) + 1 : 0;
      if (!page) {
        const wref = doc.context.getObjectRef(w.dict);
        page = doc.getPages().findIndex(p => { const an = p.node.Annots(); return !!(an && wref && an.asArray().some(a => a.toString() === wref.toString())); }) + 1;
      }
      if (!page) page = 1;
      const ph = pages[page - 1] ? pages[page - 1].height : 0;
      fields.push({name: f.getName(), type, page, rect: {x: r.x, y: ph - r.y - r.height, w: r.width, h: r.height},
        multiline: type === 'text' ? f.isMultiline() : false, maxLength: type === 'text' ? (f.getMaxLength() || 0) : 0, readOnly: f.isReadOnly()});
      break;
    }
  }
  return {kind: 'pdf', pages, fields, fillable: fields.some(f => f.type === 'text')};
}

/* Text already printed on each page, with its position (needs pdf.js, passed in so this file also runs in tests). */
export async function pdfTextItems(pdfjs, bytes){
  const task = pdfjs.getDocument({data: new Uint8Array(bytes.buffer ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) : bytes), isEvalSupported: false, disableFontFace: true, useSystemFonts: false});
  const doc = await task.promise;
  const out = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const vp = page.getViewport({scale: 1});
    const tc = await page.getTextContent();
    for (const it of tc.items) {
      const s = (it.str || '').trim(); if (!s) continue;
      const t = it.transform; const h = Math.abs(it.height || t[3] || 0) || 10;
      /* viewport coordinates are already top-left based */
      const [x0, y0] = vp.convertToViewportPoint(t[4], t[5]);
      out.push({page: i, text: s, x: x0, y: y0 - h, w: it.width || s.length * h * 0.5, h});
    }
  }
  await doc.destroy();
  return out;
}

/* Regions that would print over existing text, and regions outside the page */
export function checkRegions(fields, info, textItems){
  const problems = [];
  for (const f of fields) {
    const t = f.target || {};
    if (t.kind !== 'pdf_region') continue;
    const pg = info.pages[(t.page || 1) - 1];
    if (!pg) { problems.push({id: f.id, error: 'Page ' + t.page + ' is not in this PDF.'}); continue; }
    if (t.w < 4 || t.h < 4) { problems.push({id: f.id, error: 'The region is too small.'}); continue; }
    if (t.x < -1 || t.y < -1 || t.x + t.w > pg.width + 1 || t.y + t.h > pg.height + 1) problems.push({id: f.id, error: 'The region goes past the edge of the page.'});
    const hits = (textItems || []).filter(it => it.page === t.page).filter(it => {
      const ix = Math.max(0, Math.min(t.x + t.w, it.x + it.w) - Math.max(t.x, it.x));
      const iy = Math.max(0, Math.min(t.y + t.h, it.y + it.h) - Math.max(t.y, it.y));
      return ix * iy > 0.25 * it.w * it.h;
    });
    if (hits.length) problems.push({id: f.id, overlap: true, error: 'This area already has text printed in the PDF ("' + hits.slice(0, 3).map(h => h.text).join(' ').slice(0, 60) + '"). New text would print on top of it. Export the template from Canva with this area left blank, then upload it again.'});
  }
  return problems;
}

/* standard PDF fonts only cover Western European characters: swap common look-alikes, report anything else */
const SWAPS = {'‑': '-', '‒': '-', '―': '-', '−': '-', ' ': ' ', ' ': ' ', ' ': ' ', '′': "'", '″': '"', '←': '<-', '→': '->'};
function encodable(font, text){
  let out = '', dropped = '';
  for (const ch of text) {
    const c = SWAPS[ch] != null ? SWAPS[ch] : ch;
    if (c === '\n') { out += c; continue; }
    if (c === '\r' || c === '\t') { out += c === '\t' ? ' ' : ''; continue; }
    try { font.encodeText(c); out += c; } catch (e) { dropped += ch; }
  }
  return {text: out, dropped};
}
export function wrapText(text, font, size, width){
  const lines = [];
  for (const para of String(text).split('\n')) {
    const words = para.split(/(\s+)/).filter(x => x !== '');
    let cur = '';
    for (const w of words) {
      const next = cur + w;
      if (!cur || font.widthOfTextAtSize(next.trimEnd(), size) <= width) { cur = next; continue; }
      lines.push(cur.trimEnd()); cur = w.trimStart();
      while (cur && font.widthOfTextAtSize(cur, size) > width) { let k = cur.length; while (k > 1 && font.widthOfTextAtSize(cur.slice(0, k), size) > width) k--; lines.push(cur.slice(0, k)); cur = cur.slice(k); }
    }
    lines.push(cur.trimEnd());
  }
  return lines;
}
/* largest size from the preferred size down to the minimum at which the text fits the region */
export function layoutText(text, font, region, fmt){
  const f = fmt || {};
  const pref = f.size || 12, min = Math.min(pref, f.minSize || pref), lh = f.lineHeight || 1.2;
  const pad = f.padding != null ? f.padding : 0;
  const w = region.w - pad * 2, h = region.h - pad * 2;
  for (let size = pref; size >= min - 1e-6; size -= 0.5) {
    const lines = wrapText(text, font, size, w);
    const tooMany = f.maxLines && lines.length > f.maxLines;
    if (!tooMany && lines.length * size * lh <= h + 0.01) return {ok: true, size, lines, lh, pad};
  }
  const lines = wrapText(text, font, min, w);
  const fit = Math.max(1, Math.floor(h / (min * lh)));
  return {ok: false, size: min, lines, lh, pad, error: 'The text is too long for this area (' + lines.length + ' lines; about ' + (f.maxLines ? Math.min(f.maxLines, fit) : fit) + ' fit).'};
}

async function fontFor(doc, id, custom, cache){
  const key = id || 'Helvetica';
  if (cache[key]) return cache[key];
  if (custom && custom[key]) {
    if (!doc._fk) { const fontkit = (await import('@pdf-lib/fontkit')).default; doc.registerFontkit(fontkit); doc._fk = true; }
    cache[key] = await doc.embedFont(custom[key], {subset: true});
  } else cache[key] = await doc.embedFont((PDF_FONTS.find(f => f.id === key) || PDF_FONTS[0]).std);
  return cache[key];
}
async function embedImage(doc, img){
  const t = (img.type || '').toLowerCase();
  if (/png/.test(t)) return doc.embedPng(img.bytes);
  if (/jpe?g/.test(t)) return doc.embedJpg(img.bytes);
  throw new Error('Images must be PNG or JPEG.');
}

/* Fill a template. fields: the version's field mapping; values: {fieldId: {text} | {image: {bytes, type}}}.
 * opts: {flatten (form fields become part of the page), fonts: {id: fontBytes}}. Returns the new PDF and a report. */
export async function fillPdf(bytes, fields, values, opts){
  const o = opts || {};
  const doc = await PDFDocument.load(bytes, {updateMetadata: false});
  const pages = doc.getPages();
  const cache = {};
  const report = [];
  let form = null;
  try { form = doc.getForm(); } catch (e) {}
  for (const f of fields) {
    const t = f.target || {}; const v = values[f.id];
    if (t.kind === 'pdf_field') {
      if (!form) { report.push({id: f.id, ok: false, error: 'This PDF has no form fields.'}); continue; }
      let fld; try { fld = form.getField(t.name); } catch (e) { fld = null; }
      if (!fld) { report.push({id: f.id, ok: false, error: 'The form field "' + t.name + '" is missing from this PDF.'}); continue; }
      if (!v || typeof v.text !== 'string') { report.push({id: f.id, ok: true, kept: true}); continue; }
      if (!(fld instanceof PDFTextField)) { report.push({id: f.id, ok: false, error: 'Only text form fields can be filled.'}); continue; }
      const font = await fontFor(doc, (f.format || {}).font, o.fonts, cache);
      const enc = encodable(font, v.text);
      const max = fld.getMaxLength();
      if (max && enc.text.length > max) { report.push({id: f.id, ok: false, error: 'The form field allows ' + max + ' characters; this text has ' + enc.text.length + '.'}); continue; }
      fld.setText(enc.text);
      if ((f.format || {}).size) fld.setFontSize(f.format.size);
      fld.updateAppearances(font);
      report.push({id: f.id, ok: true, dropped: enc.dropped});
      continue;
    }
    if (t.kind !== 'pdf_region') continue;
    const page = pages[(t.page || 1) - 1];
    if (!page) { report.push({id: f.id, ok: false, error: 'Page ' + t.page + ' is missing.'}); continue; }
    const ph = page.getSize().height;
    if (f.type === 'image') {
      if (!v || !v.image) { report.push({id: f.id, ok: true, kept: true}); continue; }
      let img; try { img = await embedImage(doc, v.image); } catch (e) { report.push({id: f.id, ok: false, error: e.message}); continue; }
      /* cover the region, cropping the overflow */
      const s = Math.max(t.w / img.width, t.h / img.height);
      const w = img.width * s, h = img.height * s;
      const y0 = ph - t.y - t.h;
      page.pushOperators(pushGraphicsState(), rectangle(t.x, y0, t.w, t.h), clip(), endPath());
      page.drawImage(img, {x: t.x + (t.w - w) / 2, y: y0 + (t.h - h) / 2, width: w, height: h});
      page.pushOperators(popGraphicsState());
      report.push({id: f.id, ok: true});
      continue;
    }
    if (!v || typeof v.text !== 'string') { report.push({id: f.id, ok: true, kept: true}); continue; }
    const fmt = f.format || {};
    const font = await fontFor(doc, fmt.font, o.fonts, cache);
    const enc = encodable(font, v.text);
    const lay = layoutText(enc.text, font, t, fmt);
    if (!lay.ok) { report.push({id: f.id, ok: false, size: lay.size, error: lay.error}); continue; }
    const color = hex(fmt.color);
    const lineH = lay.size * lay.lh;
    const blockH = lay.lines.length * lineH;
    const top = fmt.valign === 'middle' ? (t.h - blockH) / 2 : fmt.valign === 'bottom' ? t.h - blockH - lay.pad : lay.pad;
    lay.lines.forEach((line, i) => {
      const lw = font.widthOfTextAtSize(line, lay.size);
      const x = fmt.align === 'center' ? t.x + (t.w - lw) / 2 : fmt.align === 'right' ? t.x + t.w - lay.pad - lw : t.x + lay.pad;
      /* baseline: one ascent below the top of the line */
      const y = ph - (t.y + top + i * lineH) - lay.size * 0.8 - (lineH - lay.size) / 2;
      page.drawText(line, {x, y, size: lay.size, font, color});
    });
    report.push({id: f.id, ok: true, size: lay.size, shrunk: lay.size < (fmt.size || 12), lines: lay.lines.length, dropped: enc.dropped});
  }
  if (form && o.flatten) { try { form.flatten(); } catch (e) {} }
  const out = await doc.save();
  return {bytes: out, report};
}

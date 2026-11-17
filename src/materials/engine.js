/* Browser side of document generation: loads the master template, fills it with the right engine for its source
 * (PowerPoint, PDF, or Canva through the canva Edge Function), and makes preview images. The master is never changed. */

const cache = new Map();
let pdfjsP = null;
export function pdfjs(){
  if (!pdfjsP) pdfjsP = Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]).then(([lib, w]) => { lib.GlobalWorkerOptions.workerSrc = w.default; return lib; });
  return pdfjsP;
}
export const pptxEngine = () => import('./pptx.js');
export const pdfEngine = () => import('./pdf.js');

export async function templateBytes(api, path){
  if (!cache.has(path)) cache.set(path, api.templateFile(path).catch(e => { cache.delete(path); throw e; }));
  const b = await cache.get(path);
  return b.slice(0);
}
export async function materialBytes(api, path){ return api.materialFile(path); }

/* images: approved media from the materials bucket, or a neutral placeholder for Test Template */
async function imageInfo(bytes, type){
  const blob = new Blob([bytes], {type});
  try { const bmp = await createImageBitmap(blob); const r = {width: bmp.width, height: bmp.height}; if (bmp.close) bmp.close(); return r; } catch (e) { return {width: 0, height: 0}; }
}
async function toPngOrJpeg(bytes, type){
  if (/png|jpe?g/i.test(type)) return {bytes, type: /png/i.test(type) ? 'image/png' : 'image/jpeg'};
  /* webp and others: convert in the browser so every engine can use it */
  const bmp = await createImageBitmap(new Blob([bytes], {type}));
  const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height; c.getContext('2d').drawImage(bmp, 0, 0);
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  return {bytes: new Uint8Array(await blob.arrayBuffer()), type: 'image/png'};
}
export async function sampleImage(w, h, label){
  const c = document.createElement('canvas'); c.width = w || 800; c.height = h || 600;
  const g = c.getContext('2d');
  g.fillStyle = '#DDF0E8'; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = '#1E6E5E'; g.lineWidth = 6; g.strokeRect(3, 3, c.width - 6, c.height - 6);
  g.fillStyle = '#1E6E5E'; g.font = 'bold ' + Math.round(c.width / 14) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label || 'Sample image', c.width / 2, c.height / 2);
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  return {bytes: new Uint8Array(await blob.arrayBuffer()), type: 'image/png', width: c.width, height: c.height};
}
const extType = p => /\.png$/i.test(p) ? 'image/png' : /\.webp$/i.test(p) ? 'image/webp' : 'image/jpeg';
export async function loadImage(api, path){
  const raw = await api.materialFile(path);
  const conv = await toPngOrJpeg(raw, extType(path));
  return Object.assign(conv, await imageInfo(conv.bytes, conv.type));
}

async function fontsFor(api, version){
  const out = {};
  for (const f of ((version.options || {}).fonts || [])) { try { out[f.id] = await templateBytes(api, f.path); } catch (e) {} }
  return out;
}

/* Fill a PowerPoint or PDF template. content: {fieldId: {text} | {image: path}}. sample: use placeholder images.
 * Returns {bytes, report, ext, mime}. */
export async function renderFile(api, version, content, opts){
  const o = opts || {};
  const fields = version.fields || [];
  const values = {};
  for (const f of fields) {
    const v = content[f.id];
    if (!v) continue;
    if (f.type === 'image') {
      if (v.image === 'sample' || (o.sample && v.image)) values[f.id] = {image: await sampleImage(800, 600, f.label || 'Sample image')};
      else if (v.image) values[f.id] = {image: await loadImage(api, v.image)};
    } else if (typeof v.text === 'string' && (v.text || f.fallback !== 'keep')) values[f.id] = {text: v.text};
  }
  const src = o.sourceBytes || await templateBytes(api, version.source_path);
  if (version.source_type === 'pptx') {
    const E = await pptxEngine();
    const r = await E.fillPptx(src, fields, values);
    return {bytes: r.bytes, report: r.report, ext: 'pptx', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', values};
  }
  if (version.source_type === 'pdf') {
    const E = await pdfEngine();
    const r = await E.fillPdf(src, fields, values, {flatten: (version.options || {}).flatten !== false, fonts: await fontsFor(api, version)});
    return {bytes: r.bytes, report: r.report, ext: 'pdf', mime: 'application/pdf', values};
  }
  throw new Error('Canva templates are filled in Canva.');
}

/* Canva: copy the master design and fill its data fields, then export a PDF. onStep reports progress. */
const wait = ms => new Promise(r => setTimeout(r, ms));
export async function renderCanva(api, version, content, opts){
  const o = opts || {};
  const data = {};
  for (const f of version.fields || []) {
    const t = f.target || {}; const v = content[f.id];
    if (t.kind !== 'canva_field' || !v) continue;
    if (f.type === 'image') { if (v.image && v.image !== 'sample') data[t.name] = {path: v.image}; }
    else if (typeof v.text === 'string' && (v.text || f.fallback !== 'keep')) data[t.name] = {text: v.text};
  }
  const step = s => { if (o.onStep) o.onStep(s); };
  step('Filling a copy of the Canva design…');
  const job = await api.canva('autofill', {versionId: version.id, materialId: o.materialId, test: !!o.test, title: o.title, data});
  let res = null;
  for (let i = 0; i < 60; i++) { await wait(i < 5 ? 1200 : 2500); res = await api.canva('job', {jobId: job.jobId}); if (res.status !== 'in_progress') break; }
  if (!res || res.status !== 'success') throw {message: (res && res.error) || 'Canva took too long to fill the design. Try again.'};
  step('Exporting a PDF from Canva…');
  const ex = await api.canva('export', {designId: res.design.id});
  let ej = null;
  for (let i = 0; i < 60; i++) { await wait(i < 5 ? 1500 : 3000); ej = await api.canva('export_job', {jobId: ex.jobId, materialId: o.materialId, versionId: version.id, test: !!o.test}); if (ej.status !== 'in_progress') break; }
  if (!ej || ej.status !== 'success') throw {message: (ej && ej.error) || 'Canva took too long to export the PDF. The design was still created in Canva.', design: res.design};
  return {design: res.design, pdfPath: ej.path, size: ej.size, sentFields: Object.keys(data)};
}

/* ---------- previews ---------- */
export async function pdfDoc(bytes){ const lib = await pdfjs(); return lib.getDocument({data: bytes.slice ? bytes.slice(0) : bytes, isEvalSupported: false}).promise; }
export async function renderPdfPage(doc, pageNo, canvas, width){
  const page = await doc.getPage(pageNo);
  const vp1 = page.getViewport({scale: 1});
  const scale = width / vp1.width;
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const vp = page.getViewport({scale: scale * ratio});
  canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height);
  canvas.style.width = Math.round(vp.width / ratio) + 'px'; canvas.style.height = Math.round(vp.height / ratio) + 'px';
  await page.render({canvasContext: canvas.getContext('2d'), viewport: vp}).promise;
  return {width: vp1.width, height: vp1.height, scale};
}
export async function pdfThumb(bytes, width){
  const doc = await pdfDoc(bytes);
  const c = document.createElement('canvas');
  const page = await doc.getPage(1);
  const vp1 = page.getViewport({scale: 1});
  const vp = page.getViewport({scale: (width || 480) / vp1.width});
  c.width = Math.round(vp.width); c.height = Math.round(vp.height);
  await page.render({canvasContext: c.getContext('2d'), viewport: vp}).promise;
  await doc.destroy();
  return new Promise(r => c.toBlob(r, 'image/png'));
}
/* draw the first slide of a PowerPoint preview model onto a canvas (thumbnails) */
export async function pptxThumb(model, width){
  const W = width || 480, k = W / model.width;
  const c = document.createElement('canvas'); c.width = W; c.height = Math.round(model.height * k);
  const g = c.getContext('2d');
  const s = model.slides[0]; if (!s) return null;
  g.fillStyle = (s.bg && s.bg.color) || '#ffffff'; g.fillRect(0, 0, c.width, c.height);
  const img = async (bytes, url) => { try { return await createImageBitmap(url ? await (await fetch(url)).blob() : new Blob([bytes])); } catch (e) { return null; } };
  if (s.bg && s.bg.media && model.media[s.bg.media]) { const b = await img(model.media[s.bg.media]); if (b) g.drawImage(b, 0, 0, c.width, c.height); }
  for (const it of s.items) {
    const x = it.x * k, y = it.y * k, w = it.w * k, h = it.h * k;
    if (it.type === 'pic') { const b = await img(it.media ? model.media[it.media] : null, it.url); if (b) g.drawImage(b, x, y, w, h); continue; }
    const st = it.style || {}; const size = Math.max(4, (st.size || 18) * 12700 * k);
    g.fillStyle = st.color || '#222'; g.font = (st.bold ? 'bold ' : '') + (st.italic ? 'italic ' : '') + size + 'px ' + (st.font ? '"' + st.font + '", ' : '') + 'sans-serif'; g.textBaseline = 'top';
    let ly = y + 0.05 * 914400 * k;
    for (const para of String(it.text || '').split('\n')) {
      let line = '';
      for (const word of para.split(/\s+/)) { const t = line ? line + ' ' + word : word; if (g.measureText(t).width > w - 0.2 * 914400 * k && line) { g.fillText(line, x + 0.1 * 914400 * k, ly); ly += size * 1.2; line = word; } else line = t; }
      g.fillText(line, x + 0.1 * 914400 * k, ly); ly += size * 1.2;
    }
  }
  return new Promise(r => c.toBlob(r, 'image/png'));
}
export function download(bytes, name, mime){
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes], {type: mime || 'application/octet-stream'});
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = href; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 5000);
}

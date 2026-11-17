/* Manage Templates: the template library (Audience → Material Type → Template → Version), category management, and
 * the template editor (add or update a design, map its fields, Test Template, approve). Built by createTemplateUI(kit)
 * with the journal's own components so it looks and behaves like the rest of the app. */
import { SOURCES, FIELD_TYPES, CHANNELS, sourceById, sourceLabel, sampleContent, checkMapping } from './content.js';
import { SOURCE_TYPES, CONFIG_STATUS } from './model.js';
import { pdfjs, pptxEngine, pdfEngine, templateBytes, renderFile, renderCanva, pdfDoc, renderPdfPage, pdfThumb, pptxThumb, materialBytes } from './engine.js';

export function createTemplateUI(kit){
  const {html, useState, useEffect, useMemo, useRef, useApp, Icon, Pill, Field, SheetHead, ConfirmSheet, PageTabs, fmtDate, asStr, uuid, useMat, ErrorNote, Busy} = kit;

  /* ---------- previews ---------- */
  function useWidth(ref){
    const [w, setW] = useState(0);
    useEffect(() => { const el = ref.current; if (!el) return; const ro = new ResizeObserver(es => setW(Math.round(es[0].contentRect.width))); ro.observe(el); setW(el.clientWidth); return () => ro.disconnect(); }, []);
    return w;
  }
  /* one PowerPoint slide drawn approximately (pictures, backgrounds, text) with optional clickable shapes */
  function SlideView({model, index, picks, onPick, selected, mapped}){
    const box = useRef(null); const w = useWidth(box);
    const urls = useMemo(() => { const u = {}; Object.entries(model.media || {}).forEach(([k, b]) => { u[k] = URL.createObjectURL(new Blob([b])); }); return u; }, [model]);
    useEffect(() => () => Object.values(urls).forEach(u => URL.revokeObjectURL(u)), [urls]);
    const s = model.slides[index]; if (!s) return null;
    const k = w / model.width;
    const pos = it => ({left: (100 * it.x / model.width) + '%', top: (100 * it.y / model.height) + '%', width: (100 * it.w / model.width) + '%', height: (100 * it.h / model.height) + '%'});
    const bg = s.bg ? Object.assign({background: s.bg.color || undefined}, s.bg.media && urls[s.bg.media] ? {backgroundImage: 'url(' + urls[s.bg.media] + ')', backgroundSize: 'cover'} : {}) : {background: '#fff'};
    return html`<div className="mt-slide" ref=${box} style=${Object.assign({aspectRatio: model.width + ' / ' + model.height}, bg)}>
      ${s.items.map((it, i) => it.type === 'pic'
        ? html`<img key=${i} className="mt-slide-pic" alt="" src=${it.url || urls[it.media]} style=${Object.assign(pos(it), it.cover ? {objectFit: 'cover'} : {})} />`
        : html`<div key=${i} className=${'mt-slide-text' + (it.filled ? ' filled' : '')} style=${Object.assign(pos(it), {fontSize: Math.max(4, (((it.style || {}).size) || 18) * 12700 * k) + 'px', color: (it.style || {}).color || '#222', fontWeight: (it.style || {}).bold ? 700 : 400, fontStyle: (it.style || {}).italic ? 'italic' : 'normal', textAlign: (it.style || {}).align || 'left', fontFamily: (it.style || {}).font ? '"' + it.style.font + '", sans-serif' : 'sans-serif'})}>${it.text}</div>`)}
      ${(picks || []).map(p => html`<button type="button" key=${p.key} className=${'mt-pick' + (selected === p.key ? ' sel' : '') + (mapped && mapped[p.key] ? ' mapped' : '')} style=${pos(p)} title=${p.name} onClick=${() => onPick && onPick(p)}>${mapped && mapped[p.key] ? html`<span className="mt-pick-tag">${mapped[p.key]}</span>` : null}</button>`)}
    </div>`;
  }
  function PptxPreview({bytes, values, fields, note}){
    const [model, setModel] = useState(null); const [err, setErr] = useState('');
    useEffect(() => { let alive = true; setModel(null); (async () => { try { const E = await pptxEngine(); const m = await E.previewPptx(bytes, values, fields); if (alive) setModel(m); } catch (e) { if (alive) setErr(e.message || 'Could not read the PowerPoint file.'); } })(); return () => { alive = false; }; }, [bytes]);
    if (err) return html`<p className="error small">${err}</p>`;
    if (!model) return html`<div className="skeleton mt-skel"></div>`;
    return html`<div className="mt-pages">${note !== false ? html`<p className="small muted">Approximate preview. Open the downloaded PowerPoint to see the exact fonts and layout.</p>` : null}${model.slides.map((s, i) => html`<div key=${i} className="mt-page"><${SlideView} model=${model} index=${i} /><small className="muted">Slide ${i + 1}</small></div>`)}</div>`;
  }
  function PdfPage({doc, page, overlay, onDraw, drawing}){
    const box = useRef(null); const cv = useRef(null); const w = useWidth(box);
    const [geo, setGeo] = useState(null);
    useEffect(() => { if (!doc || !w) return; let alive = true; renderPdfPage(doc, page, cv.current, w).then(g => { if (alive) setGeo(g); }).catch(() => {}); return () => { alive = false; }; }, [doc, page, w]);
    const [drag, setDrag] = useState(null);
    const pt = e => { const r = box.current.getBoundingClientRect(); const k = geo ? geo.scale : 1; return {x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k}; };
    const down = e => { if (!drawing || !geo) return; e.preventDefault(); const p = pt(e); setDrag({x0: p.x, y0: p.y, x1: p.x, y1: p.y}); try { e.target.setPointerCapture(e.pointerId); } catch (x) {} };
    const move = e => { if (drag) { const p = pt(e); setDrag(d => Object.assign({}, d, {x1: p.x, y1: p.y})); } };
    const up = () => { if (!drag) return; const r = {x: Math.min(drag.x0, drag.x1), y: Math.min(drag.y0, drag.y1), w: Math.abs(drag.x1 - drag.x0), h: Math.abs(drag.y1 - drag.y0)}; setDrag(null); if (r.w > 6 && r.h > 6 && onDraw) onDraw({x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h)}); };
    const k = geo ? geo.scale : 0;
    const st = r => ({left: r.x * k + 'px', top: r.y * k + 'px', width: r.w * k + 'px', height: r.h * k + 'px'});
    return html`<div className=${'mt-pdfpage' + (drawing ? ' drawing' : '')} ref=${box} onPointerDown=${down} onPointerMove=${move} onPointerUp=${up}>
      <canvas ref=${cv}></canvas>
      ${geo ? (overlay || []).map((o, i) => html`<button type="button" key=${i} className=${'mt-region ' + (o.cls || '')} style=${st(o)} title=${o.title || ''} onClick=${o.onClick} tabIndex=${o.onClick ? 0 : -1}>${o.label ? html`<span className="mt-pick-tag">${o.label}</span>` : null}</button>`) : null}
      ${drag && geo ? html`<div className="mt-region drawing" style=${st({x: Math.min(drag.x0, drag.x1), y: Math.min(drag.y0, drag.y1), w: Math.abs(drag.x1 - drag.x0), h: Math.abs(drag.y1 - drag.y0)})}></div>` : null}
    </div>`;
  }
  function PdfPreview({bytes, maxPages}){
    const [doc, setDoc] = useState(null); const [err, setErr] = useState('');
    useEffect(() => { let alive = true; let d = null; setDoc(null); pdfDoc(bytes).then(x => { d = x; if (alive) setDoc(x); }, e => { if (alive) setErr('Could not show this PDF.'); }); return () => { alive = false; if (d) d.destroy(); }; }, [bytes]);
    if (err) return html`<p className="error small">${err}</p>`;
    if (!doc) return html`<div className="skeleton mt-skel"></div>`;
    const n = Math.min(doc.numPages, maxPages || 12);
    return html`<div className="mt-pages">${Array.from({length: n}, (_, i) => html`<div key=${i} className="mt-page"><${PdfPage} doc=${doc} page=${i + 1} /><small className="muted">Page ${i + 1} of ${doc.numPages}</small></div>`)}</div>`;
  }
  /* any generated or template file */
  function DocPreview({kind, bytes, values, fields}){
    if (!bytes) return null;
    return kind === 'pptx' ? html`<${PptxPreview} bytes=${bytes} values=${values} fields=${fields} />` : html`<${PdfPreview} bytes=${bytes} />`;
  }
  /* a stored preview image (template or material thumbnail) */
  function Thumb({bucket, path, alt, fallback}){
    const {mat} = useApp(); const [src, setSrc] = useState('');
    useEffect(() => { let alive = true; setSrc(''); if (path && mat.api) mat.api.fileUrl(bucket, path).then(u => { if (alive) setSrc(u); }, () => {}); return () => { alive = false; }; }, [path]);
    return src ? html`<img className="mt-thumb" src=${src} alt=${alt || ''} />` : html`<span className="mt-thumb mt-thumb-empty" aria-hidden="true"><${Icon} name=${fallback || 'doc'} size=${28} /></span>`;
  }
  function SourceBadge({type}){ const s = SOURCE_TYPES[type] || {}; return html`<span className=${'mt-src mt-src-' + type}>${type === 'canva' ? html`<span className="mt-canva-dot">C</span>` : html`<${Icon} name=${type === 'pdf' ? 'file' : 'monitor'} size=${14} />`}${s.label || type}</span>`; }
  function ConfigPill({v}){ if (!v) return null; if (v.archived_at) return html`<${Pill} tone="outline">Archived<//>`; const s = CONFIG_STATUS.find(x => x.id === v.config_status) || CONFIG_STATUS[0]; return html`<${Pill} tone=${s.tone}>${s.label}<//>`; }

  /* ---------- the tree ---------- */
  function TemplateTree({m, q, selected, onSelect, onAdd, admin, showVersions}){
    const [open, setOpen] = useState(() => new Set(m.roots.map(a => a.id)));
    /* open the path down to the selected template */
    useEffect(() => {
      const f = selected && m.fam.get(selected); if (!f) return;
      const t = m.typ.get(f.material_type_id); if (!t) return;
      const ids = [t.id]; let a = m.aud.get(t.audience_id), guard = 0;
      while (a && guard++ < 10) { ids.push(a.id); a = a.parent_id ? m.aud.get(a.parent_id) : null; }
      setOpen(o => ids.every(x => o.has(x)) ? o : new Set([...o, ...ids]));
    }, [selected, m.families.length]);
    const tog = id => setOpen(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    const ql = asStr(q).toLowerCase();
    const famMatch = f => !ql || f.name.toLowerCase().includes(ql);
    const typeMatch = t => !ql || t.name.toLowerCase().includes(ql) || m.familiesOf(t.id).some(famMatch);
    const audMatch = a => !ql || a.name.toLowerCase().includes(ql) || m.typesOf(a.id).some(typeMatch) || m.children(a.id).some(audMatch);
    const famRow = f => { const v = m.currentVersion(f); const n = m.versionsOf(f.id).length; return html`<li key=${f.id}>
      <button type="button" className=${'mt-tree-item mt-tree-fam' + (selected === f.id ? ' sel' : '')} onClick=${() => onSelect(f)}><${Icon} name="doc" size=${16} /><span>${f.name}</span>${m.isDefault(f) ? html`<span className="mt-dot-def" title="Default template"></span>` : null}<small>(${n})</small></button>
      ${showVersions && selected === f.id ? html`<ul className="mt-tree-vers">${m.versionsOf(f.id).map(x => html`<li key=${x.id} className=${x.id === (v && v.id) ? 'cur' : ''}><span className="mt-vdot"></span>Version ${x.version_no}${x.id === (v && v.id) ? (m.isDefault(f) ? ' (Default)' : ' (Current)') : x.archived_at ? ' (Archived)' : x.config_status !== 'approved' ? ' (Draft)' : ''}</li>`)}</ul>` : null}
    </li>`; };
    const typeRow = t => { const fams = m.familiesOf(t.id).filter(famMatch); const isOpen = open.has(t.id) || !!ql; return html`<li key=${t.id}>
      <button type="button" className="mt-tree-item mt-tree-type" aria-expanded=${isOpen} onClick=${() => tog(t.id)}><${Icon} name="file" size=${16} /><span>${t.name}</span><small>${m.familiesOf(t.id).length || ''}</small><${Icon} name="chev" size=${14} /></button>
      ${isOpen ? html`<ul>${fams.map(famRow)}${!fams.length && !ql ? html`<li className="mt-tree-empty small muted">No template yet${admin ? html` · <button type="button" className="link-btn" onClick=${() => onAdd(t)}>Add one</button>` : null}</li>` : null}</ul>` : null}
    </li>`; };
    const audRow = (a, depth) => { if (!audMatch(a)) return null; const isOpen = open.has(a.id) || !!ql; const kids = m.children(a.id).filter(x => x.active !== false); const types = m.typesOf(a.id); return html`<li key=${a.id}>
      <button type="button" className=${'mt-tree-item mt-tree-aud' + (depth ? ' sub' : '')} aria-expanded=${isOpen} onClick=${() => tog(a.id)}><${Icon} name="folder" size=${18} /><span>${a.name}</span><${Icon} name="chev" size=${14} /></button>
      ${isOpen ? html`<ul>${kids.map(c => audRow(c, depth + 1))}${types.filter(typeMatch).map(typeRow)}</ul>` : null}
    </li>`; };
    return html`<ul className="mt-tree" role="tree">${m.roots.filter(a => a.active !== false).map(a => audRow(a, 0))}</ul>`;
  }

  /* ---------- template library ---------- */
  function ManageTemplates({initialFamily}){
    const {nav, isAdmin, openSheet, showToast} = useApp();
    const mat = useMat(); const m = mat.model;
    const [tab, setTab] = useState('library');
    const [q, setQ] = useState('');
    const [sel, setSel] = useState(initialFamily || null);
    const [busy, setBusy] = useState('');
    useEffect(() => { if (!sel && m.families.length) { const f = m.families.find(x => x.status === 'active' && m.isDefault(x)) || m.families.find(x => x.status === 'active'); if (f) setSel(f.id); } }, [m.families.length]);
    const fam = sel ? m.fam.get(sel) : null;
    const type = fam ? m.typ.get(fam.material_type_id) : null;
    const cur = fam ? m.currentVersion(fam) : null;
    const latest = fam ? m.versionsOf(fam.id)[0] : null;
    const working = latest && latest.config_status !== 'approved' && !latest.archived_at ? latest : null;
    const shown = cur || latest;
    const act = async (label, fn, ok) => { setBusy(label); try { await fn(); await mat.reload(); if (ok) showToast(ok); } catch (e) { showToast(e.message || "That didn't work."); } setBusy(''); };
    const setDefault = () => act('default', () => mat.api.update('mat_types', type.id, {default_family_id: fam.id}), fam.name + ' is now the default for ' + type.name + '.');
    const archive = () => openSheet(close => html`<${ConfirmSheet} close=${close} title=${'Archive ' + fam.name + '?'} body=${'Staff won\'t be able to choose it for new materials. Materials already made with it keep their template and stay exactly as they are.' + (m.isDefault(fam) ? ' It is the current default, so ' + type.name + ' will have no default until you choose another.' : '')} confirmLabel="Archive template" onConfirm=${() => act('archive', async () => { if (m.isDefault(fam)) await mat.api.update('mat_types', type.id, {default_family_id: null}); await mat.api.update('mat_template_families', fam.id, {status: 'archived'}); }, 'Template archived.')} />`);
    const restore = () => act('restore', () => mat.api.update('mat_template_families', fam.id, {status: 'active'}), 'Template restored.');
    const editMapping = () => {
      if (working) return nav('template-edit', {versionId: working.id});
      if (!cur) return;
      openSheet(close => html`<${ConfirmSheet} close=${close} title="Edit as a new version?" body=${'Version ' + cur.version_no + ' is approved, so it stays exactly as it is (documents made with it depend on it). A new version ' + (cur.version_no + 1) + ' starts with the same design and field mapping, ready to edit, test and approve.'} confirmLabel="Create version and edit" onConfirm=${async () => {
        const id = uuid(); await mat.api.save('mat_template_versions', {id, family_id: fam.id, version_no: m.versionsOf(fam.id)[0].version_no + 1, config_status: 'draft', source_type: cur.source_type, source_path: cur.source_path, source_name: cur.source_name, canva_design_id: cur.canva_design_id, canva_url: cur.canva_url, inspection: cur.inspection, fields: cur.fields, options: cur.options, change_notes: 'Field mapping updated'});
        await mat.reload(); nav('template-edit', {versionId: id});
      }} />`);
    };
    if (mat.state === 'missing') return html`<${kit.SetupNotice} />`;
    return html`<div className="view mt-manage">
      <div className="mt-subtabs"><${PageTabs} label="Manage templates" value=${tab} onChange=${setTab} tabs=${[{id: 'library', label: 'Template Library'}, {id: 'categories', label: 'Audiences & Material Types'}]} /></div>
      ${tab === 'categories' ? html`<${Categories} />` : html`<div className="mt-3col">
        <section className="card mt-panel mt-treepanel" aria-label="Template library">
          <h2>Template Library</h2><p className="small muted">Organized by audience and material type.</p>
          <label className="mt-search"><${Icon} name="search" size=${18} /><input className="input" placeholder="Search templates…" value=${q} onChange=${e => setQ(e.target.value)} aria-label="Search templates" /></label>
          <${TemplateTree} m=${m} q=${q} selected=${sel} onSelect=${f => setSel(f.id)} admin=${isAdmin} showVersions=${true} onAdd=${t => nav('template-edit', {mode: 'new', typeId: t.id})} />
        </section>
        <section className="card mt-panel mt-detail" aria-label="Template details">
          ${!fam ? html`<div className="empty"><${Icon} name="layers" size=${34} /><h3>No templates yet</h3><p className="muted">${isAdmin ? 'Upload a Canva-exported PDF or PowerPoint, or connect a Canva design, to start the library.' : 'An administrator adds templates here.'}</p>${isAdmin ? html`<div className="row-btns center"><button className="btn btn-primary" onClick=${() => nav('template-edit', {mode: 'new', kind: 'file'})}><${Icon} name="upload" size=${18} /> Upload Template</button><button className="btn btn-ghost" onClick=${() => nav('template-edit', {mode: 'new', kind: 'canva'})}><span className="mt-canva-dot">C</span> Connect Canva Design</button></div>` : null}</div>` : html`
          <div className="mt-detail-head"><p className="eyebrow mt-eyebrow">${m.audPath(type.audience_id)}</p>${m.isDefault(fam) ? html`<${Pill} tone="good"><${Icon} name="check" size=${14} /> Current Default<//>` : fam.status === 'archived' ? html`<${Pill} tone="outline">Archived<//>` : null}</div>
          <h2 className="mt-title">${fam.name}</h2>
          <p className="muted">${fam.description || type.name}</p>
          ${shown ? html`<div className="mt-meta small"><${SourceBadge} type=${shown.source_type} /><span><${Icon} name="file" size=${14} /> ${pageCount(shown) || '?'} page${pageCount(shown) === 1 ? '' : 's'}</span><span><${Icon} name="clock" size=${14} /> Version ${shown.version_no}${shown === cur ? ' (Current)' : ''}</span><${ConfigPill} v=${shown} /></div>` : null}
          <div className="mt-preview-box">${shown ? html`<${Thumb} bucket="templates" path=${shown.preview_path} alt=${fam.name + ' preview'} fallback="layers" />` : null}</div>
          ${isAdmin && shown ? html`<p className="small muted mt-cap"><strong>Creates:</strong> ${(SOURCE_TYPES[shown.source_type] || {}).output}.</p>` : null}
          ${working ? html`<p className="notice small">Version ${working.version_no} is ${working.config_status === 'tested' ? 'tested and waiting for approval' : 'being set up'}. ${cur ? 'Version ' + cur.version_no + ' stays in use until it is approved.' : 'Staff can use this template once a version is approved.'}</p>` : null}
          ${isAdmin ? html`<div className="mt-actions">
            <button className="btn btn-ghost btn-sm" id="tpl-edit-mapping" onClick=${editMapping} disabled=${!!busy || fam.status === 'archived'}><${Icon} name="edit" size=${16} /> Edit Field Mapping</button>
            <button className="btn btn-ghost btn-sm" id="tpl-test" onClick=${() => nav('template-edit', {versionId: (working || cur || latest).id, step: 'test'})} disabled=${!!busy || !(working || cur)}><${Icon} name="play" size=${16} /> Test Template</button>
            ${!m.isDefault(fam) && fam.status === 'active' ? html`<button className="btn btn-primary btn-sm" id="tpl-default" onClick=${setDefault} disabled=${!!busy || !cur}><${Icon} name="check" size=${16} /> Set as Default</button>` : null}
            <button className="btn btn-ghost btn-sm" id="tpl-update" onClick=${() => nav('template-edit', {mode: 'update', familyId: fam.id})} disabled=${!!busy || fam.status === 'archived'}><${Icon} name="upload" size=${16} /> Update Template</button>
            <button className="btn btn-ghost btn-sm" id="tpl-variation" onClick=${() => nav('template-edit', {mode: 'variation', familyId: fam.id})} disabled=${!!busy}><${Icon} name="plus" size=${16} /> Create Variation</button>
            ${fam.status === 'active' ? html`<button className="btn btn-quiet btn-sm danger" id="tpl-archive" onClick=${archive} disabled=${!!busy}><${Icon} name="archive" size=${16} /> Archive</button>` : html`<button className="btn btn-ghost btn-sm" onClick=${restore}>Restore</button>`}
          </div>` : html`<p className="small muted">Only administrators can change templates.</p>`}`}
        </section>
        <aside className="mt-side">
          ${shown ? html`<section className="card mt-panel" aria-label="Field mapping">
            <h2>Field Mapping</h2><p className="small muted">How ABG content fills ${shown === cur ? 'this template' : 'version ' + shown.version_no}.</p>
            ${(shown.fields || []).length ? html`<div className="mt-maplist">${shown.fields.map(f => html`<div key=${f.id} className="mt-maprow"><span className="mt-mapname"><${Icon} name=${fieldIcon(f)} size=${16} />${f.label || f.id}</span><span className="mt-mapsrc small">${sourceLabel(f)}</span></div>`)}</div>` : html`<p className="small muted">No fields mapped yet.</p>`}
          </section>` : null}
          ${fam ? html`<section className="card mt-panel" id="tpl-versions" aria-label="Template versions">
            <h2>Template Versions</h2><p className="small muted">Every design stays on record. Documents keep the version they were made with.</p>
            <ol className="mt-versions">${m.versionsOf(fam.id).map(v => html`<li key=${v.id} className=${v.id === (cur && cur.id) ? 'cur' : ''}>
              <span className="mt-vdot"></span>
              <div><strong>Version ${v.version_no}${v.id === (cur && cur.id) ? (m.isDefault(fam) ? ' – Current (Default)' : ' – Current') : ''}</strong> <${ConfigPill} v=${v} />
                <p className="small muted">${v.change_notes || (v.version_no === 1 ? 'Original design' : 'Updated design')}</p>
                <p className="small muted">${fmtDate(v.created_at)} by ${kit.who(v.created_by)} · <${SourceBadge} type=${v.source_type} /></p>
                ${isAdmin ? html`<div className="row-btns">
                  ${v.config_status !== 'approved' && !v.archived_at ? html`<button className="btn btn-quiet btn-sm" onClick=${() => nav('template-edit', {versionId: v.id})}>Continue setup</button>` : null}
                  ${v.config_status === 'approved' && !v.archived_at && v.id !== (cur && cur.id) ? html`<button className="btn btn-quiet btn-sm" onClick=${() => act('current', () => mat.api.update('mat_template_families', fam.id, {current_version_id: v.id}), 'Version ' + v.version_no + ' is now current.')}>Make current</button>` : null}
                  ${v.config_status === 'approved' && !v.archived_at && v.id !== (cur && cur.id) ? html`<button className="btn btn-quiet btn-sm" onClick=${() => act('varch', () => mat.api.update('mat_template_versions', v.id, {archived_at: new Date().toISOString()}), 'Version archived.')}>Archive</button>` : null}
                  ${v.config_status === 'draft' ? html`<button className="btn btn-quiet btn-sm danger" onClick=${() => act('vdel', () => mat.api.remove('mat_template_versions', v.id), 'Draft version deleted.')}>Delete draft</button>` : null}
                </div>` : null}
              </div></li>`)}</ol>
          </section>` : null}
        </aside>
      </div>`}
    </div>`;
  }
  const pageCount = v => { const i = (v && v.inspection) || {}; const p = i.pages; return Array.isArray(p) ? p.length : (p || (i.design || {}).pages || 0); };
  const fieldIcon = f => f.type === 'image' ? 'image' : f.type === 'quote' ? 'quote' : f.type === 'number' || (f.source || '').startsWith('stat') ? 'bars' : (f.source || '') === 'ai:cta' ? 'megaphone' : (f.source || '').startsWith('ai:story') ? 'openbook' : f.type === 'paragraph' ? 'list' : 'type';

  /* ---------- categories ---------- */
  function Categories(){
    const {isAdmin, openSheet, showToast} = useApp();
    const mat = useMat(); const m = mat.model;
    const [showArchived, setShowArchived] = useState(false);
    const save = async (table, row, msg) => { try { await mat.api.save(table, row); await mat.reload(); showToast(msg); return true; } catch (e) { showToast(e.message); return false; } };
    const editAud = (a, parent) => openSheet(close => html`<${AudSheet} close=${close} a=${a} parent=${parent} m=${m} onSave=${row => save('mat_audiences', row, a ? 'Audience saved.' : 'Audience added.')} />`);
    const editType = (t, aud) => openSheet(close => html`<${TypeSheet} close=${close} t=${t} aud=${aud} m=${m} onSave=${row => save('mat_types', row, t ? 'Material type saved.' : 'Material type added.')} />`);
    const audBlock = (a, depth) => { if (!showArchived && !a.active) return null; return html`<li key=${a.id} className=${'mt-cat' + (a.active ? '' : ' off')}>
      <div className="mt-cat-row"><span className="mt-cat-name"><${Icon} name="folder" size=${18} /><strong>${a.name}</strong>${a.active ? null : html` <${Pill} tone="outline">Archived<//>`}</span>
        ${isAdmin ? html`<span className="row-btns"><button className="btn btn-quiet btn-sm" onClick=${() => editAud(a)}>Edit</button>${depth === 0 ? html`<button className="btn btn-quiet btn-sm" onClick=${() => editAud(null, a)}>+ Audience</button>` : null}<button className="btn btn-quiet btn-sm" onClick=${() => editType(null, a)}>+ Material type</button></span>` : null}</div>
      <ul>${m.children(a.id).map(c => audBlock(c, depth + 1))}${m.typesOf(a.id, true).filter(t => showArchived || t.active).map(t => html`<li key=${t.id} className=${'mt-cat mt-cat-type' + (t.active ? '' : ' off')}><div className="mt-cat-row"><span className="mt-cat-name"><${Icon} name="file" size=${16} />${t.name} <small className="muted">· ${(CHANNELS.find(c => c.id === t.channel) || {}).label}</small>${t.active ? null : html` <${Pill} tone="outline">Archived<//>`}</span>${isAdmin ? html`<button className="btn btn-quiet btn-sm" onClick=${() => editType(t, a)}>Edit</button>` : null}</div></li>`)}</ul>
    </li>`; };
    return html`<section className="card mt-panel">
      <div className="row-between"><div><h2>Audiences & Material Types</h2><p className="small muted">Audiences can be grouped (Donor Materials › Individual Donors). Each material type lists where finished pieces are used, which decides the consent each story and image needs.</p></div>
        ${isAdmin ? html`<button className="btn btn-primary btn-sm" id="cat-add-aud" onClick=${() => editAud(null)}><${Icon} name="plus" size=${16} /> Add audience group</button>` : null}</div>
      <label className="check small"><input type="checkbox" checked=${showArchived} onChange=${e => setShowArchived(e.target.checked)} /> Show archived</label>
      <ul className="mt-cats">${m.roots.map(a => audBlock(a, 0))}</ul>
    </section>`;
  }
  function AudSheet({close, a, parent, m, onSave}){
    const [name, setName] = useState(a ? a.name : ''); const [desc, setDesc] = useState(a ? (a.description || '') : ''); const [active, setActive] = useState(a ? a.active : true);
    const par = a ? (a.parent_id ? m.aud.get(a.parent_id) : null) : parent;
    const inUse = a && (m.typesOf(a.id).length || m.children(a.id).some(c => c.active));
    return html`<div className="view" style=${{gap: '12px'}}><${SheetHead} title=${a ? 'Edit audience' : par ? 'Add audience to ' + par.name : 'Add audience group'} close=${close} />
      <${Field} label="Name"><input id="aud-name" className="input" value=${name} onChange=${e => setName(e.target.value)} placeholder="e.g. Board Members" /><//>
      <${Field} label="Description (optional)"><input className="input" value=${desc} onChange=${e => setDesc(e.target.value)} /><//>
      ${a ? html`<label className="check"><input type="checkbox" checked=${active} onChange=${e => setActive(e.target.checked)} /> Active (shown to staff)</label>${!active && inUse ? html`<p className="small muted">Archiving hides it from new materials. Existing materials and templates keep it.</p>` : null}` : null}
      <div className="row-btns end"><button className="btn btn-ghost" onClick=${close}>Cancel</button><button className="btn btn-primary" id="aud-save" disabled=${!asStr(name)} onClick=${async () => { if (await onSave({id: a ? a.id : uuid(), parent_id: a ? a.parent_id : (par ? par.id : null), name: asStr(name), description: asStr(desc) || null, active, sort: a ? a.sort : 99})) close(); }}>Save</button></div></div>`;
  }
  function TypeSheet({close, t, aud, m, onSave}){
    const [name, setName] = useState(t ? t.name : ''); const [desc, setDesc] = useState(t ? (t.description || '') : ''); const [channel, setChannel] = useState(t ? t.channel : 'print'); const [active, setActive] = useState(t ? t.active : true);
    const [audId, setAudId] = useState(t ? t.audience_id : aud.id);
    const used = t && m.familiesOf(t.id, true).length;
    return html`<div className="view" style=${{gap: '12px'}}><${SheetHead} title=${t ? 'Edit material type' : 'Add material type'} close=${close} />
      <${Field} label="Name"><input id="type-name" className="input" value=${name} onChange=${e => setName(e.target.value)} placeholder="e.g. Donor Impact Summary" /><//>
      <${Field} label="Audience"><select className="select" value=${audId} disabled=${!!used} onChange=${e => setAudId(e.target.value)}>${m.audiences.filter(a => a.active).map(a => html`<option key=${a.id} value=${a.id}>${m.audPath(a.id)}</option>`)}</select><//>
      <${Field} label="Where finished pieces are used" hint="Stories and images must be permitted for this use before they can appear in it."><select id="type-channel" className="select" value=${channel} onChange=${e => setChannel(e.target.value)}>${CHANNELS.map(c => html`<option key=${c.id} value=${c.id}>${c.label} (${c.hint})</option>`)}</select><//>
      <${Field} label="Description (optional)"><input className="input" value=${desc} onChange=${e => setDesc(e.target.value)} /><//>
      ${t ? html`<label className="check"><input type="checkbox" checked=${active} onChange=${e => setActive(e.target.checked)} /> Active (shown to staff)</label>` : null}
      <div className="row-btns end"><button className="btn btn-ghost" onClick=${close}>Cancel</button><button className="btn btn-primary" id="type-save" disabled=${!asStr(name)} onClick=${async () => { if (await onSave({id: t ? t.id : uuid(), audience_id: audId, name: asStr(name), description: asStr(desc) || null, channel, active, sort: t ? t.sort : 99})) close(); }}>Save</button></div></div>`;
  }

  /* ---------- template editor ---------- */
  const guessSource = (name, type) => {
    const n = String(name || '').toLowerCase();
    if (type === 'image' || /image|photo|picture|img/.test(n)) return {source: 'image', type: 'image'};
    if (/attrib|speaker|byline/.test(n)) return {source: 'quote:attribution', type: 'text'};
    if (/quote/.test(n)) return {source: 'quote:text', type: 'quote'};
    if (/stat.*label|label/.test(n)) return {source: 'stat:label', type: 'text'};
    if (/stat|number|metric|count/.test(n)) return {source: 'stat:value', type: 'number'};
    if (/title|headline|heading/.test(n)) return {source: 'ai:title', type: 'text'};
    if (/intro|opening|overview|about/.test(n)) return {source: 'ai:intro', type: 'paragraph'};
    if (/story|highlight|spotlight/.test(n)) return {source: 'ai:story', type: 'paragraph'};
    if (/program/.test(n)) return {source: 'ai:program', type: 'paragraph'};
    if (/cta|action|support|give|donate/.test(n)) return {source: 'ai:cta', type: 'paragraph'};
    if (/mission/.test(n)) return {source: 'bank:mission', type: 'paragraph'};
    if (/period|year|season/.test(n)) return {source: 'period', type: 'text'};
    if (/date/.test(n)) return {source: 'date', type: 'date'};
    return {source: 'manual', type: 'text'};
  };
  const ABBR = {cta: 'Call to action', img: 'Image', stat: 'Statistic', intro: 'Introduction'};
  const human = s => { const t = String(s || '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim(); if (ABBR[t.toLowerCase()]) return ABBR[t.toLowerCase()]; return t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Field'; };
  const idFrom = s => (String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/^(\d)/, 'f_$1').slice(0, 40)) || 'field';
  const uniqueId = (base, fields) => { let id = idFrom(base), k = 2; while (fields.some(f => f.id === id)) id = idFrom(base) + '_' + (k++); return id; };
  function autoFields(kind, insp){
    const out = [];
    const add = (label, target, extra) => { const g = guessSource(label, extra && extra.type); out.push(Object.assign({id: uniqueId(label, out), label: human(label), type: g.type, source: g.source, n: 1, required: true, fallback: 'keep', target}, extra || {}, {type: (extra && extra.type) || g.type})); };
    if (kind === 'pptx') insp.slides.forEach(s => s.shapes.filter(x => x.suggest).forEach(x => add(x.suggest, {kind: 'pptx_shape', slide: s.index, shapeId: x.id, name: x.name}, x.kind === 'picture' ? {type: 'image'} : {})));
    if (kind === 'pdf') (insp.fields || []).filter(f => f.type === 'text').forEach(f => add(f.name, {kind: 'pdf_field', name: f.name, page: f.page}, {type: f.multiline ? 'paragraph' : 'text', maxChars: f.maxLength || undefined}));
    if (kind === 'canva') (insp.fields || []).forEach(f => add(f.name, {kind: 'canva_field', name: f.name, canvaType: f.type}, f.type === 'image' ? {type: 'image'} : {}));
    return out;
  }
  /* keep the previous version's mapping where the new design still has the same element */
  function carryFields(prev, kind, insp){
    if (!prev || prev.source_type !== kind) return autoFields(kind, insp);
    const out = [];
    for (const f of prev.fields || []) {
      const t = f.target || {};
      if (kind === 'canva') { const hit = (insp.fields || []).find(x => x.name === t.name); if (hit) out.push(Object.assign({}, f, {target: Object.assign({}, t, {canvaType: hit.type})})); continue; }
      if (kind === 'pptx') { const s = insp.slides[(t.slide || 1) - 1]; const hit = s && (s.shapes.find(x => x.name === t.name && x.name) || s.shapes.find(x => x.id === t.shapeId)); if (hit) out.push(Object.assign({}, f, {target: Object.assign({}, t, {shapeId: hit.id, name: hit.name})})); continue; }
      if (kind === 'pdf') { if (t.kind === 'pdf_region' && insp.pages[(t.page || 1) - 1]) out.push(f); else if (t.kind === 'pdf_field' && (insp.fields || []).some(x => x.name === t.name)) out.push(f); }
    }
    return out.length ? out : autoFields(kind, insp);
  }
  async function inspectFile(file){
    const name = file.name || '';
    const ext = (name.split('.').pop() || '').toLowerCase();
    if (file.size > 50 * 1024 * 1024) throw new Error('The file is larger than 50 MB. Export it again from Canva at a smaller size.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const head = String.fromCharCode.apply(null, bytes.slice(0, 5));
    if (ext === 'pdf' || head === '%PDF-') {
      if (head !== '%PDF-') throw new Error("This file isn't a valid PDF.");
      const E = await pdfEngine(); const info = await E.inspectPdf(bytes);
      if (info.pages.some(p => p.rotation)) throw new Error('This PDF has rotated pages. Export it again from Canva without rotation.');
      let text = []; try { text = (await E.pdfTextItems(await pdfjs(), bytes)).slice(0, 3000); } catch (e) {}
      return {kind: 'pdf', bytes, mime: 'application/pdf', ext: 'pdf', inspection: Object.assign(info, {text})};
    }
    if (ext === 'pptx') {
      if (head.slice(0, 2) !== 'PK') throw new Error("This file isn't a valid PowerPoint (.pptx) file.");
      const E = await pptxEngine(); const info = await E.inspectPptx(bytes);
      if (!info.slides.some(s => s.shapes.length)) throw new Error('No text boxes or pictures were found in this PowerPoint. Export it from Canva as PowerPoint (PPTX) so its text stays editable.');
      return {kind: 'pptx', bytes, mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', ext: 'pptx', inspection: info};
    }
    throw new Error('Upload a PDF or a PowerPoint (.pptx) file exported from Canva.');
  }

  function TemplateEditor({params}){
    const {nav, isAdmin, showToast, openSheet} = useApp();
    const mat = useMat(); const m = mat.model;
    const p = params || {};
    const existing = p.versionId ? m.ver.get(p.versionId) : null;
    const baseFam = existing ? m.fam.get(existing.family_id) : p.familyId ? m.fam.get(p.familyId) : null;
    const mode = existing ? 'edit' : (p.mode || 'new');
    const [step, setStep] = useState(existing ? (p.step === 'test' ? 'test' : 'map') : 'source');
    const [version, setVersion] = useState(existing);
    /* keep the version in step with the server after every save (mapping, test result, approval) */
    useEffect(() => { const id = (version && version.id) || p.versionId; if (id && m.ver.get(id)) setVersion(m.ver.get(id)); }, [mat.rev]);
    if (!isAdmin) return html`<div className="view"><${kit.Back} to="materials" params=${{tab: 'templates'}} label="Manage Templates" /><p className="notice">Only administrators can add or change templates.</p></div>`;
    if (mat.state === 'missing') return html`<${kit.SetupNotice} />`;
    if (p.versionId && !existing && mat.state === 'ready') return html`<div className="view"><${kit.Back} to="materials" params=${{tab: 'templates'}} label="Manage Templates" /><p className="notice">That template version was not found.</p></div>`;
    const fam = version ? m.fam.get(version.family_id) : baseFam;
    const type = fam ? m.typ.get(fam.material_type_id) : p.typeId ? m.typ.get(p.typeId) : null;
    const title = mode === 'update' ? 'Update Template' : mode === 'variation' ? 'Create Variation' : version ? 'Field Mapping' : 'Add Template';
    const steps = [{id: 'source', label: version ? 'Design' : 'Choose design'}, {id: 'map', label: 'Map fields'}, {id: 'test', label: 'Test and approve'}];
    return html`<div className="view mt-editor">
      <${kit.Back} to="materials" params=${{tab: 'templates', family: fam ? fam.id : null}} label="Manage Templates" />
      <header className="page-head"><p className="eyebrow mt-eyebrow">Impact Materials · Manage Templates</p><h1>${title}</h1>
        ${fam ? html`<p className="muted">${m.audPath(type ? type.audience_id : null)} › ${type ? type.name : ''} › <strong>${fam.name}</strong>${version ? ' · Version ' + version.version_no : ''}</p>` : null}</header>
      <ol className="mt-steps small">${steps.map((s, i) => html`<li key=${s.id} className=${s.id === step ? 'cur' : steps.findIndex(x => x.id === step) > i ? 'done' : ''}><span>${steps.findIndex(x => x.id === step) > i ? html`<${Icon} name="check" size=${14} />` : i + 1}</span>${s.label}</li>`)}</ol>
      ${step === 'source' ? html`<${SourceStep} mode=${mode} p=${p} fam=${baseFam} type=${type} onDone=${v => { setVersion(v); setStep('map'); }} />`
        : step === 'map' && version ? html`<${MapStep} version=${version} onNext=${() => setStep('test')} />`
        : step === 'test' && version ? html`<${TestStep} version=${version} mode=${p.mode || (version.version_no > 1 ? 'update' : 'new')} onBack=${() => setStep('map')} />` : html`<div className="skeleton mt-skel"></div>`}
    </div>`;
  }

  function SourceStep({mode, p, fam, type: type0, onDone}){
    const {showToast, nav} = useApp();
    const mat = useMat(); const m = mat.model;
    const prev = fam ? m.currentVersion(fam) || m.versionsOf(fam.id)[0] : null;
    const [kind, setKind] = useState(p.kind === 'canva' ? 'canva' : (prev && mode === 'update' ? (prev.source_type === 'canva' ? 'canva' : 'file') : 'file'));
    const [audId, setAudId] = useState(type0 ? type0.audience_id : '');
    const [typeId, setTypeId] = useState(type0 ? type0.id : '');
    const [name, setName] = useState(mode === 'variation' && fam ? fam.name + ' (variation)' : (type0 && mode === 'new' ? type0.name : ''));
    const [desc, setDesc] = useState('');
    const [notes, setNotes] = useState('');
    const [file, setFile] = useState(null);
    const [busy, setBusy] = useState(''); const [err, setErr] = useState('');
    const [canva, setCanva] = useState(null); const [cv, setCv] = useState(null); const [link, setLink] = useState(''); const [designs, setDesigns] = useState(null);
    useEffect(() => { if (kind === 'canva' && !canva) mat.api.canva('status').then(setCanva, e => setCanva({error: e.message, code: e.code})); }, [kind]);
    const needCat = mode === 'new';
    const audList = m.audiences.filter(a => a.active && m.typesOf(a.id).length);
    const pick = async f => { setErr(''); setFile(null); if (!f) return; setBusy('inspect'); try { const r = await inspectFile(f); setFile(Object.assign(r, {name: f.name})); } catch (e) { setErr(e.message || 'Could not read this file.'); } setBusy(''); };
    const loadDesign = async id => { setErr(''); setCv(null); setBusy('design'); try { const r = await mat.api.canva('design', {design: id}); setCv(r); } catch (e) { setErr(e.message); } setBusy(''); };
    const browse = async () => { setBusy('designs'); try { setDesigns((await mat.api.canva('designs', {query: link && !/canva\.com/.test(link) ? link : ''})).designs); } catch (e) { setErr(e.message); } setBusy(''); };
    const ready = (kind === 'file' ? !!file : !!(cv && cv.fields && cv.fields.length)) && (!needCat || (typeId && asStr(name))) && (mode !== 'variation' || asStr(name));
    async function go(){
      setBusy('save'); setErr('');
      try {
        let familyId = fam && mode !== 'variation' ? fam.id : null;
        const tId = needCat ? typeId : (fam ? fam.material_type_id : typeId);
        if (!familyId) { familyId = uuid(); await mat.api.save('mat_template_families', {id: familyId, material_type_id: tId, name: asStr(name), description: asStr(desc) || null, status: 'active'}); }
        const vno = mode === 'update' ? m.versionsOf(fam.id)[0].version_no + 1 : 1;
        const id = uuid();
        const row = {id, family_id: familyId, version_no: vno, config_status: 'draft', change_notes: asStr(notes) || (mode === 'update' ? 'Updated design' : mode === 'variation' ? 'Variation of ' + fam.name : 'Original design'), options: {}};
        if (kind === 'file') {
          const path = 'versions/' + id + '/source.' + file.ext;
          await mat.api.uploadTemplate(path, file.bytes, file.mime);
          Object.assign(row, {source_type: file.kind, source_path: path, source_name: file.name, inspection: file.inspection, fields: mode === 'update' ? carryFields(prev, file.kind, file.inspection) : autoFields(file.kind, file.inspection), options: file.kind === 'pdf' ? {flatten: true} : {}});
        } else {
          const insp = {kind: 'canva', design: cv.design, fields: cv.fields, pages: cv.design.pages || null};
          Object.assign(row, {source_type: 'canva', canva_design_id: cv.design.id, canva_url: cv.design.editUrl || null, source_name: cv.design.title, inspection: insp, fields: mode === 'update' ? carryFields(prev, 'canva', insp) : autoFields('canva', insp)});
        }
        await mat.api.save('mat_template_versions', row);
        await mat.reload();
        showToast(mode === 'update' ? 'Version ' + vno + ' added. Map its fields next.' : 'Template added. Map its fields next.');
        onDone(row);
      } catch (e) { setErr(e.message || "That didn't work."); }
      setBusy('');
    }
    return html`<div className="mt-source">
      ${mode === 'update' && prev ? html`<section className="card mt-panel mt-current"><h2>Current template</h2>
        <dl className="mt-dl small"><div><dt>Audience</dt><dd>${m.audPath(m.typ.get(fam.material_type_id).audience_id)}</dd></div><div><dt>Material type</dt><dd>${m.typ.get(fam.material_type_id).name}</dd></div><div><dt>Template</dt><dd>${fam.name}</dd></div><div><dt>Format</dt><dd><${SourceBadge} type=${prev.source_type} /></dd></div><div><dt>Version</dt><dd>${prev.version_no} <${ConfigPill} v=${prev} /></dd></div></dl>
        <p className="small muted">The new design becomes version ${m.versionsOf(fam.id)[0].version_no + 1}. Version ${prev.version_no} and every document made with it stay exactly as they are. Fields that still match are carried over.</p></section>` : null}
      <section className="card mt-panel">
        <h2>${mode === 'update' ? 'Replacement design' : 'Design'}</h2>
        <div className="mt-method" role="radiogroup" aria-label="How to add the design">
          <button type="button" role="radio" aria-checked=${kind === 'file'} className=${'mt-method-opt' + (kind === 'file' ? ' on' : '')} id="src-file" onClick=${() => { setKind('file'); setErr(''); }}><${Icon} name="upload" size=${22} /><strong>Upload a file</strong><small>A PDF or PowerPoint (.pptx) exported from Canva. No Canva account needed.</small></button>
          <button type="button" role="radio" aria-checked=${kind === 'canva'} className=${'mt-method-opt' + (kind === 'canva' ? ' on' : '')} id="src-canva" onClick=${() => { setKind('canva'); setErr(''); }}><span className="mt-canva-dot big">C</span><strong>Connect a Canva design</strong><small>Keeps the result editable in Canva. Uses the connected Canva account.</small></button>
        </div>
        ${kind === 'file' ? html`<div className="mt-upload">
          <label className="mt-drop"><input type="file" id="tpl-file" accept=".pdf,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation" onChange=${e => pick(e.target.files && e.target.files[0])} /><${Icon} name="upload" size=${26} /><span><strong>${file ? file.name : 'Choose a PDF or PowerPoint file'}</strong><small className="muted">Up to 50 MB</small></span></label>
          ${busy === 'inspect' ? html`<p className="small muted">Reading the file…</p>` : null}
          ${file ? html`<div className="mt-found small">${file.kind === 'pptx' ? html`<p><${Icon} name="check" size=${16} /> PowerPoint with ${file.inspection.pages} slide${file.inspection.pages === 1 ? '' : 's'}: ${file.inspection.slides.reduce((n, s) => n + s.shapes.filter(x => x.kind === 'text').length, 0)} text boxes and ${file.inspection.slides.reduce((n, s) => n + s.shapes.filter(x => x.kind === 'picture').length, 0)} pictures you can map.</p>`
            : html`<p><${Icon} name="check" size=${16} /> PDF with ${file.inspection.pages.length} page${file.inspection.pages.length === 1 ? '' : 's'}. ${file.inspection.fillable ? file.inspection.fields.filter(f => f.type === 'text').length + ' fillable text fields found.' : 'No fillable fields: you will draw the areas content goes into.'}</p>
              ${!file.inspection.fillable ? html`<p className="muted">Most Canva PDFs are flat. Text already printed in the PDF can't be replaced: leave the areas for new content blank in Canva before exporting (or export as PowerPoint to keep text editable).</p>` : null}`}</div>` : null}
        </div>` : html`<div className="mt-canva-src">
          ${!canva ? html`<p className="small muted">Checking the Canva connection…</p>`
            : canva.error || !canva.configured || !canva.connected ? html`<div className="notice small"><p>${canva.error ? canva.error : !canva.configured ? 'Canva is not set up on the server yet.' : 'Canva is not connected yet.'}</p><button className="btn btn-ghost btn-sm" onClick=${() => nav('canva')}>Open Canva integration settings</button></div>`
            : html`<${Field} label="Canva design link" hint="In Canva: Share › Copy link, or copy the address of the design's edit page."><div className="row"><input id="canva-link" className="input" value=${link} onChange=${e => setLink(e.target.value)} placeholder="https://www.canva.com/design/…" /><button className="btn btn-primary btn-sm" id="canva-load" disabled=${!asStr(link) || !!busy} onClick=${() => loadDesign(link)}>Load design</button></div><//>
              <button className="btn btn-quiet btn-sm" onClick=${browse} disabled=${!!busy}><${Icon} name="search" size=${16} /> Browse designs in the connected account</button>
              ${designs ? html`<div className="mt-designs">${designs.length ? designs.map(d => html`<button type="button" key=${d.id} className="mt-design" onClick=${() => loadDesign(d.id)}>${d.thumbnail ? html`<img src=${d.thumbnail} alt="" />` : html`<span className="mt-thumb mt-thumb-empty"></span>`}<span>${d.title}</span></button>`) : html`<p className="small muted">No designs found.</p>`}</div>` : null}
              ${busy === 'design' ? html`<p className="small muted">Loading the design and its data fields…</p>` : null}
              ${cv ? html`<div className="mt-found small"><p><strong>${cv.design.title}</strong>${cv.design.pages ? ' · ' + cv.design.pages + ' pages' : ''}</p>
                ${cv.fields.length ? html`<p><${Icon} name="check" size=${16} /> ${cv.fields.length} data field${cv.fields.length === 1 ? '' : 's'}: ${cv.fields.map(f => f.name + ' (' + f.type + ')').join(', ')}</p>` : html`<p className="error">${cv.note}</p>`}
                <p className="muted">Only these data fields change. Canva makes a new copy for every document, so this design stays as it is.</p></div>` : null}`}
        </div>`}
      </section>
      ${needCat || mode === 'variation' ? html`<section className="card mt-panel"><h2>Where it belongs</h2>
        ${needCat ? html`<div className="row">
          <${Field} label="Audience"><select id="tpl-aud" className="select" value=${audId} onChange=${e => { setAudId(e.target.value); setTypeId(''); }}><option value="">Choose…</option>${audList.map(a => html`<option key=${a.id} value=${a.id}>${m.audPath(a.id)}</option>`)}</select><//>
          <${Field} label="Material type"><select id="tpl-type" className="select" value=${typeId} disabled=${!audId} onChange=${e => { setTypeId(e.target.value); const t = m.typ.get(e.target.value); if (t && !asStr(name)) setName(t.name); }}><option value="">Choose…</option>${(audId ? m.typesOf(audId) : []).map(t => html`<option key=${t.id} value=${t.id}>${t.name}</option>`)}</select><//>
        </div>` : html`<p className="small muted">A variation is another design for <strong>${m.typ.get(fam.material_type_id).name}</strong>. The current default stays the default.</p>`}
        <${Field} label="Template name"><input id="tpl-name" className="input" value=${name} onChange=${e => setName(e.target.value)} placeholder="e.g. Donor Impact Summary – teal" /><//>
        <${Field} label="Description (optional)"><input className="input" value=${desc} onChange=${e => setDesc(e.target.value)} placeholder="e.g. A two-page impact update for individual donors" /><//>
      </section>` : null}
      <section className="card mt-panel"><${Field} label="Change notes (optional)"><input id="tpl-notes" className="input" value=${notes} onChange=${e => setNotes(e.target.value)} placeholder=${mode === 'update' ? 'e.g. Refreshed messaging and new photos' : 'e.g. Original design'} /><//></section>
      ${err ? html`<p className="error" role="alert">${err}</p>` : null}
      <div className="row-btns end"><button className="btn btn-primary" id="tpl-continue" disabled=${!ready || !!busy} onClick=${go}>${busy === 'save' ? 'Saving…' : 'Continue to field mapping'} <${Icon} name="chev" size=${16} /></button></div>
    </div>`;
  }

  /* ---------- field mapping ---------- */
  function MapStep({version, onNext}){
    const {showToast} = useApp();
    const mat = useMat();
    const locked = version.config_status === 'approved';
    const [fields, setFields] = useState(() => JSON.parse(JSON.stringify(version.fields || [])));
    const [options, setOptions] = useState(() => Object.assign({}, version.options || {}));
    const [sel, setSel] = useState(fields[0] ? fields[0].id : '');
    const [page, setPage] = useState(1);
    const [bytes, setBytes] = useState(null);
    const [model, setModel] = useState(null);
    const [doc, setDoc] = useState(null);
    const [draw, setDraw] = useState(false);
    const [showText, setShowText] = useState(true);
    const [saving, setSaving] = useState(false); const [dirty, setDirty] = useState(false);
    const insp = version.inspection || {};
    const kind = version.source_type;
    useEffect(() => { if (kind === 'canva') return; let alive = true; let d = null; templateBytes(mat.api, version.source_path).then(async b => { if (!alive) return; setBytes(b); if (kind === 'pptx') { const E = await pptxEngine(); const mm = await E.previewPptx(b); if (alive) setModel(mm); } else { d = await pdfDoc(b); if (alive) setDoc(d); } }, e => showToast(e.message)); return () => { alive = false; if (d) d.destroy(); }; }, [version.id]);
    const upd = (id, patch) => { setFields(fs => fs.map(f => f.id === id ? Object.assign({}, f, patch) : f)); setDirty(true); };
    const fmt = (id, patch) => { setFields(fs => fs.map(f => f.id === id ? Object.assign({}, f, {format: Object.assign({}, f.format || {}, patch)}) : f)); setDirty(true); };
    const remove = id => { setFields(fs => fs.filter(f => f.id !== id)); setDirty(true); };
    const addField = (label, target, extra) => { const g = guessSource(label, extra && extra.type); const nf = Object.assign({id: uniqueId(label, fields), label: human(label), type: g.type, source: g.source, n: 1, required: true, fallback: 'keep', target}, extra || {}); if (extra && extra.type) nf.type = extra.type; setFields(fs => fs.concat([nf])); setSel(nf.id); setDirty(true); return nf; };
    const rename = (oldId, newId) => { setFields(fs => fs.map(f => f.id === oldId ? Object.assign({}, f, {id: newId}) : f)); if (sel === oldId) setSel(newId); setDirty(true); };
    const errors = checkMapping(fields, kind);
    const [overlaps, setOverlaps] = useState([]);
    useEffect(() => { if (kind !== 'pdf') return; pdfEngine().then(E => setOverlaps(E.checkRegions(fields, insp, insp.text || []))); }, [fields]);
    async function save(next){
      setSaving(true);
      try { await mat.api.update('mat_template_versions', version.id, {fields, options, config_status: 'draft', tested_at: null}); await mat.reload(); setDirty(false); if (!next) showToast('Field mapping saved.'); if (next) onNext(); }
      catch (e) { showToast(e.message); }
      setSaving(false);
    }
    const mappedLabel = {};
    fields.forEach(f => { const t = f.target || {}; if (t.kind === 'pptx_shape') mappedLabel[t.slide + ':' + t.shapeId] = f.label || f.id; });
    const selF = fields.find(f => f.id === sel);
    /* left: the design with clickable elements */
    let canvasPane = null;
    if (kind === 'pptx') {
      const slides = insp.slides || [];
      const s = slides[page - 1] || {shapes: []};
      canvasPane = html`<div>${slides.length > 1 ? html`<div className="mt-pager">${slides.map(x => html`<button type="button" key=${x.index} className=${'chip' + (x.index === page ? ' on' : '')} onClick=${() => setPage(x.index)}>Slide ${x.index}</button>`)}</div>` : null}
        ${model ? html`<${SlideView} model=${model} index=${page - 1} picks=${s.shapes} mapped=${mappedLabel} selected=${selF && selF.target ? selF.target.slide + ':' + selF.target.shapeId : ''} onPick=${sh => { if (locked) return; const f = fields.find(x => x.target && x.target.slide === sh.slide && x.target.shapeId === sh.id); if (f) setSel(f.id); else addField(sh.suggest || sh.name || (sh.kind === 'picture' ? 'image' : 'text'), {kind: 'pptx_shape', slide: sh.slide, shapeId: sh.id, name: sh.name}, sh.kind === 'picture' ? {type: 'image'} : (sh.h > 914400 ? {type: 'paragraph'} : {})); }} />` : html`<div className="skeleton mt-skel"></div>`}
        <p className="small muted">Click a text box or picture to map it. Everything you don't map stays exactly as designed.</p></div>`;
    } else if (kind === 'pdf') {
      const regions = fields.filter(f => f.target && f.target.kind === 'pdf_region' && f.target.page === page).map(f => Object.assign({}, f.target, {label: f.label || f.id, cls: (sel === f.id ? 'sel ' : '') + (overlaps.some(o => o.id === f.id) ? 'bad' : 'ok'), onClick: () => setSel(f.id)}));
      const formBoxes = (insp.fields || []).filter(x => x.page === page && x.type === 'text').map(x => { const f = fields.find(y => y.target && y.target.kind === 'pdf_field' && y.target.name === x.name); return Object.assign({}, x.rect, {label: f ? (f.label || f.id) : x.name, cls: 'form' + (f ? ' ok' : '') + (f && sel === f.id ? ' sel' : ''), title: 'Form field ' + x.name, onClick: locked ? null : () => { if (f) setSel(f.id); else addField(x.name, {kind: 'pdf_field', name: x.name, page: x.page}, {type: x.multiline ? 'paragraph' : 'text'}); }}); });
      const textBoxes = showText ? (insp.text || []).filter(t => t.page === page).map(t => Object.assign({}, t, {cls: 'printed', title: 'Printed in the PDF: ' + t.text})) : [];
      canvasPane = html`<div>
        <div className="mt-pager">${(insp.pages || []).map(x => html`<button type="button" key=${x.index} className=${'chip' + (x.index === page ? ' on' : '')} onClick=${() => setPage(x.index)}>Page ${x.index}</button>`)}</div>
        <div className="row-btns">${!locked ? html`<button type="button" id="pdf-draw" className=${'btn btn-sm ' + (draw ? 'btn-primary' : 'btn-ghost')} onClick=${() => setDraw(!draw)}><${Icon} name="plus" size=${16} /> ${draw ? 'Drag on the page to draw an area' : 'Draw content area'}</button>` : null}
          <label className="check small"><input type="checkbox" checked=${showText} onChange=${e => setShowText(e.target.checked)} /> Show text already printed in the PDF</label></div>
        ${doc ? html`<${PdfPage} doc=${doc} page=${page} drawing=${draw && !locked} overlay=${textBoxes.concat(formBoxes, regions)} onDraw=${r => { setDraw(false); addField('area ' + (fields.length + 1), Object.assign({kind: 'pdf_region', page}, r), {format: {font: 'Helvetica', size: 14, minSize: 10, color: '#1F2A44', align: 'left', valign: 'top', lineHeight: 1.2}}); }} />` : html`<div className="skeleton mt-skel"></div>`}
        <p className="small muted">${insp.fillable ? 'Click a form field to map it, or draw an area. ' : ''}Areas must be blank in the design: an area over printed text (red) is refused, so new text never prints on top of old text.</p></div>`;
    } else {
      canvasPane = html`<div className="mt-canva-fields">
        <p className="small"><span className="mt-canva-dot">C</span> <strong>${(insp.design || {}).title}</strong></p>
        ${(insp.design || {}).editUrl ? html`<a className="btn btn-ghost btn-sm" href=${insp.design.editUrl} target="_blank" rel="noopener">Open the master design in Canva</a>` : null}
        <ul className="mt-canva-list">${(insp.fields || []).map(cf => { const f = fields.find(x => x.target && x.target.name === cf.name); return html`<li key=${cf.name}><span><strong>${cf.name}</strong> <small className="muted">${cf.type} field</small></span>${f ? html`<button type="button" className="btn btn-quiet btn-sm" onClick=${() => setSel(f.id)}>Mapped as ${f.label || f.id}</button>` : cf.type === 'chart' ? html`<small className="muted">Charts stay as designed</small>` : !locked ? html`<button type="button" className="btn btn-ghost btn-sm" onClick=${() => addField(cf.name, {kind: 'canva_field', name: cf.name, canvaType: cf.type}, cf.type === 'image' ? {type: 'image'} : {})}>Map</button>` : null}</li>`; })}</ul>
        <p className="small muted">Only Canva data fields can be filled. To make more of the design change, connect more elements to data fields in Canva, then use Update Template.</p></div>`;
    }
    return html`<div className="mt-map">
      ${locked ? html`<p className="notice small">Version ${version.version_no} is approved, so its mapping can't change. Use Edit Field Mapping in Manage Templates to start a new version.</p>` : null}
      <div className="mt-map-grid">
        <section className="card mt-panel mt-canvas">${canvasPane}</section>
        <section className="card mt-panel mt-fields" aria-label="Fields">
          <div className="row-between"><h2>Fields <span className="count">${fields.length}</span></h2>${kind === 'pdf' && !locked ? html`<${FontManager} version=${version} options=${options} setOptions=${o => { setOptions(o); setDirty(true); }} />` : null}</div>
          ${fields.length ? null : html`<p className="small muted">${kind === 'pptx' ? 'Click an element on the slide to add a field.' : kind === 'pdf' ? 'Draw an area or click a form field to add one.' : 'Map the design\'s data fields.'}</p>`}
          ${fields.map(f => html`<${FieldCard} key=${f.id} f=${f} kind=${kind} open=${sel === f.id} locked=${locked} fonts=${options.fonts || []} onOpen=${() => setSel(sel === f.id ? '' : f.id)} upd=${upd} fmt=${fmt} remove=${remove} rename=${rename} taken=${fields.filter(x => x.id !== f.id).map(x => x.id)} overlap=${overlaps.find(o => o.id === f.id)} />`)}
          ${kind === 'pdf' && insp.fillable && !locked ? html`<label className="check small"><input type="checkbox" checked=${options.flatten !== false} onChange=${e => { setOptions(Object.assign({}, options, {flatten: e.target.checked})); setDirty(true); }} /> Flatten form fields in finished PDFs (recommended: the text can't be changed later)</label>` : null}
          ${errors.length || overlaps.length ? html`<ul className="mt-problems small">${errors.concat(overlaps.map(o => (fields.find(f => f.id === o.id) || {}).label + ': ' + o.error)).map((e, i) => html`<li key=${i} className="bad">${e}</li>`)}</ul>` : null}
          ${!locked ? html`<div className="row-btns end"><button className="btn btn-ghost" id="map-save" disabled=${saving || !dirty} onClick=${() => save(false)}>Save mapping</button><button className="btn btn-primary" id="map-next" disabled=${saving || errors.length > 0 || overlaps.length > 0} onClick=${() => (dirty ? save(true) : onNext())}>Save and test <${Icon} name="chev" size=${16} /></button></div>` : html`<div className="row-btns end"><button className="btn btn-primary" onClick=${onNext}>Test template</button></div>`}
        </section>
      </div>
    </div>`;
  }
  function FontManager({version, options, setOptions}){
    const mat = useMat(); const {showToast} = useApp();
    const add = async file => { if (!file) return; if (!/\.(ttf|otf)$/i.test(file.name)) { showToast('Upload a .ttf or .otf font file.'); return; } const id = 'custom-' + uuid().slice(0, 8); const path = 'versions/' + version.id + '/fonts/' + id + '.' + file.name.split('.').pop().toLowerCase(); try { await mat.api.uploadTemplate(path, new Uint8Array(await file.arrayBuffer()), /otf$/i.test(file.name) ? 'font/otf' : 'font/ttf'); setOptions(Object.assign({}, options, {fonts: (options.fonts || []).concat([{id, name: file.name.replace(/\.(ttf|otf)$/i, ''), path}])})); showToast('Font added. Choose it in a field\'s format.'); } catch (e) { showToast(e.message); } };
    return html`<label className="btn btn-quiet btn-sm mt-fontbtn" title="Use your brand font in PDF areas"><input type="file" accept=".ttf,.otf" onChange=${e => add(e.target.files && e.target.files[0])} />+ Brand font</label>`;
  }
  function FieldCard({f, kind, open, locked, fonts, onOpen, upd, fmt, remove, rename, taken, overlap}){
    const src = sourceById(f.source);
    const t = f.target || {};
    const where = t.kind === 'pptx_shape' ? 'Slide ' + t.slide + ' · ' + (t.name || 'element ' + t.shapeId) : t.kind === 'pdf_region' ? 'Page ' + t.page + ' · area ' + Math.round(t.w) + ' × ' + Math.round(t.h) + ' pt' : t.kind === 'pdf_field' ? 'Form field ' + t.name : t.kind === 'canva_field' ? 'Canva field ' + t.name + ' (' + t.canvaType + ')' : 'Not placed';
    const [idDraft, setIdDraft] = useState(f.id);
    useEffect(() => setIdDraft(f.id), [f.id]);
    const groups = [...new Set(SOURCES.map(s => s.group))];
    const fm = f.format || {};
    const allFonts = [{id: 'Helvetica', label: 'Sans serif'}, {id: 'Helvetica-Bold', label: 'Sans serif bold'}, {id: 'Helvetica-Oblique', label: 'Sans serif italic'}, {id: 'Times-Roman', label: 'Serif'}, {id: 'Times-Bold', label: 'Serif bold'}, {id: 'Times-Italic', label: 'Serif italic'}].concat((fonts || []).map(x => ({id: x.id, label: x.name + ' (brand font)'})));
    return html`<div className=${'mt-fcard' + (open ? ' open' : '') + (overlap ? ' bad' : '')} data-field=${f.id}>
      <button type="button" className="mt-fhead" onClick=${onOpen} aria-expanded=${open}><${Icon} name=${fieldIcon(f)} size=${18} /><span><strong>${f.label || f.id}</strong><small className="muted">${src ? sourceLabel(f) : 'Choose a content source'} · ${where}</small></span><${Icon} name="chev" size=${16} /></button>
      ${open ? html`<fieldset className="mt-fbody" disabled=${locked}>
        <div className="row"><${Field} label="Label"><input className="input fld-label" value=${f.label || ''} onChange=${e => upd(f.id, {label: e.target.value})} /><//>
          <${Field} label="Field ID" hint="Used to match fields across versions."><input className="input fld-id" value=${idDraft} onChange=${e => setIdDraft(e.target.value)} onBlur=${() => { const v = idDraft.trim(); if (v && v !== f.id && !taken.includes(v)) rename(f.id, v); else setIdDraft(f.id); }} /><//></div>
        <div className="row"><${Field} label="Field type"><select className="select fld-type" value=${f.type} onChange=${e => upd(f.id, {type: e.target.value, source: e.target.value === 'image' ? 'image' : f.source === 'image' ? 'manual' : f.source})}>${FIELD_TYPES.filter(x => kind === 'canva' ? (t.canvaType === 'image') === (x.id === 'image') : t.kind === 'pdf_field' ? x.id !== 'image' : true).map(x => html`<option key=${x.id} value=${x.id}>${x.label}</option>`)}</select><//>
          <${Field} label="Content comes from"><select className="select fld-source" value=${f.source || ''} onChange=${e => upd(f.id, {source: e.target.value})}><option value="">Choose…</option>${groups.map(g => html`<optgroup key=${g} label=${g}>${SOURCES.filter(s => s.group === g && ((f.type === 'image') === (s.id === 'image'))).map(s => html`<option key=${s.id} value=${s.id}>${s.label}</option>`)}</optgroup>`)}</select><//></div>
        ${src && src.n ? html`<${Field} label="Which one" hint="1 = the first one staff select, 2 = the second…"><select className="select fld-n" value=${f.n || 1} onChange=${e => upd(f.id, {n: +e.target.value})}>${[1, 2, 3, 4, 5, 6].map(n => html`<option key=${n} value=${n}>#${n}</option>`)}</select><//>` : null}
        ${src && src.instructions ? html`<${Field} label="Instructions for the AI"><textarea className="textarea" rows="2" value=${f.instructions || ''} onChange=${e => upd(f.id, {instructions: e.target.value})} placeholder="e.g. One sentence on what donor support made possible this year."></textarea><//>` : null}
        ${f.source === 'static' ? html`<${Field} label="Fixed text"><textarea className="textarea fld-static" rows="2" value=${f.text || ''} onChange=${e => upd(f.id, {text: e.target.value})}></textarea><//>` : null}
        ${f.type !== 'image' ? html`<div className="row"><${Field} label="Max characters"><input className="input fld-max" inputMode="numeric" value=${f.maxChars || ''} onChange=${e => upd(f.id, {maxChars: parseInt(e.target.value, 10) || undefined})} /><//>
          ${t.kind === 'pdf_region' ? html`<${Field} label="Max lines"><input className="input" inputMode="numeric" value=${f.maxLines || ''} onChange=${e => upd(f.id, {maxLines: parseInt(e.target.value, 10) || undefined})} /><//>` : null}</div>` : null}
        <div className="row"><label className="check small"><input type="checkbox" checked=${!!f.required} onChange=${e => upd(f.id, {required: e.target.checked})} /> Required</label>
          <${Field} label="If there's no content"><select className="select" value=${f.fallback || 'keep'} onChange=${e => upd(f.id, {fallback: e.target.value})}><option value="keep">Keep the template's own ${f.type === 'image' ? 'image' : 'text'}</option><option value="blank">Leave it ${f.type === 'image' ? 'as designed' : 'blank'}</option></select><//></div>
        ${t.kind === 'pdf_region' ? html`<details className="mt-fmt" open><summary className="small">Text format and position</summary>
          ${f.type !== 'image' ? html`<div className="row"><${Field} label="Font"><select className="select" value=${fm.font || 'Helvetica'} onChange=${e => fmt(f.id, {font: e.target.value})}>${allFonts.map(x => html`<option key=${x.id} value=${x.id}>${x.label}</option>`)}</select><//>
            <${Field} label="Size (pt)"><input className="input" inputMode="decimal" value=${fm.size || ''} onChange=${e => fmt(f.id, {size: parseFloat(e.target.value) || undefined})} /><//>
            <${Field} label="Smallest size"><input className="input" inputMode="decimal" value=${fm.minSize || ''} onChange=${e => fmt(f.id, {minSize: parseFloat(e.target.value) || undefined})} /><//></div>
          <div className="row"><${Field} label="Color"><input className="input" type="color" value=${fm.color || '#1F2A44'} onChange=${e => fmt(f.id, {color: e.target.value})} /><//>
            <${Field} label="Align"><select className="select" value=${fm.align || 'left'} onChange=${e => fmt(f.id, {align: e.target.value})}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select><//>
            <${Field} label="Vertical"><select className="select" value=${fm.valign || 'top'} onChange=${e => fmt(f.id, {valign: e.target.value})}><option value="top">Top</option><option value="middle">Middle</option><option value="bottom">Bottom</option></select><//></div>` : null}
          <div className="row mt-xywh">${['x', 'y', 'w', 'h'].map(k => html`<${Field} key=${k} label=${{x: 'Left', y: 'Top', w: 'Width', h: 'Height'}[k] + ' (pt)'}><input className="input" inputMode="decimal" value=${Math.round(t[k])} onChange=${e => upd(f.id, {target: Object.assign({}, t, {[k]: parseFloat(e.target.value) || 0})})} /><//>`)}</div>
        </details>` : null}
        ${t.kind === 'pptx_shape' && f.type !== 'image' ? html`<${Field} label="Smallest font size (pt)" hint="Longer text may shrink down to this size to fit its box. Leave blank to keep the design's size."><input className="input" inputMode="decimal" value=${fm.minSize || ''} onChange=${e => fmt(f.id, {minSize: parseFloat(e.target.value) || undefined})} /><//>` : null}
        ${f.type !== 'image' ? html`<${Field} label="Sample text for Test Template (optional)"><input className="input" value=${f.example || ''} onChange=${e => upd(f.id, {example: e.target.value})} placeholder="Leave blank for automatic sample text" /><//>` : null}
        ${overlap ? html`<p className="error small">${overlap.error}</p>` : null}
        <div className="row-btns end"><button type="button" className="btn btn-quiet btn-sm danger" onClick=${() => remove(f.id)}>Remove field</button></div>
      </fieldset>` : null}
    </div>`;
  }

  /* ---------- test and approve ---------- */
  function TestStep({version, mode, onBack}){
    const {nav, showToast} = useApp();
    const mat = useMat(); const m = mat.model;
    const fam = m.fam.get(version.family_id); const type = fam ? m.typ.get(fam.material_type_id) : null;
    const [busy, setBusy] = useState(''); const [err, setErr] = useState('');
    const [result, setResult] = useState(null);
    const [choice, setChoice] = useState(mode === 'update' ? 'replace' : 'default');
    const errors = checkMapping(version.fields || [], version.source_type);
    async function run(){
      setBusy('test'); setErr(''); setResult(null);
      const content = sampleContent(version.fields || []);
      try {
        if (version.source_type === 'canva') {
          const r = await renderCanva(mat.api, version, content, {test: true, title: 'TEST – ' + (fam ? fam.name : 'template'), onStep: s => setBusy(s)});
          const pdf = await materialBytes(mat.api, r.pdfPath);
          setResult({kind: 'pdf', bytes: pdf, report: (version.fields || []).map(f => ({id: f.id, ok: f.type === 'image' || r.sentFields.includes((f.target || {}).name), note: f.type === 'image' ? 'Images are tested with real content' : ''})), design: r.design});
        } else {
          const r = await renderFile(mat.api, version, content, {sample: true});
          setResult({kind: r.ext, bytes: r.bytes, report: r.report, values: r.values});
        }
      } catch (e) { setErr(e.message || 'The test could not run.'); }
      setBusy('');
    }
    const passed = result && result.report.every(x => x.ok) && !errors.length;
    async function markTested(){
      setBusy('save');
      try {
        let preview = null;
        try { preview = result.kind === 'pdf' ? await pdfThumb(result.bytes, 640) : await pptxThumb(await (await pptxEngine()).previewPptx(result.bytes), 640); } catch (e) {}
        const patch = {tested_at: new Date().toISOString()};
        if (version.config_status === 'draft') patch.config_status = 'tested';
        if (preview) { const path = 'versions/' + version.id + '/preview-' + Date.now() + '.png'; await mat.api.uploadTemplate(path, new Uint8Array(await preview.arrayBuffer()), 'image/png'); patch.preview_path = path; }
        if (version.config_status !== 'approved') await mat.api.update('mat_template_versions', version.id, patch);
        else if (patch.preview_path) await mat.api.update('mat_template_versions', version.id, {preview_path: patch.preview_path});
        await mat.reload(); showToast('Test passed. The template is ready for approval.');
      } catch (e) { setErr(e.message); }
      setBusy('');
    }
    async function approve(){
      setBusy('approve'); setErr('');
      try {
        let famId = version.family_id;
        if (choice === 'variation') {
          famId = uuid();
          await mat.api.save('mat_template_families', {id: famId, material_type_id: fam.material_type_id, name: fam.name + ' – version ' + version.version_no + ' design', description: fam.description || null, status: 'active'});
          await mat.api.update('mat_template_versions', version.id, {family_id: famId, version_no: 1});
        }
        await mat.api.update('mat_template_versions', version.id, {config_status: 'approved'});
        if (choice !== 'keep') await mat.api.update('mat_template_families', famId, {current_version_id: version.id});
        const makeDefault = choice === 'replace' ? m.isDefault(fam) || !type.default_family_id : choice === 'default';
        if (makeDefault) await mat.api.update('mat_types', type.id, {default_family_id: famId});
        await mat.reload();
        showToast(choice === 'variation' ? 'Approved as a variation. The default template is unchanged.' : makeDefault ? 'Approved. It is now the default for future ' + type.name + ' documents.' : 'Approved.');
        nav('materials', {tab: 'templates', family: famId});
      } catch (e) { setErr(e.message || 'Approval failed.'); }
      setBusy('');
    }
    const tested = version.config_status === 'tested' && version.tested_at;
    const approved = version.config_status === 'approved';
    return html`<div className="mt-test">
      <section className="card mt-panel">
        <div className="row-between"><div><h2>Test Template</h2><p className="small muted">Fills the template with clearly fake sample content and shows the result. ${version.source_type === 'canva' ? 'For Canva this makes a test copy in the connected Canva account (named TEST) and exports it.' : 'Nothing is saved as a document.'}</p></div>
          <button className="btn btn-primary" id="tpl-run-test" disabled=${!!busy || errors.length > 0} onClick=${run}><${Icon} name="play" size=${16} /> ${result ? 'Run again' : 'Run test'}</button></div>
        ${errors.length ? html`<ul className="mt-problems small">${errors.map((e, i) => html`<li key=${i} className="bad">${e}</li>`)}</ul><button className="btn btn-ghost btn-sm" onClick=${onBack}>Back to field mapping</button>` : null}
        ${busy && busy !== 'save' && busy !== 'approve' ? html`<${Busy} text=${busy === 'test' ? 'Filling the template…' : busy} />` : null}
        ${err ? html`<p className="error" role="alert">${err}</p>` : null}
        ${result ? html`<div className="mt-test-out">
          <ul className="mt-report small">${result.report.map(r => { const f = (version.fields || []).find(x => x.id === r.id) || {}; return html`<li key=${r.id} data-field=${r.id} className=${r.ok ? 'ok' : 'bad'}><${Icon} name=${r.ok ? 'check' : 'close'} size=${16} /><span><strong>${f.label || r.id}</strong> ${r.ok ? (r.shrunk ? 'fits at ' + r.size + ' pt' : r.kept ? 'kept as designed' : r.note || 'fits') : r.error}${r.dropped ? ' · characters the font can\'t print: ' + r.dropped : ''}</span></li>`; })}</ul>
          ${!passed ? html`<p className="notice small">Fix the fields above (shorten limits, enlarge areas, or allow a smaller font size), then test again. A template that can't be filled cleanly isn't used for documents.</p>` : null}
          ${result.design ? html`<p className="small"><a href=${result.design.editUrl} target="_blank" rel="noopener">Open the test copy in Canva</a></p>` : null}
          <${DocPreview} kind=${result.kind} bytes=${result.bytes} values=${result.values} fields=${version.fields} />
          ${passed && !approved && !tested ? html`<div className="row-btns end"><button className="btn btn-primary" id="tpl-mark-tested" disabled=${!!busy} onClick=${markTested}>${busy === 'save' ? 'Saving…' : 'Looks right: save test result'}</button></div>` : null}
          ${passed && approved ? html`<div className="row-btns end"><button className="btn btn-ghost" disabled=${!!busy} onClick=${markTested}>Update preview image</button></div>` : null}
        </div>` : null}
      </section>
      ${tested && !approved ? html`<section className="card mt-panel" id="tpl-approve-panel"><h2>Approve and activate</h2>
        <p className="small muted">Tested ${fmtDate(version.tested_at)}. Once approved, this version can't be changed: staff can use it, and every document records it.</p>
        <div className="mt-choice" role="radiogroup">
          ${mode === 'update' ? html`
            <label className=${'mt-choice-opt' + (choice === 'replace' ? ' on' : '')}><input type="radio" name="act" checked=${choice === 'replace'} onChange=${() => setChoice('replace')} /><span><strong>Replace Default Template</strong><small>Version ${version.version_no} becomes the template for future ${type ? type.name : ''} documents. Earlier documents keep version they were made with.</small></span></label>
            <label className=${'mt-choice-opt' + (choice === 'variation' ? ' on' : '')}><input type="radio" name="act" checked=${choice === 'variation'} onChange=${() => setChoice('variation')} /><span><strong>Create Template Variation</strong><small>Keep the current default, and add this design as another option staff can choose.</small></span></label>`
          : html`
            <label className=${'mt-choice-opt' + (choice === 'default' ? ' on' : '')}><input type="radio" name="act" checked=${choice === 'default'} onChange=${() => setChoice('default')} /><span><strong>Make it the default for ${type ? type.name : 'this material type'}</strong><small>Selected automatically when staff create this kind of material.</small></span></label>
            <label className=${'mt-choice-opt' + (choice === 'option' ? ' on' : '')}><input type="radio" name="act" checked=${choice === 'option'} onChange=${() => setChoice('option')} /><span><strong>Add as another option</strong><small>Staff can choose it; ${type && type.default_family_id ? 'the current default stays' : 'you can set a default later'}.</small></span></label>`}
        </div>
        <div className="row-btns end"><button className="btn btn-primary" id="tpl-approve" disabled=${!!busy} onClick=${approve}>${busy === 'approve' ? 'Approving…' : 'Approve template'}</button></div>
      </section>` : null}
      ${approved ? html`<p className="notice small">Version ${version.version_no} is approved${m.isDefault(fam) && fam.current_version_id === version.id ? ' and is the default' : ''}.</p>` : null}
      <div className="row-btns"><button className="btn btn-ghost" onClick=${onBack}><${Icon} name="back" size=${16} /> Field mapping</button></div>
    </div>`;
  }

  return {ManageTemplates, TemplateEditor, TemplateTree, DocPreview, PdfPreview, PptxPreview, Thumb, SourceBadge, ConfigPill, fieldIcon};
}

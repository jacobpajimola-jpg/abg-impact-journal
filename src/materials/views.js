/* Impact Materials workspace: Materials Library, the AI Material Builder, a material's detail page (preview, edit,
 * download, duplicate, regenerate, approve, Update Template), Generated Documents, the Content Bank and Canva settings.
 * createMaterialsUI(ui) is called by the journal with its own components and helpers. */
import { CHANNELS, VERIFICATION, MESSAGING_CATEGORIES, sourceById, sourceLabel, storyUse, mediaUse, statInfo, storySnapshot, statSnapshot, bankSnapshot, mediaSnapshot, statText, materialPrompt, resolveContent, checkContent, aiFields, longDate } from './content.js';
import { buildModel, SOURCE_TYPES, MAT_STATUS, slugify, carryContent } from './model.js';
import { createTemplateUI } from './templates.js';
import { renderFile, renderCanva, pdfThumb, pptxThumb, pptxEngine, materialBytes, download } from './engine.js';

export function createMaterialsUI(ui){
  const {html, useState, useEffect, useMemo, useRef, useCallback, useApp, Icon, Pill, Field, SheetHead, ConfirmSheet, PageTabs, fmtDate, asStr, trunc, h} = ui;
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); }));
  const useMat = () => useApp().mat;
  const who = email => { const e = String(email || ''); if (!e || e === 'system') return 'ABG'; const n = e.split('@')[0].split(/[._-]/)[0]; return n ? n.charAt(0).toUpperCase() + n.slice(1) : e; };
  const when = iso => { if (!iso) return ''; const d = new Date(iso); const days = Math.floor((Date.now() - d) / 864e5); const t = d.toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'}); return days < 1 && new Date().getDate() === d.getDate() ? 'Today, ' + t : days < 2 ? 'Yesterday, ' + t : fmtDate(iso); };
  function Busy({text}){ return html`<div className="mt-busy" role="status"><span className="mt-spin" aria-hidden="true"></span><span>${text}</span></div>`; }
  function Back({to, params, label}){ const {nav} = useApp(); return html`<button className="btn btn-quiet btn-sm mt-back" onClick=${() => nav(to, params || {})}><${Icon} name="back" size=${16} /> ${label}</button>`; }
  function SetupNotice(){ const {isAdmin} = useApp(); return html`<div className="notice"><p><strong>Impact Materials is not set up on the server yet.</strong></p><p className="small">${isAdmin ? 'Run supabase/materials.sql in the Supabase SQL Editor (see the README, "Impact Materials"), then reload.' : 'Ask an administrator to finish the setup.'}</p></div>`; }
  function MatStatus({status}){ const s = MAT_STATUS.find(x => x.id === status) || MAT_STATUS[0]; return html`<${Pill} tone=${s.tone} dot=${true}>${s.label}<//>`; }
  const kit = {html, useState, useEffect, useMemo, useRef, useCallback, useApp, Icon, Pill, Field, SheetHead, ConfirmSheet, PageTabs, fmtDate, asStr, uuid, useMat, Busy, Back, SetupNotice, who};
  const T = createTemplateUI(kit);
  const {ManageTemplates, TemplateEditor, TemplateTree, DocPreview, Thumb, SourceBadge, fieldIcon} = T;

  /* ---------- shared data: journal counts and statistics staff can use ---------- */
  function useStatOptions(){
    const {stories, metrics, mat} = useApp();
    const counts = h.journalCounts(stories);
    const asOf = 'as of ' + longDate();
    const out = [
      {key: 'journal:stories', title: 'Stories captured', body: 'stories documented in the ABG Impact Journal', stat_value: String(counts.stories), stat_source: 'ABG Impact Journal (count of documented stories, not a program-wide total)', stat_period: asOf, verification: 'journal_count', status: 'approved', origin: 'journal'},
      {key: 'journal:students', title: 'Students featured', body: 'students featured in documented stories', stat_value: String(counts.students), stat_source: 'ABG Impact Journal (unique students in documented stories)', stat_period: asOf, verification: 'journal_count', status: 'approved', origin: 'journal'},
      {key: 'journal:outcomes', title: 'Outcomes recorded', body: 'outcomes recorded in documented stories', stat_value: String(counts.outcomes), stat_source: 'ABG Impact Journal (outcomes recorded in documented stories)', stat_period: asOf, verification: 'journal_count', status: 'approved', origin: 'journal'},
    ];
    (mat.content || []).filter(c => c.kind === 'statistic' && c.status !== 'archived').forEach(c => out.unshift(Object.assign({key: 'bank:' + c.id, origin: 'bank'}, c)));
    (metrics || []).forEach(x => out.push({key: 'metric:' + x.id, title: x.label, body: x.label, stat_value: String(x.value), stat_unit: x.unit || '', stat_source: x.source || 'Program records', stat_period: x.period || '', verification: 'program_records', status: 'pending', origin: 'metric'}));
    return out;
  }

  /* ---------- Materials workspace ---------- */
  function MaterialsView({params}){
    const {nav, isAdmin} = useApp();
    const mat = useMat();
    const p = params || {};
    const tab = p.tab || 'library';
    const set = t => nav('materials', {tab: t});
    return html`<div className="view mt-view">
      <div className="mt-head">
        <header><p className="eyebrow mt-eyebrow">Impact Materials</p><h1>${tab === 'templates' ? 'Manage Templates' : tab === 'create' ? 'AI Material Builder' : tab === 'generated' ? 'Generated Documents' : 'Impact Materials'}</h1>
          <p className="muted">${tab === 'templates' ? "Upload, connect, and organize reusable templates for ABG's impact communications." : tab === 'create' ? "Create materials from ABG's approved stories, data, and your branded templates." : "Create, customize, and reuse materials that communicate ABG's impact."}</p></header>
        ${isAdmin && mat.state === 'ready' ? html`<div className="mt-head-btns"><button className="btn btn-ghost mt-canva-btn" id="mt-connect-canva" onClick=${() => nav('template-edit', {mode: 'new', kind: 'canva'})}><span className="mt-canva-dot">C</span> Connect Canva Design</button><button className="btn btn-primary" id="mt-upload" onClick=${() => nav('template-edit', {mode: 'new', kind: 'file'})}><${Icon} name="upload" size=${18} /> Upload Template</button></div>` : null}
      </div>
      <div className="mt-tabs" role="tablist" aria-label="Impact Materials">
        ${[['library', 'Materials Library', 'layers'], ['create', 'Create New Material', 'plus'], ['templates', 'Manage Templates', 'grid'], ['generated', 'Generated Documents', 'file']].map(([id, label, icon]) => html`<button key=${id} type="button" role="tab" aria-selected=${tab === id} className="mt-tab" onClick=${() => set(id)}><${Icon} name=${icon} size=${20} /><span>${label}</span></button>`)}
      </div>
      ${mat.state === 'missing' ? html`<${SetupNotice} />` : mat.state === 'error' ? html`<p className="error">Couldn't load Impact Materials. Check your connection. <button className="btn btn-quiet btn-sm" onClick=${mat.reload}>Try again</button></p>`
        : mat.state !== 'ready' ? html`<div className="skeleton mt-skel"></div>`
        : tab === 'templates' ? html`<${ManageTemplates} initialFamily=${p.family} />`
        : tab === 'create' ? html`<${BuilderView} params=${p} embedded=${true} />`
        : tab === 'generated' ? html`<${GeneratedDocs} />`
        : html`<${Library} />`}
    </div>`;
  }

  /* ---------- Materials Library ---------- */
  function Library(){
    const {nav, isAdmin, openSheet} = useApp();
    const mat = useMat(); const m = mat.model;
    const [q, setQ] = useState(''); const [status, setStatus] = useState(''); const [aud, setAud] = useState(''); const [typ, setTyp] = useState(''); const [range, setRange] = useState('');
    const [treeSel, setTreeSel] = useState(null);
    const [menu, setMenu] = useState('');
    useEffect(() => { if (!menu) return; const c = e => { if (!e.target.closest('.mt-menu-wrap')) setMenu(''); }; document.addEventListener('click', c); return () => document.removeEventListener('click', c); }, [menu]);
    const since = range ? new Date(Date.now() - (+range) * 864e5).toISOString() : '';
    const audIds = id => { const out = [id]; m.children(id).forEach(c => out.push(...audIds(c.id))); return out; };
    const list = (mat.materials || []).filter(x => (!status ? x.status !== 'archived' : x.status === status) && (!aud || audIds(aud).includes(x.audience_id)) && (!typ || x.material_type_id === typ) && (!treeSel || x.family_id === treeSel) && (!since || x.created_at >= since) && (!q || (x.title + ' ' + ((m.typ.get(x.material_type_id) || {}).name || '')).toLowerCase().includes(q.toLowerCase())));
    const audOpts = m.audiences.filter(a => a.active);
    return html`<div className="mt-lib">
      <aside className="card mt-panel mt-treepanel"><h2>Templates & Materials</h2>
        ${treeSel ? html`<button className="btn btn-quiet btn-sm" onClick=${() => setTreeSel(null)}>Show all materials</button>` : html`<p className="small muted">Pick a template to see the materials made with it.</p>`}
        <${TemplateTree} m=${m} q="" selected=${treeSel} onSelect=${f => setTreeSel(f.id)} showVersions=${true} admin=${isAdmin} onAdd=${t => nav('template-edit', {mode: 'new', typeId: t.id})} />
      </aside>
      <section className="mt-libmain">
        <div className="mt-libhead"><div><h2>Materials Library</h2><p className="small muted">Browse, manage, and update your generated materials.</p></div>
          <label className="mt-search"><${Icon} name="search" size=${18} /><input className="input" id="lib-q" placeholder="Search materials…" value=${q} onChange=${e => setQ(e.target.value)} aria-label="Search materials" /></label></div>
        <div className="filter-bar mt-filters"><span className="filter-label">Filter by:</span>
          <label className="ins-filter"><select className="select" aria-label="Audience" value=${aud} onChange=${e => { setAud(e.target.value); setTyp(''); }}><option value="">All audiences</option>${audOpts.map(a => html`<option key=${a.id} value=${a.id}>${m.audPath(a.id)}</option>`)}</select></label>
          <label className="ins-filter"><select className="select" aria-label="Material type" value=${typ} onChange=${e => setTyp(e.target.value)}><option value="">All material types</option>${m.types.filter(t => !aud || audIds(aud).includes(t.audience_id)).map(t => html`<option key=${t.id} value=${t.id}>${t.name}</option>`)}</select></label>
          <label className="ins-filter"><select className="select" aria-label="Date" value=${range} onChange=${e => setRange(e.target.value)}><option value="">Any date</option><option value="30">Last 30 days</option><option value="92">Last 3 months</option><option value="366">Last 12 months</option></select></label>
          <label className="ins-filter"><select className="select" id="lib-status" aria-label="Status" value=${status} onChange=${e => setStatus(e.target.value)}><option value="">All statuses</option>${MAT_STATUS.map(s => html`<option key=${s.id} value=${s.id}>${s.label}</option>`)}</select></label>
        </div>
        ${!list.length ? html`<div className="empty"><${Icon} name="layers" size=${34} /><h3>${(mat.materials || []).length ? 'No materials match' : 'No materials yet'}</h3><p className="muted">${(mat.materials || []).length ? 'Try other filters.' : m.families.some(f => m.currentVersion(f) && m.currentVersion(f).config_status === 'approved') ? 'Create your first donor summary, proposal or one-pager from approved stories and data.' : isAdmin ? 'Start by adding a template under Manage Templates.' : 'Materials appear here once an administrator adds templates.'}</p>
          <button className="btn btn-primary" onClick=${() => nav('materials', {tab: 'create'})}><${Icon} name="plus" size=${18} /> Create New Material</button></div>`
        : html`<div className="mt-table" role="table" aria-label="Materials">
          <div className="mt-tr mt-th" role="row"><span role="columnheader">Material</span><span role="columnheader">Audience</span><span role="columnheader">Material type</span><span role="columnheader">Template (version)</span><span role="columnheader">Status</span><span role="columnheader">Created</span><span></span></div>
          ${list.map(x => { const v = m.ver.get(x.template_version_id); const t = m.typ.get(x.material_type_id); const a = m.aud.get(x.audience_id);
            return html`<div className="mt-tr card" role="row" key=${x.id} data-id=${x.id}>
              <button className="mt-cell-main" onClick=${() => nav('material', {id: x.id})}><${Thumb} bucket="materials" path=${(x.output || {}).thumb} alt="" fallback="doc" /><span><strong>${x.title}</strong><small className="muted clamp2">${((x.content || {}).intro || {}).text || ((x.settings || {}).period ? 'Reporting period: ' + x.settings.period : '')}</small></span></button>
              <span data-label="Audience"><span className="pill tone-teal">${a ? a.name : ''}</span></span>
              <span data-label="Material type" className="small">${t ? t.name : ''}</span>
              <span data-label="Template" className="small">${v ? m.versionLabel(v) : ''}${v && m.isDefault(m.fam.get(v.family_id)) && m.currentVersion(m.fam.get(v.family_id)) === v ? ' (Default)' : ''}</span>
              <span data-label="Status"><${MatStatus} status=${x.status} /></span>
              <span data-label="Created" className="small muted">${fmtDate(x.created_at)}<br />${who(x.created_by)}</span>
              <span className="mt-menu-wrap"><button className="icon-btn mt-dots" aria-label=${'Actions for ' + x.title} aria-expanded=${menu === x.id} onClick=${e => { e.stopPropagation(); setMenu(menu === x.id ? '' : x.id); }}><${Icon} name="dots" /></button>
                ${menu === x.id ? html`<${ActionMenu} x=${x} close=${() => setMenu('')} />` : null}</span>
            </div>`; })}
        </div>`}
      </section>
    </div>`;
  }
  /* actions shared by the library menu and the material page */
  function useMaterialActions(x){
    const app = useApp(); const {nav, isAdmin, openSheet, showToast} = app;
    const mat = useMat(); const m = mat.model;
    const locked = x.status === 'approved' || x.status === 'archived';
    const mine = isAdmin || x.created_by === String((window.__platform && window.__platform.email) || (app.caps.me || {}).email || '').toLowerCase();
    const files = (x.output || {}).files || [];
    const dl = async () => {
      if (!files.length) { showToast('Generate the document first.'); return; }
      try { for (const f of files) { const url = await mat.api.fileUrl('materials', f.path, f.name); const a = document.createElement('a'); a.href = url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); } await mat.api.log('exported', x.id, {files: files.map(f => f.name)}); mat.reload(); }
      catch (e) { showToast(e.message); }
    };
    const copyTo = async (version, kind) => {
      const fam = m.fam.get(version.family_id);
      const {content, missing} = carryContent(x.content, version.fields || []);
      const id = uuid();
      const row = {id, title: (kind === 'duplicate' ? 'Copy of ' : '') + x.title, audience_id: x.audience_id, material_type_id: x.material_type_id, family_id: fam.id, template_version_id: version.id, settings: x.settings, sources: x.sources, content, warnings: [], output: {}, status: 'draft', created_by: String((window.__platform && window.__platform.email) || '').toLowerCase()};
      row[kind === 'duplicate' ? 'duplicated_from' : 'regenerated_from'] = x.id;
      try { await mat.api.save('mat_materials', row); await mat.reload(); showToast(kind === 'duplicate' ? 'Duplicated. Review the content, then generate.' : 'New version started with ' + m.versionLabel(version) + (missing.length ? '. ' + missing.length + ' field' + (missing.length === 1 ? ' needs' : 's need') + ' content.' : '. The original stays as it is.')); nav('builder', {materialId: id, step: 6}); }
      catch (e) { showToast(e.message); }
    };
    const duplicate = () => { const v = m.ver.get(x.template_version_id); const t = m.typ.get(x.material_type_id); const ok = v && v.config_status === 'approved' && !v.archived_at && m.fam.get(v.family_id).status === 'active'; const use = ok ? v : m.defaultVersion(t); if (!use) { showToast('This material type has no approved template right now.'); return; } copyTo(use, 'duplicate'); };
    const regenerate = () => openSheet(close => html`<${RegenerateSheet} close=${close} x=${x} onPick=${v => { close(); copyTo(v, 'regenerate'); }} />`);
    const updateTemplate = () => nav('template-edit', {mode: 'update', familyId: x.family_id});
    const edit = () => { if (locked) { showToast('This material is ' + x.status + ' and preserved. Duplicate it to make changes.'); return; } nav('builder', {materialId: x.id, step: 6}); };
    const setStatus = async (status, msg) => { try { await mat.api.update('mat_materials', x.id, {status}); await mat.reload(); showToast(msg); } catch (e) { showToast(e.message); } };
    return {locked, mine, files, dl, duplicate, regenerate, updateTemplate, edit, setStatus};
  }
  function ActionMenu({x, close}){
    const {nav, isAdmin} = useApp();
    const a = useMaterialActions(x);
    const item = (icon, label, fn, dis, id) => html`<button type="button" role="menuitem" id=${id} className="mt-menu-item" disabled=${dis} onClick=${() => { close(); fn(); }}><${Icon} name=${icon} size=${18} />${label}</button>`;
    return html`<div className="mt-menu" role="menu">
      ${item('eye', 'Preview', () => nav('material', {id: x.id}))}
      ${item('edit', 'Edit content', a.edit, a.locked || !a.mine)}
      ${item('download', 'Download' + (a.files[0] ? ' (' + a.files.map(f => f.kind.toUpperCase()).join(', ') + ')' : ''), a.dl, !a.files.length)}
      ${item('copy', 'Duplicate', a.duplicate)}
      ${item('refresh', 'Regenerate', a.regenerate)}
      ${isAdmin ? item('layers', 'Update Template', a.updateTemplate, false, 'menu-update-template') : null}
    </div>`;
  }
  function RegenerateSheet({close, x, onPick}){
    const mat = useMat(); const m = mat.model;
    const t = m.typ.get(x.material_type_id);
    const opts = m.usableVersions(t);
    const def = m.defaultVersion(t);
    const [pick, setPick] = useState(def ? def.id : (opts[0] ? opts[0].version.id : ''));
    const v = m.ver.get(pick);
    const cc = v ? carryContent(x.content, v.fields || []) : {missing: []};
    const old = m.ver.get(x.template_version_id);
    return html`<div className="view" style=${{gap: '12px'}}><${SheetHead} title="Regenerate with a template" close=${close} />
      <p className="small muted">Makes a new material from this one's content with the template you choose. "${x.title}" stays exactly as it is${x.status === 'approved' ? ' (it is approved)' : ''}.</p>
      ${opts.length ? html`<div className="mt-choice">${opts.map(o => html`<label key=${o.version.id} className=${'mt-choice-opt' + (pick === o.version.id ? ' on' : '')}><input type="radio" name="rg" checked=${pick === o.version.id} onChange=${() => setPick(o.version.id)} /><span><strong>${m.versionLabel(o.version)}${def && def.id === o.version.id ? ' (Default)' : ''}${old && old.id === o.version.id ? ' (same as now)' : ''}</strong><small><${SourceBadge} type=${o.version.source_type} /> ${(SOURCE_TYPES[o.version.source_type] || {}).output}</small></span></label>`)}</div>` : html`<p className="notice small">There's no approved template for ${t ? t.name : 'this material type'} right now.</p>`}
      ${v && cc.missing.length ? html`<p className="notice small">This template has ${cc.missing.length} field${cc.missing.length === 1 ? '' : 's'} the original doesn't fill (${cc.missing.map(f => f.label || f.id).join(', ')}). You'll review and fill ${cc.missing.length === 1 ? 'it' : 'them'} before generating.</p>` : null}
      <div className="row-btns end"><button className="btn btn-ghost" onClick=${close}>Cancel</button><button className="btn btn-primary" id="rg-go" disabled=${!v} onClick=${() => onPick(v)}>Regenerate</button></div></div>`;
  }

  /* ---------- Generated Documents ---------- */
  function GeneratedDocs(){
    const {nav, showToast} = useApp();
    const mat = useMat(); const m = mat.model;
    const rows = [];
    (mat.materials || []).forEach(x => { const o = x.output || {}; (o.files || []).forEach(f => rows.push({x, f})); if (o.canva) rows.push({x, canva: o.canva}); });
    rows.sort((a, b) => String((b.f || b.canva).at || b.x.updated_at).localeCompare(String((a.f || a.canva).at || a.x.updated_at)));
    const get = async (x, f) => { try { const url = await mat.api.fileUrl('materials', f.path, f.name); window.open(url, '_blank', 'noopener'); await mat.api.log('exported', x.id, {files: [f.name]}); } catch (e) { showToast(e.message); } };
    return html`<section className="card mt-panel">
      <h2>Generated Documents</h2><p className="small muted">Every file and Canva design made from a material. Approved materials' files never change.</p>
      ${!rows.length ? html`<div className="empty"><h3>No documents yet</h3><p className="muted">Generate a material to see its PDF, PowerPoint or Canva design here.</p></div>`
        : html`<div className="mt-docs">${rows.map((r, i) => html`<div className="mt-doc" key=${i}>
          <span className=${'mt-doc-ic ' + (r.canva ? 'canva' : r.f.kind)}>${r.canva ? 'C' : r.f.kind.toUpperCase()}</span>
          <span className="mt-doc-main"><strong>${r.canva ? 'Canva design: ' + (r.canva.title || r.x.title) : r.f.name}</strong><small className="muted">${r.x.title} · ${(m.ver.get(r.x.template_version_id) ? m.versionLabel(m.ver.get(r.x.template_version_id)) : '')} · ${fmtDate((r.f || r.canva).at || r.x.updated_at)}</small></span>
          <${MatStatus} status=${r.x.status} />
          <span className="row-btns">${r.canva ? html`<a className="btn btn-ghost btn-sm" href=${r.canva.editUrl || ('https://www.canva.com/design/' + r.canva.id + '/edit')} target="_blank" rel="noopener">Open in Canva</a>` : html`<button className="btn btn-ghost btn-sm" onClick=${() => get(r.x, r.f)}><${Icon} name="download" size=${16} /> Download</button>`}<button className="btn btn-quiet btn-sm" onClick=${() => nav('material', {id: r.x.id})}>Details</button></span>
        </div>`)}</div>`}
    </section>`;
  }

  /* ---------- AI Material Builder ---------- */
  const STEPS = ['Select Audience', 'Select Material Type', 'Select Template', 'Select Content', 'Generate Draft Content', 'Review Content', 'Generate Document', 'Final Review'];
  const KEYWORDS = [['donor', 'donors'], ['foundation', 'donors'], ['grant', 'donors'], ['school', 'schools'], ['teacher', 'schools'], ['corporate', 'corporate'], ['partner', 'corporate'], ['community', 'community'], ['neighborhood', 'community'], ['artist', 'artists'], ['volunteer', 'artists']];
  const tagFor = name => { const n = String(name || '').toLowerCase(); const k = KEYWORDS.find(([w]) => n.includes(w)); return k ? k[1] : ''; };
  function needsOf(fields){
    const need = {stories: 0, stats: 0, quotes: 0, images: 0};
    (fields || []).forEach(f => { const s = f.source || ''; const n = f.n || 1;
      if (s === 'ai:story' || s.startsWith('story:')) need.stories = Math.max(need.stories, n);
      if (s.startsWith('stat:')) need.stats = Math.max(need.stats, n);
      if (s.startsWith('quote:')) need.quotes = Math.max(need.quotes, n);
      if (s === 'image') need.images = Math.max(need.images, n); });
    return need;
  }
  function programYear(offset){ const d = new Date(); const y = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1; const a = y + (offset || 0); return a + '–' + String(a + 1).slice(2) + ' program year (Jul ' + a + ' – Jun ' + (a + 1) + ')'; }

  function BuilderView({params}){
    const app = useApp(); const {nav, stories, settings, showToast, isAdmin, caps, openSheet} = app;
    const mat = useMat(); const m = mat.model;
    const p = params || {};
    const resume = p.materialId ? (mat.materials || []).find(x => x.id === p.materialId) : null;
    const [step, setStep] = useState(resume ? 6 : p.typeId ? 3 : p.audienceId ? 2 : 1);
    const [audienceId, setAudienceId] = useState(resume ? resume.audience_id : (p.audienceId || ''));
    const [typeId, setTypeId] = useState(resume ? resume.material_type_id : (p.typeId || ''));
    const [versionId, setVersionId] = useState(resume ? resume.template_version_id : '');
    const S0 = (resume && resume.settings) || {};
    const [period, setPeriod] = useState(S0.period || programYear(0));
    const [programs, setPrograms] = useState(S0.programs || []);
    const [storyIds, setStoryIds] = useState(S0.storyIds || []);
    const [statKeys, setStatKeys] = useState(S0.statKeys || []);
    const [imageIds, setImageIds] = useState(S0.imageIds || []);
    const [instructions, setInstructions] = useState(S0.instructions || '');
    const [materialId, setMaterialId] = useState(resume ? resume.id : '');
    const [title, setTitle] = useState(resume ? resume.title : '');
    const [content, setContent] = useState(resume ? (resume.content || {}) : {});
    const [snap, setSnap] = useState(resume ? (resume.sources || null) : null);
    const [busy, setBusy] = useState(''); const [err, setErr] = useState('');
    const [genReport, setGenReport] = useState(null);
    const type = m.typ.get(typeId); const aud = m.aud.get(audienceId);
    const version = m.ver.get(versionId);
    const fam = version ? m.fam.get(version.family_id) : null;
    const channel = type ? type.channel : 'print';
    const fields = (version && version.fields) || [];
    const need = needsOf(fields);
    const statOpts = useStatOptions();
    useEffect(() => { if (type && !versionId) { const d = m.defaultVersion(type) || (m.usableVersions(type)[0] || {}).version; if (d) setVersionId(d.id); } }, [typeId, mat.rev]);
    useEffect(() => { if (type && aud && !title) setTitle(type.name + (period ? ' – ' + period.replace(/ \(.*\)$/, '') : '')); }, [typeId]);
    if (mat.state === 'missing') return html`<${SetupNotice} />`;
    if (p.materialId && !resume) return html`<div className="view">${mat.state === 'ready' ? html`<p className="notice">That material was not found.</p>` : html`<div className="skeleton mt-skel"></div>`}</div>`;
    if (resume && (resume.status === 'approved' || resume.status === 'archived')) return html`<div className="view"><${Back} to="material" params=${{id: resume.id}} label="Back to material" /><p className="notice">This material is ${resume.status} and preserved as it is. Duplicate it to make changes.</p></div>`;

    /* content choices with consent checks */
    const tag = tagFor((aud ? aud.name : '') + ' ' + (type ? type.name : '') + ' ' + (aud && aud.parent_id ? (m.aud.get(aud.parent_id) || {}).name : ''));
    const storyChoices = stories.filter(s => !s.demo).map(s => ({s, use: storyUse(h, s, channel), rec: !!((tag && (s.audiences || []).includes(tag)) || (programs.length && programs.includes(s.program)))}))
      .sort((a, b) => (b.use.allowed - a.use.allowed) || (b.rec - a.rec) || String(b.s.updatedAt || b.s.createdAt || '').localeCompare(String(a.s.updatedAt || a.s.createdAt || '')));
    const media = (mat.content || []).filter(c => c.kind === 'media' && c.status !== 'archived').map(c => ({c, use: mediaUse(c, channel)}));
    const messaging = (mat.content || []).filter(c => c.kind === 'messaging' && c.status === 'approved' && (!(c.audience_ids || []).length || (c.audience_ids || []).includes(audienceId) || (aud && aud.parent_id && (c.audience_ids || []).includes(aud.parent_id))) && (c.category !== 'program' || !programs.length || programs.includes(c.program)));
    const pickedStories = storyIds.map(id => stories.find(s => s.id === id)).filter(Boolean);
    const pickedStats = statKeys.map(k => statOpts.find(o => o.key === k)).filter(Boolean);
    const pickedImages = imageIds.map(id => (mat.content || []).find(c => c.id === id)).filter(Boolean);
    const quotesN = pickedStories.reduce((n, s) => n + (s.quotes || []).filter(q => q.approved).length, 0);
    function buildSel(){
      const blocked = [];
      pickedStories.forEach(s => { const u = storyUse(h, s, channel); if (!u.allowed) blocked.push('Story "' + trunc(s.title || 'Untitled', 40) + '" can\'t be used: ' + u.blocks.join('; ') + '.'); });
      pickedImages.forEach(c => { const u = mediaUse(c, channel); if (!u.allowed) blocked.push('Image "' + c.title + '" can\'t be used: ' + u.blocks.join('; ') + '.'); });
      return {stories: pickedStories.map((s, i) => storySnapshot(h, s, i, channel)), stats: pickedStats.map((t, i) => Object.assign(statSnapshot(t, i), {key: t.key})), messaging: messaging.map((c, i) => bankSnapshot(c, i)), images: pickedImages.map((c, i) => mediaSnapshot(c, i)),
        period, programs, audienceName: aud ? aud.name : '', typeName: type ? type.name : '', channel, instructions: asStr(instructions), blocked};
    }
    const sel = snap || buildSel();
    const problems = version ? checkContent(fields, content, sel) : [];
    const errorsN = problems.filter(x => x.level === 'error').length;
    const me = String((window.__platform && window.__platform.email) || (caps.me || {}).email || '').toLowerCase();

    async function saveDraft(patch, quiet){
      const row = Object.assign({title: asStr(title) || (type ? type.name : 'Material'), audience_id: audienceId, material_type_id: typeId, family_id: fam.id, template_version_id: version.id,
        settings: {period, programs, storyIds, statKeys, imageIds, instructions: asStr(instructions), channel}, sources: snap || buildSel(), content, warnings: problems}, patch || {});
      if (!materialId) { const id = uuid(); await mat.api.save('mat_materials', Object.assign({id, status: 'draft', output: {}, created_by: me}, row)); setMaterialId(id); await mat.reload(); if (!quiet) showToast('Draft saved.'); return id; }
      await mat.api.update('mat_materials', materialId, row); await mat.reload(); if (!quiet) showToast('Draft saved.'); return materialId;
    }
    async function generateContent(only){
      setBusy(only ? 'field:' + only : 'ai'); setErr('');
      const s = only ? sel : buildSel();
      try {
        let ai = {fields: {}};
        const want = aiFields(fields).filter(f => !only || f.id === only);
        if (want.length) {
          if (!caps.sample) throw {message: 'AI writing is not available here.'};
          const prompt = materialPrompt({fields: want, sel: s, context: {audience: (aud ? m.audPath(aud.id) : ''), materialType: type ? type.name : 'material'}, emphasis: h.audienceEmphasis(tagFor((aud ? aud.name : '') + ' ' + (aud && aud.parent_id ? (m.aud.get(aud.parent_id) || {}).name : '')))});
          ai = await caps.sample.json(prompt);
        }
        const fresh = resolveContent(fields, s, ai, Object.fromEntries(Object.entries(content).map(([k, v]) => [k, v.text])));
        let next;
        if (only) next = Object.assign({}, content, {[only]: fresh[only]});
        else { next = {}; fields.forEach(f => { next[f.id] = f.source === 'manual' && content[f.id] ? content[f.id] : fresh[f.id]; }); }
        setContent(next); setSnap(s);
        if (!only) setStep(6);
        return next;
      } catch (e) { setErr(h.aiErrorMessage ? h.aiErrorMessage(e) : (e.message || "The AI couldn't write the content. Try again.")); }
      finally { setBusy(''); }
    }
    async function generateDocument(){
      setBusy('doc'); setErr(''); setGenReport(null);
      try {
        const id = await saveDraft({}, true);
        const fresh = mat.materials.find(x => x.id === id) || {};
        let output = {};
        const stamp = Date.now();
        const base = slugify(title) + '-v' + version.version_no;
        if (version.source_type === 'canva') {
          const r = await renderCanva(mat.api, version, content, {materialId: id, title: asStr(title), onStep: t => setBusy(t)});
          const pdf = await materialBytes(mat.api, r.pdfPath);
          const thumb = await pdfThumb(pdf, 480).catch(() => null);
          let thumbPath = null; if (thumb) { thumbPath = 'generated/' + id + '/thumb-' + stamp + '.png'; await mat.api.uploadMaterialFile(thumbPath, new Uint8Array(await thumb.arrayBuffer()), 'image/png'); }
          output = {canva: Object.assign({}, r.design, {title: asStr(title)}), files: [{kind: 'pdf', path: r.pdfPath, name: base + '.pdf', size: r.size, at: new Date().toISOString()}], thumb: thumbPath, engine: 'canva', generatedAt: new Date().toISOString()};
        } else {
          setBusy('Filling the template…');
          const r = await renderFile(mat.api, version, content);
          const bad = r.report.filter(x => !x.ok);
          if (bad.length) { setGenReport(r.report); setBusy(''); setErr('The document was not created: ' + bad.length + ' field' + (bad.length === 1 ? " doesn't" : "s don't") + ' fit the template. Shorten the text below, then try again.'); return; }
          setBusy('Saving the document…');
          const path = 'generated/' + id + '/' + base + '-' + stamp + '.' + r.ext;
          await mat.api.uploadMaterialFile(path, r.bytes, r.mime);
          let thumb = null;
          try { thumb = r.ext === 'pdf' ? await pdfThumb(r.bytes, 480) : await pptxThumb(await (await pptxEngine()).previewPptx(r.bytes), 480); } catch (e) {}
          let thumbPath = null; if (thumb) { thumbPath = 'generated/' + id + '/thumb-' + stamp + '.png'; await mat.api.uploadMaterialFile(thumbPath, new Uint8Array(await thumb.arrayBuffer()), 'image/png'); }
          output = {files: [{kind: r.ext, path, name: base + '.' + r.ext, size: r.bytes.length, at: new Date().toISOString()}], thumb: thumbPath, engine: version.source_type, report: r.report, generatedAt: new Date().toISOString()};
        }
        await mat.api.update('mat_materials', id, {output});
        await mat.api.log('generated', id, {version: version.version_no, engine: output.engine});
        await mat.reload();
        showToast('Document generated. Review it, then download or send it for approval.');
        nav('material', {id});
      } catch (e) { setErr(e.message || 'The document could not be generated.'); }
      setBusy('');
    }

    const go = n => { setErr(''); setStep(n); try { window.scrollTo(0, 0); } catch (e) {} };
    const canNext = step === 1 ? !!audienceId : step === 2 ? !!typeId : step === 3 ? !!versionId : true;
    /* left column: the person's selections so far */
    const selections = step > 1 ? html`<aside className="mt-bside">
      <section className="card mt-panel"><div className="row-between"><h2>Your Selections</h2>${step > 1 && !materialId ? html`<button className="link-btn" onClick=${() => go(1)}><${Icon} name="edit" size=${14} /> Edit</button>` : null}</div>
        <dl className="mt-sel small"><div><dt><${Icon} name="user" size=${16} /> Audience</dt><dd>${aud ? aud.name : '–'}</dd></div><div><dt><${Icon} name="file" size=${16} /> Material Type</dt><dd>${type ? type.name : '–'}</dd></div><div><dt><${Icon} name="layers" size=${16} /> Template</dt><dd>${version ? m.versionLabel(version) + (m.defaultVersion(type) === version ? ' (Default)' : '') : '–'}</dd></div></dl></section>
      ${version ? html`<section className="card mt-panel mt-tplcard"><${Thumb} bucket="templates" path=${version.preview_path} alt="" fallback="layers" /><div><strong>${m.versionLabel(version)}</strong>${m.defaultVersion(type) === version ? html` <${Pill} tone="purple">Default<//>` : null}<p className="small"><${SourceBadge} type=${version.source_type} /></p>${step < 5 && !materialId ? html`<button className="link-btn small" onClick=${() => go(3)}><${Icon} name="swap" size=${14} /> Change Template</button>` : null}</div></section>` : null}
      ${step >= 4 ? html`<section className="card mt-panel"><div className="row-between"><h3>Selected Stories (${pickedStories.length})</h3>${step >= 5 ? html`<button className="link-btn small" onClick=${() => go(4)}>+ Add Story</button>` : null}</div>
        ${pickedStories.map(s => html`<div className="mt-selstory small" key=${s.id}><strong>${trunc(s.title || 'Untitled', 50)}</strong><span className="chips"><${Pill} tone="good"><${Icon} name="check" size=${12} /> Approved<//><${Pill} tone="teal">External use<//></span></div>`)}</section>
        <section className="card mt-panel"><div className="row-between"><h3>Selected Statistics (${pickedStats.length})</h3>${step >= 5 ? html`<button className="link-btn small" onClick=${() => go(4)}>+ Add Statistic</button>` : null}</div>
        <div className="mt-statgrid">${pickedStats.map(t => html`<div className="mt-stat" key=${t.key}><b>${t.stat_value}${t.stat_unit === '%' ? '%' : ''}</b><small>${t.title}</small>${t.verification === 'independently_verified' ? html`<span className="mt-statok" title="Independently verified"><${Icon} name="check" size=${12} /></span>` : null}</div>`)}</div></section>` : null}
    </aside>` : null;

    let body;
    if (step === 1) {
      body = html`<section className="card mt-panel"><h2>Who is this material for?</h2>
        ${m.pickable.length ? html`<div className="mt-audgrid">${m.roots.filter(r => r.active).map(r => { const leaves = [r].concat(m.children(r.id)).filter(a => a.active && m.typesOf(a.id).length); if (!leaves.length) return null; return html`<div key=${r.id} className="mt-audgroup"><p className="eyebrow">${r.name}</p>${leaves.map(a => html`<button key=${a.id} type="button" className=${'mt-pickcard' + (audienceId === a.id ? ' on' : '')} data-aud=${a.name} onClick=${() => { setAudienceId(a.id); setTypeId(''); setVersionId(''); go(2); }}><strong>${a.name === r.name ? a.name : a.name}</strong><small className="muted">${m.typesOf(a.id).map(t => t.name).join(' · ')}</small></button>`)}</div>`; })}</div>`
          : html`<p className="notice small">No audiences are set up yet. An administrator can add them under Manage Templates › Audiences & Material Types.</p>`}</section>`;
    } else if (step === 2) {
      body = html`<section className="card mt-panel"><h2>What are you making for ${aud ? aud.name : ''}?</h2>
        <div className="mt-typegrid">${m.typesOf(audienceId).map(t => { const d = m.defaultVersion(t); const n = m.usableVersions(t).length; return html`<button key=${t.id} type="button" className=${'mt-pickcard' + (typeId === t.id ? ' on' : '')} disabled=${!n} data-type=${t.name} onClick=${() => { setTypeId(t.id); setVersionId(''); go(3); }}><strong>${t.name}</strong><small className="muted">${d ? 'Default template: ' + m.versionLabel(d) : n ? n + ' template' + (n === 1 ? '' : 's') : 'No approved template yet'}</small></button>`; })}</div></section>`;
    } else if (step === 3) {
      const opts = type ? m.usableVersions(type) : [];
      body = html`<section className="card mt-panel"><h2>Template</h2><p className="small muted">The default is selected. ${opts.length > 1 ? 'You can choose another variation.' : ''}</p>
        <div className="mt-tplgrid">${opts.map(o => html`<button key=${o.version.id} type="button" className=${'mt-tplpick' + (versionId === o.version.id ? ' on' : '')} onClick=${() => setVersionId(o.version.id)}><${Thumb} bucket="templates" path=${o.version.preview_path} alt="" fallback="layers" /><span><strong>${m.versionLabel(o.version)}</strong>${m.defaultVersion(type) === o.version ? html` <${Pill} tone="purple">Default<//>` : null}<small><${SourceBadge} type=${o.version.source_type} /> ${(SOURCE_TYPES[o.version.source_type] || {}).output}</small></span></button>`)}</div>
        ${version ? html`<details className="mt-tpldetails"><summary className="small">What this template fills (${fields.length} fields)</summary><ul className="small">${fields.map(f => html`<li key=${f.id}><strong>${f.label || f.id}</strong>: ${sourceLabel(f)}</li>`)}</ul></details>` : null}</section>`;
    } else if (step === 4) {
      const togg = (list, set, id, max) => set(list.includes(id) ? list.filter(x => x !== id) : list.concat([id]).slice(-(max || 99)));
      const progs = (settings.programs || []).map(x => typeof x === 'string' ? x : x.name).filter(Boolean);
      body = html`<div className="mt-content">
        <section className="card mt-panel"><h2>Reporting period and programs</h2>
          <div className="row"><${Field} label="Reporting period"><input id="b-period" className="input" list="dl-period" value=${period} onChange=${e => setPeriod(e.target.value)} /><//><datalist id="dl-period"><option value=${programYear(0)}></option><option value=${programYear(-1)}></option><option value=${'Calendar year ' + new Date().getFullYear()}></option></datalist>
          <${Field} label="Material title"><input id="b-title" className="input" value=${title} onChange=${e => setTitle(e.target.value)} /><//></div>
          ${progs.length ? html`<div className="field"><span className="field-label">Programs (optional)</span><div className="chips">${progs.map(pr => html`<button type="button" key=${pr} className=${'chip' + (programs.includes(pr) ? ' on' : '')} aria-pressed=${programs.includes(pr)} onClick=${() => togg(programs, setPrograms, pr)}>${pr}</button>`)}</div></div>` : null}
        </section>
        <section className="card mt-panel"><div className="row-between"><h2>Approved stories</h2><small className="muted">${need.stories || need.quotes ? 'This template uses ' + [need.stories ? need.stories + ' stor' + (need.stories === 1 ? 'y' : 'ies') : '', need.quotes ? need.quotes + ' quotation' + (need.quotes === 1 ? '' : 's') : ''].filter(Boolean).join(' and ') : 'Optional'}</small></div>
          <p className="small muted">Only stories approved for external use, with consent for ${(CHANNELS.find(c => c.id === channel) || {}).label.toLowerCase()}, can be selected. The order you pick them is #1, #2…</p>
          <div className="mt-picklist">${storyChoices.slice(0, 60).map(({s, use, rec}) => { const on = storyIds.includes(s.id); return html`<div key=${s.id} className=${'mt-pickrow' + (on ? ' on' : '') + (use.allowed ? '' : ' blocked')} data-story=${s.id}>
            <label className="check"><input type="checkbox" disabled=${!use.allowed} checked=${on} onChange=${() => togg(storyIds, setStoryIds, s.id)} /><span><strong>${on ? '#' + (storyIds.indexOf(s.id) + 1) + ' ' : ''}${s.title || 'Untitled story'}</strong>${rec ? html` <${Pill} tone="teal">Recommended<//>` : null}<small className="muted">${[s.program, use.name ? 'Named as ' + use.name : 'Not named', use.quotes ? use.quotes + ' approved quote' + (use.quotes === 1 ? '' : 's') : 'no approved quotes'].filter(Boolean).join(' · ')}</small>
              ${use.allowed ? (use.warnings.length ? html`<small className="mt-warn">${use.warnings.join('. ')}</small>` : null) : html`<small className="mt-block"><${Icon} name="lock" size=${12} /> ${use.blocks.join(' · ')}</small>`}</span></label>
            ${!use.allowed && use.fixable && isAdmin ? html`<button className="btn btn-quiet btn-sm" onClick=${() => openSheet(close => html`<${UsesSheet} close=${close} story=${s} />`)}>Record permitted uses</button>` : null}
          </div>`; })}${!storyChoices.length ? html`<p className="small muted">No stories in the journal yet.</p>` : null}</div>
        </section>
        <section className="card mt-panel"><div className="row-between"><h2>Statistics</h2><small className="muted">${need.stats ? 'This template uses ' + need.stats : 'Optional'}</small></div>
          <p className="small muted">Filled in exactly as recorded, with their verification level. Only independently verified figures are presented as verified.</p>
          <div className="mt-picklist">${statOpts.map(o => { const on = statKeys.includes(o.key); const info = statInfo(o); return html`<div key=${o.key} className=${'mt-pickrow' + (on ? ' on' : '')} data-stat=${o.key}><label className="check"><input type="checkbox" checked=${on} onChange=${() => togg(statKeys, setStatKeys, o.key)} /><span><strong>${on ? '#' + (statKeys.indexOf(o.key) + 1) + ' ' : ''}${o.stat_value}${o.stat_unit === '%' ? '%' : o.stat_unit ? ' ' + o.stat_unit : ''} · ${o.title}</strong><small className="muted">${o.stat_source}${o.stat_period ? ' · ' + o.stat_period : ''}</small><span className="chips"><${Pill} tone=${info.ver.tone}>${info.ver.short}<//>${o.status !== 'approved' ? html`<${Pill} tone="warn">Not approved in Content Bank<//>` : null}</span></span></label></div>`; })}</div>
        </section>
        ${need.images || media.length ? html`<section className="card mt-panel"><div className="row-between"><h2>Images</h2><small className="muted">${need.images ? 'This template uses ' + need.images : 'Optional'}</small></div>
          ${media.length ? html`<div className="mt-mediagrid">${media.map(({c, use}) => { const on = imageIds.includes(c.id); return html`<label key=${c.id} className=${'mt-media' + (on ? ' on' : '') + (use.allowed ? '' : ' blocked')}><input type="checkbox" disabled=${!use.allowed} checked=${on} onChange=${() => togg(imageIds, setImageIds, c.id)} /><${Thumb} bucket="materials" path=${c.media_path} alt=${c.media_alt || c.title} fallback="image" /><span className="small">${on ? '#' + (imageIds.indexOf(c.id) + 1) + ' ' : ''}${c.title}</span>${use.allowed ? null : html`<small className="mt-block">${use.blocks.join(' · ')}</small>`}</label>`; })}</div>` : html`<p className="small muted">No approved images in the Content Bank yet.${need.images ? ' The template keeps its own image where none is selected.' : ''}</p>`}</section>` : null}
        <section className="card mt-panel"><h2>Approved messaging used</h2>
          ${messaging.length ? html`<ul className="mt-msglist small">${messaging.map(c => html`<li key=${c.id}><strong>${(MESSAGING_CATEGORIES.find(x => x.id === c.category) || {}).label}:</strong> ${c.title}</li>`)}</ul>` : html`<p className="small muted">No approved messaging in the Content Bank yet. AI-written introductions and calls to action will be left empty until an administrator adds the mission, organization description and audience messaging.</p>`}
          <${Field} label="Additional instructions (optional)"><textarea id="b-instr" className="textarea" rows="2" value=${instructions} onChange=${e => setInstructions(e.target.value)} placeholder="e.g. Focus on our mural program at Roosevelt. Keep it upbeat."></textarea><//>
        </section>
        ${(need.stories > pickedStories.length || need.stats > pickedStats.length || need.quotes > quotesN || need.images > pickedImages.length) ? html`<p className="notice small">This template has places for ${[need.stories > pickedStories.length ? need.stories + ' stor' + (need.stories === 1 ? 'y' : 'ies') : '', need.stats > pickedStats.length ? need.stats + ' statistic' + (need.stats === 1 ? '' : 's') : '', need.quotes > quotesN ? need.quotes + ' approved quotation' + (need.quotes === 1 ? '' : 's') : '', need.images > pickedImages.length ? need.images + ' image' + (need.images === 1 ? '' : 's') : ''].filter(Boolean).join(', ')}. Missing ones are flagged in review${fields.some(f => f.fallback === 'keep') ? ' (fields set to keep the template\'s text stay as designed)' : ''}.</p>` : null}
      </div>`;
    } else if (step === 5) {
      const n = aiFields(fields).length;
      body = html`<section className="card mt-panel mt-gen5"><h2><${Icon} name="spark" size=${22} /> Generate Draft Content</h2>
        <p className="muted">${n ? 'Claude writes ' + n + ' field' + (n === 1 ? '' : 's') + ' from the stories and messaging you selected. ' : ''}Statistics, quotations and Content Bank text are placed exactly as recorded. Nothing is final until you review it.</p>
        <p className="small muted">Only what is cleared for external use is sent to the AI: approved story text with names removed where permission isn't documented, approved quotes, statistics and approved messaging. No transcripts or private details.</p>
        ${busy === 'ai' ? html`<${Busy} text="Writing draft content…" />` : html`<div className="row-btns"><button className="btn btn-primary btn-lg" id="b-generate-content" onClick=${() => generateContent()}><${Icon} name="spark" size=${18} /> Generate Draft Content</button></div>`}
      </section>`;
    } else if (step === 6 || step === 7) {
      const refName = r => { const s = sel.stories.find(x => x.ref === r); if (s) return {icon: 'openbook', label: 'Story: ' + trunc(s.title, 32), status: 'External use approved'}; const t = sel.stats.find(x => x.ref === r); if (t) return {icon: 'bars', label: 'Statistic: ' + t.title, status: (VERIFICATION.find(v => v.id === t.verification) || {}).short || 'Unverified', tone: t.verification === 'independently_verified' ? 'good' : 'warn'}; const mm = sel.messaging.find(x => x.ref === r); if (mm) return {icon: 'layers', label: (MESSAGING_CATEGORIES.find(c => c.id === mm.category) || {}).label + ': ' + trunc(mm.title, 30), status: 'Approved'}; const im = sel.images.find(x => x.ref === r); if (im) return {icon: 'image', label: 'Image: ' + im.title, status: 'Approved'}; return null; };
      body = html`<section className="card mt-panel mt-review">
        <div className="row-between"><div><h2><${Icon} name="spark" size=${20} /> Generated Draft Content</h2><p className="small muted">Review and edit before creating your document. Sources are shown for every field.</p></div>
          ${aiFields(fields).length ? html`<button className="btn btn-ghost btn-sm mt-regen-all" disabled=${!!busy} onClick=${() => generateContent()}><${Icon} name="refresh" size=${16} /> Regenerate All</button>` : null}</div>
        ${problems.length ? html`<ul className="mt-problems small" id="b-problems">${problems.map((x, i) => html`<li key=${i} className=${x.level === 'error' ? 'bad' : 'warn'}><${Icon} name=${x.level === 'error' ? 'close' : 'flag'} size=${14} /> ${x.text}</li>`)}</ul>` : html`<p className="mt-allgood small"><${Icon} name="check" size=${16} /> Every field has content from approved sources.</p>`}
        ${genReport ? html`<ul className="mt-problems small">${genReport.filter(r => !r.ok).map(r => html`<li key=${r.id} className="bad">${(fields.find(f => f.id === r.id) || {}).label || r.id}: ${r.error}</li>`)}</ul>` : null}
        <div className="mt-frows">${fields.map(f => { const v = content[f.id] || {}; const refs = (v.sources || []).map(refName).filter(Boolean); const ai = (sourceById(f.source) || {}).ai; const fp = problems.filter(x => x.field === f.id);
          return html`<div className=${'mt-frow' + (fp.some(x => x.level === 'error') ? ' bad' : '')} key=${f.id} data-field=${f.id}>
            <div className="mt-flabel"><${Icon} name=${fieldIcon(f)} size=${20} /><span><strong>${f.label || f.id}</strong><small className="muted">${sourceLabel(f)}</small></span></div>
            ${f.type === 'image' ? html`<div className="mt-fimg">${v.image ? html`<${Thumb} bucket="materials" path=${v.image} alt=${v.alt || ''} fallback="image" />` : html`<span className="small muted">${f.fallback === 'keep' ? "The template's own image stays." : 'No image'}</span>`}</div>`
              : html`<div className="mt-ftext"><textarea className="textarea" rows=${f.type === 'paragraph' ? 4 : 2} value=${v.text || ''} disabled=${!!busy} aria-label=${f.label || f.id} onChange=${e => setContent(c => Object.assign({}, c, {[f.id]: Object.assign({}, c[f.id] || {}, {text: e.target.value, edited: true})}))}></textarea>
                <small className=${'muted mt-count' + (f.maxChars && (v.text || '').length > f.maxChars ? ' over' : '')}>${(v.text || '').length}${f.maxChars ? ' / ' + f.maxChars : ''} characters${v.edited ? ' · edited' : ''}</small>
                ${ai ? html`<button className="link-btn small" disabled=${!!busy} onClick=${() => generateContent(f.id)}>${busy === 'field:' + f.id ? 'Writing…' : html`<${Icon} name="refresh" size=${12} /> Regenerate this field`}</button>` : null}</div>`}
            <div className="mt-fsrc">${refs.length ? refs.map((r, i) => html`<div key=${i} className="small"><span><${Icon} name=${r.icon} size=${14} /> Source: ${r.label}</span><span className=${'mt-srcok tone-' + (r.tone || 'good')}><${Icon} name="check" size=${12} /> ${r.status}</span></div>`) : html`<div className="small muted">${v.origin === 'period' ? 'Reporting period' : v.origin === 'date' ? "Today's date" : v.origin === 'audience' ? 'Audience name' : v.origin === 'static' ? 'Fixed template text' : v.origin === 'manual' ? 'Typed by staff' : f.source === 'ai:title' && v.text ? 'Written from the audience and reporting period' : ai && v.text ? 'No source given: check this text' : ''}</div>`}</div>
          </div>`; })}</div>
        ${err ? html`<p className="error" role="alert">${err}</p>` : null}
        ${busy && busy !== 'ai' && !busy.startsWith('field:') ? html`<${Busy} text=${busy === 'doc' ? 'Generating the document…' : busy} />` : null}
        <div className="row-btns end mt-reviewbtns">
          <button className="btn btn-ghost" id="b-save-draft" disabled=${!!busy} onClick=${() => saveDraft().catch(e => showToast(e.message))}><${Icon} name="save" size=${16} /> Save Draft</button>
          ${version && version.source_type !== 'canva' ? html`<button className="btn btn-ghost btn-purple-ghost" id="b-preview" disabled=${!!busy} onClick=${() => openSheet(close => html`<${PreviewSheet} close=${close} version=${version} content=${content} />`)}><${Icon} name="eye" size=${16} /> Preview</button>` : null}
          <button className="btn btn-primary" id="b-generate-doc" disabled=${!!busy || errorsN > 0} title=${errorsN ? 'Fix the problems listed above first' : ''} onClick=${generateDocument}><${Icon} name="spark" size=${16} /> Generate Document <${Icon} name="chev" size=${16} /></button>
        </div>
      </section>`;
    }
    const stepper = html`<ol className="mt-stepper" aria-label="Steps">${STEPS.slice(0, 6).map((s, i) => { const n = i + 1; const done = step > n; const cur = step === n || (n === 6 && step === 7); return html`<li key=${n} className=${(done ? 'done' : '') + (cur ? ' cur' : '')}><span className="mt-sn">${done ? html`<${Icon} name="check" size=${16} />` : n}</span><span className="mt-sl">${s}</span></li>`; })}</ol>`;
    return html`<div className="mt-builder">
      ${stepper}
      <div className=${'mt-bgrid' + (step > 1 ? '' : ' one')}>${selections}<div className="mt-bmain">${body}
        ${err && step < 6 ? html`<p className="error" role="alert">${err}</p>` : null}
        ${step < 5 ? html`<div className="row-btns end">${step > 1 ? html`<button className="btn btn-ghost" onClick=${() => go(step - 1)}><${Icon} name="back" size=${16} /> Back</button>` : null}${step === 4 && version ? html`<button className="btn btn-ghost" disabled=${!!busy} onClick=${() => saveDraft().catch(e => showToast(e.message))}>Save Draft</button>` : null}<button className="btn btn-primary" id="b-next" disabled=${!canNext} onClick=${() => go(step + 1)}>Continue <${Icon} name="chev" size=${16} /></button></div>` : step === 5 ? html`<div className="row-btns"><button className="btn btn-ghost" onClick=${() => go(4)}><${Icon} name="back" size=${16} /> Back to content</button></div>` : html`<div className="row-btns"><button className="btn btn-quiet btn-sm" onClick=${() => { setSnap(null); go(4); }}><${Icon} name="back" size=${16} /> Change stories, statistics or images</button></div>`}
      </div></div>
    </div>`;
  }
  function PreviewSheet({close, version, content}){
    const mat = useMat();
    const [r, setR] = useState(null); const [err, setErr] = useState('');
    useEffect(() => { renderFile(mat.api, version, content).then(setR, e => setErr(e.message || 'Preview failed.')); }, []);
    return html`<div className="view mt-prevsheet" style=${{gap: '12px'}}><${SheetHead} title="Preview" close=${close} />
      ${err ? html`<p className="error">${err}</p>` : !r ? html`<${Busy} text="Filling the template…" />` : html`
        ${r.report.some(x => !x.ok) ? html`<ul className="mt-problems small">${r.report.filter(x => !x.ok).map(x => html`<li key=${x.id} className="bad">${((version.fields || []).find(f => f.id === x.id) || {}).label || x.id}: ${x.error}</li>`)}</ul>` : html`<p className="small muted">Preview only: nothing is saved until you generate the document.</p>`}
        <${DocPreview} kind=${r.ext} bytes=${r.bytes} values=${r.values} fields=${version.fields} />`}</div>`;
  }
  function UsesSheet({close, story}){
    const {caps, safeWrite, showToast} = useApp();
    const cur = (story.materialsUse && story.materialsUse.channels) || [];
    const [ch, setCh] = useState(cur.length ? cur : []);
    const [ok, setOk] = useState(false);
    const p = story.privacy || {};
    return html`<div className="view" style=${{gap: '12px'}}><${SheetHead} title="Permitted uses in Impact Materials" close=${close} />
      <p className="small"><strong>${story.title || 'Untitled story'}</strong></p>
      <p className="small muted">Record where ABG has permission to use this story outside ABG. ${p.minor === 'yes' ? 'It involves a minor: only record uses the guardian agreed to.' : ''}</p>
      ${CHANNELS.map(c => html`<label key=${c.id} className="check"><input type="checkbox" checked=${ch.includes(c.id)} onChange=${e => setCh(e.target.checked ? ch.concat([c.id]) : ch.filter(x => x !== c.id))} /> <span><strong>${c.label}</strong> <small className="muted">${c.hint}</small></span></label>`)}
      <label className="check small"><input type="checkbox" id="uses-confirm" checked=${ok} onChange=${e => setOk(e.target.checked)} /> Permission for these uses is documented (consent form, email or recorded agreement).</label>
      <div className="row-btns end"><button className="btn btn-ghost" onClick=${close}>Cancel</button><button className="btn btn-primary" id="uses-save" disabled=${!ok} onClick=${async () => { const done = await safeWrite(() => caps.db.collection('stories').doc(story.id).update({materialsUse: {channels: ch, recordedBy: (caps.me || {}).name || '', recordedAt: new Date().toISOString()}})); if (done) { showToast('Permitted uses recorded.'); close(); } }}>Save</button></div></div>`;
  }

  /* ---------- a material's page ---------- */
  function MaterialView({id}){
    const app = useApp(); const {nav, isAdmin, openSheet, showToast} = app;
    const mat = useMat(); const m = mat.model;
    const x = (mat.materials || []).find(y => y.id === id);
    const [bytes, setBytes] = useState(null); const [kind, setKind] = useState('');
    const [acts, setActs] = useState([]);
    useEffect(() => { if (!x) return; const f = ((x.output || {}).files || [])[0]; setBytes(null); if (f) materialBytes(mat.api, f.path).then(b => { setBytes(b); setKind(f.kind); }, () => {}); mat.api.activityFor(x.id).then(setActs, () => {}); }, [x && x.id, x && x.updated_at]);
    const a = useMaterialActions(x || {output: {}});
    if (!x) return html`<div className="view"><${Back} to="materials" label="Materials Library" />${mat.state === 'ready' ? html`<p className="notice">That material was not found.</p>` : html`<div className="skeleton mt-skel"></div>`}</div>`;
    const v = m.ver.get(x.template_version_id); const fam = v ? m.fam.get(v.family_id) : null; const t = m.typ.get(x.material_type_id);
    const def = t ? m.defaultVersion(t) : null;
    const newer = def && v && def.id !== v.id;
    const generated = ((x.output || {}).files || []).length > 0 || (x.output || {}).canva;
    const sources = x.sources || {stories: [], stats: [], messaging: [], images: []};
    const problems = v ? checkContent(v.fields || [], x.content || {}, sources) : [];
    const approve = () => openSheet(close => html`<${ConfirmSheet} close=${close} title="Approve for external use?" body=${'Approving preserves "' + x.title + '" exactly as it is. It can be downloaded and shared, and can no longer be edited (duplicate it to make changes).' + (problems.some(p => p.level === 'warning') ? ' Check the notes listed on this page first.' : '')} confirmLabel="Approve" onConfirm=${() => a.setStatus('approved', 'Approved for external use.')} />`);
    const del = () => openSheet(close => html`<${ConfirmSheet} close=${close} title="Delete this draft?" body="The draft and its generated files are removed from the library. This can't be undone." confirmLabel="Delete draft" onConfirm=${async () => { try { await mat.api.remove('mat_materials', x.id); await mat.reload(); showToast('Draft deleted.'); nav('materials'); } catch (e) { showToast(e.message); } }} />`);
    const ACT = {created: 'created this material', generated: 'generated the document', edited: 'edited the content', submitted: 'sent it for review', approved: 'approved it for external use', returned: 'returned it to draft', archived: 'archived it', exported: 'downloaded it', regenerated: 'regenerated it from another material', duplicated: 'duplicated it from another material'};
    return html`<div className="view mt-material">
      <${Back} to="materials" label="Materials Library" />
      <header className="mt-mhead"><div><p className="eyebrow mt-eyebrow">${m.audPath(x.audience_id)} › ${t ? t.name : ''}</p><h1>${x.title}</h1>
        <p className="small muted">${v ? m.versionLabel(v) : 'Template'} · <${SourceBadge} type=${v ? v.source_type : ''} /> · Created ${fmtDate(x.created_at)} by ${who(x.created_by)}${x.approved_at ? ' · Approved ' + fmtDate(x.approved_at) + ' by ' + who(x.approved_by) : ''}</p></div><${MatStatus} status=${x.status} /></header>
      ${x.status === 'approved' ? html`<p className="notice small"><${Icon} name="lock" size=${14} /> Approved and preserved as it is. It keeps template ${v ? m.versionLabel(v) : ''} even if the template is updated. Duplicate or regenerate it to make a changed version.</p>` : null}
      ${newer && x.status !== 'archived' ? html`<p className="notice small">A newer default template is available (${m.versionLabel(def)}). This material keeps ${v ? m.versionLabel(v) : 'its template'}; use Regenerate to make a copy with the new design.</p>` : null}
      <div className="mt-actions mt-mactions">
        ${!a.locked && a.mine ? html`<button className="btn btn-ghost btn-sm" id="m-edit" onClick=${a.edit}><${Icon} name="edit" size=${16} /> Edit content</button>` : null}
        <button className="btn btn-ghost btn-sm" id="m-download" disabled=${!a.files.length} onClick=${a.dl}><${Icon} name="download" size=${16} /> Download</button>
        ${(x.output || {}).canva ? html`<a className="btn btn-ghost btn-sm" href=${x.output.canva.editUrl || ('https://www.canva.com/design/' + x.output.canva.id + '/edit')} target="_blank" rel="noopener"><span className="mt-canva-dot">C</span> Open in Canva</a>` : null}
        <button className="btn btn-ghost btn-sm" id="m-duplicate" onClick=${a.duplicate}><${Icon} name="copy" size=${16} /> Duplicate</button>
        <button className="btn btn-ghost btn-sm" id="m-regenerate" onClick=${a.regenerate}><${Icon} name="refresh" size=${16} /> Regenerate</button>
        ${isAdmin ? html`<button className="btn btn-ghost btn-sm" id="m-update-template" onClick=${a.updateTemplate} title="Change the reusable design for this template (not just this document)"><${Icon} name="layers" size=${16} /> Update Template</button>` : null}
        ${x.status === 'draft' && a.mine ? html`<button className="btn btn-purple btn-sm" id="m-submit" disabled=${!generated} onClick=${() => a.setStatus('in_review', 'Sent for review.')}>Send for review</button>` : null}
        ${isAdmin && (x.status === 'draft' || x.status === 'in_review') ? html`<button className="btn btn-primary btn-sm" id="m-approve" disabled=${!generated || problems.some(p => p.level === 'error')} onClick=${approve}><${Icon} name="check" size=${16} /> Approve</button>` : null}
        ${x.status === 'in_review' && a.mine ? html`<button className="btn btn-quiet btn-sm" onClick=${() => a.setStatus('draft', 'Returned to draft.')}>Return to draft</button>` : null}
        ${isAdmin && x.status !== 'archived' && x.status !== 'draft' ? html`<button className="btn btn-quiet btn-sm" id="m-archive" onClick=${() => a.setStatus('archived', 'Archived.')}><${Icon} name="archive" size=${16} /> Archive</button>` : null}
        ${isAdmin && x.status === 'draft' ? html`<button className="btn btn-quiet btn-sm danger" onClick=${del}>Delete draft</button>` : null}
      </div>
      <p className="small muted mt-twoacts"><strong>Edit content</strong> changes only this document. <strong>Update Template</strong> changes the reusable design for future ${t ? t.name : ''} documents; documents already made keep their design.</p>
      <div className="mt-mgrid">
        <section className="card mt-panel" aria-label="Preview"><h2>Preview</h2>
          ${!generated ? html`<div className="empty"><p className="muted">The document hasn't been generated yet.</p>${!a.locked && a.mine ? html`<button className="btn btn-primary" onClick=${a.edit}>Review content and generate</button>` : null}</div>`
            : bytes ? html`<${DocPreview} kind=${kind} bytes=${bytes} />` : html`<div className="skeleton mt-skel"></div>`}
        </section>
        <aside className="mt-mside">
          ${problems.length ? html`<section className="card mt-panel"><h2>Checks</h2><ul className="mt-problems small">${problems.map((p, i) => html`<li key=${i} className=${p.level === 'error' ? 'bad' : 'warn'}>${p.text}</li>`)}</ul></section>` : null}
          <section className="card mt-panel"><h2>Content and sources</h2>
            <dl className="mt-dl small">${(v ? v.fields : []).map(f => { const c = (x.content || {})[f.id] || {}; return html`<div key=${f.id}><dt>${f.label || f.id}</dt><dd>${f.type === 'image' ? (c.image ? 'Approved image' : "Template's own image") : (c.text || html`<em className="muted">empty</em>`)}${(c.sources || []).length ? html`<small className="muted"> [${c.sources.join(', ')}]</small>` : null}</dd></div>`; })}</dl>
            <details className="small"><summary>Sources used</summary><ul>
              ${(sources.stories || []).map(s => html`<li key=${s.ref}>${s.ref}: story "${s.title}" (${s.name ? 'named as ' + s.name : 'not named'})</li>`)}
              ${(sources.stats || []).map(s => html`<li key=${s.ref}>${s.ref}: ${statText(s, 'full')} (${(VERIFICATION.find(z => z.id === s.verification) || {}).label || 'verification not stated'}; ${s.source})</li>`)}
              ${(sources.messaging || []).map(s => html`<li key=${s.ref}>${s.ref}: ${(MESSAGING_CATEGORIES.find(z => z.id === s.category) || {}).label} "${s.title}"</li>`)}
              ${(sources.images || []).map(s => html`<li key=${s.ref}>${s.ref}: image "${s.title}"</li>`)}
              ${sources.period ? html`<li>Reporting period: ${sources.period}</li>` : null}</ul></details>
          </section>
          <section className="card mt-panel"><h2>History</h2><ul className="mt-hist small">${acts.map(e => html`<li key=${e.id}><strong>${who(e.actor)}</strong> ${ACT[e.action] || e.action} <span className="muted">· ${when(e.at)}</span></li>`)}${!acts.length ? html`<li className="muted">No history yet.</li>` : null}</ul></section>
        </aside>
      </div>
    </div>`;
  }

  /* ---------- Content Bank ---------- */
  function ContentBankView({params}){
    const {isAdmin, openSheet, showToast, stories} = useApp();
    const mat = useMat();
    const [tab, setTab] = useState((params || {}).tab || 'messaging');
    const items = (mat.content || []);
    const edit = (kind, row) => openSheet(close => html`<${ContentSheet} close=${close} kind=${kind} row=${row} />`);
    const list = k => items.filter(c => c.kind === k).sort((a, b) => (a.status === 'archived') - (b.status === 'archived') || String(a.category || '').localeCompare(String(b.category || '')));
    const statusPill = c => html`<${Pill} tone=${c.status === 'approved' ? 'good' : c.status === 'pending' ? 'warn' : 'outline'}>${c.status === 'approved' ? 'Approved' : c.status === 'pending' ? 'Awaiting approval' : 'Archived'}<//>`;
    const usable = stories.filter(s => !s.demo);
    if (mat.state === 'missing') return html`<div className="view"><header className="page-head"><h1>Content Bank</h1></header><${SetupNotice} /></div>`;
    return html`<div className="view mt-bank">
      <header className="page-head"><p className="eyebrow mt-eyebrow">Settings</p><h1>Content Bank</h1><p className="muted">Approved content the Material Builder draws from, so nobody types it again. ${isAdmin ? '' : 'Only administrators can change it.'}</p></header>
      <${PageTabs} label="Content Bank" value=${tab} onChange=${setTab} tabs=${[{id: 'messaging', label: 'Core Messaging'}, {id: 'statistic', label: 'Verified Statistics'}, {id: 'stories', label: 'Approved Stories'}, {id: 'media', label: 'Approved Media'}]} />
      ${tab === 'stories' ? html`<section className="card mt-panel"><h2>Approved stories</h2>
        <p className="small muted">Stories stay in the Story Library; this shows whether each one may appear in external materials. "Approved for external use" (in the story) and the permitted uses recorded here must both be in place. Community approvals count for internal reporting only, until the contributor's sharing choice is confirmed.</p>
        <div className="mt-storytable">${usable.map(s => { const uses = CHANNELS.map(c => ({c, u: storyUse(h, s, c.id)})); const any = uses.some(x => x.u.allowed); return html`<div className="mt-storyrow" key=${s.id}><span><strong>${s.title || 'Untitled story'}</strong><small className="muted">${[s.program, s.status === 'approved' ? 'Approved for external use' : 'Not approved for external use', (s.quotes || []).filter(q => q.approved).length + ' approved quotes'].filter(Boolean).join(' · ')}</small>
          ${any ? html`<span className="chips">${uses.filter(x => x.u.allowed).map(x => html`<${Pill} key=${x.c.id} tone="good">${x.c.label}<//>`)}</span>` : html`<small className="mt-block">${uses[0].u.blocks.join(' · ')}</small>`}</span>
          ${isAdmin && !s.demo && s.status === 'approved' ? html`<button className="btn btn-quiet btn-sm" onClick=${() => openSheet(close => html`<${UsesSheet} close=${close} story=${s} />`)}>Permitted uses</button>` : null}</div>`; })}${!usable.length ? html`<p className="small muted">No stories yet.</p>` : null}</div></section>`
      : html`<section className="card mt-panel">
        <div className="row-between"><h2>${tab === 'messaging' ? 'Core messaging' : tab === 'statistic' ? 'Verified statistics' : 'Approved media'}</h2>${isAdmin ? html`<button className="btn btn-primary btn-sm" id="cb-add" onClick=${() => edit(tab)}><${Icon} name="plus" size=${16} /> Add</button>` : null}</div>
        <p className="small muted">${tab === 'messaging' ? 'Mission, organization description, program descriptions, audience messaging and calls to action. Used word for word, or as the only basis for AI-written introductions and calls to action.' : tab === 'statistic' ? 'Each figure keeps its source, reporting period and verification level: self-reported, staff-observed or independently verified. Only approved statistics are presented without a warning.' : 'Photos, artwork and graphics with their usage permissions. Images of identifiable people need documented consent.'}</p>
        <div className="mt-banklist">${list(tab).map(c => html`<div key=${c.id} className=${'mt-bankrow' + (c.status === 'archived' ? ' off' : '')} data-id=${c.id}>
          ${tab === 'media' ? html`<${Thumb} bucket="materials" path=${c.media_path} alt=${c.media_alt || ''} fallback="image" />` : null}
          <span className="mt-bankmain"><strong>${tab === 'statistic' ? c.stat_value + (c.stat_unit === '%' ? '%' : c.stat_unit ? ' ' + c.stat_unit : '') + ' · ' : ''}${c.title}</strong>
            <small className="muted">${tab === 'messaging' ? (MESSAGING_CATEGORIES.find(x => x.id === c.category) || {}).label + (c.program ? ' · ' + c.program : '') + ((c.audience_ids || []).length ? ' · ' + c.audience_ids.map(id => (mat.model.aud.get(id) || {}).name).filter(Boolean).join(', ') : ' · All audiences') : tab === 'statistic' ? c.stat_source + (c.stat_period ? ' · ' + c.stat_period : '') : (c.permitted_uses || []).map(u => (CHANNELS.find(x => x.id === u) || {}).label).join(', ') || 'No uses recorded'}</small>
            ${tab === 'messaging' ? html`<span className="small clamp">${c.body}</span>` : tab === 'statistic' ? html`<${Pill} tone=${(VERIFICATION.find(v => v.id === c.verification) || {}).tone || 'neutral'}>${(VERIFICATION.find(v => v.id === c.verification) || {}).label}<//>` : (() => { const u = mediaUse(c, 'print'); return c.identifiable ? html`<small className=${c.consent === 'documented' ? 'muted' : 'mt-block'}>${c.consent === 'documented' ? 'Identifiable people · consent documented' : 'Identifiable people · consent missing'}</small>` : null; })()}</span>
          ${statusPill(c)}${isAdmin ? html`<button className="btn btn-quiet btn-sm" onClick=${() => edit(tab, c)}>Edit</button>` : null}
        </div>`)}${!list(tab).length ? html`<p className="small muted">Nothing here yet.</p>` : null}</div></section>`}
    </div>`;
  }
  function ContentSheet({close, kind, row}){
    const {showToast, settings} = useApp();
    const mat = useMat(); const m = mat.model;
    const r = row || {};
    const [f, setF] = useState({category: r.category || (kind === 'messaging' ? 'mission' : null), title: r.title || '', body: r.body || '', program: r.program || '', audience_ids: r.audience_ids || [], stat_value: r.stat_value || '', stat_unit: r.stat_unit || '', stat_source: r.stat_source || '', stat_period: r.stat_period || '', verification: r.verification || '', media_alt: r.media_alt || '', identifiable: r.identifiable == null ? null : r.identifiable, minors: !!r.minors, consent: r.consent || '', permitted_uses: r.permitted_uses || [], status: r.status || 'approved'});
    const [file, setFile] = useState(null); const [busy, setBusy] = useState(false);
    const set = (k, v) => setF(x => Object.assign({}, x, {[k]: v}));
    const progs = (settings.programs || []).map(x => typeof x === 'string' ? x : x.name).filter(Boolean);
    const valid = asStr(f.title) && (kind !== 'messaging' || asStr(f.body)) && (kind !== 'statistic' || (asStr(f.stat_value) && asStr(f.stat_source) && f.verification)) && (kind !== 'media' || ((file || r.media_path) && f.identifiable != null && (!f.identifiable || f.consent)));
    async function save(){
      setBusy(true);
      try {
        const id = r.id || uuid();
        let media_path = r.media_path || null;
        if (kind === 'media' && file) { const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace('jpeg', 'jpg'); if (!/^(png|jpg|webp)$/.test(ext)) throw {message: 'Use a PNG, JPEG or WebP image.'}; if (file.size > 15 * 1024 * 1024) throw {message: 'Images must be smaller than 15 MB.'}; media_path = 'media/' + id + '-' + Date.now() + '.' + ext; await mat.api.uploadMaterialFile(media_path, new Uint8Array(await file.arrayBuffer()), ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'); }
        const out = {id, kind, title: asStr(f.title), status: f.status, updated_by: String((window.__platform && window.__platform.email) || '').toLowerCase(), updated_at: new Date().toISOString()};
        if (kind === 'messaging') Object.assign(out, {category: f.category, body: asStr(f.body), program: f.category === 'program' ? asStr(f.program) || null : null, audience_ids: f.category === 'audience' || f.category === 'cta' ? f.audience_ids : []});
        if (kind === 'statistic') Object.assign(out, {body: asStr(f.body) || asStr(f.title).toLowerCase(), stat_value: asStr(f.stat_value), stat_unit: asStr(f.stat_unit) || null, stat_source: asStr(f.stat_source), stat_period: asStr(f.stat_period) || null, verification: f.verification, program: asStr(f.program) || null});
        if (kind === 'media') Object.assign(out, {media_path, media_alt: asStr(f.media_alt) || null, identifiable: f.identifiable, minors: f.identifiable ? !!f.minors : false, consent: f.identifiable ? f.consent : 'not_needed', permitted_uses: f.permitted_uses});
        await mat.api.save('mat_content', out); await mat.reload(); showToast('Saved.'); close();
      } catch (e) { showToast(e.message || "Couldn't save."); }
      setBusy(false);
    }
    return html`<div className="view" style=${{gap: '12px'}}><${SheetHead} title=${(row ? 'Edit ' : 'Add ') + (kind === 'messaging' ? 'messaging' : kind === 'statistic' ? 'statistic' : 'image')} close=${close} />
      ${kind === 'messaging' ? html`<${Field} label="Kind"><select id="cb-cat" className="select" value=${f.category} onChange=${e => set('category', e.target.value)}>${MESSAGING_CATEGORIES.map(c => html`<option key=${c.id} value=${c.id}>${c.label}</option>`)}</select><//>` : null}
      <${Field} label=${kind === 'statistic' ? 'Statistic name' : 'Title'}><input id="cb-title" className="input" value=${f.title} onChange=${e => set('title', e.target.value)} placeholder=${kind === 'statistic' ? 'e.g. Students served' : kind === 'media' ? 'e.g. Roosevelt mural, spring 2026' : 'e.g. ABG mission statement'} /><//>
      ${kind === 'messaging' ? html`<${Field} label="Approved text"><textarea id="cb-body" className="textarea" rows="5" value=${f.body} onChange=${e => set('body', e.target.value)}></textarea><//>
        ${f.category === 'program' ? html`<${Field} label="Program"><input className="input" list="dl-progs" value=${f.program} onChange=${e => set('program', e.target.value)} /><datalist id="dl-progs">${progs.map(p => html`<option key=${p} value=${p}></option>`)}</datalist><//>` : null}
        ${f.category === 'audience' || f.category === 'cta' ? html`<div className="field"><span className="field-label">For audiences (none = all)</span><div className="chips">${m.audiences.filter(a => a.active).map(a => html`<button type="button" key=${a.id} className=${'chip' + (f.audience_ids.includes(a.id) ? ' on' : '')} onClick=${() => set('audience_ids', f.audience_ids.includes(a.id) ? f.audience_ids.filter(x => x !== a.id) : f.audience_ids.concat([a.id]))}>${a.name}</button>`)}</div></div>` : null}` : null}
      ${kind === 'statistic' ? html`<div className="row"><${Field} label="Value"><input id="cb-value" className="input" value=${f.stat_value} onChange=${e => set('stat_value', e.target.value)} placeholder="128" /><//><${Field} label="Unit (optional)"><input className="input" value=${f.stat_unit} onChange=${e => set('stat_unit', e.target.value)} placeholder="students, %, murals" /><//></div>
        <${Field} label="Label used in documents"><input className="input" value=${f.body} onChange=${e => set('body', e.target.value)} placeholder="e.g. students engaged" /><//>
        <div className="row"><${Field} label="Source (required)"><input id="cb-source" className="input" value=${f.stat_source} onChange=${e => set('stat_source', e.target.value)} placeholder="e.g. 2025–26 attendance records" /><//><${Field} label="Reporting period"><input className="input" value=${f.stat_period} onChange=${e => set('stat_period', e.target.value)} placeholder="e.g. 2025–26 school year" /><//></div>
        <${Field} label="Verification"><select id="cb-ver" className="select" value=${f.verification} onChange=${e => set('verification', e.target.value)}><option value="">Choose…</option>${VERIFICATION.filter(v => ['independently_verified', 'staff_observed', 'self_reported'].includes(v.id)).map(v => html`<option key=${v.id} value=${v.id}>${v.label}</option>`)}</select><//>` : null}
      ${kind === 'media' ? html`<label className="mt-drop"><input type="file" id="cb-file" accept="image/png,image/jpeg,image/webp" onChange=${e => setFile(e.target.files && e.target.files[0])} /><${Icon} name="image" size=${24} /><span><strong>${file ? file.name : r.media_path ? 'Replace image' : 'Choose an image'}</strong><small className="muted">PNG, JPEG or WebP, up to 15 MB</small></span></label>
        <${Field} label="Description (alt text)"><input className="input" value=${f.media_alt} onChange=${e => set('media_alt', e.target.value)} /><//>
        <div className="field"><span className="field-label">Can people in it be identified?</span><div className="chips"><button type="button" id="cb-ident-yes" className=${'chip' + (f.identifiable === true ? ' on' : '')} onClick=${() => set('identifiable', true)}>Yes</button><button type="button" id="cb-ident-no" className=${'chip' + (f.identifiable === false ? ' on' : '')} onClick=${() => set('identifiable', false)}>No (artwork, hands, backs, places)</button></div></div>
        ${f.identifiable ? html`<label className="check"><input type="checkbox" checked=${f.minors} onChange=${e => set('minors', e.target.checked)} /> Shows a minor</label>
          <${Field} label="Consent"><select id="cb-consent" className="select" value=${f.consent} onChange=${e => set('consent', e.target.value)}><option value="">Choose…</option><option value="documented">Documented (photo release on file${f.minors ? ', signed by a guardian' : ''})</option><option value="missing">Not documented</option></select><//>` : null}
        <div className="field"><span className="field-label">Permitted uses</span>${CHANNELS.map(c => html`<label key=${c.id} className="check small"><input type="checkbox" checked=${f.permitted_uses.includes(c.id)} onChange=${e => set('permitted_uses', e.target.checked ? f.permitted_uses.concat([c.id]) : f.permitted_uses.filter(x => x !== c.id))} /> ${c.label}</label>`)}</div>` : null}
      <${Field} label="Status"><select id="cb-status" className="select" value=${f.status} onChange=${e => set('status', e.target.value)}><option value="approved">Approved</option><option value="pending">Awaiting approval</option><option value="archived">Archived</option></select><//>
      <div className="row-btns end"><button className="btn btn-ghost" onClick=${close}>Cancel</button><button className="btn btn-primary" id="cb-save" disabled=${!valid || busy} onClick=${save}>${busy ? 'Saving…' : 'Save'}</button></div></div>`;
  }

  /* ---------- Canva integration (Settings) ---------- */
  function CanvaView(){
    const {isAdmin, showToast} = useApp();
    const mat = useMat();
    const [st, setSt] = useState(null); const [busy, setBusy] = useState('');
    const load = () => mat.api.canva('status').then(setSt, e => setSt({error: e.message, code: e.code}));
    useEffect(() => { if (mat.api) load(); }, []);
    const connect = async () => { setBusy('connect'); try { const r = await mat.api.canva('connect'); window.location.assign(r.url); } catch (e) { showToast(e.message); setBusy(''); } };
    const disconnect = async () => { setBusy('disconnect'); try { await mat.api.canva('disconnect'); await load(); showToast('Canva disconnected.'); } catch (e) { showToast(e.message); } setBusy(''); };
    return html`<div className="view mt-canvaview">
      <header className="page-head"><p className="eyebrow mt-eyebrow">Settings</p><h1>Canva integration</h1><p className="muted">Connect ABG's Canva account so editable Canva designs can be used as templates. Uploading PDF or PowerPoint templates works without it.</p></header>
      <section className="card mt-panel">
        <h2><span className="mt-canva-dot big">C</span> Connection</h2>
        ${!st ? html`<p className="small muted">Checking…</p>` : st.error ? html`<p className="notice small">${st.error}</p>`
          : !st.configured ? html`<p className="notice small">Canva isn't set up on the server yet. Follow the steps below once, then connect.</p>`
          : st.connected ? html`<p className="mt-ok"><${Icon} name="check" size=${18} /> Connected by ${who(st.connectedBy)} on ${fmtDate(st.connectedAt)}.</p>`
          : html`<p className="small">Not connected.</p>`}
        ${isAdmin && st && st.configured ? html`<div className="row-btns">${st.connected ? html`<button className="btn btn-ghost" onClick=${connect} disabled=${!!busy}>Reconnect</button><button className="btn btn-quiet danger" id="canva-disconnect" onClick=${disconnect} disabled=${!!busy}>Disconnect</button>` : html`<button className="btn btn-primary" id="canva-connect" onClick=${connect} disabled=${!!busy}>${busy === 'connect' ? 'Opening Canva…' : 'Connect Canva'}</button>`}</div>` : null}
        ${!isAdmin ? html`<p className="small muted">Only administrators can connect or disconnect Canva.</p>` : null}
      </section>
      <section className="card mt-panel"><h2>How it works</h2><ul className="small">
        <li>An administrator signs in to Canva once, here. Staff never need a Canva account: generating a material uses the connection on the server.</li>
        <li>For each document, Canva makes a <strong>new copy</strong> of the master design and fills its data fields. The master design is never changed.</li>
        <li>Only elements connected to <strong>data fields</strong> in Canva can change (in Canva: Apps › Bulk Create or Data autofill, then connect text and images to fields).</li>
        <li>Canva requires the connected account to be on <strong>Canva Pro, Teams, Enterprise or Canva for Nonprofits</strong> (free for eligible nonprofits), with two-step sign-in turned on.</li>
        <li>Every generated design is also exported to PDF and saved with the material.</li></ul></section>
      ${isAdmin ? html`<section className="card mt-panel"><h2>One-time setup</h2><ol className="small mt-setup">
        <li>Go to <a href="https://www.canva.com/developers/integrations/connect-api" target="_blank" rel="noopener">canva.com/developers</a> and create an integration (Canva's REST API).</li>
        <li>Under <strong>Scopes</strong>, turn on: design content (read and write), design metadata (read), assets (read and write)<code className="mt-code">${(st && st.scopes) || 'design:content:read design:content:write design:meta:read asset:read asset:write'}</code></li>
        <li>Under <strong>Authentication</strong>, add this redirect URL:<code className="mt-code" id="canva-redirect">${(st && st.redirectUri) || '<your Supabase project URL>/functions/v1/canva/callback'}</code></li>
        <li>In Supabase, add Edge Function secrets <code>CANVA_CLIENT_ID</code>, <code>CANVA_CLIENT_SECRET</code>, <code>CANVA_TOKEN_KEY</code> (any long random text) and <code>SITE_URL</code>, then deploy the <code>canva</code> function with "Verify JWT" off (see the README).</li>
        <li>Come back here and press <strong>Connect Canva</strong>.</li></ol></section>` : null}
    </div>`;
  }

  /* ---------- Home: attention items and recent activity from real data ---------- */
  function homeSignals(app){
    const {mat, subs, stories, caps} = app;
    const me = String((window.__platform && window.__platform.email) || (caps.me || {}).email || '').toLowerCase();
    const real = (stories || []).filter(s => !s.demo);
    const mats = mat.materials || [];
    const items = [];
    const pendingSubs = (subs || []).filter(x => !x.is_test && (x.status === 'pending_review' || x.status === 'removal_requested')).length;
    const awaiting = real.filter(s => s.status === 'draft' || s.status === 'needs_verification').length;
    const consent = real.filter(s => s.status === 'approved' && ((s.privacy || {}).minor === 'yes' && (s.privacy || {}).permission !== 'yes' || !(s.materialsUse && Array.isArray(s.materialsUse.channels)))).length;
    const review = mats.filter(x => x.status === 'in_review').length;
    const myDrafts = mats.filter(x => x.status === 'draft' && x.created_by === me).length;
    const ivDrafts = h.interviewDrafts ? h.interviewDrafts() : 0;
    if (pendingSubs) items.push({id: 'subs', icon: 'inbox', tone: 'purple', text: 'Community stories awaiting review', n: pendingSubs, to: ['submissions', {}]});
    if (awaiting) items.push({id: 'approvals', icon: 'openbook', tone: 'teal', text: 'Stories awaiting approval for external use', n: awaiting, to: ['library', {}]});
    if (consent) items.push({id: 'consent', icon: 'shield', tone: 'orange', text: 'Approved stories missing consent for external materials', n: consent, to: ['content-bank', {tab: 'stories'}]});
    if (review) items.push({id: 'review', icon: 'doc', tone: 'purple', text: 'Materials awaiting review', n: review, to: ['materials', {}]});
    if (myDrafts) items.push({id: 'mdrafts', icon: 'edit', tone: 'teal', text: 'Your incomplete material drafts', n: myDrafts, to: ['materials', {}]});
    if (ivDrafts) items.push({id: 'idrafts', icon: 'mic', tone: 'orange', text: 'Unfinished story interviews on this device', n: ivDrafts, to: ['interview', {}]});
    const acts = [];
    (stories || []).forEach(s => { if (s.createdAt) acts.push({at: s.createdAt, icon: 'openbook', title: s.title || 'Untitled story', sub: h.isCommunity(s) ? 'Community story approved' : 'Story captured', pill: s.demo ? ['Demo', 'demo'] : s.status === 'approved' ? ['Approved', 'good'] : null, to: ['story', {id: s.id}]}); });
    (subs || []).filter(x => !x.is_test && x.submitted_at).forEach(x => acts.push({at: x.submitted_at, icon: 'users', title: 'Community submission' + (x.analysis && x.analysis.title ? ': ' + x.analysis.title : ''), sub: 'Submission received', pill: x.status === 'pending_review' ? ['Needs review', 'warn'] : x.status === 'approved' ? ['Approved', 'good'] : null, to: ['submission', {id: x.id}]}));
    (mat.activity || []).filter(e => e.material_id && ['created', 'generated', 'edited', 'approved', 'regenerated', 'duplicated'].includes(e.action)).forEach(e => { const x = mats.find(y => y.id === e.material_id); if (x) acts.push({at: e.at, icon: 'doc', title: x.title, sub: ({created: 'Material created', generated: 'Document generated', edited: 'Material edited', approved: 'Material approved', regenerated: 'Material regenerated', duplicated: 'Material duplicated'})[e.action] + (e.actor === me ? ' by you' : ' by ' + who(e.actor)), pill: e.action === 'approved' ? ['Approved', 'good'] : e.action === 'edited' ? ['Updated', 'teal'] : x.status === 'draft' ? ['Draft', 'purple'] : null, to: ['material', {id: x.id}]}); });
    (mat.activity || []).filter(e => ['template_added', 'template_updated', 'default_changed'].includes(e.action)).forEach(e => { const f = mat.model.fam.get(e.family_id); if (f) acts.push({at: e.at, icon: 'layers', title: f.name, sub: e.action === 'template_added' ? 'Template added' : e.action === 'default_changed' ? 'Default template changed' : 'Template updated', pill: null, to: ['materials', {tab: 'templates', family: f.id}]}); });
    acts.sort((a, b) => String(b.at).localeCompare(String(a.at)));
    /* one row per thing: keep the latest */
    const seen = new Set(); const recent = acts.filter(a => { const k = a.to[0] + (a.to[1].id || a.to[1].family || ''); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 6);
    return {items, recent, when};
  }

  return {MaterialsView, MaterialView, BuilderView, TemplateEditor, ContentBankView, CanvaView, homeSignals, buildModel, Thumb};
}

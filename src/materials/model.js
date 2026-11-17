/* The template library as a tree: Audience (and audience groups) → Material Type → Template (family) → Version.
 * A material type's default template is its default family's current version. Pure functions, no React. */
export function buildModel(raw){
  const r = raw || {};
  const audiences = r.audiences || [], types = r.types || [], families = r.families || [], versions = r.versions || [];
  const byId = list => { const m = new Map(); list.forEach(x => m.set(x.id, x)); return m; };
  const aud = byId(audiences), typ = byId(types), fam = byId(families), ver = byId(versions);
  const sortBy = (a, b) => (a.sort || 0) - (b.sort || 0) || String(a.name).localeCompare(String(b.name));
  const children = id => audiences.filter(a => (a.parent_id || null) === (id || null)).sort(sortBy);
  const typesOf = (audId, all) => types.filter(t => t.audience_id === audId && (all || t.active !== false)).sort(sortBy);
  const familiesOf = (typeId, all) => families.filter(f => f.material_type_id === typeId && (all || f.status !== 'archived')).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  const versionsOf = famId => versions.filter(v => v.family_id === famId).sort((a, b) => b.version_no - a.version_no);
  const currentVersion = f => (f && f.current_version_id ? ver.get(f.current_version_id) : null) || null;
  const defaultFamily = t => (t && t.default_family_id ? fam.get(t.default_family_id) : null) || null;
  const defaultVersion = t => { const f = defaultFamily(t); const v = currentVersion(f); return v && v.config_status === 'approved' && !v.archived_at && f.status !== 'archived' ? v : null; };
  /* versions staff may choose for a material type: each active template's current approved version */
  const usableVersions = t => familiesOf(t.id).map(f => ({family: f, version: currentVersion(f)})).filter(x => x.version && x.version.config_status === 'approved' && !x.version.archived_at);
  const audPath = id => { const out = []; let a = aud.get(id); let guard = 0; while (a && guard++ < 10) { out.unshift(a.name); a = a.parent_id ? aud.get(a.parent_id) : null; } return out.join(' › '); };
  /* audiences staff pick from: active ones that have at least one active material type */
  const pickable = audiences.filter(a => a.active !== false && typesOf(a.id).length);
  const familyLabel = f => { if (!f) return ''; const v = currentVersion(f); return f.name + (v ? ' v' + v.version_no : ''); };
  const versionLabel = v => { if (!v) return ''; const f = fam.get(v.family_id); return (f ? f.name : 'Template') + ' v' + v.version_no; };
  const isDefault = f => { const t = f && typ.get(f.material_type_id); return !!(t && t.default_family_id === f.id); };
  return {audiences, types, families, versions, aud, typ, fam, ver, children, typesOf, familiesOf, versionsOf, currentVersion, defaultFamily, defaultVersion, usableVersions, audPath, pickable, familyLabel, versionLabel, isDefault, roots: children(null)};
}

export const SOURCE_TYPES = {
  canva: {label: 'Canva', short: 'Canva', output: 'A new Canva design (editable in Canva) and a PDF', engine: 'Canva autofill'},
  pptx: {label: 'PowerPoint', short: 'PPTX', output: 'A PowerPoint file (.pptx), editable', engine: 'PowerPoint text and picture replacement'},
  pdf: {label: 'PDF', short: 'PDF', output: 'A finished PDF (not editable in Canva)', engine: 'PDF form fields or content regions'},
};
export const MAT_STATUS = [
  {id: 'draft', label: 'Draft', tone: 'neutral'},
  {id: 'in_review', label: 'In review', tone: 'purple'},
  {id: 'approved', label: 'Approved', tone: 'good'},
  {id: 'archived', label: 'Archived', tone: 'outline'},
];
export const CONFIG_STATUS = [
  {id: 'draft', label: 'Needs setup', tone: 'warn'},
  {id: 'tested', label: 'Tested, awaiting approval', tone: 'blue'},
  {id: 'approved', label: 'Approved', tone: 'good'},
];
export function slugify(s){ return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'material'; }
/* carry field content over to another template version: same field ids keep their text; new fields are listed */
export function carryContent(oldContent, newFields){
  const content = {}, missing = [];
  for (const f of newFields) { const v = (oldContent || {})[f.id]; if (v && (v.text || v.image)) content[f.id] = Object.assign({}, v, {carried: true}); else missing.push(f); }
  return {content, missing};
}

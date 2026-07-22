// AR Studio — Builder editor. Canvas (Konva) with layers, element placement,
// transform, a contextual properties panel, and project save/load.
import Konva from 'konva';
import { ELEMENT_TYPES, LAYER_ORDER, MAX_ELEMENTS, defaultElement } from '../elements.js';
import { renderProperties } from './properties.js';
import { publishProject } from './publish.js';

// ---- Project model ---------------------------------------------------------
export const project = {
  name: 'Untitled',
  image: null,        // dataURL of the trigger image
  imageW: 0, imageH: 0,
  realWidthCm: 15,
  elements: [],       // [{id, ...element fields}] positions normalized (0..1)
};
let selectedId = null;
let nextId = 1;

// ---- Konva stage -----------------------------------------------------------
const host = document.getElementById('stage-host');
let stage, bgLayer, contentLayer, tr;
const nodeById = new Map();

function initStage(w, h) {
  host.innerHTML = '';
  const wrap = document.getElementById('canvas-wrap');
  const maxW = (wrap.clientWidth || 900) - 60, maxH = (wrap.clientHeight || 640) - 60;
  const s = Math.min(maxW / w, maxH / h, 1);
  const sw = Math.round(w * s), sh = Math.round(h * s);
  stage = new Konva.Stage({ container: host, width: sw, height: sh });
  bgLayer = new Konva.Layer(); contentLayer = new Konva.Layer();
  stage.add(bgLayer); stage.add(contentLayer);
  tr = new Konva.Transformer({ rotateEnabled: true, keepRatio: false, borderStroke: '#4fd1c5', anchorStroke: '#4fd1c5', anchorFill: '#0f1420' });
  contentLayer.add(tr);
  stage.scaleFactor = s;
  stage.on('click tap', (e) => { if (e.target === stage) select(null); });
}

function loadImage(dataURL) {
  const img = new Image();
  img.onload = () => {
    project.image = dataURL; project.imageW = img.width; project.imageH = img.height;
    initStage(img.width, img.height);
    const kimg = new Konva.Image({ image: img, width: stage.width(), height: stage.height(), listening: false });
    bgLayer.add(kimg); bgLayer.draw();
    document.getElementById('empty-hint').classList.add('hidden');
    project.elements.forEach(addNode);
    refreshLayers();
  };
  img.src = dataURL;
}

// ---- Element <-> node sync -------------------------------------------------
// Model stores normalized center (x,y) and normalized size (w,h). Konva uses px.
const toPx = (el) => ({
  x: el.x * stage.width(), y: el.y * stage.height(),
  w: el.w * stage.width(), h: el.h * stage.height(),
});
function addNode(el) {
  const p = toPx(el);
  const def = ELEMENT_TYPES[el.type];
  const group = new Konva.Group({ x: p.x, y: p.y, rotation: el.rotation || 0, draggable: true });
  const rect = new Konva.Rect({
    width: p.w, height: p.h, offsetX: p.w / 2, offsetY: p.h / 2,
    fill: def.color + '22', stroke: def.color, strokeWidth: 2, cornerRadius: 8,
  });
  const label = new Konva.Text({
    text: `${def.icon} ${labelFor(el)}`, fontSize: 15, fill: def.color,
    width: p.w, align: 'center', offsetX: p.w / 2, offsetY: 8, listening: false,
  });
  group.add(rect); group.add(label);
  group.el = el; group.rect = rect; group.label = label;
  group.on('click tap', (e) => { e.cancelBubble = true; select(el.id); });
  group.on('dragend', () => syncFromNode(el.id));
  group.on('transformend', () => syncFromNode(el.id));
  contentLayer.add(group);
  nodeById.set(el.id, group);
  applyLayerVisibility(el.type);
  contentLayer.draw();
}
function labelFor(el) {
  return el.label || el.value || (el.asset ? el.asset.split('/').pop() : '') || ELEMENT_TYPES[el.type].label;
}
function syncFromNode(id) {
  const g = nodeById.get(id); const el = g.el;
  el.x = g.x() / stage.width();
  el.y = g.y() / stage.height();
  el.rotation = Math.round(g.rotation());
  // Transformer scales the group; bake scale into rect size, reset group scale.
  const sx = g.scaleX(), sy = g.scaleY();
  if (sx !== 1 || sy !== 1) {
    const nw = g.rect.width() * sx, nh = g.rect.height() * sy;
    g.rect.width(nw); g.rect.height(nh); g.rect.offset({ x: nw / 2, y: nh / 2 });
    g.label.width(nw); g.label.offsetX(nw / 2);
    g.scale({ x: 1, y: 1 });
    el.w = nw / stage.width(); el.h = nh / stage.height();
  }
  contentLayer.draw();
}
function refreshNodeLabel(id) {
  const g = nodeById.get(id); if (!g) return;
  g.label.text(`${ELEMENT_TYPES[g.el.type].icon} ${labelFor(g.el)}`);
  contentLayer.draw();
}

// ---- Selection + properties ------------------------------------------------
function select(id) {
  selectedId = id;
  const g = id ? nodeById.get(id) : null;
  tr.nodes(g ? [g] : []);
  contentLayer.draw();
  const propsEl = document.getElementById('props');
  const noSel = document.getElementById('no-sel');
  const del = document.getElementById('del-btn');
  if (!g) { propsEl.classList.add('hidden'); del.classList.add('hidden'); noSel.classList.remove('hidden'); return; }
  noSel.classList.add('hidden'); propsEl.classList.remove('hidden'); del.classList.remove('hidden');
  renderProperties(propsEl, g.el, () => { refreshNodeLabel(id); });
}

// ---- Add / delete ----------------------------------------------------------
function addElement(type) {
  if (!project.image) { alert('Load a trigger image first.'); return; }
  if (project.elements.length >= MAX_ELEMENTS) { alert(`Limit is ${MAX_ELEMENTS} elements per image.`); return; }
  const el = { id: nextId++, ...defaultElement(type) };
  // Cascade so new elements don't stack exactly on top of each other.
  const n = project.elements.length;
  el.x = Math.min(0.8, 0.35 + (n % 5) * 0.07);
  el.y = Math.min(0.85, 0.3 + Math.floor(n / 5) * 0.12 + (n % 5) * 0.05);
  project.elements.push(el);
  addNode(el); refreshLayers(); updateBudget(); select(el.id);
}
function deleteSelected() {
  if (!selectedId) return;
  const g = nodeById.get(selectedId);
  g.destroy(); nodeById.delete(selectedId);
  project.elements = project.elements.filter((e) => e.id !== selectedId);
  select(null); refreshLayers(); updateBudget(); contentLayer.draw();
}

// ---- Layers panel ----------------------------------------------------------
const layerVisible = {};
LAYER_ORDER.forEach((t) => (layerVisible[t] = true));
function applyLayerVisibility(type) {
  nodeById.forEach((g) => { if (g.el.type === type) g.visible(layerVisible[type]); });
}
function refreshLayers() {
  const host = document.getElementById('layers'); host.innerHTML = '';
  LAYER_ORDER.forEach((type) => {
    const count = project.elements.filter((e) => e.type === type).length;
    if (count === 0) return;
    const def = ELEMENT_TYPES[type];
    const row = document.createElement('div'); row.className = 'layer-row';
    const eye = document.createElement('span'); eye.className = 'eye' + (layerVisible[type] ? '' : ' off');
    eye.textContent = '👁'; eye.title = 'Toggle visibility';
    eye.onclick = () => { layerVisible[type] = !layerVisible[type]; eye.className = 'eye' + (layerVisible[type] ? '' : ' off'); applyLayerVisibility(type); contentLayer.draw(); };
    const name = document.createElement('span'); name.textContent = `${def.icon} ${def.label} (${count})`;
    row.append(eye, name); host.append(row);
  });
}
function updateBudget() {
  document.querySelector('#budget b').textContent = project.elements.length;
}

// ---- Save / load -----------------------------------------------------------
function saveProject() {
  project.name = document.getElementById('proj-name').value || 'Untitled';
  const data = JSON.stringify(project);
  localStorage.setItem('arstudio:last', data);
  const blob = new Blob([data], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = project.name.replace(/\s+/g, '_') + '.arstudio';
  a.click();
}
function loadProjectData(data) {
  Object.assign(project, data);
  nextId = Math.max(0, ...project.elements.map((e) => e.id || 0)) + 1;
  document.getElementById('proj-name').value = project.name || 'Untitled';
  nodeById.clear();
  if (project.image) loadImage(project.image);
  updateBudget();
}

// ---- Wire up UI ------------------------------------------------------------
function buildAddButtons() {
  const grid = document.getElementById('add-grid');
  Object.entries(ELEMENT_TYPES).forEach(([type, def]) => {
    const b = document.createElement('button'); b.className = 'add-btn';
    b.innerHTML = `<span class="em">${def.icon}</span>${def.label}`;
    b.onclick = () => addElement(type);
    grid.append(b);
  });
}

document.getElementById('load-img-btn').onclick = () => document.getElementById('file-input').click();
document.getElementById('file-input').onchange = (e) => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader(); r.onload = () => loadImage(r.result); r.readAsDataURL(f);
};
document.getElementById('save-btn').onclick = saveProject;
document.getElementById('open-btn').onclick = () => document.getElementById('proj-input').click();
document.getElementById('proj-input').onchange = (e) => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader(); r.onload = () => loadProjectData(JSON.parse(r.result)); r.readAsText(f);
};
document.getElementById('del-btn').onclick = deleteSelected;
document.getElementById('publish-btn').onclick = () => {
  project.name = document.getElementById('proj-name').value || 'Untitled';
  project.realWidthCm = project.realWidthCm || 15;
  publishProject(project);
};
window.addEventListener('keydown', (e) => { if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') deleteSelected(); });

// Load a trigger image from a URL (convenience + used for testing).
window.arStudioLoadImageURL = async (url) => {
  const blob = await (await fetch(url)).blob();
  const r = new FileReader(); r.onload = () => loadImage(r.result); r.readAsDataURL(blob);
};
window.arStudioProject = project;

// Refit the stage when the canvas area resizes (model holds normalized coords,
// so re-loading the image rebuilds nodes at the correct size).
let refitTimer = null, lastFitW = 0;
const wrapEl = document.getElementById('canvas-wrap');
new ResizeObserver(() => {
  if (!project.image) return;
  const w = wrapEl.clientWidth;
  if (!w || w === lastFitW) return;
  lastFitW = w;
  clearTimeout(refitTimer);
  refitTimer = setTimeout(() => { const sel = selectedId; loadImage(project.image); if (sel) setTimeout(() => select(sel), 50); }, 120);
}).observe(wrapEl);

buildAddButtons();
updateBudget();
// Offer to restore last session.
const last = localStorage.getItem('arstudio:last');
if (last) { try { loadProjectData(JSON.parse(last)); } catch {} }

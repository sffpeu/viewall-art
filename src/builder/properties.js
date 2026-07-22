// Contextual properties panel for the selected element. Edits mutate the
// element object in place; onChange() lets the editor refresh the canvas label.
import { ELEMENT_TYPES } from '../elements.js';

const FIELDS = {
  text:  [['value', 'Text', 'text'], ['color', 'Colour', 'color']],
  image: [['asset', 'Image file', 'asset:image']],
  '3d':  [['asset', '3D model (.glb)', 'asset:model'], ['onClick', 'On click', 'select:none,animate']],
  sound: [['asset', 'Sound file', 'asset:audio'], ['loop', 'Loop', 'bool']],
  url:   [['label', 'Button label', 'text'], ['url', 'Web address', 'text']],
  phone: [['label', 'Button label', 'text'], ['number', 'Phone number', 'text']],
  email: [['label', 'Button label', 'text'], ['to', 'To', 'text'], ['subject', 'Subject', 'text'], ['body', 'Message', 'textarea']],
};

export function renderProperties(host, el, onChange) {
  const def = ELEMENT_TYPES[el.type];
  host.innerHTML = '';
  addHeading(host, `${def.icon} ${def.label}`);

  (FIELDS[el.type] || []).forEach(([key, label, kind]) => addField(host, el, key, label, kind, onChange));

  // Interaction (all types support it).
  addField(host, el, 'interaction', 'Interaction', 'select:none,click,drag', onChange);

  // Spatial controls.
  addHeading(host, 'Position in space');
  const grid = document.createElement('div'); grid.className = 'row2'; host.append(grid);
  addField(grid, el, 'z', 'Height above page', 'number', onChange);
  addField(grid, el, 'scale', 'Scale', 'number', onChange);
}

function addHeading(host, text) {
  const h = document.createElement('div'); h.className = 'section-title'; h.textContent = text; host.append(h);
}

function addField(host, el, key, label, kind, onChange) {
  const wrap = document.createElement('div'); wrap.className = 'prop';
  const lab = document.createElement('label'); lab.textContent = label; wrap.append(lab);
  let input;

  if (kind === 'textarea') {
    input = document.createElement('textarea'); input.value = el[key] ?? '';
    input.oninput = () => { el[key] = input.value; onChange(); };
  } else if (kind === 'bool') {
    input = document.createElement('input'); input.type = 'checkbox'; input.checked = !!el[key];
    input.style.width = 'auto';
    input.onchange = () => { el[key] = input.checked; onChange(); };
  } else if (kind === 'color') {
    input = document.createElement('input'); input.type = 'color'; input.value = el[key] || '#ffffff';
    input.oninput = () => { el[key] = input.value; onChange(); };
  } else if (kind === 'number') {
    input = document.createElement('input'); input.type = 'number'; input.step = '0.05'; input.value = el[key] ?? 0;
    input.oninput = () => { el[key] = parseFloat(input.value) || 0; onChange(); };
  } else if (kind.startsWith('select:')) {
    input = document.createElement('select');
    kind.slice(7).split(',').forEach((opt) => {
      const o = document.createElement('option'); o.value = opt; o.textContent = opt; input.append(o);
    });
    input.value = el[key] ?? kind.slice(7).split(',')[0];
    input.onchange = () => { el[key] = input.value; onChange(); };
  } else if (kind.startsWith('asset:')) {
    const accept = { image: 'image/*', model: '.glb,model/gltf-binary', audio: 'audio/*' }[kind.slice(6)];
    input = document.createElement('input'); input.type = 'file'; input.accept = accept;
    input.onchange = () => {
      const f = input.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        el[key] = r.result;             // dataURL — bundled at publish time
        el._assetName = f.name;
        onChange();
      };
      r.readAsDataURL(f);
    };
    if (el._assetName) { const cur = document.createElement('div'); cur.style.cssText = 'font-size:0.75rem;color:#9fb0c8;margin-top:3px'; cur.textContent = 'Current: ' + el._assetName; wrap.append(lab, input, cur); host.append(wrap); return; }
  } else {
    input = document.createElement('input'); input.type = 'text'; input.value = el[key] ?? '';
    input.oninput = () => { el[key] = input.value; onChange(); };
  }
  wrap.append(input); host.append(wrap);
}

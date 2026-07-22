// Publish: compile the trigger image to targets.mind, convert the project to
// experience.json, bundle assets (+ the viewer, if available) into a zip.
import { Compiler } from 'mind-ar/dist/mindar-image.prod.js';
import JSZip from 'jszip';

function overlay() {
  let o = document.getElementById('publish-overlay');
  if (!o) {
    o = document.createElement('div'); o.id = 'publish-overlay';
    o.style.cssText = 'position:fixed;inset:0;z-index:999;background:rgba(8,12,20,0.88);color:#e8edf4;display:flex;align-items:center;justify-content:center;font:600 1.2rem system-ui;text-align:center;padding:2rem';
    document.body.append(o);
  }
  o.style.display = 'flex';
  return o;
}
const setMsg = (t) => (overlay().textContent = t);
const hide = () => { const o = document.getElementById('publish-overlay'); if (o) o.style.display = 'none'; };

function dataURLToBytes(dataURL) {
  const b64 = dataURL.split(',')[1];
  const bin = atob(b64); const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}
function extFromDataURL(d) {
  const mime = (d.match(/^data:([^;]+)/) || [])[1] || '';
  return ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp',
    'model/gltf-binary': 'glb', 'application/octet-stream': 'glb',
    'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/mp4': 'm4a' })[mime] || 'bin';
}
function loadImageEl(src) {
  return new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = src; });
}

export async function publishProject(project) {
  if (!project.image) { alert('Load a trigger image first.'); return; }
  try {
    const zip = new JSZip();

    // 1) Compile targets.mind from the trigger image.
    setMsg('Preparing trigger image…');
    const img = await loadImageEl(project.image);
    const compiler = new Compiler();
    await compiler.compileImageTargets([img], (p) => setMsg('Compiling recognition data… ' + Math.round(p) + '%'));
    const mindData = new Uint8Array(await compiler.exportData());
    zip.file('targets.mind', mindData);

    // 2) Trigger image (kept for reference).
    zip.file('trigger.' + extFromDataURL(project.image), dataURLToBytes(project.image));

    // 3) experience.json + assets.
    setMsg('Bundling content…');
    const assets = zip.folder('assets');
    const elements = project.elements.map((el, idx) => {
      const clean = { ...el };
      delete clean.id; delete clean._assetName;
      if (typeof clean.asset === 'string' && clean.asset.startsWith('data:')) {
        const name = `el${idx}.${extFromDataURL(clean.asset)}`;
        assets.file(name, dataURLToBytes(clean.asset));
        clean.asset = 'assets/' + name;
      }
      return clean;
    });
    const experience = {
      version: 1,
      targetsFile: 'targets.mind',
      targets: [{
        index: 0,
        image: 'trigger.' + extFromDataURL(project.image),
        heightRatio: project.imageH / project.imageW,
        realWidthCm: project.realWidthCm || 15,
        elements,
      }],
    };
    zip.file('experience.json', JSON.stringify(experience, null, 2));

    // 4) Include the viewer (as index.html) if we're running from a built site.
    setMsg('Adding the viewer…');
    let bundledViewer = false;
    try {
      const html = await (await fetch('./viewer.html')).text();
      const m = html.match(/src="([^"]*viewer[^"]*\.js)"/);
      if (m) {
        zip.file('index.html', html.replace(m[1], m[1].replace(/^\.?\//, './')));
        const jsPath = m[1].replace(/^\.?\//, '');
        const js = await (await fetch('./' + jsPath)).text();
        zip.file(jsPath, js);
        bundledViewer = true;
      }
    } catch { /* dev mode — viewer served separately */ }

    if (!bundledViewer) {
      zip.file('README.txt',
        'Drop experience.json, targets.mind, trigger.* and the assets/ folder into your AR viewer\'s public/ folder, then serve it.\n');
    }

    // 5) Download.
    setMsg('Packaging…');
    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (project.name || 'experience').replace(/\s+/g, '_') + '_AR.zip';
    a.click();
    setMsg('✅ Published! The zip is downloading.' + (bundledViewer ? ' Unzip and host it anywhere.' : ''));
    setTimeout(hide, 2500);
  } catch (err) {
    console.error(err);
    setMsg('Publish failed: ' + (err?.message || err));
    setTimeout(hide, 4000);
  }
}

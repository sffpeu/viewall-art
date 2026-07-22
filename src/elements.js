// Shared element-type definitions — the single source of truth for both the
// Builder (editor UI) and the Viewer (AR playback). Each type counts as one of
// the 10 elements allowed per trigger image.

export const MAX_ELEMENTS = 10;

// One layer per content type (Builder shows these as toggleable layers).
export const ELEMENT_TYPES = {
  text:  { label: 'Text',  icon: '📝', color: '#e8edf4', interactive: true },
  image: { label: 'Image', icon: '🖼️', color: '#8ec5ff', interactive: true },
  '3d':  { label: '3D',    icon: '🧊', color: '#4fd1c5', interactive: true },
  sound: { label: 'Sound', icon: '🔊', color: '#ffd479', interactive: true },
  url:   { label: 'Link',  icon: '🔗', color: '#b794f6', interactive: true },
  phone: { label: 'Phone', icon: '📞', color: '#68d391', interactive: true },
  email: { label: 'Email', icon: '✉️', color: '#f6ad55', interactive: true },
};

export const LAYER_ORDER = ['image', 'text', 'sound', 'url', 'phone', 'email', '3d'];

// Default element created when the user adds one of a given type.
// Positions are normalized (0..1) relative to the trigger image; z is height
// above the page (also in image-width units); scale multiplies content size.
export function defaultElement(type) {
  const base = { type, x: 0.5, y: 0.5, w: 0.25, h: 0.15, z: 0, scale: 1, rotation: 0, interaction: 'none' };
  switch (type) {
    case 'text':  return { ...base, value: 'New text', color: '#ffffff', fontSize: 0.08 };
    case 'image': return { ...base, asset: '' };
    case '3d':    return { ...base, asset: '', z: 0.3, scale: 1, onClick: 'animate', autoplay: true };
    case 'sound': return { ...base, asset: '', loop: false, w: 0.12, h: 0.12 };
    case 'url':   return { ...base, url: 'https://', label: 'Open link', interaction: 'click' };
    case 'phone': return { ...base, number: '+49', label: 'Call', interaction: 'click' };
    case 'email': return { ...base, to: '', subject: '', body: '', label: 'Email', interaction: 'click' };
    default:      return base;
  }
}

// Build the href an action element opens when clicked.
export function actionHref(el) {
  if (el.type === 'url') return el.url;
  if (el.type === 'phone') return 'tel:' + String(el.number || '').replace(/\s+/g, '');
  if (el.type === 'email') {
    const params = [];
    if (el.subject) params.push('subject=' + encodeURIComponent(el.subject));
    if (el.body) params.push('body=' + encodeURIComponent(el.body));
    return 'mailto:' + (el.to || '') + (params.length ? '?' + params.join('&') : '');
  }
  return null;
}

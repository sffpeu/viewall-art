import { startAR } from './ar.js';

const overlay = document.querySelector('#overlay');
const startBtn = document.querySelector('#start-btn');
const status = document.querySelector('#status');
const hint = document.querySelector('#hint');

// Detect in-app browsers (Instagram/Facebook/etc.) — they block the camera.
function isInAppBrowser() {
  const ua = navigator.userAgent || '';
  return /FBAN|FBAV|Instagram|Line|Twitter|Snapchat|Pinterest|WhatsApp/i.test(ua);
}

// The big JS bundle must finish loading before the button works.
// This module only runs AFTER it loads, so enabling here guarantees readiness.
startBtn.disabled = false;
startBtn.textContent = 'Start camera';

if (isInAppBrowser()) {
  status.textContent = '⚠️ Please open this page in Safari (tap ••• or the share icon → "Open in Safari"). The camera does not work inside this app.';
}

if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
  status.textContent = '⚠️ This browser cannot use the camera. Open the link in Safari (iPhone) or Chrome (Android).';
  startBtn.disabled = true;
}

startBtn.addEventListener('click', async () => {
  startBtn.disabled = true;
  status.textContent = 'Starting camera… (allow the camera when asked)';
  try {
    await startAR({
      onReady: () => {
        overlay.classList.add('hidden');
        hint.classList.remove('hidden');
      },
      onError: (err) => {
        const name = (err && err.name) || '';
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          status.textContent = '🚫 Camera blocked. In Safari: tap "aA" in the address bar → Website Settings → Camera → Allow, then reload.';
        } else if (name === 'NotFoundError') {
          status.textContent = '🚫 No camera found on this device.';
        } else {
          status.textContent = 'Something went wrong: ' + (err?.message || name || err) + '. Try reloading the page.';
        }
        startBtn.disabled = false;
        startBtn.textContent = 'Try again';
      },
    });
  } catch {
    /* handled in onError */
  }
});

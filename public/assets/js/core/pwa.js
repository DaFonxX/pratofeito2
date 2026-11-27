import { t } from './i18n.js';
import { toast } from './ui.js';

let deferredPrompt = null;
const listeners = new Set();
const emit = () => { for (const fn of listeners) fn(); };

export const canInstall = () => !!deferredPrompt;
export const onInstallChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

export async function promptInstall() {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  emit();
  return outcome === 'accepted';
}

export function initPwa() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    emit();
    toast(t('pwa.installed'));
  });
  window.addEventListener('offline', () => toast(t('pwa.offline'), { type: 'info', duration: 6000 }));
  window.addEventListener('online', () => toast(t('pwa.online')));

  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      const notify = (worker) => {
        toast(t('pwa.update'), {
          type: 'info',
          duration: 20000,
          action: { label: t('pwa.reload'), onClick: () => worker.postMessage({ type: 'SKIP_WAITING' }) },
        });
      };
      if (registration.waiting && navigator.serviceWorker.controller) notify(registration.waiting);
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) notify(worker);
        });
      });
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading) return;
        reloading = true;
        location.reload();
      });
      setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000);
    } catch {
      return;
    }
  });
}

import React, { useState, useEffect } from 'react';
import { usePos } from '../../context/PosContext';

export const PwaAppModal = () => {
  const { closeModal, showToast } = usePos();
  const [canInstall, setCanInstall] = useState(() => Boolean(window.__deferredPwaPrompt));
  const [updateReady, setUpdateReady] = useState(() => Boolean(window.__pwaUpdateReady));
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [cacheVersion, setCacheVersion] = useState('v1.6.0');
  const [isStandalone, setIsStandalone] = useState(() => {
    try {
      return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    } catch (e) {
      return false;
    }
  });

  useEffect(() => {
    const onInstallAvailable = () => setCanInstall(Boolean(window.__deferredPwaPrompt));
    const onInstalled = () => {
      setCanInstall(false);
      setIsStandalone(true);
    };
    const onUpdateReady = () => setUpdateReady(true);

    window.addEventListener('pwa-install-available', onInstallAvailable);
    window.addEventListener('pwa-installed', onInstalled);
    window.addEventListener('pwa-update-ready', onUpdateReady);

    // Query active Service Worker cache name
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      try {
        const channel = new MessageChannel();
        channel.port1.onmessage = (event) => {
          if (event.data && event.data.cacheName) {
            setCacheVersion(event.data.cacheName);
          }
        };
        navigator.serviceWorker.controller.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
      } catch (e) {}
    }

    return () => {
      window.removeEventListener('pwa-install-available', onInstallAvailable);
      window.removeEventListener('pwa-installed', onInstalled);
      window.removeEventListener('pwa-update-ready', onUpdateReady);
    };
  }, []);

  const handleTriggerInstall = async () => {
    const promptEvent = window.__deferredPwaPrompt;
    if (!promptEvent) {
      showToast('Use your browser menu (⋮) → "Install app" to install on Android', 'info');
      return;
    }
    try {
      promptEvent.prompt();
      const choiceResult = await promptEvent.userChoice;
      if (choiceResult && choiceResult.outcome === 'accepted') {
        window.__deferredPwaPrompt = null;
        setCanInstall(false);
        showToast('Installing Micro Saler Android App...', 'success');
        closeModal();
      }
    } catch (e) {
      showToast('Could not open install prompt. Use Chrome menu (⋮) → Install app.', 'error');
    }
  };

  const handleApplyUpdate = () => {
    const reg = window.__swRegistration;
    if (reg && reg.waiting) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    window.__pwaUpdateReady = false;
    showToast('Updating to latest release...', 'success');
    setTimeout(() => {
      window.location.reload();
    }, 250);
  };

  const handleCheckForUpdates = async () => {
    if (!('serviceWorker' in navigator)) {
      showToast('Service Worker is not supported in this browser.', 'error');
      return;
    }
    if (!navigator.onLine) {
      showToast('You are currently offline. Connect to the internet to check for updates.', 'error');
      return;
    }

    setIsCheckingUpdate(true);
    try {
      const reg = window.__swRegistration || (await navigator.serviceWorker.getRegistration());
      if (!reg) {
        showToast('No Service Worker registered yet.', 'info');
        setIsCheckingUpdate(false);
        return;
      }

      await reg.update();

      if (reg.waiting || reg.installing || window.__pwaUpdateReady) {
        setUpdateReady(true);
        showToast('New update downloaded! Tap "Apply Update & Reload" to finish.', 'success');
      } else {
        showToast('You are already running the latest version from GitHub!', 'success');
      }
    } catch (e) {
      showToast('Failed to check for updates. Please verify your internet connection.', 'error');
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  return (
    <div className="modal-overlay active" onClick={closeModal}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <h2>📲 Android App & Auto-Updates</h2>
          <button className="modal-close" onClick={closeModal}>&times;</button>
        </div>

        <div className="modal-body">
          <div className="card card-static p-sm mb-md" style={{ background: 'var(--market-surface-variant)' }}>
            <div className="flex-between body-small mb-xs">
              <span>App Display Mode:</span>
              <strong style={{ color: isStandalone ? 'var(--color-emerald)' : 'var(--color-primary)' }}>
                {isStandalone ? '✅ Installed Android App' : '🌐 Browser Tab'}
              </strong>
            </div>
            <div className="flex-between body-small mb-xs">
              <span>Active Build Cache:</span>
              <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>{cacheVersion}</strong>
            </div>
            <div className="flex-between body-small">
              <span>Local Database:</span>
              <strong style={{ color: 'var(--color-emerald)' }}>IndexedDB v11 Protected</strong>
            </div>
          </div>

          {updateReady && (
            <div
              className="card card-static p-sm mb-md"
              style={{
                background: 'var(--color-emerald-subtle)',
                border: '1px solid var(--color-emerald)'
              }}
            >
              <div style={{ fontWeight: 700, color: 'var(--color-emerald)', marginBottom: '4px' }}>
                ✨ New GitHub Update Ready!
              </div>
              <p className="body-small mb-sm">
                A newer build of Micro Saler has been downloaded in the background. Applying it will NOT affect any of your local sales, inventory, or customer data.
              </p>
              <button className="btn btn-success btn-block" onClick={handleApplyUpdate}>
                🔄 Apply Update & Reload Now
              </button>
            </div>
          )}

          {!isStandalone && (
            <div className="card card-static p-sm mb-md">
              <div style={{ fontWeight: 700, marginBottom: '6px' }}>
                Install as Native Android App (WebAPK)
              </div>
              <p className="body-small text-muted mb-sm">
                Micro Saler installs directly to your Android home screen and app drawer with full offline support and zero browser address bar.
              </p>

              {canInstall ? (
                <button className="btn btn-primary btn-block mb-xs" onClick={handleTriggerInstall}>
                  📲 Install Micro Saler App Now
                </button>
              ) : (
                <div
                  className="body-small"
                  style={{
                    background: 'var(--market-surface-variant)',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    lineHeight: 1.5
                  }}
                >
                  <div><strong>How to install on Android Chrome:</strong></div>
                  <div>1. Tap the <strong>⋮</strong> menu in the top-right corner of Chrome.</div>
                  <div>2. Tap <strong>&ldquo;Install app&rdquo;</strong> or <strong>&ldquo;Add to Home screen&rdquo;</strong>.</div>
                  <div>3. Open <strong>MicroSaler</strong> from your Android home screen!</div>
                </div>
              )}
            </div>
          )}

          <div className="card card-static p-sm mb-md">
            <div style={{ fontWeight: 700, marginBottom: '6px' }}>
              How Automatic Updates Work
            </div>
            <p className="body-small text-muted mb-sm" style={{ lineHeight: 1.5 }}>
              Every time you push changes to the <code>main</code> branch on GitHub, GitHub Actions automatically builds a new bundle and stamps a fresh version hash. Whenever you open the Android app with internet access, it downloads the update automatically while keeping your local IndexedDB ledger untouched.
            </p>
            <button
              className="btn btn-secondary btn-block"
              onClick={handleCheckForUpdates}
              disabled={isCheckingUpdate}
            >
              {isCheckingUpdate ? '⏳ Checking GitHub Pages...' : '🔄 Check for App Updates Now'}
            </button>
          </div>

          <div className="flex-between gap-sm">
            <button className="btn btn-ghost btn-block" onClick={closeModal}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

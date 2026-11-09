// CleanYourNest v1.1 - Google Cast Web Sender initialization and diagnostics.
// The receiver application ID MUST be registered, and the Nest Hub must be a test device.
(() => {
  'use strict';

  const DEFAULT_APP_ID = 'D0A623B3';
  const field = document.getElementById('app-id');
  const launch = document.getElementById('connect');
  const stop = document.getElementById('stop');
  const output = document.getElementById('output');
  const report = (text) => { output.textContent = text; console.info('[CleanYourNest]', text); };
  const valid = (value) => /^[A-F0-9]{8}$/.test(value);
  let sdkReady = false;
  let context = null;
  let activeAppId = null;

  field.value = (localStorage.getItem('cyn-cast-app-id') || DEFAULT_APP_ID).trim().toUpperCase();
  launch.disabled = true;

  function setReceiverOptions() {
    if (!sdkReady || !context) return false;
    const appId = field.value.trim().toUpperCase();
    if (!valid(appId)) {
      report('Voer de acht tekens van je Google Cast Application ID in.');
      launch.disabled = true;
      return false;
    }
    if (activeAppId !== appId) {
      context.setOptions({
        receiverApplicationId: appId,
        autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
      });
      activeAppId = appId;
      localStorage.setItem('cyn-cast-app-id', appId);
      report('Cast SDK actief voor ' + appId + '. Apparaten worden gezocht…');
    }
    launch.disabled = false;
    return true;
  }

  function showCastState() {
    if (!context) return;
    const state = context.getCastState();
    const states = cast.framework.CastState;
    switch (state) {
      case states.NO_DEVICES_AVAILABLE:
        report('Nog geen geschikte ontvangers voor App ID ' + activeAppId + '. Controleer testapparaatregistratie en start de Nest Hub zo nodig opnieuw op.');
        break;
      case states.NOT_CONNECTED:
        report('Geschikte Cast-ontvanger ontdekt. Klik op Start op Nest Hub.');
        break;
      case states.CONNECTING:
        report('Verbinding maken met de Cast-ontvanger…');
        break;
      case states.CONNECTED:
        report('Cast verbonden. Controleer je Nest Hub.');
        stop.disabled = false;
        break;
      default:
        report('Cast status: ' + String(state));
    }
  }

  // Google recommends configuring CastContext as soon as the SDK is available.
  // Previously setOptions was called only after clicking Start; this could
  // leave insufficient time for app-ID-specific discovery.
  window.__onGCastApiAvailable = (isAvailable) => {
    if (!isAvailable || !window.cast?.framework?.CastContext || !window.chrome?.cast) {
      report('Google Cast SDK is niet beschikbaar in deze browser. Gebruik Google Chrome.');
      return;
    }
    try {
      context = cast.framework.CastContext.getInstance();
      sdkReady = true;
      context.addEventListener(cast.framework.CastContextEventType.CAST_STATE_CHANGED, showCastState);
      context.addEventListener(cast.framework.CastContextEventType.SESSION_STATE_CHANGED, (event) => {
        console.info('[CleanYourNest] Session:', event.sessionState);
        if (event.sessionState === cast.framework.SessionState.SESSION_ENDED) stop.disabled = true;
      });
      setReceiverOptions();
      showCastState();
    } catch (error) {
      report('Cast initialisatie mislukt: ' + (error?.message || String(error)));
    }
  };

  const sdk = document.createElement('script');
  sdk.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
  sdk.async = true;
  sdk.onerror = () => report('Cast Sender SDK kon niet geladen worden.');
  document.head.appendChild(sdk);

  field.addEventListener('change', () => {
    if (sdkReady) { setReceiverOptions(); showCastState(); }
  });
  field.addEventListener('input', () => {
    launch.disabled = !sdkReady || !valid(field.value.trim().toUpperCase());
  });
  launch.addEventListener('click', async () => {
    if (!setReceiverOptions()) return;
    try {
      report('Cast-apparaatselectie openen…');
      await context.requestSession();
      report('Cast-sessie gestart. Controleer je Nest Hub.');
      stop.disabled = false;
    } catch (error) {
      report('Cast-sessie niet gestart: ' + (error?.message || error?.code || String(error)));
    }
  });
  stop.addEventListener('click', async () => {
    try {
      const session = context?.getCurrentSession();
      if (!session) { report('Er is geen actieve Cast-sessie.'); return; }
      await session.endSession(true);
      stop.disabled = true;
      report('Cast-sessie beëindigd.');
    } catch (error) { report('Stoppen mislukt: ' + (error?.message || String(error))); }
  });
})();

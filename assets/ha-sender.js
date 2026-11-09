/* CleanYourNest Home Assistant sender setup; never persists or logs the bridge key. */
(() => {
  'use strict';
  const NS = 'urn:x-cast:com.cleanyournest.ha';
  const url = document.getElementById('ha-bridge-url');
  const key = document.getElementById('ha-bridge-key');
  const link = document.getElementById('ha-link');
  const status = document.getElementById('ha-sender-status');
  if (!url || !key || !link || !status) return;
  url.value = localStorage.getItem('cyn-ha-bridge-url') || '';
  const report = msg => { status.textContent = msg; };
  let sdkContext = null;
  let listening = null;
  let sending = false;
  function ensureSessionListener(session) {
    if (!session || listening === session) return;
    session.addMessageListener(NS, (_namespace, message) => {
      try { if (JSON.parse(message).type === 'ha:ack') report('Nest Hub heeft de configuratie ontvangen.'); }
      catch (_err) { /* Do not log message data. */ }
    });
    listening = session;
  }
  async function send() {
    if (sending) return;
    const session = sdkContext?.getCurrentSession();
    if (!session) { report('Start eerst de Cast-sessie op je Nest Hub.'); return; }
    let parsed;
    try { parsed = new URL(url.value.trim()); }
    catch (_error) { report('Vul een geldige HTTPS-URL voor je bridge in.'); return; }
    if (parsed.protocol !== 'https:' || parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.username || parsed.password) {
      report('Gebruik de basis-HTTPS-URL van de bridge zonder pad of parameters.'); return;
    }
    if (key.value.length < 24) { report('De koppelcode moet minimaal 24 tekens lang zijn.'); return; }
    localStorage.setItem('cyn-ha-bridge-url', parsed.origin);
    ensureSessionListener(session);
    sending = true;
    try {
      report('Koppeling versturen naar Nest Hub…');
      await session.sendMessage(NS, {type:'ha:connect', url:parsed.origin, key:key.value});
      report('Koppeling verstuurd. Controleer de Nest Hub.');
      // Receiver registration might race with SESSION_STARTED; an explicit button retry is always available.
    } catch (_err) { report('Versturen mislukt. Wacht enkele seconden en probeer nogmaals.'); }
    finally { sending = false; }
  }
  link.addEventListener('click', send);
  // Separate module, attach to existing Cast SDK without modifying sender.js.
  const timer = setInterval(() => {
    if (!window.cast?.framework?.CastContext || !window.cast.framework.CastContext.getInstance) return;
    sdkContext = cast.framework.CastContext.getInstance();
    clearInterval(timer);
    sdkContext.addEventListener(cast.framework.CastContextEventType.SESSION_STATE_CHANGED, event => {
      const s = cast.framework.SessionState;
      if ([s.SESSION_STARTED, s.SESSION_RESUMED].includes(event.sessionState) && url.value.trim() && key.value) {
        setTimeout(send, 1500);
      }
    });
  }, 300);
})();

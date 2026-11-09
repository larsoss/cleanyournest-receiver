/* CleanYourNest Home Assistant v0.2 — browser/cast dashboard client.
   Bridge key is only kept in volatile JS memory. Never add HA tokens here. */
(() => {
  'use strict';
  const NS = 'urn:x-cast:com.cleanyournest.ha';
  const byId = id => document.getElementById(id);
  const state = { url: '', key: '', timer: null, pending: false, connected: false, entities: new Map(), context: null, senderId: null };
  const put = (id, value) => { const el = byId(id); if (el) el.textContent = String(value); };
  const onOff = e => e?.state === 'on';
  const unavailable = e => !e || ['unknown', 'unavailable'].includes(e.state);
  const fmt = (value, digits = 1) => { const n = Number(value); return Number.isFinite(n) ? n.toLocaleString('nl-NL', {maximumFractionDigits: digits, minimumFractionDigits: digits}) : '—'; };
  const entity = id => state.entities.get(id);
  const showStatus = (text, connected = false) => {
    put('ha-connection', text);
    put('ha-tile-status', connected ? 'Live verbonden' : text);
    byId('ha-connection')?.classList.toggle('ha-connected', connected);
  };
  const weatherNames = {
    'clear-night':'Heldere nacht', 'cloudy':'Bewolkt', 'exceptional':'Bijzonder weer',
    'fog':'Mist', 'hail':'Hagel', 'lightning':'Onweer', 'lightning-rainy':'Onweer en regen',
    'partlycloudy':'Half bewolkt', 'pouring':'Stortregen', 'rainy':'Regen',
    'snowy':'Sneeuw', 'snowy-rainy':'Natte sneeuw', 'sunny':'Zonnig', 'windy':'Winderig',
    'windy-variant':'Wisselvallig'
  };
  function showToast(message) {
    const el = byId('ha-toast'); if (!el) return;
    el.textContent = message;
    el.hidden = false;
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => { el.hidden = true; }, 3500);
  }
  function makeButton(label, secondary, click, disabled = false) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'ha-control' + (secondary ? ' is-on' : '');
    button.textContent = label; button.disabled = disabled;
    button.addEventListener('click', click);
    return button;
  }
  function renderLights() {
    const root = byId('ha-light-list'); if (!root) return;
    root.replaceChildren();
    const lights = [...state.entities.values()].filter(e => e.kind === 'light');
    lights.forEach(e => {
      const active = onOff(e);
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'ha-light' + (active ? ' is-on' : '');
      button.disabled = !e.control || unavailable(e) || !state.connected;
      button.setAttribute('aria-pressed', String(active));
      const icon = document.createElement('span'); icon.className = 'ha-light-symbol'; icon.textContent = '◉';
      const body = document.createElement('span'); body.className = 'ha-light-info';
      const title = document.createElement('strong'); title.textContent = e.label;
      const sub = document.createElement('small'); sub.textContent = unavailable(e) ? 'Niet beschikbaar' : (active ? 'Aan' : 'Uit');
      body.append(title, sub);
      button.append(icon, body);
      button.addEventListener('click', () => action(e.id, 'toggle'));
      root.append(button);
    });
    if (!lights.length) put('ha-lights-message', state.connected ? 'Geen lampen ingesteld in bridge/entities.json' : 'Koppel Home Assistant via de startpagina');
    else put('ha-lights-message', lights.filter(onOff).length + ' van ' + lights.length + ' lampen aan');
  }
  function renderMedia() {
    const players = [...state.entities.values()].filter(e => e.kind === 'media');
    const select = byId('ha-media-select'); if (!select) return;
    const oldId = select.value;
    select.replaceChildren();
    for (const player of players) {
      const option = document.createElement('option'); option.value = player.id; option.textContent = player.label;
      select.append(option);
    }
    if (players.some(p => p.id === oldId)) select.value = oldId;
    const chosen = entity(select.value);
    const isPlaying = chosen?.state === 'playing';
    const caption = chosen?.attributes?.media_title || (chosen ? chosen.state : 'Niet verbonden');
    put('ha-media-track', caption);
    put('ha-media-play', isPlaying ? '❚❚ Pauze' : '▶ Afspelen');
    const volume = byId('ha-media-volume');
    if (volume) volume.value = Math.round(Math.max(0, Math.min(1, Number(chosen?.attributes?.volume_level) || 0)) * 100);
    const disabled = !state.connected || unavailable(chosen) || !chosen?.control;
    ['ha-media-play', 'ha-media-next', 'ha-media-volume'].forEach(id => { if (byId(id)) byId(id).disabled = disabled; });
  }
  function render() {
    const weather = [...state.entities.values()].find(e => e.kind === 'weather');
    const indoor = entity('sensor.woonkamer_temperatuur');
    const outdoor = entity('sensor.tuin_temperatuur');
    const people = [...state.entities.values()].filter(e => e.kind === 'person');
    const doors = [...state.entities.values()].filter(e => e.kind === 'door');
    const wind = entity('sensor.knmi_windsnelheid');
    put('ha-weather-description', weather ? (weatherNames[weather.state] || weather.state) : '—');
    const temperature = weather?.attributes?.temperature;
    put('ha-weather-temp', temperature !== undefined && temperature !== null ? fmt(temperature) + '°' : '—');
    put('ha-indoor-temp', unavailable(indoor) ? '—' : fmt(indoor.state) + '°');
    put('ha-outdoor-temp', unavailable(outdoor) ? '—' : fmt(outdoor.state) + '°');
    put('ha-people', people.length ? people.filter(p => p.state === 'home').map(p => p.label).join(' & ') || 'Niemand thuis' : '—');
    put('ha-doors', doors.length ? (doors.filter(d => d.state === 'on').length ? doors.filter(d => d.state === 'on').map(d => d.label).join(', ') + ' open' : 'Alles gesloten') : '—');
    put('ha-weather-small', weather ? 'Home Assistant · actueel' : 'Geen weerentiteit ingesteld');
    renderLights(); renderMedia();
    put('ha-last-update', 'Bijgewerkt ' + new Intl.DateTimeFormat('nl-NL', {hour:'2-digit', minute:'2-digit', second:'2-digit'}).format(new Date()));
  }
  async function getState() {
    if (!state.url || !state.key || state.pending) return;
    state.pending = true;
    try {
      const response = await fetch(state.url + '/api/state', {
        method: 'GET', headers: {'Authorization': 'Bearer ' + state.key},
        mode: 'cors', cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer',
        signal: AbortSignal.timeout ? AbortSignal.timeout(9000) : undefined
      });
      if (!response.ok) throw new Error(response.status === 401 ? 'Koppelcode ongeldig' : 'HTTP ' + response.status);
      const data = await response.json();
      if (!Array.isArray(data.entities)) throw new Error('Ongeldig bridgeantwoord');
      state.entities = new Map(data.entities.filter(e => typeof e.id === 'string').map(e => [e.id, e]));
      state.connected = true;
      showStatus('Verbonden', true); render();
    } catch (err) {
      state.connected = false;
      showStatus('Verbinding verbroken');
      put('ha-last-update', err?.message || String(err));
      console.warn('[CleanYourNest HA] Bridge niet beschikbaar:', err?.message || err);
      renderLights(); renderMedia();
    } finally { state.pending = false; }
  }
  async function action(id, service, value) {
    if (!state.connected || !state.entities.get(id)?.control) return;
    const payload = {entity_id:id, service};
    if (value !== undefined) payload.value = value;
    try {
      const response = await fetch(state.url + '/api/action', {
        method:'POST', headers:{'Authorization':'Bearer ' + state.key, 'Content-Type':'application/json'},
        body:JSON.stringify(payload), mode:'cors', cache:'no-store', credentials:'omit', referrerPolicy:'no-referrer'
      });
      if (!response.ok) throw new Error('Actie geweigerd (HTTP ' + response.status + ')');
      setTimeout(getState, 500);
    } catch (err) { showToast(err?.message || 'Actie mislukt'); }
  }
  function connect(url, key, context, senderId) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/' || key.length < 24) throw Error('HTTPS-URL of koppelcode ongeldig');
      state.url = parsed.origin; state.key = key; state.context = context; state.senderId = senderId;
      state.entities.clear(); state.connected = false;
      showStatus('Verbinden…');
      if (state.timer) clearInterval(state.timer);
      state.timer = setInterval(getState, 10000);
      getState();
      context?.sendCustomMessage(NS, senderId, {type:'ha:ack', message:'Configuratie ontvangen'});
    } catch (err) {
      showStatus('Configuratie ongeldig');
      console.warn('[CleanYourNest HA]', err.message);
    }
  }
  function register(context) {
    context.addCustomMessageListener(NS, event => {
      const message = event.data;
      if (message?.type === 'ha:connect' && typeof message.url === 'string' && typeof message.key === 'string') {
        connect(message.url.trim(), message.key, context, event.senderId);
      }
      if (message?.type === 'ha:disconnect') {
        if (state.timer) clearInterval(state.timer);
        state.timer = null; state.key = ''; state.url = ''; state.connected = false; state.entities.clear();
        showStatus('Niet gekoppeld'); render();
      }
    });
  }
  function startup() {
    showStatus('Niet gekoppeld');
    const select = byId('ha-media-select');
    select?.addEventListener('change', renderMedia);
    byId('ha-media-play')?.addEventListener('click', () => action(select.value, 'media_play_pause'));
    byId('ha-media-next')?.addEventListener('click', () => action(select.value, 'media_next_track'));
    byId('ha-media-volume')?.addEventListener('change', event => action(select.value, 'volume_set', Number(event.target.value) / 100));
    renderLights(); renderMedia();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startup, {once:true});
  else startup();
  window.CleanYourNestHA = { register };
})();

// CleanYourNest v0.1 — basic Google Cast Web Receiver.
// No credentials, no Home Assistant API tokens and no firmware writes.
(() => {
  'use strict';
  const clock = document.getElementById('clock');
  const date = document.getElementById('date');
  const receiverState = document.getElementById('receiver-state');
  const castStatus = document.getElementById('cast-status');
  const counter = document.getElementById('connection-counter');
  const updateClock = () => {
    const now = new Date();
    clock.textContent = new Intl.DateTimeFormat('nl-NL', {hour:'2-digit',minute:'2-digit',hour12:false}).format(now);
    date.textContent = new Intl.DateTimeFormat('nl-NL', {weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(now);
  };
  updateClock();
  setInterval(updateClock, 1000);
  if (!window.cast?.framework?.CastReceiverContext) {
    receiverState.textContent = 'Demo in browser';
    castStatus.textContent = 'Receiver SDK niet geladen';
    counter.textContent = 'Open via een Cast-sessie';
    return;
  }
  try {
    const context = cast.framework.CastReceiverContext.getInstance();
    const namespace = 'urn:x-cast:com.cleanyournest.demo';
    context.addCustomMessageListener(namespace, event => {
      counter.textContent = 'Sender verbonden';
      if (event.data?.type === 'ping') {
        context.sendCustomMessage(namespace, event.senderId, {type:'pong',time:new Date().toISOString()});
      }
    });
    context.start();
    receiverState.textContent = 'Cast actief';
    castStatus.textContent = 'Receiver draait';
    counter.textContent = 'Klaar voor DevTools';
  } catch (err) {
    receiverState.textContent = 'Cast-initialisatie mislukt';
    castStatus.textContent = 'Controleer DevTools';
    console.error('[CleanYourNest]', err);
  }
})();

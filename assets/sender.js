(() => {
 'use strict';
 const field = document.getElementById('app-id');
 const launch = document.getElementById('connect');
 const stop = document.getElementById('stop');
 const output = document.getElementById('output');
 const log = text => {output.textContent = text;};
 field.value = localStorage.getItem('cyn-cast-app-id') || '';
 let ready = false;
 let castContext;
 function initialize() {
   if (!window.cast?.framework?.CastContext || !window.chrome?.cast) return;
   ready = true;
   log('Cast SDK gereed. Vul je App ID in en klik op Start op Nest Hub.');
   launch.disabled = !field.value.trim();
 }
 window.__onGCastApiAvailable = isAvailable => {
   if (isAvailable) initialize();
   else log('Google Cast is niet beschikbaar in deze browser of dit netwerk.');
 };
 const sdk = document.createElement('script');
 sdk.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
 sdk.async = true;
 sdk.onerror = () => log('Kan de Cast Sender SDK niet laden. Controleer internettoegang.');
 document.head.appendChild(sdk);
 field.addEventListener('input', () => {launch.disabled = !ready || !field.value.trim();});
 launch.addEventListener('click', async () => {
   if (!ready) return;
   const appId = field.value.trim().toUpperCase();
   if (!/^[A-Z0-9]{8,40}$/.test(appId)) {log('Controleer de Application ID uit de Cast Developer Console.');return;}
   localStorage.setItem('cyn-cast-app-id',appId);
   try {
     castContext = cast.framework.CastContext.getInstance();
     castContext.setOptions({receiverApplicationId:appId,autoJoinPolicy:chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED});
     log('Apparaatselectie openen…');
     await castContext.requestSession();
     log('Cast-sessie gestart. Controleer het Nest Hub-scherm en chrome://inspect/#devices.');
     stop.disabled = false;
   } catch (error) {
     log('Geen Cast-sessie gestart: ' + (error?.message || error?.code || String(error)));
   }
 });
 stop.addEventListener('click', async () => {
   try {
     const session = castContext?.getCurrentSession();
     if (!session) {log('Er is geen actieve sessie.');return;}
     await session.endSession(true);
     stop.disabled = true;
     log('Cast-sessie gestopt.');
   } catch (error) {log('Stoppen mislukt: ' + (error?.message || String(error)));}
 });
})();

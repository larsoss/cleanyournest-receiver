# CleanYourNest Cast Web Sender v1.1

## Probleem

YouTube in Chrome toont de Nest Hub 'Fotolijst', maar de eigen Cast Sender toont alleen 'Slaapkamer'. Het eigen apparaat wordt mogelijk gefilterd op de geregistreerde App ID, die in v1.0 pas bij het klikken op Start geconfigureerd werd.

## Wijziging

`assets/sender.js` initialiseert nu `CastContext.setOptions` zodra de SDK gereed is met de App ID `D0A623B3`, start discovery vroegtijdig en geeft Cast-status aan. Er worden geen netwerk- of firmwarewijzigingen gedaan.

## Installatie

Upload het nieuwe `assets/sender.js` in GitHub (zelfde map, bestaande bestand vervangen/committen). Herlaad de Pages-site met Ctrl+F5. De nieuwe zip bevat ook de andere oorspronkelijke sitebestanden voor een complete upload.

Als 'Geen geschikte ontvangers' verschijnt, controleer dat het in de Developer Console geregistreerde **Cast-apparaat** status **Ready For Testing** heeft en de app ID juist is. Google adviseert na registratie te wachten en het Cast-apparaat te herstarten. De lokale Fuchsia-ontwikkelaarsmodus mag daarbij uit gaan; die is niet hetzelfde als de Cast SDK-registratie.

Een YouTube Cast-lijst is niet hetzelfde als de voor onze App ID gefilterde Web Sender-lijst, dus dit lost niet gegarandeerd alle incompatibiliteitsproblemen op.

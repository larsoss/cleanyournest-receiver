#!/usr/bin/env python3
"""Minimal dependency-free HA bridge for CleanYourNest.

Run only behind a trusted HTTPS reverse proxy/tunnel. The real HA token stays
in this server's environment; public clients only hold a separate pair key.
Only allowlisted entities and actions are exposed.
"""
import hmac
import json
import logging
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

LOG = logging.getLogger('cleanyournest.bridge')
BASE = Path(__file__).resolve().parent
HA_URL = os.environ.get('HA_URL', 'http://homeassistant.local:8123').rstrip('/')
HA_TOKEN = os.environ.get('HA_TOKEN', '')
PAIR_KEY = os.environ.get('CYN_PAIR_KEY', '')
ALLOWED_ORIGINS = frozenset(s.strip() for s in os.environ.get('CYN_ALLOWED_ORIGIN', 'https://larsoss.github.io').split(',') if s.strip())
BIND = os.environ.get('CYN_BIND', '127.0.0.1')
PORT = int(os.environ.get('CYN_PORT', '8787'))


def load_entities():
    entries = json.loads((BASE / 'entities.json').read_text(encoding='utf-8'))
    if not isinstance(entries, list):
        raise ValueError('entities.json moet een lijst zijn')
    allowed_kinds = {'weather', 'temperature', 'person', 'door', 'light', 'media'}
    seen = set()
    for item in entries:
        if not isinstance(item, dict) or not all(k in item for k in ('id', 'label', 'kind', 'control')):
            raise ValueError('Entity mist verplicht veld')
        identifier = item['id']
        if not isinstance(identifier, str) or '.' not in identifier or identifier in seen:
            raise ValueError('Ongeldig/dubbel entity_id')
        if item['kind'] not in allowed_kinds or not isinstance(item['control'], bool):
            raise ValueError('Ongeldig kind/control')
        if item['control'] and ((item['kind'] == 'light' and not identifier.startswith('light.')) or
                                (item['kind'] == 'media' and not identifier.startswith('media_player.')) or
                                item['kind'] not in ('light', 'media')):
            raise ValueError('Onveilige control mapping: ' + identifier)
        seen.add(identifier)
    return entries


ENTITY_LIST = load_entities()
ENTITY_MAP = {e['id']: e for e in ENTITY_LIST}


def clean_attributes(attrs):
    """Never return HA's complete attribute dict to browsers."""
    if not isinstance(attrs, dict):
        return {}
    allowed = ('temperature', 'humidity', 'unit_of_measurement', 'media_title', 'volume_level', 'is_volume_muted')
    output = {}
    for key in allowed:
        val = attrs.get(key)
        if type(val) in (str, int, float, bool) and len(str(val)) < 180:
            output[key] = val
    return output


def validate_action(payload):
    if not isinstance(payload, dict) or set(payload) - {'entity_id', 'service', 'value'}:
        raise ValueError('Ongeldige actiegegevens')
    identifier, service = payload.get('entity_id'), payload.get('service')
    entry = ENTITY_MAP.get(identifier) if isinstance(identifier, str) else None
    if not entry or not entry['control'] or not isinstance(service, str):
        raise ValueError('Entity mag niet bediend worden')
    domain = 'light' if entry['kind'] == 'light' else 'media_player'
    allowed = {'light': {'toggle', 'turn_on', 'turn_off'},
               'media_player': {'media_play_pause', 'media_next_track', 'volume_set'}}
    if service not in allowed[domain]:
        raise ValueError('Actie niet toegestaan')
    data = {'entity_id': identifier}
    if 'value' in payload:
        if domain == 'light' and service == 'turn_on':
            if type(payload['value']) not in (int, float) or not 1 <= payload['value'] <= 100:
                raise ValueError('Lichtsterkte moet 1–100 zijn')
            data['brightness_pct'] = int(payload['value'])
        elif domain == 'media_player' and service == 'volume_set':
            if type(payload['value']) not in (int, float) or not 0 <= payload['value'] <= 1:
                raise ValueError('Volume moet 0–1 zijn')
            data['volume_level'] = round(float(payload['value']), 2)
        else:
            raise ValueError('Waarde niet toegestaan bij deze actie')
    elif service == 'volume_set':
        raise ValueError('Volume ontbreekt')
    return domain, service, data


def ha_request(path, method='GET', payload=None):
    body = json.dumps(payload).encode('utf-8') if payload is not None else None
    request = Request(HA_URL + path, method=method, data=body,
                      headers={'Authorization': 'Bearer ' + HA_TOKEN,
                               'Content-Type': 'application/json', 'Accept': 'application/json'})
    with urlopen(request, timeout=8) as response:
        raw = response.read(3_000_000 + 1)
    if len(raw) > 3_000_000:
        raise RuntimeError('HA antwoord te groot')
    return json.loads(raw) if raw else None


def get_snapshot():
    raw = ha_request('/api/states')
    if not isinstance(raw, list):
        raise RuntimeError('Onverwacht Home Assistant antwoord')
    by_id = {e.get('entity_id'): e for e in raw if isinstance(e, dict)}
    result = []
    for entry in ENTITY_LIST:
        src = by_id.get(entry['id'], {})
        result.append({'id': entry['id'], 'label': entry['label'],
                       'kind': entry['kind'], 'control': entry['control'],
                       'state': str(src.get('state', 'unavailable'))[:120],
                       'attributes': clean_attributes(src.get('attributes', {}))})
    return {'entities': result}


class Handler(BaseHTTPRequestHandler):
    server_version = 'CleanYourNestHA/0.2'
    sys_version = ''

    def _origin(self):
        origin = self.headers.get('Origin', '')
        return origin if origin in ALLOWED_ORIGINS else None

    def _headers(self, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Vary', 'Origin')
        if self._origin():
            self.send_header('Access-Control-Allow-Origin', self._origin())
            self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.end_headers()

    def _json(self, status, obj):
        payload = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self._headers(status)
        self.wfile.write(payload)

    def _authorized(self):
        supplied = self.headers.get('Authorization', '')
        return supplied.startswith('Bearer ') and hmac.compare_digest(supplied[7:], PAIR_KEY)

    def do_OPTIONS(self):
        if self.path not in ('/api/state', '/api/action') or not self._origin():
            self._json(403, {'error': 'origin_not_allowed'})
        else:
            self._headers(204)

    def do_GET(self):
        if self.path == '/health':
            # No HA secrets or configuration here.
            self._json(200, {'service': 'cleanyournest-ha-bridge', 'status': 'ready'})
            return
        if self.path != '/api/state':
            self._json(404, {'error': 'not_found'})
        elif not self._authorized():
            self._json(401, {'error': 'not_authorized'})
        else:
            try:
                self._json(200, get_snapshot())
            except (HTTPError, URLError, RuntimeError, ValueError) as error:
                LOG.error('HA kon status niet laden: %s', type(error).__name__)
                self._json(502, {'error': 'home_assistant_unavailable'})

    def do_POST(self):
        if self.path != '/api/action':
            self._json(404, {'error': 'not_found'})
        elif not self._authorized():
            self._json(401, {'error': 'not_authorized'})
        else:
            try:
                length = int(self.headers.get('Content-Length', '0'))
                if not 1 <= length <= 4096:
                    raise ValueError('Ongeldige berichtlengte')
                payload = json.loads(self.rfile.read(length))
                domain, service, data = validate_action(payload)
                ha_request('/api/services/' + domain + '/' + service, 'POST', data)
                self._json(200, {'ok': True})
            except (ValueError, json.JSONDecodeError):
                self._json(400, {'error': 'invalid_action'})
            except (HTTPError, URLError, RuntimeError) as error:
                LOG.error('HA actie mislukt: %s', type(error).__name__)
                self._json(502, {'error': 'home_assistant_unavailable'})

    def log_message(self, fmt, *args):
        # Standard log contains path/status only; Authorization header is never logged.
        LOG.info('%s - ' + fmt, self.address_string(), *args)


def main():
    if not HA_TOKEN or len(PAIR_KEY) < 24:
        raise SystemExit('HA_TOKEN ontbreekt of CYN_PAIR_KEY is korter dan 24 tekens. Configureer bridge/.env.')
    if urlparse(HA_URL).scheme not in ('http', 'https'):
        raise SystemExit('HA_URL moet een geldige http(s) URL zijn')
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
    srv = ThreadingHTTPServer((BIND, PORT), Handler)
    LOG.info('Bridge start op %s:%d, %d entities; origin(s): %s', BIND, PORT, len(ENTITY_LIST), ', '.join(ALLOWED_ORIGINS))
    try:
        srv.serve_forever(poll_interval=0.5)
    except KeyboardInterrupt:
        pass
    finally:
        srv.server_close()


if __name__ == '__main__':
    main()

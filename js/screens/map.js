// js/screens/map.js — ParkUp Live Map (Leaflet.js — FREE, no API key needed)
import { onGarages, onFreshSpots, addStreetSpot, searchGarages, timeAgo, statusColor, statusLabel } from '../services/db.js';
import { currentUser } from '../services/auth.js';
import { toast, showModal } from '../components/ui.js';

let _map            = null;
let _garageLayer    = null;
let _spotLayer      = null;
let _userMarker     = null;
let _unsubGarages   = null;
let _unsubSpots     = null;
let _showGarages    = true;
let _showStreets    = true;
let _currentLat     = null;
let _currentLng     = null;
let _currentAddress = 'Your current location';
let _countryCode    = null;

export function renderMap(container) {
  container.innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%;overflow:hidden">

      <!-- TOP BAR -->
      <div style="background:white;border-bottom:1px solid #E3F2FD;padding:10px 16px;display:flex;align-items:center;gap:10px;flex-shrink:0;z-index:10">

        <!-- Search + Filter row -->
        <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">

          <!-- Search -->
          <div style="position:relative;flex:1;min-width:0;max-width:220px">
            <input id="map-search"
              style="width:100%;padding:8px 12px 8px 34px;border:1.5px solid #E3F2FD;border-radius:22px;font-size:13px;color:#0A2540;outline:none;font-family:'Inter',sans-serif;transition:border-color .2s;background:#F7FBFF"
              placeholder="Search a garage..."
              onfocus="this.style.borderColor='#29ABE2';this.style.background='white'"
              onblur="this.style.borderColor='#E3F2FD';this.style.background='#F7FBFF'"/>
            <svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%);pointer-events:none" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#5B8DB8" stroke-width="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <div id="search-drop" style="display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;background:white;border-radius:12px;border:1px solid #E3F2FD;box-shadow:0 8px 24px rgba(0,0,0,.12);z-index:9999;overflow:hidden;max-height:220px;overflow-y:auto"></div>
          </div>

          <!-- Filter chips -->
          <button id="chip-garages" onclick="toggleLayer('garages')"
            style="display:flex;align-items:center;gap:5px;padding:7px 13px;border-radius:22px;font-size:12px;font-weight:700;cursor:pointer;border:2px solid #29ABE2;background:#29ABE2;color:white;font-family:'Inter',sans-serif;transition:all .2s;white-space:nowrap;flex-shrink:0">
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/></svg>
            Garages
          </button>
          <button id="chip-streets" onclick="toggleLayer('streets')"
            style="display:flex;align-items:center;gap:5px;padding:7px 13px;border-radius:22px;font-size:12px;font-weight:700;cursor:pointer;border:2px solid #1A73CC;background:#1A73CC;color:white;font-family:'Inter',sans-serif;transition:all .2s;white-space:nowrap;flex-shrink:0">
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>
            Street Spots
          </button>

        </div>

        <!-- Add Garage — admin only, hidden by default -->
        <button id="add-garage-btn"
          style="display:none;align-items:center;gap:6px;padding:8px 16px;border-radius:10px;background:#0A2540;color:white;font-size:13px;font-weight:700;border:none;cursor:pointer;font-family:Inter,sans-serif;transition:background .2s;white-space:nowrap"
          onmouseover="this.style.background='#1255A0'" onmouseout="this.style.background='#0A2540'"
          onclick="openAddGarageModal()">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Garage
        </button>

      </div>

      <!-- MAP CONTAINER + SIDE PANEL -->
      <div style="flex:1;display:flex;min-height:0;overflow:hidden;position:relative">
        <div id="leaflet-map" style="flex:1;height:100%;z-index:1;transition:all .3s"></div>

        <!-- Legend toggle button -->
        <button id="legend-toggle-btn" onclick="window.toggleLegend()"
          style="position:absolute;top:10px;right:10px;z-index:501;width:36px;height:36px;border-radius:10px;background:white;border:1.5px solid #E3F2FD;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.15);transition:all .2s"
          title="Show/Hide Status">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#29ABE2" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </button>

        <!-- Status Legend - hidden by default -->
        <div id="legend-panel" style="position:absolute;top:54px;right:10px;z-index:500;background:white;border-radius:14px;padding:10px 14px;box-shadow:0 2px 12px rgba(0,0,0,.15);border:1px solid #E3F2FD;opacity:0;transform:scale(.9) translateY(-6px);pointer-events:none;transition:all .2s cubic-bezier(.34,1.56,.64,1);transform-origin:top right">
          <div style="font-size:9px;font-weight:700;color:#5B8DB8;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">STATUS</div>
          ${['available','few','full'].map(s=>`
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
              <div style="width:10px;height:10px;border-radius:50%;background:${statusColor(s)};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.2);flex-shrink:0"></div>
              <span style="font-size:11px;font-weight:600;color:#0A2540">${statusLabel(s)}</span>
            </div>
          `).join('')}
          <div style="border-top:1px solid #E3F2FD;margin-top:6px;padding-top:6px;display:flex;align-items:center;gap:8px">
            <div style="width:10px;height:10px;border-radius:50%;background:#29ABE2;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.2);flex-shrink:0"></div>
            <span style="font-size:11px;font-weight:600;color:#0A2540">Street Spot</span>
          </div>
        </div>

        <!-- Garage Detail Panel -->
        <div id="garage-panel" style="width:0;overflow:hidden;transition:width .3s ease;background:white;border-left:1px solid #E3F2FD;flex-shrink:0;display:flex;flex-direction:column"></div>
      </div>

      <!-- BOTTOM BAR -->
      <div style="background:#0A2540;padding:8px 12px;display:flex;align-items:center;gap:8px;flex-shrink:0">

        <!-- My Location — icon only -->
        <button onclick="goToMyLocation()"
          style="display:flex;align-items:center;justify-content:center;width:42px;height:42px;border-radius:12px;background:rgba(255,255,255,.1);color:white;border:1.5px solid rgba(255,255,255,.15);cursor:pointer;transition:all .2s;flex-shrink:0"
          title="My Location"
          onmouseover="this.style.background='rgba(255,255,255,.2)'" onmouseout="this.style.background='rgba(255,255,255,.1)'">
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
          </svg>
        </button>

        <!-- Report — icon + text inline -->
        <button onclick="openReport()"
          style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px;height:42px;border-radius:12px;background:#29ABE2;color:white;border:none;cursor:pointer;font-family:'Inter',sans-serif;transition:all .2s"
          onmouseover="this.style.background='#1A93C8'" onmouseout="this.style.background='#29ABE2'">
          <div style="width:24px;height:24px;border-radius:50%;background:rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="white" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </div>
          <span style="font-size:13px;font-weight:800;white-space:nowrap">Report Empty Spot</span>
        </button>

        <!-- Google Maps — icon only -->
        <button onclick="openGoogleMaps()"
          style="display:flex;align-items:center;justify-content:center;width:42px;height:42px;border-radius:12px;background:rgba(255,255,255,.1);color:white;border:1.5px solid rgba(255,255,255,.15);cursor:pointer;transition:all .2s;flex-shrink:0"
          title="Google Maps"
          onmouseover="this.style.background='rgba(255,255,255,.2)'" onmouseout="this.style.background='rgba(255,255,255,.1)'">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            <circle cx="12" cy="9" r="2.5"/>
          </svg>
        </button>
      </div>
    </div>
  `;

  _initLeaflet();
  _setupSearch();
  setTimeout(_checkAdminBtn, 800);

  // Only subscribe once — keep subscriptions alive across navigations
  if (!_unsubGarages) _unsubGarages = onGarages(gs => _renderGarages(gs));
  if (!_unsubSpots)   _unsubSpots   = onFreshSpots(ss => _renderSpots(ss));
}

// ── Init Leaflet ─────────────────────────
function _initLeaflet() {
  if (!window.L) {
    // Load Leaflet CSS
    const link = document.createElement('link');
    link.rel  = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    // Load Leaflet JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => _createMap();
    document.head.appendChild(script);
  } else {
    _createMap();
  }
}

function _createMap() {
  const el = document.getElementById('leaflet-map');
  if (!el) return;

  // If map already exists, just re-attach it to the new DOM element
  if (_map) {
    try {
      // Move the map container into the new div
      const existingContainer = _map.getContainer();
      el.parentNode.replaceChild(existingContainer, el);
      existingContainer.style.flex    = '1';
      existingContainer.style.height  = '100%';
      existingContainer.id = 'leaflet-map';
      setTimeout(() => _map.invalidateSize(), 100);
      return;
    } catch(e) {
      // If re-attach fails, destroy and recreate
      try { _map.remove(); } catch(e2) {}
      _map = null;
    }
  }

  _map = L.map('leaflet-map', { zoomControl: true }).setView([30.0444, 31.2357], 13);
  window._map = _map; // expose for other screens

  // OpenStreetMap tiles — FREE, no API key
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(_map);

  _garageLayer = L.layerGroup().addTo(_map);
  _spotLayer   = L.layerGroup().addTo(_map);

  // Get user location
  goToMyLocation();
}

// ── My Location ──────────────────────────
window.goToMyLocation = () => {
  if (!navigator.geolocation || !_map) return;
  navigator.geolocation.getCurrentPosition(pos => {
    _currentLat = pos.coords.latitude;
    _currentLng = pos.coords.longitude;
    _map.setView([_currentLat, _currentLng], 15);

    // Remove old user marker
    if (_userMarker) _map.removeLayer(_userMarker);

    // Blue pulsing user dot
    const icon = L.divIcon({
      className: '',
      html: `<div style="width:16px;height:16px;border-radius:50%;background:#1565C0;border:3px solid white;box-shadow:0 0 0 6px rgba(21,101,192,.2)"></div>`,
      iconSize:   [16, 16],
      iconAnchor: [8, 8],
    });
    _userMarker = L.marker([_currentLat, _currentLng], { icon, zIndexOffset: 1000 })
      .addTo(_map)
      .bindPopup('<b>You are here</b>');

    // Get address
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${_currentLat}&lon=${_currentLng}&format=json`)
      .then(r => r.json())
      .then(d => {
        const city    = d.address?.city || d.address?.town || d.address?.village || '';
        const country = d.address?.country_code?.toUpperCase() || '';
        _countryCode    = d.address?.country_code?.toLowerCase() || null;
        _currentAddress = d.display_name?.split(',').slice(0,3).join(',') || 'Your location';
        const lbl = document.getElementById('location-label');
        if (lbl) lbl.textContent = city && country ? `${city}, ${country}` : 'Near You';
      }).catch(() => {});
  }, () => {}, { enableHighAccuracy: true, timeout: 8000 });
};

// ── Open Google Maps ─────────────────────
window.openGoogleMaps = () => {
  const lat = _currentLat || 30.0444;
  const lng = _currentLng || 31.2357;
  window.open(`https://www.google.com/maps/@${lat},${lng},15z`, '_blank');
};

// ── Garage Detail Side Panel ─────────────
window._openGaragePanel = _openGaragePanel;
function _openGaragePanel(g) {
  const panel = document.getElementById('garage-panel');
  if (!panel) return;

  const color = statusColor(g.status);
  const pct   = g.totalSpots > 0 ? Math.round(((g.totalSpots - g.availableSpots) / g.totalSpots) * 100) : 0;
  const initials = (g.managerName || 'MN').split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();

  panel.style.width = '320px';
  panel.innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%;overflow-y:auto;font-family:'Inter',sans-serif">

      <!-- Header -->
      <div style="background:#0A2540;padding:16px 20px;flex-shrink:0">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <button onclick="_closeGaragePanel()"
            style="display:flex;align-items:center;gap:5px;background:none;border:none;color:#29ABE2;font-size:12px;font-weight:700;cursor:pointer;padding:0;font-family:Inter,sans-serif">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><polyline points="15,18 9,12 15,6"/></svg>
            Close
          </button>
          <button onclick="_closeGaragePanel()" style="background:none;border:none;color:rgba(255,255,255,.4);font-size:20px;cursor:pointer;padding:0;line-height:1">×</button>
        </div>
        <h3 style="font-size:19px;font-weight:900;color:white;margin:0 0 4px">${g.name}</h3>
        <p style="font-size:11px;color:rgba(255,255,255,.5);margin:0 0 10px">${g.address||''}</p>
        <div style="display:flex;align-items:center;gap:10px">
          <span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:12px;font-size:11px;font-weight:700;background:${color}22;color:${color}">
            <span style="width:6px;height:6px;border-radius:50%;background:${color};display:inline-block"></span>
            ${statusLabel(g.status)}
          </span>
          <span style="font-size:11px;color:rgba(255,255,255,.4)">Updated ${timeAgo(g.lastUpdated)}</span>
        </div>
      </div>

      <!-- Content -->
      <div style="padding:16px;display:flex;flex-direction:column;gap:12px;flex:1">

        <!-- Details — stacked rows -->
        <div style="background:#F8FBFF;border-radius:12px;padding:4px;border:1px solid #E3F2FD">
          ${(()=>{
            const rows = [
              ['<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#29ABE2" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>', 'Working Hours', g.workingHours||'—'],
              ['<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#29ABE2" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>', 'Price / Hour', (g.pricePerHour||0)+' EGP'],
              ['<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#29ABE2" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/></svg>', 'Available', (g.availableSpots||0)+' / '+(g.totalSpots||0)+' spots'],
              ['<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#29ABE2" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.21h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>', 'Manager Phone', g.managerPhone||'—'],
            ];
            return rows.map(([svg, label, val], i) => `
            <div style="display:flex;align-items:center;gap:12px;padding:12px;${i < rows.length-1 ? 'border-bottom:1px solid #EEF4FF' : ''}">
              <div style="width:34px;height:34px;border-radius:9px;background:#EEF6FC;display:flex;align-items:center;justify-content:center;flex-shrink:0">${svg}</div>
              <div style="flex:1">
                <div style="font-size:11px;color:#5B8DB8;font-weight:600">${label}</div>
                <div style="font-size:14px;font-weight:700;color:#0A2540;margin-top:2px">${val}</div>
              </div>
            </div>
          `).join('');
          })()}
        </div>

        <!-- Manager -->
        <div style="background:#F8FBFF;border-radius:12px;padding:14px;border:1px solid #E3F2FD">
          <div style="font-size:10px;font-weight:700;color:#29ABE2;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px">Garage Manager</div>
          <div style="display:flex;align-items:center;gap:12px">
            <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#1A73CC,#29ABE2);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;color:white;flex-shrink:0">${initials}</div>
            <div style="flex:1">
              <div style="font-size:13px;font-weight:800;color:#0A2540">${g.managerName||'—'}</div>
              <div style="font-size:11px;color:#5B8DB8;margin-top:2px">On duty</div>
            </div>
            ${g.managerPhone ? `
            <a href="tel:${g.managerPhone}"
              style="width:34px;height:34px;border-radius:50%;background:#29ABE2;display:flex;align-items:center;justify-content:center;flex-shrink:0;text-decoration:none">
              <svg width="15" height="15" fill="white" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.21h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            </a>
            ` : ''}
          </div>
        </div>

      </div>

      <!-- Bottom actions -->
      <div style="padding:16px;display:flex;gap:10px;flex-shrink:0;border-top:1px solid #E3F2FD">
        <a href="https://www.google.com/maps/dir/?api=1&destination=${g.lat},${g.lng}" target="_blank"
          style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px;padding:13px;background:#29ABE2;color:white;border-radius:12px;font-size:13px;font-weight:700;text-decoration:none;transition:background .2s"
          onmouseover="this.style.background='#1A73CC'" onmouseout="this.style.background='#29ABE2'">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><polygon points="3,11 22,2 13,21 11,13 3,11"/></svg>
          Get Directions
        </a>
      </div>
    </div>
  `;

  // Force map resize
  setTimeout(() => _map?.invalidateSize(), 320);
}

window._closeGaragePanel = () => {
  const panel = document.getElementById('garage-panel');
  if (panel) panel.style.width = '0';
  setTimeout(() => _map?.invalidateSize(), 320);
};

// ── Garage markers ───────────────────────
function _renderGarages(garages) {
  if (!_map || !_garageLayer) return;
  _garageLayer.clearLayers();
  if (!_showGarages) return;

  garages.forEach(g => {
    if (!g.lat || !g.lng) return;
    const color = statusColor(g.status);
    const pct   = g.totalSpots > 0 ? Math.round((g.availableSpots / g.totalSpots) * 100) : 0;

    const icon = L.divIcon({
      className: '',
      html: `
        <div style="position:relative;display:flex;flex-direction:column;align-items:center">
          <!-- Garage name label -->
          <div style="background:#0A2540;color:white;font-size:10px;font-weight:700;padding:3px 8px;border-radius:8px;white-space:nowrap;margin-bottom:4px;font-family:'Inter',sans-serif;box-shadow:0 2px 6px rgba(0,0,0,.3);max-width:120px;overflow:hidden;text-overflow:ellipsis">
            ${g.name.length > 16 ? g.name.slice(0,16)+'…' : g.name}
          </div>
          <!-- Big P pin -->
          <div style="width:48px;height:48px;border-radius:50%;background:${color};border:3px solid white;display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:22px;font-weight:900;color:white;box-shadow:0 4px 14px rgba(0,0,0,.35);cursor:pointer;position:relative">
            P
            <!-- Pulse ring for available -->
            ${g.status === 'available' ? '<div style="position:absolute;inset:-5px;border-radius:50%;border:2px solid ' + color + ';opacity:0.4;animation:spotPulse 2s ease-out infinite"></div>' : ''}
          </div>
          <!-- Arrow -->
          <div style="width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:10px solid ${color};margin-top:2px"></div>
          <!-- Spots badge -->
          <div style="background:white;color:#0A2540;font-size:9px;font-weight:700;padding:2px 7px;border-radius:6px;margin-top:3px;white-space:nowrap;border:1px solid #E3F2FD;box-shadow:0 1px 4px rgba(0,0,0,.15)">
            ${g.availableSpots||0}/${g.totalSpots||0} spots
          </div>
        </div>`,
      iconSize:   [120, 90],
      iconAnchor: [60, 68],
      popupAnchor:[0, -90],
    });

    const marker = L.marker([g.lat, g.lng], { icon });
    marker.on('click', () => _openGaragePanel(g));
    marker.addTo(_garageLayer);
  });
}

// ── Street spot markers ──────────────────
function _renderSpots(spots) {
  if (!_map || !_spotLayer) return;
  _spotLayer.clearLayers();
  if (!_showStreets) return;

  // Add pulse animation style once
  if (!document.getElementById('spot-pulse-style')) {
    const style = document.createElement('style');
    style.id = 'spot-pulse-style';
    style.textContent = `
      @keyframes spotPulse {
        0%   { transform: scale(1);   opacity: 0.7; }
        50%  { transform: scale(1.8); opacity: 0;   }
        100% { transform: scale(1);   opacity: 0;   }
      }
      @keyframes spotBlink {
        0%,100% { box-shadow: 0 0 0 0 rgba(41,171,226,0.7); }
        50%     { box-shadow: 0 0 0 8px rgba(41,171,226,0); }
      }
      .spot-pin { animation: spotBlink 1.8s ease-in-out infinite; }
    `;
    document.head.appendChild(style);
  }

  spots.forEach(sp => {
    if (!sp.lat || !sp.lng) return;

    const ago      = timeAgo(sp.reportedAt);
    const isFresh  = sp.isFresh;
    const color    = isFresh ? '#29ABE2' : '#FB8C00';
    const ringColor= isFresh ? 'rgba(41,171,226,0.35)' : 'rgba(251,140,0,0.35)';

    // Compute distance from user
    let distLabel = '';
    if (_currentLat && _currentLng) {
      const R    = 6371000;
      const dLat = (sp.lat - _currentLat) * Math.PI / 180;
      const dLng = (sp.lng - _currentLng) * Math.PI / 180;
      const a    = Math.sin(dLat/2)**2 + Math.cos(_currentLat*Math.PI/180) * Math.cos(sp.lat*Math.PI/180) * Math.sin(dLng/2)**2;
      const dist = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
      distLabel  = dist < 1000 ? `${dist} m away` : `${(dist/1000).toFixed(1)} km away`;
    }

    const icon = L.divIcon({
      className: '',
      html: `
        <div style="position:relative;display:flex;flex-direction:column;align-items:center">
          <!-- Time badge above -->
          <div style="background:#0A2540;color:${color};font-size:10px;font-weight:700;padding:3px 8px;border-radius:8px;white-space:nowrap;margin-bottom:4px;font-family:'Inter',sans-serif;box-shadow:0 2px 6px rgba(0,0,0,.3)">
            ${ago}
          </div>
          <!-- Pulsing dot -->
          <div class="spot-pin" style="width:20px;height:20px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3);cursor:pointer;position:relative">
            <!-- Pulse ring -->
            <div style="position:absolute;inset:-5px;border-radius:50%;background:${ringColor};animation:spotPulse 2s ease-out infinite"></div>
          </div>
          <!-- Distance badge below -->
          ${distLabel ? `
          <div style="background:white;color:#0A2540;font-size:9px;font-weight:700;padding:2px 6px;border-radius:6px;margin-top:4px;white-space:nowrap;font-family:'Inter',sans-serif;border:1px solid #E3F2FD;box-shadow:0 1px 4px rgba(0,0,0,.15)">
            ${distLabel}
          </div>` : ''}
        </div>`,
      iconSize:    [80, distLabel ? 68 : 52],
      iconAnchor:  [40, distLabel ? 44 : 36],
      popupAnchor: [0, distLabel ? -68 : -52],
    });

    // Build popup with real DOM (not innerHTML) so events work reliably
    const user    = currentUser();
    const isOwner = user && sp.reportedBy === user.uid;
    const marker  = L.marker([sp.lat, sp.lng], { icon });

    // Build popup DOM
    const wrap = document.createElement('div');
    wrap.style.cssText = 'font-family:Inter,sans-serif;padding:4px;min-width:220px';

    // Header row
    const hdr = document.createElement('div');
    hdr.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px';
    hdr.innerHTML = `
      <div style="width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0"></div>
      <div style="font-weight:900;font-size:14px;color:#0A2540">Street Spot</div>
      <span style="margin-left:auto;font-size:10px;font-weight:700;color:${color};background:${color}22;padding:2px 7px;border-radius:8px">${isFresh ? 'Fresh 🟢' : 'Older 🟠'}</span>
    `;
    wrap.appendChild(hdr);

    // Address
    const addr = document.createElement('div');
    addr.style.cssText = 'font-size:11px;color:#5B8DB8;margin-bottom:6px';
    addr.textContent = '' + (sp.address || 'Unknown location');
    wrap.appendChild(addr);

    // Time + distance
    const meta = document.createElement('div');
    meta.style.cssText = 'display:flex;gap:12px;margin-bottom:8px';
    meta.innerHTML = `
      <div style="font-size:11px;color:#5B8DB8">🕐 <b style="color:#0A2540">${ago}</b></div>
      ${distLabel ? `<div style="font-size:11px;color:#5B8DB8">📏 <b style="color:#0A2540">${distLabel}</b></div>` : ''}
    `;
    wrap.appendChild(meta);

    // Reporter
    const rep = document.createElement('div');
    rep.style.cssText = 'font-size:11px;color:#5B8DB8;margin-bottom:' + (sp.notes ? '6' : '10') + 'px';
    rep.innerHTML = 'By <b style="color:#0A2540">' + (sp.reporterName || 'Anonymous') + '</b>'
      + (isOwner ? ' <span style="font-size:10px;color:#29ABE2;font-weight:700">(You)</span>' : '');
    wrap.appendChild(rep);

    // Notes
    if (sp.notes) {
      const notes = document.createElement('div');
      notes.style.cssText = 'font-size:11px;color:#5B8DB8;font-style:italic;margin-bottom:10px;background:#F0F8FF;padding:6px 8px;border-radius:6px';
      notes.textContent = '"' + sp.notes + '"';
      wrap.appendChild(notes);
    }

    // Buttons row
    const btns = document.createElement('div');
    btns.style.cssText = 'display:flex;gap:6px;margin-top:4px';

    // Navigate button
    const navBtn = document.createElement('a');
    navBtn.href   = 'https://www.google.com/maps/dir/?api=1&destination=' + sp.lat + ',' + sp.lng;
    navBtn.target = '_blank';
    navBtn.style.cssText = 'flex:1;display:block;text-align:center;padding:8px;background:#29ABE2;color:white;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none';
    navBtn.textContent = 'Navigate';
    navBtn.addEventListener('click', async () => {
      // Auto-remove spot when someone navigates to it
      try {
        const { deleteSpot } = await import('../services/db.js');
        await deleteSpot(sp.id, null); // null = no points deduction, just remove
        // marker will disappear automatically via real-time listener
      } catch(e) {
        console.warn('[ParkUp] Auto-remove on navigate failed:', e.message);
      }
    });
    btns.appendChild(navBtn);

    // Delete button — only for owner
    if (isOwner) {
      const delBtn = document.createElement('button');
      delBtn.textContent = 'Remove';
      delBtn.style.cssText = 'padding:8px 12px;background:#FFEBEE;color:#C62828;border:1.5px solid #FFCDD2;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif;white-space:nowrap;transition:background .2s';
      delBtn.onmouseover = () => delBtn.style.background = '#FFCDD2';
      delBtn.onmouseout  = () => delBtn.style.background = '#FFEBEE';
      delBtn.addEventListener('click', async () => {
        if (!confirm('Remove this spot?')) return;
        delBtn.textContent = 'Removing...';
        delBtn.disabled = true;
        try {
          const { deleteSpot } = await import('../services/db.js');
          await deleteSpot(sp.id, user?.uid);
          marker.remove();
          toast('Spot removed ✓');
        } catch(e) {
          toast('Error: ' + e.message, 'error');
          delBtn.textContent = 'Remove';
          delBtn.disabled = false;
        }
      });
      btns.appendChild(delBtn);
    }

    wrap.appendChild(btns);

    const popup = L.popup({ maxWidth: 260 }).setContent(wrap);
    marker.bindPopup(popup).addTo(_spotLayer);
  });
}

// ── Legend toggle ─────────────────────────
let _legendVisible = false;
window.toggleLegend = () => {
  _legendVisible = !_legendVisible;
  const panel = document.getElementById('legend-panel');
  const btn   = document.getElementById('legend-toggle-btn');
  if (!panel) return;
  if (_legendVisible) {
    panel.style.opacity       = '1';
    panel.style.transform     = 'scale(1) translateY(0)';
    panel.style.pointerEvents = 'auto';
    if (btn) btn.style.background = '#E3F2FD';
  } else {
    panel.style.opacity       = '0';
    panel.style.transform     = 'scale(.9) translateY(-6px)';
    panel.style.pointerEvents = 'none';
    if (btn) btn.style.background = 'white';
  }
};

// ── Filter toggle ────────────────────────
window.toggleLayer = (type) => {
  if (type === 'garages') {
    _showGarages = !_showGarages;
    const btn = document.getElementById('chip-garages');
    btn.style.background = _showGarages ? '#29ABE2' : 'transparent';
    btn.style.color      = _showGarages ? 'white'   : '#29ABE2';
    if (_map) {
      _showGarages ? _garageLayer?.addTo(_map) : _map.removeLayer(_garageLayer);
    }
  } else {
    _showStreets = !_showStreets;
    const btn = document.getElementById('chip-streets');
    btn.style.background = _showStreets ? '#1A73CC' : 'transparent';
    btn.style.color      = _showStreets ? 'white'   : '#1A73CC';
    if (_map) {
      _showStreets ? _spotLayer?.addTo(_map) : _map.removeLayer(_spotLayer);
    }
  }
};

// ── Search ───────────────────────────────
function _setupSearch() {
  const input = document.getElementById('map-search');
  const drop  = document.getElementById('search-drop');
  if (!input) return;

  let timer;

  input.addEventListener('input', e => {
    clearTimeout(timer);
    const q = e.target.value.trim();
    if (!q) { drop.style.display = 'none'; return; }
    timer = setTimeout(() => _runSearch(q), 350);
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { const first = drop.querySelector('[data-lat]'); if (first) first.click(); }
    if (e.key === 'Escape') { drop.style.display = 'none'; input.value = ''; }
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('#map-search') && !e.target.closest('#search-drop'))
      drop.style.display = 'none';
  });
}

async function _runSearch(q) {
  const drop = document.getElementById('search-drop');
  drop.style.display = 'block';
  drop.innerHTML = `<div style="padding:12px 16px;font-size:12px;color:#5B8DB8;display:flex;align-items:center;gap:8px">
    <div style="width:12px;height:12px;border:2px solid #29ABE2;border-top-color:transparent;border-radius:50%;animation:spin .6s linear infinite;flex-shrink:0"></div>
    Searching...
  </div>`;

  // Run DB garages + Nominatim places in parallel
  const [garageResults, placeResults] = await Promise.all([
    searchGarages(q).catch(() => []),
    _searchPlaces(q),
  ]);

  drop.innerHTML = '';

  const garages = garageResults.filter(g => g.lat && g.lng);
  const places  = placeResults;

  if (!garages.length && !places.length) {
    drop.innerHTML = `<div style="padding:16px;font-size:13px;color:#5B8DB8;text-align:center">No results for "<b>${q}</b>"</div>`;
    return;
  }

  // Garages section
  if (garages.length) {
    const sec = document.createElement('div');
    sec.style.cssText = 'padding:7px 14px;font-size:10px;font-weight:700;color:#5B8DB8;letter-spacing:1px;text-transform:uppercase;background:#F8FBFF';
    sec.textContent = 'Garages';
    drop.appendChild(sec);
    garages.forEach(g => drop.appendChild(_makeRow({
      type:'garage', icon:'garage',
      label: g.name,
      sub:   g.address || '',
      lat:   g.lat, lng: g.lng,
      status: g.status,
    })));
  }

  // Places section
  if (places.length) {
    const sec = document.createElement('div');
    sec.style.cssText = 'padding:7px 14px;font-size:10px;font-weight:700;color:#5B8DB8;letter-spacing:1px;text-transform:uppercase;background:#F8FBFF' + (garages.length ? ';border-top:1px solid #E3F2FD' : '');
    sec.textContent = 'Places';
    drop.appendChild(sec);
    places.forEach(p => drop.appendChild(_makeRow({
      type:'place', icon:'place',
      label: p.display_name.split(',').slice(0,2).join(',').trim(),
      sub:   p.display_name.split(',').slice(2,4).join(',').trim(),
      lat:   parseFloat(p.lat),
      lng:   parseFloat(p.lon),
    })));
  }
}

function _makeRow(item) {
  const row = document.createElement('div');
  row.dataset.lat = item.lat;
  row.dataset.lng = item.lng;
  row.style.cssText = 'padding:10px 14px;cursor:pointer;border-bottom:1px solid #F8FBFF;display:flex;align-items:center;gap:10px;transition:background .15s';

  const labelEl = document.createElement('div');
  labelEl.style.cssText = 'font-size:18px;flex-shrink:0';
  labelEl.textContent = item.icon;
  row.appendChild(labelEl);

  const textEl = document.createElement('div');
  textEl.style.cssText = 'flex:1;min-width:0';
  textEl.innerHTML = `
    <div style="font-weight:700;font-size:13px;color:#0A2540;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${item.label}</div>
    ${item.sub ? `<div style="font-size:11px;color:#5B8DB8;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${item.sub}</div>` : ''}
  `;
  row.appendChild(textEl);

  if (item.status) {
    const badge = document.createElement('span');
    badge.style.cssText = `font-size:9px;font-weight:700;padding:2px 7px;border-radius:6px;flex-shrink:0;background:${statusColor(item.status)}22;color:${statusColor(item.status)}`;
    badge.textContent = statusLabel(item.status);
    row.appendChild(badge);
  }

  row.addEventListener('mouseover', () => row.style.background = '#F0F8FF');
  row.addEventListener('mouseout',  () => row.style.background = 'white');
  row.addEventListener('click', () => {
    if (_map) {
      _map.setView([item.lat, item.lng], item.type === 'garage' ? 17 : 14);

      // Temp pin for place results
      if (item.type === 'place') {
        const tmpIcon = L.divIcon({
          className: '',
          html: `<div style="display:flex;flex-direction:column;align-items:center">
            <div style="background:#0A2540;color:white;font-size:10px;font-weight:700;padding:3px 8px;border-radius:6px;white-space:nowrap;margin-bottom:4px">${item.label}</div>
            <svg width="20" height="20" fill="#0A2540" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>
          </div>`,
          iconSize: [120, 48], iconAnchor: [60, 48],
        });
        const tmp = L.marker([item.lat, item.lng], { icon: tmpIcon, zIndexOffset: 500 })
          .addTo(_map);
        setTimeout(() => tmp.remove(), 6000);
      }
    }
    document.getElementById('map-search').value = item.label;
    document.getElementById('search-drop').style.display = 'none';
  });

  return row;
}

// Nominatim geocoder — restricted to user's country/location
async function _searchPlaces(q) {
  try {
    // Build params
    const params = new URLSearchParams({
      q,
      format:         'json',
      limit:          '7',
      addressdetails: '1',
    });

    // Restrict to user's country if known
    if (_countryCode) params.set('countrycodes', _countryCode);

    // Bias results toward user's current location if known
    if (_currentLat && _currentLng) {
      const delta = 1.5; // ~150km box
      params.set('viewbox', `${_currentLng - delta},${_currentLat + delta},${_currentLng + delta},${_currentLat - delta}`);
      params.set('bounded', '0'); // 0 = prefer viewbox but fallback outside if needed
    }

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      { headers: { 'Accept-Language': 'en' } }
    );
    return await res.json();
  } catch { return []; }
}
// ── Show Add Garage btn for admins ─────────
function _checkAdminBtn() {
  const roleEl = document.getElementById('u-role');
  const role   = (roleEl?.textContent ?? '').toLowerCase();
  const btn    = document.getElementById('add-garage-btn');
  if (!btn) return;
  if (role.includes('admin')) {
    btn.style.display = 'flex';
  } else if (!role || role === 'locating...') {
    setTimeout(_checkAdminBtn, 600); // retry
  }
}

// ── Add Garage Modal (Admin only) ──────────
window.openAddGarageModal = () => {
  const { showModal } = window._ui || {};

  // Build modal manually to avoid import issues
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:2000;padding:20px';

  const box = document.createElement('div');
  box.style.cssText = 'background:white;border-radius:20px;padding:28px;max-width:520px;width:100%;max-height:90vh;overflow-y:auto;animation:fadeIn .25s ease;font-family:Inter,sans-serif';
  box.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
      <h3 style="font-size:20px;font-weight:900;color:#0A2540;margin:0">Add New Garage</h3>
      <button id="ag-close" style="font-size:24px;color:#5B8DB8;background:none;border:none;cursor:pointer;line-height:1">×</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div style="grid-column:1/-1">
        <label style="display:block;font-size:11px;font-weight:700;color:#5B8DB8;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px">Garage Name *</label>
        <input id="ag-name" style="width:100%;padding:10px 14px;border:1.5px solid #E3F2FD;border-radius:10px;font-size:13px;color:#0A2540;outline:none;font-family:Inter,sans-serif" placeholder="e.g. City Center Garage"/>
      </div>
      <div style="grid-column:1/-1">
        <label style="display:block;font-size:11px;font-weight:700;color:#5B8DB8;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px">Address *</label>
        <input id="ag-addr" style="width:100%;padding:10px 14px;border:1.5px solid #E3F2FD;border-radius:10px;font-size:13px;color:#0A2540;outline:none;font-family:Inter,sans-serif" placeholder="e.g. 123 Main Street"/>
      </div>
      <div>
        <label style="display:block;font-size:11px;font-weight:700;color:#5B8DB8;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px">Latitude</label>
        <input id="ag-lat" type="number" step="0.0001" style="width:100%;padding:10px 14px;border:1.5px solid #E3F2FD;border-radius:10px;font-size:13px;color:#0A2540;outline:none;font-family:Inter,sans-serif" placeholder="30.0626" value="${(_currentLat||'').toString().slice(0,9)}"/>
      </div>
      <div>
        <label style="display:block;font-size:11px;font-weight:700;color:#5B8DB8;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px">Longitude</label>
        <input id="ag-lng" type="number" step="0.0001" style="width:100%;padding:10px 14px;border:1.5px solid #E3F2FD;border-radius:10px;font-size:13px;color:#0A2540;outline:none;font-family:Inter,sans-serif" placeholder="31.2001" value="${(_currentLng||'').toString().slice(0,9)}"/>
      </div>
      <div>
        <label style="display:block;font-size:11px;font-weight:700;color:#5B8DB8;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px">Total Spots *</label>
        <input id="ag-total" type="number" min="1" style="width:100%;padding:10px 14px;border:1.5px solid #E3F2FD;border-radius:10px;font-size:13px;color:#0A2540;outline:none;font-family:Inter,sans-serif" placeholder="30"/>
      </div>
      <div>
        <label style="display:block;font-size:11px;font-weight:700;color:#5B8DB8;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px">Price / Hour</label>
        <input id="ag-price" type="number" min="0" style="width:100%;padding:10px 14px;border:1.5px solid #E3F2FD;border-radius:10px;font-size:13px;color:#0A2540;outline:none;font-family:Inter,sans-serif" placeholder="10"/>
      </div>
      <div style="grid-column:1/-1">
        <label style="display:block;font-size:11px;font-weight:700;color:#5B8DB8;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px">Working Hours</label>
        <input id="ag-hours" style="width:100%;padding:10px 14px;border:1.5px solid #E3F2FD;border-radius:10px;font-size:13px;color:#0A2540;outline:none;font-family:Inter,sans-serif" placeholder="8 AM — 12 AM"/>
      </div>
      <div>
        <label style="display:block;font-size:11px;font-weight:700;color:#5B8DB8;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px">Manager Name</label>
        <input id="ag-mgr" style="width:100%;padding:10px 14px;border:1.5px solid #E3F2FD;border-radius:10px;font-size:13px;color:#0A2540;outline:none;font-family:Inter,sans-serif" placeholder="Ahmed Hassan"/>
      </div>
      <div>
        <label style="display:block;font-size:11px;font-weight:700;color:#5B8DB8;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px">Manager Phone</label>
        <input id="ag-phone" style="width:100%;padding:10px 14px;border:1.5px solid #E3F2FD;border-radius:10px;font-size:13px;color:#0A2540;outline:none;font-family:Inter,sans-serif" placeholder="+20 100 000 0000"/>
      </div>
    </div>
    <div id="ag-err" style="display:none;background:#FFEBEE;color:#C62828;border-radius:8px;padding:10px 14px;font-size:13px;font-weight:600;margin-top:12px"></div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px">
      <button id="ag-cancel" style="padding:10px 18px;border-radius:10px;font-weight:700;cursor:pointer;background:white;color:#0A2540;border:1.5px solid #E3F2FD;font-family:Inter,sans-serif;font-size:13px">Cancel</button>
      <button id="ag-submit" style="padding:10px 20px;border-radius:10px;font-weight:700;cursor:pointer;background:#29ABE2;color:white;border:none;font-family:Inter,sans-serif;font-size:13px">+ Add Garage</button>
    </div>
  `;

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  box.querySelector('#ag-close').onclick  = close;
  box.querySelector('#ag-cancel').onclick = close;
  overlay.onclick = e => { if (e.target === overlay) close(); };

  box.querySelector('#ag-submit').addEventListener('click', async () => {
    const name  = document.getElementById('ag-name')?.value.trim();
    const addr  = document.getElementById('ag-addr')?.value.trim();
    const total = parseInt(document.getElementById('ag-total')?.value) || 0;
    const errEl = document.getElementById('ag-err');

    if (!name || !addr || !total) {
      errEl.textContent = 'Name, address and total spots are required';
      errEl.style.display = 'block';
      return;
    }

    const submitBtn = document.getElementById('ag-submit');
    submitBtn.textContent = 'Adding...';
    submitBtn.disabled    = true;

    try {
      const { addGarage } = await import('../services/db.js');
      await addGarage({
        name,
        address:        addr,
        lat:            parseFloat(document.getElementById('ag-lat')?.value)   || 0,
        lng:            parseFloat(document.getElementById('ag-lng')?.value)   || 0,
        totalSpots:     total,
        availableSpots: total,
        pricePerHour:   parseFloat(document.getElementById('ag-price')?.value) || 0,
        workingHours:   document.getElementById('ag-hours')?.value.trim()      || '8 AM — 12 AM',
        managerName:    document.getElementById('ag-mgr')?.value.trim()        || '',
        managerPhone:   document.getElementById('ag-phone')?.value.trim()      || '',
        status:         'available',
        isActive:       true,
      });
      close();
      toast(' Garage added! Showing on map now.');
    } catch(e) {
      errEl.textContent   = 'Error: ' + e.message;
      errEl.style.display = 'block';
      submitBtn.textContent = '+ Add Garage';
      submitBtn.disabled    = false;
    }
  });
};

// ── Report Modal ─────────────────────────
window.openReport = () => {
  const user = currentUser();
  if (!user) { toast('Please sign in first', 'error'); return; }

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(async pos => {
      _currentLat = pos.coords.latitude;
      _currentLng = pos.coords.longitude;
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${_currentLat}&lon=${_currentLng}&format=json`);
        const d = await r.json();
        _currentAddress = d.display_name?.split(',').slice(0,3).join(',') || 'Your location';
      } catch {}
      _showReportModal(user);
    }, () => _showReportModal(user), { timeout: 4000 });
  } else {
    _showReportModal(user);
  }
};

function _showReportModal(user) {
  showModal({
    title: 'Report Empty Spot',
    body: `
      <div style="display:flex;flex-direction:column;gap:14px">
        <!-- GPS -->
        <div>
          <label style="display:block;font-size:11px;font-weight:700;color:#5B8DB8;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Your Location</label>
          <div style="background:#F0F8FF;border-radius:10px;padding:10px 14px;display:flex;align-items:center;gap:10px;border:1.5px solid ${_currentLat ? '#29ABE2' : '#BBDEFB'}">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="${_currentLat ? '#29ABE2' : '#5B8DB8'}" stroke-width="2">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/>
            </svg>
            <div>
              <div style="font-size:12px;font-weight:700;color:#0A2540">${_currentLat ? '✓ GPS Active' : 'GPS unavailable'}</div>
              <div style="font-size:11px;color:#5B8DB8;margin-top:1px">${_currentAddress}</div>
            </div>
          </div>
        </div>
        <!-- Photo -->
        <div>
          <label style="display:block;font-size:11px;font-weight:700;color:#5B8DB8;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">
            Add a Photo <span style="font-weight:700;color:#29ABE2">+5 pts</span>
          </label>
          <label style="display:flex;align-items:center;justify-content:center;gap:8px;padding:13px;border-radius:10px;border:2px dashed #BBDEFB;cursor:pointer;background:#F0F8FF;transition:border-color .2s"
            onmouseover="this.style.borderColor='#29ABE2'" onmouseout="this.style.borderColor='#BBDEFB'">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#29ABE2" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg>
            <span style="font-size:13px;font-weight:600;color:#5B8DB8">Upload or take a photo</span>
            <input type="file" id="photo-file" accept="image/*" style="display:none" onchange="
              document.getElementById('pname').textContent='✓ '+this.files[0]?.name;
              document.getElementById('pts-total').textContent='+15';
              document.getElementById('pts-note').textContent='10 pts for report + 5 pts for photo';
            "/>
          </label>
          <div id="pname" style="font-size:11px;color:#29ABE2;margin-top:4px"></div>
        </div>
        <!-- Notes -->
        <div>
          <label style="display:block;font-size:11px;font-weight:700;color:#5B8DB8;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">
            Notes <span style="font-weight:400;text-transform:none;letter-spacing:0;color:#BBDEFB">(optional)</span>
          </label>
          <textarea id="snotes" style="width:100%;padding:10px 14px;border:1.5px solid #E3F2FD;border-radius:10px;font-size:13px;font-family:'Inter',sans-serif;color:#0A2540;outline:none;resize:none;height:64px;transition:border-color .2s"
            placeholder="e.g. Space for 2 cars, near the corner..."
            onfocus="this.style.borderColor='#29ABE2'" onblur="this.style.borderColor='#E3F2FD'"></textarea>
        </div>
        <!-- Points -->
        <div style="background:#0A2540;border-radius:10px;padding:12px 16px;display:flex;align-items:center;justify-content:space-between">
          <div>
            <div style="font-size:12px;color:rgba(255,255,255,.6)">You'll earn</div>
            <div id="pts-note" style="font-size:10px;color:#29ABE2;margin-top:2px">10 pts for report · add photo for +5 more</div>
          </div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:26px;color:white"><span id="pts-total" style="color:#29ABE2">+10</span> pts</div>
        </div>
      </div>
    `,
    confirmLabel: '✓ Submit Report',
    onConfirm: async () => {
      const notes = document.getElementById('snotes')?.value || '';
      const photo = document.getElementById('photo-file')?.files[0];
      try {
        await addStreetSpot({
          uid: user.uid, reporterName: user.displayName || 'User',
          lat: _currentLat || 0, lng: _currentLng || 0,
          address: _currentAddress, type: 'street', notes, photoFile: photo,
        });
        const pts = photo ? 15 : 10;
        toast(`Spot reported! +${pts} pts earned.`);
        // Drop marker on map immediately
        if (_map && _spotLayer && _currentLat) {
          const icon = L.divIcon({
            className:'',
            html:`<div style="width:14px;height:14px;border-radius:50%;background:#29ABE2;border:2.5px solid #0A2540;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>`,
            iconSize:[14,14], iconAnchor:[7,7],
          });
          L.marker([_currentLat, _currentLng], { icon })
            .bindPopup('<b>Just reported!</b><br>'+_currentAddress)
            .addTo(_spotLayer);
        }
      } catch(e) { toast('Error: ' + e.message, 'error'); }
    }
  });

  window.selType = btn => {
    document.querySelectorAll('.type-opt').forEach(b => {
      b.style.borderColor='#E3F2FD'; b.style.background='white';
      b.querySelector('div:last-child').style.color='#5B8DB8';
      b.classList.remove('sel');
    });
    btn.style.borderColor='#29ABE2'; btn.style.background='#F0F8FF';
    btn.querySelector('div:last-child').style.color='#0A2540';
    btn.classList.add('sel');
  };
}

// js/screens/list.js
import { onGarages, onFreshSpots, timeAgo, statusColor, statusLabel } from '../services/db.js';
import { statusPill, capBar, spinner, empty } from '../components/ui.js';

let _unsubG = null, _unsubS = null, _activeTab = 'garages';
let _garages = [], _spots = [];
let _userLat = null, _userLng = null;

// Haversine distance in meters
function _distanceTo(lat2, lng2) {
  if (!_userLat || !_userLng || !lat2 || !lng2) return null;
  const R = 6371000;
  const dLat = (lat2 - _userLat) * Math.PI / 180;
  const dLng = (lng2 - _userLng) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
    Math.cos(_userLat * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng/2)**2;
  const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(d);
}

function _formatDist(meters) {
  if (meters === null) return null;
  if (meters < 50)   return `< 50 m`;
  if (meters < 1000) return `~${Math.round(meters / 50) * 50} m`;
  return `~${(meters / 1000).toFixed(1)} km`;
}

export function renderList(container) {
  // Get user location for distance calculations
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      _userLat = pos.coords.latitude;
      _userLng = pos.coords.longitude;
      // Re-render current tab with real distances
      if (_activeTab === 'garages') _renderGarages();
      else _renderSpots();
    }, () => {}, { timeout: 5000 });
  }

  container.innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%;overflow:hidden;background:#F0F8FF">

      <!-- Header -->
      <div style="background:white;border-bottom:1px solid #E3F2FD;padding:20px 24px 0;flex-shrink:0">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px">
          <div>
            <h2 style="font-size:20px;font-weight:900;color:#0A2540;margin:0">Nearby Parking</h2>
            <p style="font-size:13px;color:#5B8DB8;margin:4px 0 0" id="list-subtitle">Loading...</p>
          </div>
          <!-- View on Map button -->
          <button onclick="window._nav('map')"
            style="display:flex;align-items:center;gap:6px;padding:9px 16px;background:#0A2540;color:white;border:none;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif;transition:background .2s;white-space:nowrap;flex-shrink:0"
            onmouseover="this.style.background='#29ABE2'" onmouseout="this.style.background='#0A2540'">
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><polygon points="1,6 1,22 8,18 16,22 23,18 23,2 16,6 8,2"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
            View on Map
          </button>
        </div>

        <!-- Tabs -->
        <div style="display:flex;gap:0">
          <button id="tab-garages" onclick="switchTab('garages')"
            style="padding:10px 20px;font-size:13px;font-weight:700;cursor:pointer;border:none;background:transparent;font-family:Inter,sans-serif;border-bottom:3px solid #29ABE2;color:#0A2540;transition:all .2s">
            Garages
          </button>
          <button id="tab-streets" onclick="switchTab('streets')"
            style="padding:10px 20px;font-size:13px;font-weight:700;cursor:pointer;border:none;background:transparent;font-family:Inter,sans-serif;border-bottom:3px solid transparent;color:#5B8DB8;transition:all .2s">
            Street Spots
          </button>
        </div>
      </div>

      <!-- List body -->
      <div style="flex:1;overflow-y:auto;padding:20px 24px" id="list-body">
        ${spinner()}
      </div>
    </div>
  `;

  // Subscribe to both
  if (_unsubG) _unsubG();
  if (_unsubS) _unsubS();

  _unsubG = onGarages(garages => {
    _garages = garages;
    if (_activeTab === 'garages') _renderGarages();
  });

  _unsubS = onFreshSpots(spots => {
    _spots = spots;
    if (_activeTab === 'streets') _renderSpots();
  });

  // Tab switch
  window.switchTab = (tab) => {
    _activeTab = tab;
    // Update tab styles
    const gBtn = document.getElementById('tab-garages');
    const sBtn = document.getElementById('tab-streets');
    if (!gBtn || !sBtn) return;
    if (tab === 'garages') {
      gBtn.style.borderBottomColor = '#29ABE2'; gBtn.style.color = '#0A2540';
      sBtn.style.borderBottomColor = 'transparent'; sBtn.style.color = '#5B8DB8';
      _renderGarages();
    } else {
      sBtn.style.borderBottomColor = '#29ABE2'; sBtn.style.color = '#0A2540';
      gBtn.style.borderBottomColor = 'transparent'; gBtn.style.color = '#5B8DB8';
      _renderSpots();
    }
  };
}

// ── Render Garages ────────────────────────
function _renderGarages() {
  const body = document.getElementById('list-body');
  const sub  = document.getElementById('list-subtitle');
  if (!body) return;

  if (sub) sub.textContent = `${_garages.length} garage${_garages.length !== 1 ? 's' : ''} found`;

  if (!_garages.length) {
    body.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;text-align:center;color:#5B8DB8">
      <div style="font-size:48px;margin-bottom:12px;opacity:.3"><svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="#BBDEFB" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/></svg></div>
      <div style="font-size:15px;font-weight:700;color:#0A2540;margin-bottom:4px">No garages yet</div>
      <div style="font-size:13px">Check back soon or report a street spot</div>
    </div>`;
    return;
  }

  body.innerHTML = `<div style="display:flex;flex-direction:column;gap:12px;max-width:720px;margin:0 auto">
    ${_garages.map(g => {
      const color = statusColor(g.status);
      const pct   = g.totalSpots > 0 ? Math.round(((g.totalSpots - g.availableSpots) / g.totalSpots) * 100) : 0;
      const isFull = g.status === 'full';

      return `
        <div style="background:white;border-radius:16px;padding:18px 20px;border:1px solid #E3F2FD;box-shadow:0 2px 8px rgba(10,37,64,.05);cursor:pointer;transition:all .2s;animation:fadeIn .3s ease"
          onmouseover="this.style.boxShadow='0 6px 20px rgba(10,37,64,.1)';this.style.transform='translateY(-1px)'"
          onmouseout="this.style.boxShadow='0 2px 8px rgba(10,37,64,.05)';this.style.transform='translateY(0)'"
          onclick="window._showGarageOnMap('${g.id}')">

          <!-- Top row -->
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px">
            <div style="display:flex;align-items:center;gap:12px;min-width:0">
              <!-- Icon -->
              <div style="width:44px;height:44px;border-radius:12px;background:${color}18;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="${color}" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/></svg>
              </div>
              <div style="min-width:0">
                <div style="font-size:15px;font-weight:900;color:#0A2540;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${g.name}</div>
                <div style="font-size:12px;color:#5B8DB8;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${g.address || '—'}</div>
              </div>
            </div>
            <!-- Status + distance -->
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex-shrink:0">
              ${statusPill(g.status)}
              ${_formatDist(_distanceTo(g.lat, g.lng)) ? `<span style="font-size:11px;font-weight:600;color:#5B8DB8">${_formatDist(_distanceTo(g.lat, g.lng))}</span>` : ''}
            </div>
          </div>

          <!-- Capacity bar -->
          <div style="margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px">
              <span style="font-size:11px;color:#5B8DB8;font-weight:600">Capacity</span>
              <span style="font-size:12px;font-weight:800;color:#0A2540">${g.availableSpots || 0} / ${g.totalSpots || 0} spots</span>
            </div>
            <div style="background:#E3F2FD;border-radius:6px;height:8px;overflow:hidden">
              <div style="height:100%;background:${color};width:${pct}%;border-radius:6px;transition:width .4s ease"></div>
            </div>
            <div style="font-size:10px;font-weight:700;color:${color};margin-top:3px">${pct}% occupied</div>
          </div>

          <!-- Bottom row -->
          <div style="display:flex;align-items:center;justify-content:space-between;padding-top:10px;border-top:1px solid #F0F8FF">
            <div style="display:flex;align-items:center;gap:14px">
              <span style="font-size:11px;color:#5B8DB8"><svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="#5B8DB8" stroke-width="2" style="display:inline;vertical-align:middle;margin-right:3px"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>${g.workingHours || '—'}</span>
              <span style="font-size:11px;color:#5B8DB8"><svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="#5B8DB8" stroke-width="2" style="display:inline;vertical-align:middle;margin-right:3px"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>${g.pricePerHour || 0} EGP/hr</span>
              <span style="font-size:11px;color:#5B8DB8"><svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="#5B8DB8" stroke-width="2" style="display:inline;vertical-align:middle;margin-right:3px"><polyline points="23,4 23,11 16,11"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 11"/></svg>${timeAgo(g.lastUpdated)}</span>
            </div>
            <!-- Action button -->
            ${isFull
              ? `<span style="font-size:12px;font-weight:700;color:#E53935;background:#FFEBEE;padding:6px 12px;border-radius:8px">Full</span>`
              : `<a href="https://www.google.com/maps/dir/?api=1&destination=${g.lat},${g.lng}" target="_blank"
                  onclick="event.stopPropagation()"
                  style="display:flex;align-items:center;gap:5px;padding:7px 14px;background:#29ABE2;color:white;border-radius:9px;font-size:12px;font-weight:700;text-decoration:none;transition:background .2s"
                  onmouseover="this.style.background='#1A73CC'" onmouseout="this.style.background='#29ABE2'">
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><polygon points="3,11 22,2 13,21 11,13 3,11"/></svg>
                  Directions
                </a>`
            }
          </div>
        </div>
      `;
    }).join('')}
  </div>`;

  // Navigate to map and open garage panel
  window._showGarageOnMap = async (garageId) => {
    // Find garage data
    const g = _garages.find(x => x.id === garageId);
    if (!g) return;

    // Switch to map tab
    window._nav('map');

    // Wait for map to render then open panel
    let attempts = 0;
    const tryOpen = () => {
      attempts++;
      if (typeof window._openGaragePanel === 'function') {
        // Center map on garage first
        if (window._map && g.lat && g.lng) {
          window._map.setView([g.lat, g.lng], 16);
        }
        window._openGaragePanel(g);
      } else if (attempts < 15) {
        setTimeout(tryOpen, 200);
      }
    };
    setTimeout(tryOpen, 300);
  };
}

// ── Render Street Spots ───────────────────
function _renderSpots() {
  const body = document.getElementById('list-body');
  const sub  = document.getElementById('list-subtitle');
  if (!body) return;

  if (sub) sub.textContent = `${_spots.length} active report${_spots.length !== 1 ? 's' : ''} (last 30 min)`;

  if (!_spots.length) {
    body.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;text-align:center;color:#5B8DB8">
      <div style="font-size:48px;margin-bottom:12px;opacity:.3"><svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="#BBDEFB" stroke-width="1.5"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg></div>
      <div style="font-size:15px;font-weight:700;color:#0A2540;margin-bottom:4px">No active reports</div>
      <div style="font-size:13px">Be the first to report an empty spot!</div>
    </div>`;
    return;
  }

  body.innerHTML = `<div style="display:flex;flex-direction:column;gap:10px;max-width:720px;margin:0 auto">
    ${_spots.map(sp => {
      const fresh = sp.isFresh;
      const color = fresh ? '#29ABE2' : '#FB8C00';

      return `
        <div style="background:white;border-radius:14px;padding:16px 18px;border:1px solid ${fresh ? '#BBDEFB' : '#FFE0B2'};box-shadow:0 2px 8px rgba(10,37,64,.05);display:flex;align-items:center;gap:14px;animation:fadeIn .3s ease">
          <!-- Icon -->
          <div style="width:42px;height:42px;border-radius:12px;background:${color}18;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="${color}" stroke-width="2">
              <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-2"/>
              <circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>
            </svg>
          </div>

          <!-- Info -->
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:800;color:#0A2540;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${sp.address || 'Unknown location'}</div>
            <div style="font-size:11px;color:#5B8DB8;margin-top:3px">
              By <b style="color:#0A2540">${sp.reporterName || 'Anonymous'}</b>
              · <span style="font-weight:700;color:${color}">${timeAgo(sp.reportedAt)}</span>
              ${sp.confirmed ? `· <span style="color:#43A047;font-weight:700">✓ Confirmed</span>` : ''}
            </div>
            ${sp.notes ? `<div style="font-size:11px;color:#5B8DB8;margin-top:4px;font-style:italic">"${sp.notes}"</div>` : ''}
          </div>

          <!-- Right side -->
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0">
            <span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:7px;background:${color}18;color:${color}">
              ${sp.type || 'street'}
            </span>
            <a href="https://www.google.com/maps/dir/?api=1&destination=${sp.lat},${sp.lng}" target="_blank"
              style="display:flex;align-items:center;gap:4px;font-size:11px;font-weight:700;color:#29ABE2;text-decoration:none"
              onmouseover="this.style.color='#1A73CC'" onmouseout="this.style.color='#29ABE2'">
              <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><polygon points="3,11 22,2 13,21 11,13 3,11"/></svg>
              Navigate
            </a>
          </div>
        </div>
      `;
    }).join('')}
  </div>`;
}

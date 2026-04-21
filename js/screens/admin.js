// js/screens/admin.js — ParkUp Admin Panel (Redesigned)
import { onGarages, onFreshSpots, getAllUsers, onAllUsers, addGarage, updateGarage, deleteGarage, setUserRole, timeAgo, statusColor, statusLabel } from '../services/db.js';
import { toast, showModal, statusPill, capBar, roleBadge, sectionTitle, spinner, empty } from '../components/ui.js';

let _unsubG = null, _unsubS = null;

// ── Shell ─────────────────────────────────
function _shell(tab) {
  const tabs = [
    { id:'dashboard', label:'Dashboard', icon:`<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>` },
    { id:'garages',   label:'Garages',   icon:`<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/></svg>` },
    { id:'users',     label:'Users',     icon:`<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>` },
    { id:'reports',   label:'Reports',   icon:`<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>` },
  ];
  return `
    <div style="display:flex;flex-direction:column;height:100%;overflow:hidden;background:#F0F8FF">
      <div style="background:#0A2540;height:56px;display:flex;align-items:center;padding:0 24px;gap:0;flex-shrink:0">
        <div style="display:flex;align-items:center;gap:10px;margin-right:32px">
          <span style="font-family:'Bebas Neue',sans-serif;font-size:20px;color:white;letter-spacing:2px">Admin Panel</span>
          <span style="background:rgba(229,57,53,.25);color:#FF8A80;font-size:9px;font-weight:700;padding:2px 8px;border-radius:6px;letter-spacing:1px">ADMIN</span>
        </div>
        ${tabs.map(t => `
          <button onclick="window._nav('${t.id}')"
            style="display:flex;align-items:center;gap:7px;padding:0 16px;height:56px;font-size:13px;font-weight:700;cursor:pointer;border:none;font-family:'Inter',sans-serif;border-bottom:3px solid ${t.id===tab?'#29ABE2':'transparent'};background:${t.id===tab?'rgba(41,171,226,.12)':'transparent'};color:${t.id===tab?'white':'rgba(255,255,255,.4)'};transition:all .2s"
            onmouseover="if('${t.id}'!=='${tab}')this.style.color='rgba(255,255,255,.75)'"
            onmouseout="if('${t.id}'!=='${tab}')this.style.color='rgba(255,255,255,.4)'">
            ${t.icon} ${t.label}
          </button>
        `).join('')}
      </div>
      <div style="flex:1;overflow-y:auto" id="admin-body">${spinner()}</div>
    </div>
  `;
}

export function renderAdmin(container, tab = 'dashboard') {
  if (_unsubUsers) { _unsubUsers(); _unsubUsers = null; }
  container.innerHTML = _shell(tab);
  const body = document.getElementById('admin-body');
  if      (tab === 'dashboard') renderDashboard(body);
  else if (tab === 'garages')   renderGarages(body);
  else if (tab === 'users')     renderUsers(body);
  else if (tab === 'reports')   renderReports(body);
}

// ══ DASHBOARD ══════════════════════════════
let _cachedGarages = [], _cachedSpots = [];
let _adminMap = null, _adminGarageLayer = null, _adminSpotLayer = null;

function renderDashboard(body) {
  if (_unsubG) _unsubG();
  if (_unsubS) _unsubS();

  _unsubG = onGarages(garages => {
    _cachedGarages = garages;
    const totalSpots = garages.reduce((s,g) => s+(g.totalSpots||0), 0);
    const available  = garages.reduce((s,g) => s+(g.availableSpots||0), 0);
    const full       = garages.filter(g => g.status==='full').length;
    const occ        = totalSpots > 0 ? Math.round(((totalSpots-available)/totalSpots)*100) : 0;

    body.innerHTML = `
      <div style="padding:24px;max-width:1100px;margin:0 auto">

        <!-- Stat cards -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px">
          ${[
            ['Total Garages',  garages.length, '#29ABE2', '#E3F2FD', `<svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#29ABE2" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/></svg>`],
            ['Available Spots',available,      '#43A047', '#E8F5E9', `<svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#43A047" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>`],
            ['Full Garages',   full,           '#E53935', '#FFEBEE', `<svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#E53935" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`],
            ['Occupancy',      occ+'%',        '#1A73CC', '#E3F2FD', `<svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#1A73CC" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`],
          ].map(([label,val,color,bg,icon]) => `
            <div style="background:white;border-radius:16px;padding:20px;border:1px solid #E3F2FD;box-shadow:0 2px 8px rgba(10,37,64,.06)">
              <div style="width:44px;height:44px;border-radius:12px;background:${bg};display:flex;align-items:center;justify-content:center;margin-bottom:14px">${icon}</div>
              <div style="font-family:'Bebas Neue',sans-serif;font-size:38px;color:${color};line-height:1;letter-spacing:1px">${val}</div>
              <div style="font-size:11px;font-weight:700;color:#5B8DB8;margin-top:5px;text-transform:uppercase;letter-spacing:.5px">${label}</div>
            </div>
          `).join('')}
        </div>

        <!-- Map + Table -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">

          <!-- Live Map -->
          <div style="background:white;border-radius:16px;border:1px solid #E3F2FD;box-shadow:0 2px 8px rgba(10,37,64,.06);overflow:hidden;display:flex;flex-direction:column">
            <div style="padding:14px 20px;border-bottom:1px solid #F0F8FF;display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
              <span style="font-family:'Bebas Neue',sans-serif;font-size:13px;color:#29ABE2;letter-spacing:2px">LIVE MAP</span>
              <span style="font-size:11px;color:#5B8DB8">${garages.length} garages</span>
            </div>
            <div id="admin-map" style="flex:1;min-height:280px"></div>
          </div>

          <!-- Status table -->
          <div style="background:white;border-radius:16px;border:1px solid #E3F2FD;box-shadow:0 2px 8px rgba(10,37,64,.06);overflow:hidden;display:flex;flex-direction:column">
            <div style="padding:14px 20px;border-bottom:1px solid #F0F8FF;display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
              <span style="font-family:'Bebas Neue',sans-serif;font-size:13px;color:#29ABE2;letter-spacing:2px">GARAGES STATUS</span>
              <button onclick="window._nav('garages')" style="font-size:11px;color:#29ABE2;font-weight:700;background:none;border:none;cursor:pointer">View all →</button>
            </div>
            <div style="overflow-y:auto;flex:1">
              ${garages.length ? garages.map(g => `
                <div style="display:grid;grid-template-columns:1fr auto auto;align-items:center;padding:12px 20px;border-bottom:1px solid #F8FBFF;gap:12px;transition:background .15s"
                  onmouseover="this.style.background='#F8FBFF'" onmouseout="this.style.background='white'">
                  <div>
                    <div style="font-size:13px;font-weight:700;color:#0A2540">${g.name}</div>
                    <div style="font-size:11px;color:#5B8DB8;margin-top:1px">${g.address||''}</div>
                  </div>
                  <div style="font-size:12px;font-weight:800;color:${statusColor(g.status)}">${g.availableSpots||0}/${g.totalSpots||0}</div>
                  ${statusPill(g.status)}
                </div>
              `).join('') : `<div style="padding:32px;text-align:center;color:#5B8DB8;font-size:13px">No garages yet</div>`}
            </div>
          </div>
        </div>

        <!-- Capacity bars -->
        ${garages.length ? `
        <div style="background:white;border-radius:16px;padding:20px 24px;border:1px solid #E3F2FD;box-shadow:0 2px 8px rgba(10,37,64,.06)">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:13px;color:#29ABE2;letter-spacing:2px;margin-bottom:16px">CAPACITY OVERVIEW</div>
          ${garages.map(g => {
            const pct = g.totalSpots > 0 ? Math.round(((g.totalSpots-g.availableSpots)/g.totalSpots)*100) : 0;
            const col = statusColor(g.status);
            return `
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
                <div style="width:160px;font-size:12px;font-weight:600;color:#0A2540;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex-shrink:0">${g.name}</div>
                <div style="flex:1;background:#E3F2FD;border-radius:6px;height:8px;overflow:hidden">
                  <div style="height:100%;background:${col};width:${pct}%;border-radius:6px;transition:width .4s ease"></div>
                </div>
                <div style="font-size:11px;font-weight:700;color:${col};width:36px;text-align:right;flex-shrink:0">${pct}%</div>
                ${statusPill(g.status)}
              </div>
            `;
          }).join('')}
        </div>
        ` : ''}
      </div>
    `;

    setTimeout(() => _buildAdminMap(), 80);
  });

  _unsubS = onFreshSpots(spots => {
    _cachedSpots = spots;
    if (_adminSpotLayer) _renderAdminSpots();
  });
}

// ── Admin Map ─────────────────────────────
function _buildAdminMap() {
  const el = document.getElementById('admin-map');
  if (!el) return;

  if (_adminMap) { try { _adminMap.remove(); } catch(e){} _adminMap = null; }

  const loadMap = () => {
    _adminMap = L.map(el, { zoomControl:true, attributionControl:false }).setView([30.0444, 31.2357], 11);

    // Show user location on admin map too
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const userIcon = L.divIcon({
          className:'',
          html:`<div style="width:16px;height:16px;border-radius:50%;background:#1565C0;border:3px solid white;box-shadow:0 0 0 6px rgba(21,101,192,.2)"></div>`,
          iconSize:[16,16], iconAnchor:[8,8],
        });
        L.marker([lat,lng],{icon:userIcon,zIndexOffset:1000})
          .addTo(_adminMap)
          .bindPopup('<b>Your Location</b>');
      }, ()=>{}, {timeout:5000});
    }
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19 }).addTo(_adminMap);
    _adminGarageLayer = L.layerGroup().addTo(_adminMap);
    _adminSpotLayer   = L.layerGroup().addTo(_adminMap);
    _renderAdminGarages();
    _renderAdminSpots();
    const bounds = _cachedGarages.filter(g=>g.lat&&g.lng).map(g=>[g.lat,g.lng]);
    if (bounds.length > 0) setTimeout(() => _adminMap.fitBounds(bounds, {padding:[40,40]}), 200);
  };

  if (!window.L) {
    if (!document.getElementById('leaflet-css')) {
      const l = document.createElement('link'); l.id='leaflet-css'; l.rel='stylesheet';
      l.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(l);
    }
    const s = document.createElement('script');
    s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload = loadMap; document.head.appendChild(s);
  } else { loadMap(); }
}

function _renderAdminGarages() {
  if (!_adminGarageLayer) return;
  _adminGarageLayer.clearLayers();
  _cachedGarages.forEach(g => {
    if (!g.lat || !g.lng) return;
    const col  = statusColor(g.status);
    const icon = L.divIcon({
      className:'',
      html:`<div style="display:flex;flex-direction:column;align-items:center">
        <div style="background:#0A2540;color:white;font-size:9px;font-weight:700;padding:2px 7px;border-radius:5px;white-space:nowrap;margin-bottom:3px">${g.name.length>16?g.name.slice(0,16)+'…':g.name}</div>
        <div style="width:34px;height:34px;border-radius:50%;background:${col};border:3px solid white;display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:16px;color:white;box-shadow:0 3px 10px rgba(0,0,0,.3)">P</div>
        <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid ${col};margin-top:2px"></div>
      </div>`,
      iconSize:[110,54], iconAnchor:[55,54], popupAnchor:[0,-54],
    });
    const pct = g.totalSpots > 0 ? Math.round(((g.totalSpots-g.availableSpots)/g.totalSpots)*100) : 0;
    L.marker([g.lat,g.lng],{icon}).bindPopup(`
      <div style="font-family:Inter,sans-serif;min-width:190px">
        <div style="font-weight:900;font-size:14px;color:#0A2540;margin-bottom:4px">${g.name}</div>
        <div style="font-size:11px;color:#5B8DB8;margin-bottom:8px">${g.address||''}</div>
        <div style="background:#E3F2FD;border-radius:4px;height:6px;overflow:hidden;margin-bottom:6px">
          <div style="height:100%;background:${col};width:${pct}%;border-radius:4px"></div>
        </div>
        <div style="display:flex;justify-content:space-between">
          <span style="font-size:11px;color:#5B8DB8">${g.availableSpots||0}/${g.totalSpots||0} spots</span>
          <span style="font-size:10px;font-weight:700;color:${col}">${statusLabel(g.status)}</span>
        </div>
      </div>
    `).addTo(_adminGarageLayer);
  });
}

function _renderAdminSpots() {
  if (!_adminSpotLayer) return;
  _adminSpotLayer.clearLayers();
  _cachedSpots.forEach(sp => {
    if (!sp.lat || !sp.lng) return;
    const ago   = timeAgo(sp.reportedAt);
    const fresh = sp.isFresh;
    const col   = fresh ? '#29ABE2' : '#FB8C00';
    const icon = L.divIcon({
      className:'',
      html:`<div style="display:flex;flex-direction:column;align-items:center">
        <div style="background:#0A2540;color:${col};font-size:9px;font-weight:700;padding:2px 7px;border-radius:6px;white-space:nowrap;margin-bottom:3px;box-shadow:0 1px 4px rgba(0,0,0,.25)">${ago}</div>
        <div style="width:16px;height:16px;border-radius:50%;background:${col};border:2.5px solid white;box-shadow:0 0 0 4px ${col}33;position:relative">
          <div style="position:absolute;inset:-4px;border-radius:50%;border:2px solid ${col};opacity:.4;animation:spotPulse 2s ease-out infinite"></div>
        </div>
      </div>`,
      iconSize:[80,32], iconAnchor:[40,32], popupAnchor:[0,-32],
    });
    L.marker([sp.lat,sp.lng],{icon})
      .bindPopup(`<b style="color:#0A2540">Street Spot</b><br><span style="font-size:11px;color:#5B8DB8">${sp.address||''}<br>${timeAgo(sp.reportedAt)}</span>`)
      .addTo(_adminSpotLayer);
  });
}

// ══ GARAGES ════════════════════════════════
function renderGarages(body) {
  if (_unsubG) _unsubG();
  body.innerHTML = `
    <div style="padding:24px;max-width:900px;margin:0 auto">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;color:#0A2540;letter-spacing:1px">All Garages</div>
          <div id="garage-count" style="font-size:12px;color:#5B8DB8">Loading...</div>
        </div>
        <button onclick="openAddGarage()"
          style="display:flex;align-items:center;gap:7px;padding:10px 18px;background:#29ABE2;color:white;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif;transition:background .2s"
          onmouseover="this.style.background='#1A73CC'" onmouseout="this.style.background='#29ABE2'">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Garage
        </button>
      </div>
      <div id="garages-list">${spinner()}</div>
    </div>
  `;

  _unsubG = onGarages(garages => {
    const c = document.getElementById('garage-count');
    if (c) c.textContent = `${garages.length} garage${garages.length!==1?'s':''}`;
    const list = document.getElementById('garages-list');
    if (!list) return;
    if (!garages.length) { list.innerHTML = empty(`<svg width='40' height='40' fill='none' viewBox='0 0 24 24' stroke='#BBDEFB' stroke-width='1.5'><rect x='3' y='3' width='18' height='18' rx='2'/><path d='M9 17V7h4a3 3 0 0 1 0 6H9'/></svg>`,'No garages yet. Add one!'); return; }

    list.innerHTML = garages.map(g => `
      <div style="background:white;border-radius:16px;padding:20px;border:1px solid #E3F2FD;margin-bottom:12px;box-shadow:0 2px 8px rgba(10,37,64,.05);transition:box-shadow .2s"
        onmouseover="this.style.boxShadow='0 4px 20px rgba(10,37,64,.1)'" onmouseout="this.style.boxShadow='0 2px 8px rgba(10,37,64,.05)'">
        <div style="display:flex;align-items:flex-start;gap:16px">
          <div style="width:48px;height:48px;border-radius:14px;background:${statusColor(g.status)}18;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="${statusColor(g.status)}" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/></svg>
          </div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px">
              <span style="font-size:15px;font-weight:900;color:#0A2540">${g.name}</span>
              ${statusPill(g.status)}
            </div>
            <div style="font-size:12px;color:#5B8DB8;margin-bottom:12px">${g.address||''}</div>
            ${capBar(g.availableSpots, g.totalSpots, g.status)}
            <div style="display:flex;gap:16px;margin-top:10px;flex-wrap:wrap">
              <span style="font-size:11px;color:#5B8DB8"><svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="#5B8DB8" stroke-width="2" style="display:inline;vertical-align:middle;margin-right:3px"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>${g.workingHours||'—'}</span>
              <span style="font-size:11px;color:#5B8DB8"><svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="#5B8DB8" stroke-width="2" style="display:inline;vertical-align:middle;margin-right:3px"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>${g.pricePerHour||0} EGP/hr</span>
              <span style="font-size:11px;color:#5B8DB8"><svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="#5B8DB8" stroke-width="2" style="display:inline;vertical-align:middle;margin-right:3px"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>${g.managerName||'—'}</span>
              <span style="font-size:11px;color:#5B8DB8"><svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="#5B8DB8" stroke-width="2" style="display:inline;vertical-align:middle;margin-right:3px"><polyline points="23,4 23,11 16,11"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 11"/></svg>${timeAgo(g.lastUpdated)}</span>
            </div>
          </div>
          <div style="display:flex;gap:8px;flex-shrink:0">
            <button onclick="window._showGarageId('${g.id}','${g.name.replace(/'/g,'')}')"
              style="display:flex;align-items:center;gap:5px;padding:8px 14px;background:#F8FBFF;color:#5B8DB8;border:1.5px solid #E3F2FD;border-radius:9px;font-size:12px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif;transition:all .2s"
              onmouseover="this.style.background='#E3F2FD'" onmouseout="this.style.background='#F8FBFF'">
              🔑 ID
            </button>
            <button onclick="openEditGarage('${g.id}')"
              style="display:flex;align-items:center;gap:5px;padding:8px 14px;background:#F0F8FF;color:#1A73CC;border:1.5px solid #29ABE2;border-radius:9px;font-size:12px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif;transition:all .2s"
              onmouseover="this.style.background='#29ABE2';this.style.color='white'" onmouseout="this.style.background='#F0F8FF';this.style.color='#1A73CC'">
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Edit
            </button>
            <button onclick="confirmDelete('${g.id}','${g.name.replace(/'/g,'')}')"
              style="display:flex;align-items:center;gap:5px;padding:8px 14px;background:#FFEBEE;color:#C62828;border:1.5px solid #FFCDD2;border-radius:9px;font-size:12px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif;transition:all .2s"
              onmouseover="this.style.background='#FFCDD2'" onmouseout="this.style.background='#FFEBEE'">
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"/><path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a1,1,0,0,1,1-1h4a1,1,0,0,1,1,1v2"/></svg>
              Delete
            </button>
          </div>
        </div>
      </div>
    `).join('');
  });

  window.openAddGarage  = () => openGarageForm();
  window.openEditGarage = async (id) => { const { getGarage } = await import('../services/db.js'); const g = await getGarage(id); if (g) openGarageForm(g); };
  window._showGarageId  = (id, name) => showModal({
    title: `🔑 Garage ID`,
    body: `
      <div style="display:flex;flex-direction:column;gap:14px">
        <div style="font-size:14px;color:#5B8DB8">Share this ID with the owner of <b>${name}</b> so they can link their account:</div>
        <div style="background:#F0F8FF;border:2px solid #29ABE2;border-radius:12px;padding:16px;text-align:center">
          <div style="font-size:11px;font-weight:700;color:#5B8DB8;letter-spacing:2px;margin-bottom:8px">GARAGE ID</div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:18px;color:#0A2540;word-break:break-all;letter-spacing:1px">${id}</div>
        </div>
        <button onclick="navigator.clipboard.writeText('${id}');this.textContent='✓ Copied!';this.style.background='#43A047'"
          style="width:100%;padding:12px;border-radius:10px;background:#29ABE2;color:white;font-size:14px;font-weight:700;border:none;cursor:pointer;font-family:Inter,sans-serif">
          📋 Copy ID
        </button>
      </div>
    `,
    confirmLabel: null,
    cancelLabel: 'Close',
  });
  window.confirmDelete  = (id, name) => showModal({
    title: `Delete "${name}"?`,
    body: `<p style="color:#5B8DB8;font-size:14px">This cannot be undone.</p>`,
    confirmLabel:'Delete', danger:true,
    onConfirm: async () => { await deleteGarage(id); toast('Garage deleted'); },
  });
}

// ── Use My Location in garage form ──────────
window._useMyLocation = () => {
  const btn    = document.getElementById('use-loc-btn');
  const status = document.getElementById('loc-status');
  if (!btn || !status) return;

  btn.textContent = '⏳ Getting location...';
  btn.disabled    = true;
  status.textContent = '';

  if (!navigator.geolocation) {
    status.textContent = 'Geolocation not supported';
    btn.textContent = 'Use My Current Location';
    btn.disabled    = false;
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      document.getElementById('g-lat').value = lat.toFixed(6);
      document.getElementById('g-lng').value = lng.toFixed(6);

      btn.innerHTML = `<svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg> Location Set!`;
      btn.style.background   = '#E8F5E9';
      btn.style.color        = '#2E7D32';
      btn.style.borderColor  = '#43A047';
      btn.disabled           = false;
      btn.onmouseover = null;
      btn.onmouseout  = null;

      // Try to get address
      try {
        const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
        const data = await res.json();
        const addr = data.display_name?.split(',').slice(0,3).join(',').trim();
        status.textContent = '' + addr;
        status.style.color = '#29ABE2';
        // Auto-fill address if empty
        const addrInput = document.getElementById('g-addr');
        if (addrInput && !addrInput.value) addrInput.value = addr;
      } catch { status.textContent = `\${lat.toFixed(4)}, \${lng.toFixed(4)}`; }
    },
    (err) => {
      status.textContent = 'Could not get location. Enter manually.';
      btn.innerHTML = '<svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg> Use My Current Location';
      btn.disabled = false;
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
};

function openGarageForm(garage = null) {
  const isEdit = !!garage, g = garage || {};
  showModal({
    title: isEdit ? `Edit: ${g.name}` : 'Add New Garage',
    body: `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div style="grid-column:1/-1"><label class="field-label">Garage Name *</label><input id="g-name" class="input" value="${g.name||''}" placeholder="e.g. City Center Garage"/></div>
        <div style="grid-column:1/-1"><label class="field-label">Address *</label><input id="g-addr" class="input" value="${g.address||''}" placeholder="e.g. 123 Main Street"/></div>
        <div><label class="field-label">Latitude</label><input id="g-lat" class="input" type="number" step="0.0001" value="${g.lat||''}" placeholder="30.0626"/></div>
        <div><label class="field-label">Longitude</label><input id="g-lng" class="input" type="number" step="0.0001" value="${g.lng||''}" placeholder="31.2001"/></div>
        <div style="grid-column:1/-1">
          <button type="button" id="use-loc-btn"
            onclick="window._useMyLocation()"
            style="display:flex;align-items:center;gap:8px;padding:9px 16px;background:#F0F8FF;color:#1A73CC;border:1.5px solid #29ABE2;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif;transition:all .2s;width:100%;justify-content:center"
            onmouseover="this.style.background='#29ABE2';this.style.color='white'" onmouseout="this.style.background='#F0F8FF';this.style.color='#1A73CC'">
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>
            Use My Current Location
          </button>
          <div id="loc-status" style="font-size:11px;color:#5B8DB8;margin-top:5px;text-align:center;min-height:16px"></div>
        </div>
        <div><label class="field-label">Total Spots *</label><input id="g-total" class="input" type="number" value="${g.totalSpots||30}" min="1"/></div>
        <div><label class="field-label">Price / Hour</label><input id="g-price" class="input" type="number" value="${g.pricePerHour||10}" min="0"/></div>
        <div style="grid-column:1/-1"><label class="field-label">Working Hours</label><input id="g-hours" class="input" value="${g.workingHours||'8 AM — 12 AM'}"/></div>
        <div><label class="field-label">Manager Name</label><input id="g-mgr" class="input" value="${g.managerName||''}" placeholder="Ahmed Hassan"/></div>
        <div><label class="field-label">Manager Phone</label><input id="g-phone" class="input" value="${g.managerPhone||''}" placeholder="+20 100 000 0000"/></div>
        <div style="grid-column:1/-1">
          <label class="field-label">Assign Owner <span style="font-weight:400;text-transform:none;letter-spacing:0;color:#BBDEFB">(optional)</span></label>
          <select id="g-owner" class="input" style="cursor:pointer">
            <option value="">— No owner assigned —</option>
          </select>
          <div id="owner-loading" style="font-size:11px;color:#5B8DB8;margin-top:4px">Loading users...</div>
        </div>
        ${isEdit ? `
        <div><label class="field-label">Status</label><select id="g-status" class="input">${['available','few','full'].map(s=>`<option value="${s}" ${g.status===s?'selected':''}>${statusLabel(s)}</option>`).join('')}</select></div>
        <div><label class="field-label">Available Spots</label><input id="g-avail" class="input" type="number" value="${g.availableSpots||0}" min="0"/></div>
        ` : ''}
      </div>
    `,
    confirmLabel: isEdit ? '✓ Save Changes' : '+ Add Garage',
    onConfirm: async () => {
      const data = {
        name: document.getElementById('g-name').value.trim(),
        address: document.getElementById('g-addr').value.trim(),
        lat: parseFloat(document.getElementById('g-lat').value) || 0,
        lng: parseFloat(document.getElementById('g-lng').value) || 0,
        totalSpots: parseInt(document.getElementById('g-total').value) || 30,
        pricePerHour: parseFloat(document.getElementById('g-price').value) || 10,
        workingHours: document.getElementById('g-hours').value.trim(),
        managerName: document.getElementById('g-mgr').value.trim(),
        managerPhone: document.getElementById('g-phone').value.trim(),
        ownerUid: document.getElementById('g-owner')?.value.trim() || null,
      };
      if (!data.name || !data.address) { toast('Name and address are required', 'error'); return; }
      if (isEdit) {
        const status = document.getElementById('g-status')?.value;
        const avail  = parseInt(document.getElementById('g-avail')?.value) || g.availableSpots;
        await updateGarage(g.id, { ...data, status, availableSpots: avail });
        if (data.ownerUid && data.ownerUid !== g.ownerUid) await setUserRole(data.ownerUid, 'owner', g.id);
        toast(' Garage updated!');
      } else {
        const ref = await addGarage({ ...data, availableSpots: data.totalSpots });
        if (data.ownerUid) await setUserRole(data.ownerUid, 'owner', ref.id);
        toast('Garage added!');
        // Show Garage ID to admin so they can share it with the owner
        setTimeout(() => {
          showModal({
            title: '✅ Garage Created!',
            body: `
              <div style="display:flex;flex-direction:column;gap:14px">
                <div style="font-size:14px;color:#5B8DB8">Share this <b>Garage ID</b> with the owner so they can link their account:</div>
                <div style="background:#F0F8FF;border:2px solid #29ABE2;border-radius:12px;padding:16px;text-align:center">
                  <div style="font-size:11px;font-weight:700;color:#5B8DB8;letter-spacing:2px;margin-bottom:8px">GARAGE ID</div>
                  <div style="font-family:'Bebas Neue',sans-serif;font-size:20px;color:#0A2540;word-break:break-all;letter-spacing:1px">${ref.id}</div>
                </div>
                <button onclick="navigator.clipboard.writeText('${ref.id}');this.textContent='✓ Copied!';this.style.background='#43A047'"
                  style="width:100%;padding:12px;border-radius:10px;background:#29ABE2;color:white;font-size:14px;font-weight:700;border:none;cursor:pointer;font-family:Inter,sans-serif">
                  📋 Copy ID
                </button>
                <div style="font-size:12px;color:#BBDEFB;text-align:center">The owner pastes this ID in their Owner Panel to link the garage</div>
              </div>
            `,
            confirmLabel: null,
            cancelLabel: 'Close',
          });
        }, 300);
      }
    },
  });

  // Populate owners dropdown after modal renders
  setTimeout(async () => {
    const sel = document.getElementById('g-owner');
    const lbl = document.getElementById('owner-loading');
    if (!sel) return;
    try {
      const users = await getAllUsers();
      const owners = users.filter(u => u.role === 'owner' || u.role === 'user');
      owners.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.id;
        opt.textContent = `${u.name || u.email} (${u.role})`;
        if (u.id === (garage?.ownerUid || '')) opt.selected = true;
        sel.appendChild(opt);
      });
      if (lbl) lbl.style.display = 'none';
    } catch(e) {
      if (lbl) lbl.textContent = 'Could not load users';
    }
  }, 100);
}

// ══ USERS ══════════════════════════════════
let _unsubUsers = null;

function renderUsers(body) {
  // إلغاء أي listener قديم
  if (_unsubUsers) { _unsubUsers(); _unsubUsers = null; }

  body.innerHTML = `
    <div style="padding:24px;max-width:900px;margin:0 auto">
      <div style="margin-bottom:20px;display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;color:#0A2540;letter-spacing:1px">All Users</div>
          <div id="users-count" style="font-size:12px;color:#5B8DB8">Loading...</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:#43A047;font-weight:700">
          <span style="width:7px;height:7px;border-radius:50%;background:#43A047;display:inline-block;animation:pulse 1.5s infinite"></span>
          Live
        </div>
      </div>
      <style>@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}</style>
      <div style="background:white;border-radius:16px;border:1px solid #E3F2FD;overflow:hidden;box-shadow:0 2px 8px rgba(10,37,64,.05)">
        <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;padding:12px 20px;background:#F8FBFF;border-bottom:1px solid #E3F2FD;font-size:11px;font-weight:700;color:#5B8DB8;text-transform:uppercase;letter-spacing:1px">
          <span>User</span><span>Role</span><span>Points</span><span>Change Role</span>
        </div>
        <div id="users-list">${spinner()}</div>
      </div>
    </div>
  `;

  window._setRole = async (uid, role) => { await setUserRole(uid, role); toast(`Role updated to ${role}`); };

  // ✅ Real-time listener — يظهر أي يوزر جديد فوراً
  _unsubUsers = onAllUsers(users => {
    const c = document.getElementById('users-count');
    if (c) c.textContent = `${users.length} user${users.length !== 1 ? 's' : ''}`;
    const list = document.getElementById('users-list');
    if (!list) return;
    if (!users.length) {
      list.innerHTML = `<div style="padding:32px;text-align:center;color:#5B8DB8">No users found</div>`;
      return;
    }
    list.innerHTML = users.map(u => {
      const rc = { admin:'#C62828', owner:'#E65100', user:'#1A73CC' }[u.role||'user'] ?? '#1A73CC';
      return `
        <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;align-items:center;padding:14px 20px;border-bottom:1px solid #F8FBFF;transition:background .15s"
          onmouseover="this.style.background='#F8FBFF'" onmouseout="this.style.background='white'">
          <div style="display:flex;align-items:center;gap:12px">
            <div style="width:38px;height:38px;border-radius:50%;background:${rc}18;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;color:${rc};flex-shrink:0">
              ${u.photoUrl
                ? `<img src="${u.photoUrl}" style="width:38px;height:38px;border-radius:50%;object-fit:cover">`
                : (u.name||'U')[0].toUpperCase()
              }
            </div>
            <div>
              <div style="font-size:13px;font-weight:700;color:#0A2540">${u.name||'—'}</div>
              <div style="font-size:11px;color:#5B8DB8;margin-top:1px">${u.email||''}</div>
            </div>
          </div>
          <div>${roleBadge(u.role||'user')}</div>
          <div style="font-size:15px;font-weight:800;color:#0A2540">${u.points||0} <span style="font-size:10px;font-weight:600;color:#5B8DB8">pts</span></div>
          <div>
            <select onchange="window._setRole('${u.id}',this.value)"
              style="padding:7px 10px;border:1.5px solid #E3F2FD;border-radius:8px;font-size:12px;font-weight:700;color:#0A2540;background:white;cursor:pointer;font-family:Inter,sans-serif;outline:none;transition:border-color .2s"
              onfocus="this.style.borderColor='#29ABE2'" onblur="this.style.borderColor='#E3F2FD'">
              ${['user','owner','admin'].map(r=>`<option value="${r}" ${(u.role||'user')===r?'selected':''}>${r[0].toUpperCase()+r.slice(1)}</option>`).join('')}
            </select>
          </div>
        </div>
      `;
    }).join('');
  });
}

// ══ REPORTS ════════════════════════════════
function renderReports(body) {
  body.innerHTML = `
    <div style="padding:24px;max-width:900px;margin:0 auto">
      <div style="margin-bottom:20px">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;color:#0A2540;letter-spacing:1px">Street Spot Reports</div>
        <div style="font-size:12px;color:#5B8DB8">Active reports from the last 30 minutes</div>
      </div>
      <div id="reports-list">${spinner()}</div>
    </div>
  `;

  if (_unsubS) _unsubS();
  _unsubS = onFreshSpots(spots => {
    const list = document.getElementById('reports-list');
    if (!list) return;
    if (!spots.length) { list.innerHTML = empty(`<svg width='40' height='40' fill='none' viewBox='0 0 24 24' stroke='#BBDEFB' stroke-width='1.5'><path d='M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-2'/><circle cx='7.5' cy='17.5' r='2.5'/><circle cx='17.5' cy='17.5' r='2.5'/></svg>`,'No active reports right now'); return; }
    list.innerHTML = `
      <div style="background:white;border-radius:16px;border:1px solid #E3F2FD;overflow:hidden;box-shadow:0 2px 8px rgba(10,37,64,.05)">
        <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 0.6fr;padding:12px 20px;background:#F8FBFF;border-bottom:1px solid #E3F2FD;font-size:11px;font-weight:700;color:#5B8DB8;text-transform:uppercase;letter-spacing:1px">
          <span>Location</span><span>Reporter</span><span>Type</span><span>Time</span><span>Status</span>
        </div>
        ${spots.map(sp => `
          <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 0.6fr;align-items:center;padding:14px 20px;border-bottom:1px solid #F8FBFF;transition:background .15s"
            onmouseover="this.style.background='#F8FBFF'" onmouseout="this.style.background='white'">
            <div>
              <div style="font-size:13px;font-weight:700;color:#0A2540">${sp.address||'Unknown location'}</div>
              ${sp.notes?`<div style="font-size:11px;color:#5B8DB8;margin-top:2px;font-style:italic">"${sp.notes}"</div>`:''}
            </div>
            <div style="font-size:12px;color:#5B8DB8">${sp.reporterName||'—'}</div>
            <div><span style="background:#E3F2FD;color:#1A73CC;font-size:10px;font-weight:700;padding:3px 8px;border-radius:6px">${sp.type||'street'}</span></div>
            <div style="font-size:12px;font-weight:${sp.isFresh?'700':'400'};color:${sp.isFresh?'#29ABE2':'#5B8DB8'}">${timeAgo(sp.reportedAt)}</div>
            <div style="font-size:12px;font-weight:700;color:${sp.confirmed?'#43A047':'#BBDEFB'}">${sp.confirmed?'✓ '+sp.confirmCount:'—'}</div>
          </div>
        `).join('')}
      </div>
    `;
  });
}

// js/screens/owner.js
import { onUser, onGarages, onFreshSpots, updateGarage, setUserRole, timeAgo, statusLabel } from '../services/db.js';
import { currentUser } from '../services/auth.js';
import { toast, spinner } from '../components/ui.js';

let _unsubUser = null, _unsubGarage = null, _unsubSpots = null;

export function renderOwner(container, tab = 'dashboard') {
  const user = currentUser();
  if (!user) return;

  container.innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%;background:#F0F6FF;font-family:'Inter',sans-serif">

      <!-- Top bar -->
      <div style="background:#0A2540;padding:0 20px;height:56px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
        <div style="display:flex;align-items:center;gap:10px">
          <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#FF6B00" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/></svg>
          <span style="font-family:'Bebas Neue',sans-serif;font-size:20px;color:white;letter-spacing:2px">My Garage</span>
        </div>
        <button onclick="window._navigate('nearby')"
          style="padding:7px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;border:none;font-family:Inter,sans-serif;background:rgba(255,255,255,.1);color:rgba(255,255,255,.6)">
          📍 Nearby Spots
        </button>
      </div>

      <div style="flex:1;overflow-y:auto" id="owner-body">${spinner()}</div>
    </div>
  `;

  const body = document.getElementById('owner-body');

  if (_unsubUser) _unsubUser();
  _unsubUser = onUser(user.uid, u => {
    if (!u.ownedGarageId) {
      body.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:20px;padding:40px;text-align:center">
          <div style="font-size:64px">🅿️</div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;color:#0A2540;letter-spacing:1px">No Garage Assigned</div>
          <div style="font-size:14px;color:#5B8DB8;line-height:1.7">Got a Garage ID from the admin?<br>Enter it below to link your garage</div>

          <div style="width:100%;max-width:320px;display:flex;flex-direction:column;gap:10px">
            <input id="garage-id-input" type="text" placeholder="Paste Garage ID here..."
              style="width:100%;padding:14px 16px;border:2px solid #E3F2FD;border-radius:12px;font-size:14px;font-family:Inter,sans-serif;color:#0A2540;outline:none;text-align:center;transition:border-color .2s;box-sizing:border-box"
              onfocus="this.style.borderColor='#29ABE2'" onblur="this.style.borderColor='#E3F2FD'"/>
            <button onclick="window._linkGarage('${user.uid}')"
              style="width:100%;padding:14px;border-radius:12px;background:#29ABE2;color:white;font-size:15px;font-weight:700;border:none;cursor:pointer;font-family:Inter,sans-serif;transition:background .2s"
              onmouseover="this.style.background='#1A73CC'" onmouseout="this.style.background='#29ABE2'">
              🔗 Link My Garage
            </button>
          </div>

          <div style="font-size:12px;color:#BBDEFB;max-width:280px;line-height:1.6">
            Ask the admin to give you the Garage ID from the admin panel
          </div>
        </div>
      `;

      window._linkGarage = async (uid) => {
        const input = document.getElementById('garage-id-input');
        const garageId = input?.value?.trim();
        if (!garageId) { toast('Please enter a Garage ID', 'error'); return; }

        try {
          // Verify garage exists
          const { getDoc, doc, getFirestore } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
          const { app } = await import('../services/app.js');
          const db   = getFirestore(app);
          const snap = await getDoc(doc(db, 'garages', garageId));
          if (!snap.exists()) { toast('Garage ID not found. Check with your admin.', 'error'); return; }

          await setUserRole(uid, 'owner', garageId);
          toast('Garage linked successfully! ✅');
        } catch(e) {
          toast('Error: ' + e.message, 'error');
        }
      };

      return;
    }

    if (tab === 'nearby') renderNearbySpots(body);
    else renderGarageDashboard(body, u.ownedGarageId);
  });
}

// ══ GARAGE DASHBOARD ═══════════════════════
function renderGarageDashboard(body, garageId) {
  if (_unsubGarage) _unsubGarage();

  _unsubGarage = onGarages(garages => {
    const g = garages.find(g => g.id === garageId);
    if (!g) { body.innerHTML = `<div style="padding:40px;text-align:center;color:#5B8DB8">Garage not found</div>`; return; }

    const pct    = g.totalSpots > 0 ? Math.round((g.availableSpots / g.totalSpots) * 100) : 0;
    const sColor = { available:'#43A047', few:'#FB8C00', full:'#E53935' }[g.status] ?? '#29ABE2';
    const sBg    = { available:'#E8F5E9', few:'#FFF3E0', full:'#FFEBEE' }[g.status] ?? '#E3F2FD';
    const sLabel = { available:'مفتوح ✅', few:'أماكن قليلة ⚠️', full:'ممتلئ 🚫' }[g.status] ?? g.status;
    const sLabelEn = { available:'Available', few:'Few Spots Left', full:'Full' }[g.status] ?? g.status;

    body.innerHTML = `
      <div style="max-width:500px;margin:0 auto;padding:20px;display:flex;flex-direction:column;gap:14px">

        <!-- Garage Name -->
        <div style="background:#0A2540;border-radius:18px;padding:20px 24px;display:flex;align-items:center;justify-content:space-between">
          <div>
            <div style="font-family:'Bebas Neue',sans-serif;font-size:26px;color:white;letter-spacing:1px">${g.name}</div>
            <div style="font-size:12px;color:rgba(255,255,255,.4);margin-top:2px">${g.address || ''}</div>
          </div>
          <div style="background:${sBg};color:${sColor};font-size:12px;font-weight:700;padding:6px 14px;border-radius:20px;white-space:nowrap">${sLabelEn}</div>
        </div>

        <!-- BIG Available Spots Counter -->
        <div style="background:white;border-radius:18px;padding:28px 24px;border:1px solid #E3F2FD;box-shadow:0 2px 12px rgba(10,37,64,.06);text-align:center">
          <div style="font-size:13px;font-weight:700;color:#5B8DB8;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px">Available Spots</div>

          <!-- Counter buttons -->
          <div style="display:flex;align-items:center;justify-content:center;gap:20px;margin:16px 0">
            <button onclick="window._changeSpots('${g.id}', -1, ${g.totalSpots})"
              style="width:64px;height:64px;border-radius:50%;background:#FFEBEE;color:#E53935;font-size:32px;font-weight:700;border:none;cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:center;line-height:1"
              onmouseover="this.style.background='#FFCDD2'" onmouseout="this.style.background='#FFEBEE'">−</button>

            <div style="text-align:center">
              <div id="spots-count" style="font-family:'Bebas Neue',sans-serif;font-size:80px;color:#0A2540;line-height:1">${g.availableSpots}</div>
              <div style="font-size:14px;color:#BBDEFB;font-weight:600">of ${g.totalSpots} spots</div>
            </div>

            <button onclick="window._changeSpots('${g.id}', +1, ${g.totalSpots})"
              style="width:64px;height:64px;border-radius:50%;background:#E8F5E9;color:#43A047;font-size:32px;font-weight:700;border:none;cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:center;line-height:1"
              onmouseover="this.style.background='#C8E6C9'" onmouseout="this.style.background='#E8F5E9'">+</button>
          </div>

          <!-- Progress bar -->
          <div style="height:10px;border-radius:10px;background:#F0F8FF;overflow:hidden;margin:8px 0">
            <div id="spots-bar" style="height:100%;border-radius:10px;background:${sColor};width:${pct}%;transition:width .4s ease"></div>
          </div>
          <div style="font-size:12px;color:#5B8DB8;margin-top:4px">${pct}% available</div>
        </div>

        <!-- BIG Status Buttons -->
        <div style="background:white;border-radius:18px;padding:20px;border:1px solid #E3F2FD;box-shadow:0 2px 12px rgba(10,37,64,.06)">
          <div style="font-size:13px;font-weight:700;color:#5B8DB8;text-transform:uppercase;letter-spacing:2px;margin-bottom:14px">Garage Status</div>
          <div style="display:flex;flex-direction:column;gap:10px">

            <button onclick="window._ownerStatus('${g.id}','available')"
              style="width:100%;padding:16px;border-radius:14px;font-size:16px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif;border:3px solid ${g.status==='available' ? '#43A047' : '#E3F2FD'};background:${g.status==='available' ? '#E8F5E9' : 'white'};color:${g.status==='available' ? '#43A047' : '#5B8DB8'};transition:all .2s;display:flex;align-items:center;gap:12px">
              <span style="font-size:24px">✅</span>
              <div style="text-align:left">
                <div>Open — Available</div>
                <div style="font-size:12px;font-weight:400;opacity:.7">Plenty of spots available</div>
              </div>
              ${g.status==='available' ? '<span style="margin-left:auto;font-size:20px">◉</span>' : ''}
            </button>

            <button onclick="window._ownerStatus('${g.id}','few')"
              style="width:100%;padding:16px;border-radius:14px;font-size:16px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif;border:3px solid ${g.status==='few' ? '#FB8C00' : '#E3F2FD'};background:${g.status==='few' ? '#FFF3E0' : 'white'};color:${g.status==='few' ? '#FB8C00' : '#5B8DB8'};transition:all .2s;display:flex;align-items:center;gap:12px">
              <span style="font-size:24px">⚠️</span>
              <div style="text-align:left">
                <div>Few Spots Left</div>
                <div style="font-size:12px;font-weight:400;opacity:.7">Almost full, hurry up</div>
              </div>
              ${g.status==='few' ? '<span style="margin-left:auto;font-size:20px">◉</span>' : ''}
            </button>

            <button onclick="window._ownerStatus('${g.id}','full')"
              style="width:100%;padding:16px;border-radius:14px;font-size:16px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif;border:3px solid ${g.status==='full' ? '#E53935' : '#E3F2FD'};background:${g.status==='full' ? '#FFEBEE' : 'white'};color:${g.status==='full' ? '#E53935' : '#5B8DB8'};transition:all .2s;display:flex;align-items:center;gap:12px">
              <span style="font-size:24px">🚫</span>
              <div style="text-align:left">
                <div>Full — No Spots</div>
                <div style="font-size:12px;font-weight:400;opacity:.7">Garage is completely full</div>
              </div>
              ${g.status==='full' ? '<span style="margin-left:auto;font-size:20px">◉</span>' : ''}
            </button>

          </div>
        </div>

        <!-- Info -->
        <div style="background:white;border-radius:18px;padding:20px;border:1px solid #E3F2FD;box-shadow:0 2px 12px rgba(10,37,64,.06)">
          <div style="font-size:13px;font-weight:700;color:#5B8DB8;text-transform:uppercase;letter-spacing:2px;margin-bottom:14px">Garage Info</div>
          <div style="display:flex;flex-direction:column;gap:12px">
            ${[
              ['🕐', 'Working Hours', g.workingHours || '8 AM — 12 AM'],
              ['💰', 'Price / Hour',  `${g.pricePerHour || 10} EGP`],
              ['📞', 'Manager Phone', g.managerPhone || '—'],
            ].map(([icon,k,v]) => `
              <div style="display:flex;align-items:center;gap:12px;padding:12px;background:#F8FBFF;border-radius:12px">
                <span style="font-size:20px">${icon}</span>
                <div>
                  <div style="font-size:11px;color:#5B8DB8">${k}</div>
                  <div style="font-size:15px;font-weight:700;color:#0A2540">${v}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

      </div>
    `;

    // Current available spots tracking
    let currentSpots = g.availableSpots;

    window._changeSpots = async (id, delta, total) => {
      currentSpots = Math.max(0, Math.min(total, currentSpots + delta));
      const pct    = Math.round((currentSpots / total) * 100);
      const status = currentSpots === 0 ? 'full' : currentSpots / total <= 0.25 ? 'few' : 'available';
      const sColor = { available:'#43A047', few:'#FB8C00', full:'#E53935' }[status];

      // Update UI instantly
      const countEl = document.getElementById('spots-count');
      const barEl   = document.getElementById('spots-bar');
      if (countEl) countEl.textContent = currentSpots;
      if (barEl)   { barEl.style.width = pct + '%'; barEl.style.background = sColor; }

      await updateGarage(id, { availableSpots: currentSpots, status });
      toast(`${currentSpots} spots available`);
    };

    window._ownerStatus = async (id, status) => {
      await updateGarage(id, { status });
      toast(`Status updated to ${statusLabel(status)}`);
    };
  });
}

// ══ NEARBY SPOTS ═══════════════════════════
function renderNearbySpots(body) {
  body.innerHTML = `
    <div style="max-width:500px;margin:0 auto;padding:20px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;color:#0A2540;letter-spacing:1px">Nearby Street Spots</div>
        <button onclick="window._navigate('my-garage')"
          style="padding:7px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;border:1.5px solid #E3F2FD;background:white;color:#5B8DB8;font-family:Inter,sans-serif">
          ← My Garage
        </button>
      </div>
      <div id="nearby-list">${spinner()}</div>
    </div>
  `;

  if (_unsubSpots) _unsubSpots();
  _unsubSpots = onFreshSpots(spots => {
    const list = document.getElementById('nearby-list');
    if (!list) return;
    if (!spots.length) {
      list.innerHTML = `
        <div style="text-align:center;padding:60px 20px;color:#5B8DB8">
          <div style="font-size:48px;margin-bottom:12px">📍</div>
          <div style="font-weight:700;color:#0A2540;margin-bottom:4px">No nearby reports</div>
          <div style="font-size:13px">No active street spots right now</div>
        </div>
      `;
      return;
    }

    list.innerHTML = `
      <div style="background:white;border-radius:16px;border:1px solid #E3F2FD;overflow:hidden;box-shadow:0 2px 8px rgba(10,37,64,.04)">
        ${spots.map((sp, i) => `
          <div style="display:flex;align-items:center;gap:14px;padding:16px 18px;${i < spots.length-1 ? 'border-bottom:1px solid #F0F8FF' : ''}">
            <div style="font-size:28px;flex-shrink:0">${sp.isFresh ? '🟢' : '🟡'}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:14px;font-weight:700;color:#0A2540;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${sp.address || 'Unknown location'}</div>
              <div style="font-size:12px;color:#5B8DB8;margin-top:2px">
                ${sp.reporterName || 'Anonymous'} · ${timeAgo(sp.reportedAt)}
              </div>
            </div>
            <div style="font-size:12px;font-weight:700;color:${sp.isFresh ? '#43A047' : '#FB8C00'};flex-shrink:0">${sp.isFresh ? 'Fresh' : 'Old'}</div>
          </div>
        `).join('')}
      </div>
    `;
  });
}

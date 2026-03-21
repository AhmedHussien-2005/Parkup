// js/screens/profile.js
import { onUser, getUserSpots, setNotificationPref, deleteSpot, timeAgo, statusColor, statusLabel } from '../services/db.js';
import { currentUser } from '../services/auth.js';
import { toast, showModal } from '../components/ui.js';

let _unsub = null;
let _notifEnabled = true;

export function renderProfile(container) {
  const fbUser = currentUser();
  if (!fbUser) return;

  const initials = (fbUser.displayName || fbUser.email || 'U')[0].toUpperCase();

  container.innerHTML = `
    <div style="height:100%;overflow-y:auto;background:#F0F8FF">
      <div style="max-width:680px;margin:0 auto;padding:24px">

        <!-- Profile card -->
        <div style="background:linear-gradient(160deg,#0A2540 0%,#1255A0 100%);border-radius:24px;overflow:hidden;margin-bottom:20px;box-shadow:0 8px 32px rgba(10,37,64,.2)">
          <div style="padding:32px 28px 24px;display:flex;flex-direction:column;align-items:center;gap:12px">
            <div id="p-avatar" style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#1A73CC,#29ABE2);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:32px;color:white;border:4px solid rgba(255,255,255,.2);box-shadow:0 8px 24px rgba(0,0,0,.25);background-size:cover;background-position:center">
              ${fbUser.photoURL ? '' : initials}
            </div>
            <div style="text-align:center">
              <div id="p-name" style="font-size:22px;font-weight:900;color:white;letter-spacing:.5px">${fbUser.displayName || 'User'}</div>
              <div style="font-size:13px;color:rgba(255,255,255,.5);margin-top:4px">${fbUser.email || ''}</div>
            </div>
            <div id="p-role-badge" style="background:rgba(41,171,226,.2);color:#29ABE2;font-size:11px;font-weight:700;padding:5px 14px;border-radius:20px;letter-spacing:.5px">Driver</div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);background:rgba(255,255,255,.06);border-top:1px solid rgba(255,255,255,.08)">
            ${[['pts-stat','Points'],['rep-stat','Reports'],['rank-stat','Rank'],['lvl-stat','Level']].map(([id,lbl],i)=>`
              <div style="padding:16px 8px;text-align:center;${i<3?'border-right:1px solid rgba(255,255,255,.08)':''}">
                <div id="${id}" style="font-family:'Bebas Neue',sans-serif;font-size:26px;color:white;line-height:1">—</div>
                <div style="font-size:10px;font-weight:700;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.5px;margin-top:4px">${lbl}</div>
              </div>`).join('')}
          </div>
        </div>

        <!-- Account -->
        <div style="background:white;border-radius:16px;padding:4px 20px;border:1px solid #E3F2FD;box-shadow:0 2px 8px rgba(10,37,64,.05);margin-bottom:14px">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:11px;color:#29ABE2;letter-spacing:2.5px;padding:14px 0 10px">ACCOUNT</div>

          <!-- Edit Profile -->
          <div onclick="window._editProfile()" style="display:flex;align-items:center;gap:14px;padding:12px 0;border-bottom:1px solid #F0F8FF;cursor:pointer;border-radius:8px;margin:0 -8px;padding-left:8px;padding-right:8px;transition:background .15s"
            onmouseover="this.style.background='#F8FBFF'" onmouseout="this.style.background='transparent'">
            <div style="width:40px;height:40px;border-radius:12px;background:#EEF4FF;display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="#1A73CC" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <div style="flex:1"><div style="font-size:14px;font-weight:700;color:#0A2540">Edit Profile</div><div style="font-size:12px;color:#5B8DB8;margin-top:2px">Change your display name</div></div>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#BBDEFB" stroke-width="2.5"><polyline points="9,18 15,12 9,6"/></svg>
          </div>

          <!-- Change Password -->
          <div onclick="window._changePassword()" style="display:flex;align-items:center;gap:14px;padding:12px 0;border-bottom:1px solid #F0F8FF;cursor:pointer;border-radius:8px;margin:0 -8px;padding-left:8px;padding-right:8px;transition:background .15s"
            onmouseover="this.style.background='#F8FBFF'" onmouseout="this.style.background='transparent'">
            <div style="width:40px;height:40px;border-radius:12px;background:#F0EEFF;display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="#5B5BD6" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <div style="flex:1"><div style="font-size:14px;font-weight:700;color:#0A2540">Change Password</div><div style="font-size:12px;color:#5B8DB8;margin-top:2px">Update your security</div></div>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#BBDEFB" stroke-width="2.5"><polyline points="9,18 15,12 9,6"/></svg>
          </div>

          <!-- Notifications toggle -->
          <div style="display:flex;align-items:center;gap:14px;padding:12px 0;cursor:pointer;border-radius:8px;margin:0 -8px;padding-left:8px;padding-right:8px;transition:background .15s"
            onmouseover="this.style.background='#F8FBFF'" onmouseout="this.style.background='transparent'"
            onclick="window._toggleNotif()">
            <div style="width:40px;height:40px;border-radius:12px;background:#ECFEFF;display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="#0891B2" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            </div>
            <div style="flex:1"><div style="font-size:14px;font-weight:700;color:#0A2540">Notifications</div><div style="font-size:12px;color:#5B8DB8;margin-top:2px">Spot alerts & updates</div></div>
            <!-- Toggle switch -->
            <div id="notif-toggle" onclick="event.stopPropagation();window._toggleNotif()" style="width:44px;height:24px;border-radius:12px;background:#29ABE2;position:relative;cursor:pointer;transition:background .3s;flex-shrink:0">
              <div id="notif-knob" style="position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:white;transition:transform .3s;box-shadow:0 1px 4px rgba(0,0,0,.2)"></div>
            </div>
          </div>
        </div>

        <!-- Activity -->
        <div style="background:white;border-radius:16px;padding:4px 20px;border:1px solid #E3F2FD;box-shadow:0 2px 8px rgba(10,37,64,.05);margin-bottom:14px">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:11px;color:#29ABE2;letter-spacing:2.5px;padding:14px 0 10px">ACTIVITY</div>

          <!-- My Reports -->
          <div onclick="window._myReports()" style="display:flex;align-items:center;gap:14px;padding:12px 0;border-bottom:1px solid #F0F8FF;cursor:pointer;border-radius:8px;margin:0 -8px;padding-left:8px;padding-right:8px;transition:background .15s"
            onmouseover="this.style.background='#F8FBFF'" onmouseout="this.style.background='transparent'">
            <div style="width:40px;height:40px;border-radius:12px;background:#ECFDF5;display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="#059669" stroke-width="2"><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 0 1-2.827 0l-4.244-4.243a8 8 0 1 1 11.314 0z"/><circle cx="12" cy="11" r="3"/></svg>
            </div>
            <div style="flex:1"><div style="font-size:14px;font-weight:700;color:#0A2540">My Reports</div><div style="font-size:12px;color:#5B8DB8;margin-top:2px">Spots you reported</div></div>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#BBDEFB" stroke-width="2.5"><polyline points="9,18 15,12 9,6"/></svg>
          </div>

          <!-- Redeemed Rewards -->
          <div onclick="window._rewardsComingSoon()" style="display:flex;align-items:center;gap:14px;padding:12px 0;cursor:pointer;border-radius:8px;margin:0 -8px;padding-left:8px;padding-right:8px;transition:background .15s"
            onmouseover="this.style.background='#F8FBFF'" onmouseout="this.style.background='transparent'">
            <div style="width:40px;height:40px;border-radius:12px;background:#FFFBEB;display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="#D97706" stroke-width="2"><polyline points="20,12 20,22 4,22 4,12"/><rect x="2" y="7" width="20" height="5"/><path d="M12 22V7"/></svg>
            </div>
            <div style="flex:1"><div style="font-size:14px;font-weight:700;color:#0A2540">Redeemed Rewards</div><div style="font-size:12px;color:#5B8DB8;margin-top:2px">Your rewards history</div></div>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#BBDEFB" stroke-width="2.5"><polyline points="9,18 15,12 9,6"/></svg>
          </div>
        </div>

        <!-- Sign out -->
        <button onclick="doLogout()"
          style="width:100%;padding:14px;border-radius:14px;border:1.5px solid #FFCDD2;background:white;color:#C62828;font-size:14px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:8px"
          onmouseover="this.style.background='#FFEBEE'" onmouseout="this.style.background='white'">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Sign Out
        </button>
        <div style="text-align:center;font-size:11px;color:#BBDEFB;margin-top:16px;padding-bottom:8px">ParkUp v1.0</div>

      </div>
    </div>
  `;

  // Set photo
  if (fbUser.photoURL) {
    const av = document.getElementById('p-avatar');
    if (av) { av.style.backgroundImage = `url(${fbUser.photoURL})`; av.textContent = ''; }
  }

  // Firestore data
  if (_unsub) _unsub();
  _unsub = onUser(fbUser.uid, u => {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('pts-stat',  (u.points ?? 0).toLocaleString());
    set('rep-stat',  u.reportsCount ?? 0);
    set('rank-stat', u.weeklyRank ? `#${u.weeklyRank}` : '—');
    set('lvl-stat',  u.level?.split(' ')[0] ?? '—');

    const roleLabel = { admin:'Administrator', owner:'Garage Owner', user:'Driver' }[u.role] ?? 'Driver';
    const roleColor = { admin:'#FF8A80', owner:'#FFCC80', user:'#29ABE2' }[u.role] ?? '#29ABE2';
    const roleBg    = { admin:'rgba(229,57,53,.2)', owner:'rgba(251,140,0,.2)', user:'rgba(41,171,226,.2)' }[u.role] ?? 'rgba(41,171,226,.2)';
    const badge = document.getElementById('p-role-badge');
    if (badge) { badge.textContent = roleLabel; badge.style.color = roleColor; badge.style.background = roleBg; }

    // Notification state
    _notifEnabled = u.notificationsEnabled !== false;
    _updateNotifUI();
  });

  // ── Actions ───────────────────────────────

  // Edit Profile
  window._editProfile = () => {
    showModal({
      title: 'Edit Profile',
      body: `
        <div style="display:flex;flex-direction:column;gap:14px">
          <div style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:16px;background:#F8FBFF;border-radius:12px">
            <div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#1A73CC,#29ABE2);display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:900;color:white">
              ${initials}
            </div>
          </div>
          <div>
            <label class="field-label">Display Name</label>
            <input id="edit-name" class="input" value="${fbUser.displayName || ''}" placeholder="Your name"/>
          </div>
          <div style="background:#F8FBFF;border-radius:10px;padding:10px 14px;font-size:12px;color:#5B8DB8">
            <b style="color:#0A2540">Email:</b> ${fbUser.email || '—'} <span style="color:#BBDEFB">(cannot be changed)</span>
          </div>
        </div>
      `,
      confirmLabel: 'Save Changes',
      onConfirm: async () => {
        const newName = document.getElementById('edit-name')?.value.trim();
        if (!newName) { toast('Name cannot be empty', 'error'); return; }
        try {
          const { updateDisplayName } = await import('../services/auth.js');
          await updateDisplayName(newName);
          // Update UI immediately
          const nameEl = document.getElementById('p-name');
          if (nameEl) nameEl.textContent = newName;
          toast('Profile updated!');
        } catch(e) { toast('Error: ' + e.message, 'error'); }
      }
    });
  };

  // Change Password
  window._changePassword = () => {
    showModal({
      title: 'Change Password',
      body: `
        <div style="display:flex;flex-direction:column;gap:14px">
          <div>
            <label class="field-label">Current Password</label>
            <input id="pwd-current" class="input" type="password" placeholder="Enter current password"/>
          </div>
          <div>
            <label class="field-label">New Password</label>
            <input id="pwd-new" class="input" type="password" placeholder="At least 6 characters"/>
          </div>
          <div>
            <label class="field-label">Confirm New Password</label>
            <input id="pwd-confirm" class="input" type="password" placeholder="Repeat new password"/>
          </div>
          <div id="pwd-err" style="display:none;background:#FFEBEE;color:#C62828;padding:10px 14px;border-radius:8px;font-size:13px;font-weight:600"></div>
        </div>
      `,
      confirmLabel: 'Update Password',
      onConfirm: async () => {
        const current = document.getElementById('pwd-current')?.value;
        const newPwd  = document.getElementById('pwd-new')?.value;
        const confirm = document.getElementById('pwd-confirm')?.value;
        const errEl   = document.getElementById('pwd-err');

        const showErr = msg => { if(errEl){ errEl.textContent=msg; errEl.style.display='block'; } };

        if (!current || !newPwd || !confirm) { showErr('All fields are required'); return; }
        if (newPwd.length < 6) { showErr('New password must be at least 6 characters'); return; }
        if (newPwd !== confirm) { showErr('Passwords do not match'); return; }

        try {
          const { changePassword, hasPasswordProvider } = await import('../services/auth.js');
          if (!hasPasswordProvider()) {
            showErr('Your account uses Google Sign-In — password cannot be changed here');
            return;
          }
          await changePassword(current, newPwd);
          toast('Password updated successfully!');
        } catch(e) {
          const msg = e.code === 'auth/wrong-password' ? 'Current password is incorrect'
                    : e.code === 'auth/weak-password'  ? 'New password is too weak'
                    : e.message;
          showErr(msg);
        }
      }
    });
  };

  // Notifications toggle
  window._toggleNotif = async () => {
    _notifEnabled = !_notifEnabled;
    _updateNotifUI();
    try {
      await setNotificationPref(fbUser.uid, _notifEnabled);
      toast(_notifEnabled ? 'Notifications enabled' : 'Notifications disabled');
    } catch(e) {
      _notifEnabled = !_notifEnabled; // revert
      _updateNotifUI();
      toast('Could not update setting', 'error');
    }
  };

  // My Reports
  window._myReports = async () => {
    showModal({
      title: 'My Reports',
      body: `<div id="my-reports-body" style="min-height:120px;display:flex;align-items:center;justify-content:center">
        <div style="width:20px;height:20px;border:3px solid #29ABE2;border-top-color:transparent;border-radius:50%;animation:spin .6s linear infinite"></div>
      </div>`,
      confirmLabel: null,
      cancelLabel: 'Close',
      onConfirm: null,
    });

    try {
      const spots = await getUserSpots(fbUser.uid);
      const body  = document.getElementById('my-reports-body');
      if (!body) return;

      if (!spots.length) {
        body.innerHTML = `<div style="text-align:center;padding:20px;color:#5B8DB8">
          <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="#BBDEFB" stroke-width="1.5" style="margin-bottom:8px"><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 0 1-2.827 0l-4.244-4.243a8 8 0 1 1 11.314 0z"/><circle cx="12" cy="11" r="3"/></svg>
          <div style="font-weight:700;color:#0A2540;margin-bottom:4px">No reports yet</div>
          <div style="font-size:12px">Go to the Map and report empty spots!</div>
        </div>`;
        return;
      }

      body.style.minHeight = 'auto';
      body.innerHTML = `
        <div style="font-size:12px;color:#5B8DB8;margin-bottom:12px">${spots.length} report${spots.length!==1?'s':''} total</div>
        <div style="display:flex;flex-direction:column;gap:8px;max-height:360px;overflow-y:auto">
          ${spots.map(sp => {
            const fresh = sp.isFresh;
            const color = fresh ? '#29ABE2' : '#FB8C00';
            return `
              <div style="display:flex;align-items:center;gap:12px;background:#F8FBFF;border-radius:12px;padding:12px 14px;border:1px solid #E3F2FD">
                <div style="width:36px;height:36px;border-radius:10px;background:${color}18;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="${color}" stroke-width="2"><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 0 1-2.827 0l-4.244-4.243a8 8 0 1 1 11.314 0z"/><circle cx="12" cy="11" r="3"/></svg>
                </div>
                <div style="flex:1;min-width:0">
                  <div style="font-size:12px;font-weight:700;color:#0A2540;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${sp.address || 'Unknown location'}</div>
                  <div style="font-size:11px;color:#5B8DB8;margin-top:2px">${timeAgo(sp.reportedAt)} · ${sp.type || 'street'}</div>
                </div>
                <button onclick="window._deleteMySpot('${sp.id}')"
                  style="padding:6px 10px;background:#FFEBEE;color:#C62828;border:1px solid #FFCDD2;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif;flex-shrink:0;transition:background .2s"
                  onmouseover="this.style.background='#FFCDD2'" onmouseout="this.style.background='#FFEBEE'">
                  Remove
                </button>
              </div>
            `;
          }).join('')}
        </div>
      `;

      window._deleteMySpot = async (spotId) => {
        if (!confirm('Remove this spot? (-10 pts)')) return;
        try {
          await deleteSpot(spotId, fbUser.uid);
          toast('Spot removed');
          // Refresh modal
          window._myReports();
        } catch(e) { toast('Error: ' + e.message, 'error'); }
      };

    } catch(e) {
      const body = document.getElementById('my-reports-body');
      if (body) body.innerHTML = `<div style="color:#C62828;text-align:center;padding:20px">Error: ${e.message}</div>`;
    }
  };

  window._rewardsComingSoon = () => {
    showModal({
      title: 'Redeemed Rewards',
      body: `
        <div style="display:flex;flex-direction:column;align-items:center;padding:24px 0;text-align:center">
          <div style="width:64px;height:64px;border-radius:20px;background:#FFFBEB;display:flex;align-items:center;justify-content:center;margin-bottom:16px">
            <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#D97706" stroke-width="1.5">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;color:#0A2540;letter-spacing:1px;margin-bottom:8px">Coming Soon</div>
          <div style="font-size:13px;color:#5B8DB8;line-height:1.6">Rewards feature is coming soon.<br>Keep earning points in the meantime!</div>
        </div>
      `,
      confirmLabel: null,
      cancelLabel: 'Close',
    });
  };
}

function _updateNotifUI() {
  const toggle = document.getElementById('notif-toggle');
  const knob   = document.getElementById('notif-knob');
  if (!toggle || !knob) return;
  toggle.style.background    = _notifEnabled ? '#29ABE2' : '#CBD5E1';
  knob.style.transform       = _notifEnabled ? 'translateX(20px)' : 'translateX(0)';
}

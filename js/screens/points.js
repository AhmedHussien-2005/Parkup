// js/screens/points.js
import { onUser, onPointsHistory, getLeaderboard, redeemReward, timeAgo } from '../services/db.js';
import { currentUser } from '../services/auth.js';
import { toast, spinner } from '../components/ui.js';

let _unsubUser = null, _unsubHistory = null;

export function renderPoints(container) {
  const user = currentUser();
  if (!user) return;

  container.innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%;overflow:hidden;background:#F0F8FF">

      <!-- Hero -->
      <div style="background:linear-gradient(160deg,#0A2540 0%,#1255A0 100%);padding:24px 28px 0;flex-shrink:0">
        <div style="max-width:900px;margin:0 auto">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:20px">
            <div>
              <div style="font-size:10px;font-weight:700;color:rgba(255,255,255,.4);letter-spacing:2.5px;text-transform:uppercase;margin-bottom:6px">Weekly Points</div>
              <div id="pts-display" style="font-family:'Bebas Neue',sans-serif;font-size:60px;color:white;line-height:1;letter-spacing:2px">—</div>
              <div id="pts-total-label" style="font-size:11px;color:rgba(255,255,255,.3);margin-top:3px"></div>
              <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;max-width:240px">
                <span id="level-name" style="font-size:12px;font-weight:700;color:#29ABE2">Loading...</span>
                <span id="level-next" style="font-size:11px;color:rgba(255,255,255,.3)"></span>
              </div>
              <div style="margin-top:7px;height:5px;border-radius:10px;background:rgba(255,255,255,.1);max-width:240px;overflow:hidden">
                <div id="level-bar" style="height:100%;border-radius:10px;background:linear-gradient(90deg,#29ABE2,#1A73CC);transition:width .6s ease;width:0%"></div>
              </div>
            </div>
            <div style="text-align:center;background:rgba(255,255,255,.08);border-radius:14px;padding:12px 18px;border:1px solid rgba(255,255,255,.1)">
              <div style="font-size:9px;font-weight:700;color:rgba(255,255,255,.4);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:3px">Weekly Rank</div>
              <div id="rank-badge" style="font-family:'Bebas Neue',sans-serif;font-size:38px;color:#29ABE2;line-height:1">#—</div>
            </div>
          </div>
          <!-- Tabs -->
          <div style="display:flex;gap:0">
            <button id="ptab-rank"    onclick="pTab('rank')"    style="padding:10px 20px;font-size:13px;font-weight:700;cursor:pointer;border:none;background:transparent;font-family:Inter,sans-serif;color:white;border-bottom:3px solid #29ABE2;transition:all .2s">Rankings</button>
            <button id="ptab-rewards" onclick="pTab('rewards')" style="padding:10px 20px;font-size:13px;font-weight:700;cursor:pointer;border:none;background:transparent;font-family:Inter,sans-serif;color:rgba(255,255,255,.4);border-bottom:3px solid transparent;transition:all .2s">Rewards</button>
          </div>
        </div>
      </div>

      <!-- Content -->
      <div style="flex:1;overflow-y:auto">
        <div id="pcon-rank"    style="padding:20px;max-width:900px;margin:0 auto">${spinner()}</div>
        <div id="pcon-rewards" style="display:none;padding:20px;max-width:900px;margin:0 auto"></div>
      </div>
    </div>
  `;

  window.pTab = (tab) => {
    ['rank','rewards'].forEach(t => {
      const btn = document.getElementById(`ptab-${t}`);
      const con = document.getElementById(`pcon-${t}`);
      if (!btn || !con) return;
      const active = t === tab;
      btn.style.color             = active ? 'white' : 'rgba(255,255,255,.4)';
      btn.style.borderBottomColor = active ? '#29ABE2' : 'transparent';
      con.style.display           = active ? 'block' : 'none';
    });
  };

  // User data
  if (_unsubUser) _unsubUser();
  _unsubUser = onUser(user.uid, u => {
    const totalPts  = u.points       ?? 0;
    const weeklyPts = u.weeklyPoints ?? 0;
    const lvl       = u.level        || 'Bronze Spotter';
    const el        = id => document.getElementById(id);

    // Show weekly points in hero (what matters for ranking)
    if (el('pts-display')) el('pts-display').textContent = weeklyPts.toLocaleString();
    if (el('pts-total-label')) el('pts-total-label').textContent = `Total: ${totalPts.toLocaleString()} pts`;
    if (el('level-name'))  el('level-name').textContent  = lvl;
    if (el('rank-badge'))  el('rank-badge').textContent  = u.weeklyRank ? `#${u.weeklyRank}` : '#—';

    // Level bar based on total points
    let pct, toNext;
    if      (lvl.includes('Gold'))   { pct = 100; toNext = 'Max level'; }
    else if (lvl.includes('Silver')) { pct = Math.min(100, Math.round(((totalPts-200)/300)*100)); toNext = `${Math.max(0,500-totalPts)} to Gold`; }
    else                             { pct = Math.min(100, Math.round((totalPts/200)*100));        toNext = `${Math.max(0,200-totalPts)} to Silver`; }
    if (el('level-bar'))  el('level-bar').style.width  = `${Math.max(0,pct)}%`;
    if (el('level-next')) el('level-next').textContent = toNext;
  });

  // Load both in parallel
  _loadRankTab(user);
  _loadRewards(user);

  // History stream — subscribed here, fills panel when ready
  if (_unsubHistory) _unsubHistory();
  _unsubHistory = onPointsHistory(user.uid, h => {
    console.log('[ParkUp] Points history received:', h.length, 'items');
    // Retry until panel exists (built inside _loadRankTab async)
    const tryFill = (attempts = 0) => {
      const panel = document.getElementById('my-history-panel');
      if (panel) {
        _fillHistory(panel, h);
      } else if (attempts < 30) {
        setTimeout(() => tryFill(attempts + 1), 200);
      } else {
        console.warn('[ParkUp] my-history-panel not found after retries');
      }
    };
    tryFill();
  });
}

// ══ RANK TAB — podium + all users + my history ══
function _loadRankTab(user) {
  getLeaderboard().catch(err => {
    console.warn('[ParkUp] Leaderboard failed:', err.message);
    return [];
  }).then(leaders => {
    const panel = document.getElementById('pcon-rank');
    if (!panel) return;

    const medals = ['#F59E0B','#9CA3AF','#CD7C2F'];
    const top3   = leaders.slice(0, 3);
    const rest   = leaders.slice(3);

    // Podium order: 2nd · 1st · 3rd
    const podiumItems = [
      { u: top3[1], rank: 2 },
      { u: top3[0], rank: 1 },
      { u: top3[2], rank: 3 },
    ];
    const barHeights = { 1: 88, 2: 60, 3: 44 };

    panel.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">

        <!-- LEFT: Podium + Full ranking -->
        <div>

          <!-- Podium card -->
          <div style="background:white;border-radius:20px;padding:24px 16px 0;border:1px solid #E3F2FD;box-shadow:0 2px 12px rgba(10,37,64,.06);margin-bottom:14px;overflow:hidden">
            <div style="font-family:'Bebas Neue',sans-serif;font-size:11px;color:#29ABE2;letter-spacing:3px;text-align:center;margin-bottom:20px">TOP SPOTTERS</div>

            ${leaders.length === 0 ? `
              <div style="text-align:center;padding:24px;color:#5B8DB8;font-size:13px">No rankings yet — start reporting!</div>
            ` : `
              <div style="display:flex;align-items:flex-end;justify-content:center;gap:8px">
                ${podiumItems.map(({ u, rank }) => {
                  if (!u) return `<div style="width:80px"></div>`;
                  const isMe     = u.id === user.uid;
                  const isFirst  = rank === 1;
                  const medal    = medals[rank - 1];
                  const initials = (u.name || 'U').split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();
                  const sz       = isFirst ? 58 : 46;
                  const barH     = barHeights[rank];
                  return `
                    <div style="display:flex;flex-direction:column;align-items:center;gap:4px;width:88px">
                      ${isFirst
                        ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="${medal}"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`
                        : `<div style="width:18px;height:18px;border-radius:50%;background:${medal};display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:white">${rank}</div>`
                      }
                      <div style="width:${sz}px;height:${sz}px;border-radius:50%;background:${isMe ? '#29ABE2' : isFirst ? '#0D3460' : '#E8EFF8'};display:flex;align-items:center;justify-content:center;font-weight:900;font-size:${isFirst?17:13}px;color:${isMe || isFirst ? 'white' : '#0A2540'};border:3px solid ${isMe ? '#29ABE2' : medal};box-shadow:0 4px 14px rgba(0,0,0,.12)">${initials}</div>
                      <div style="font-size:11px;font-weight:700;color:#0A2540;text-align:center;max-width:84px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${u.name?.split(' ')[0] || 'User'}</div>
                      <div style="font-family:'Bebas Neue',sans-serif;font-size:${isFirst?16:13}px;color:${medal}">${(u.weeklyPoints || 0).toLocaleString()}</div>
                      <div style="width:76px;height:${barH}px;background:linear-gradient(180deg,${medal}CC,${medal}44);border-radius:8px 8px 0 0;display:flex;align-items:center;justify-content:center">
                        <span style="font-family:'Bebas Neue',sans-serif;font-size:20px;color:white;opacity:.9">${rank}</span>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            `}
            <div style="height:1px;background:#E3F2FD;margin:0 -16px"></div>
          </div>

          <!-- Full ranking table -->
          <div style="background:white;border-radius:16px;border:1px solid #E3F2FD;overflow:hidden;box-shadow:0 2px 8px rgba(10,37,64,.05)">
            <div style="padding:12px 16px;background:#F8FBFF;border-bottom:1px solid #E3F2FD;display:grid;grid-template-columns:28px 36px 1fr 44px 56px;gap:6px;align-items:center">
              <span style="font-size:9px;font-weight:700;color:#5B8DB8;text-transform:uppercase;letter-spacing:1px">#</span>
              <span></span>
              <span style="font-size:9px;font-weight:700;color:#5B8DB8;text-transform:uppercase;letter-spacing:1px">Spotter</span>
              <span style="font-size:9px;font-weight:700;color:#5B8DB8;text-transform:uppercase;letter-spacing:1px;text-align:center">Rep</span>
              <span style="font-size:9px;font-weight:700;color:#5B8DB8;text-transform:uppercase;letter-spacing:1px;text-align:right">Pts</span>
            </div>
            ${leaders.length === 0
              ? `<div style="padding:24px;text-align:center;color:#5B8DB8;font-size:13px">No users yet</div>`
              : leaders.map((u, i) => {
                  const isMe     = u.id === user.uid;
                  const medal    = i < 3 ? medals[i] : null;
                  const initials = (u.name || 'U').split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();
                  return `
                    <div style="display:grid;grid-template-columns:28px 36px 1fr 44px 56px;gap:6px;align-items:center;padding:10px 16px;border-bottom:1px solid #F8FBFF;background:${isMe ? 'rgba(41,171,226,.05)' : 'white'};transition:background .15s"
                      onmouseover="this.style.background='#F8FBFF'" onmouseout="this.style.background='${isMe ? 'rgba(41,171,226,.05)' : 'white'}'">
                      <div style="width:24px;height:24px;border-radius:6px;background:${isMe ? '#29ABE2' : medal ? `${medal}22` : '#F0F8FF'};display:flex;align-items:center;justify-content:center">
                        ${medal && !isMe
                          ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="${medal}"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`
                          : `<span style="font-family:'Bebas Neue',sans-serif;font-size:13px;color:${isMe ? 'white' : '#5B8DB8'}">${i+1}</span>`
                        }
                      </div>
                      <div style="width:30px;height:30px;border-radius:50%;background:${isMe ? '#29ABE2' : medal ? medal : '#E3F2FD'};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:11px;color:${isMe || medal ? 'white' : '#0A2540'}">${initials}</div>
                      <div style="min-width:0">
                        <div style="font-size:12px;font-weight:700;color:#0A2540;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                          ${u.name || 'User'}
                          ${isMe ? '<span style="font-size:9px;background:#E3F2FD;color:#29ABE2;padding:1px 5px;border-radius:4px;margin-left:3px;font-weight:700">YOU</span>' : ''}
                        </div>
                        <div style="font-size:10px;color:#5B8DB8">${u.level || 'Bronze Spotter'}</div>
                      </div>
                      <div style="text-align:center;font-size:12px;font-weight:700;color:#5B8DB8">${u.reportsCount || 0}</div>
                      <div style="text-align:right;font-family:'Bebas Neue',sans-serif;font-size:15px;color:${isMe ? '#29ABE2' : medal ? medal : '#0A2540'}">${(u.weeklyPoints || 0).toLocaleString()}</div>
                    </div>
                  `;
                }).join('')
            }
          </div>
        </div>

        <!-- RIGHT: My Reports History -->
        <div>
          <div style="background:white;border-radius:20px;border:1px solid #E3F2FD;box-shadow:0 2px 12px rgba(10,37,64,.06);overflow:hidden;height:100%;display:flex;flex-direction:column">
            <div style="padding:16px 20px;border-bottom:1px solid #F0F8FF;flex-shrink:0">
              <div style="font-family:'Bebas Neue',sans-serif;font-size:11px;color:#29ABE2;letter-spacing:3px;margin-bottom:2px">MY REPORTS</div>
              <div style="font-size:11px;color:#5B8DB8">Points earned from your activity</div>
            </div>
            <div id="my-history-panel" style="flex:1;overflow-y:auto">
              ${spinner()}
            </div>
          </div>
        </div>

      </div>
    `;
  });
}

function _fillHistory(panel, history) {
  if (!history.length) {
    panel.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px;text-align:center;color:#5B8DB8">
        <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="#BBDEFB" stroke-width="1.5" style="margin-bottom:12px"><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 0 1-2.827 0l-4.244-4.243a8 8 0 1 1 11.314 0z"/><circle cx="12" cy="11" r="3"/></svg>
        <div style="font-size:14px;font-weight:700;color:#0A2540;margin-bottom:4px">No reports yet</div>
        <div style="font-size:12px;line-height:1.6">Start reporting empty spots<br>to earn points!</div>
      </div>`;
    return;
  }

  panel.innerHTML = history.map((h, i) => {
    const earn = h.points > 0;
    const color = earn ? '#43A047' : '#FB8C00';
    const bg    = earn ? '#E8F5E9' : '#FFF3E0';
    const icon  = earn
      ? `<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="${color}" stroke-width="2"><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 0 1-2.827 0l-4.244-4.243a8 8 0 1 1 11.314 0z"/><circle cx="12" cy="11" r="3"/></svg>`
      : `<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="${color}" stroke-width="2"><polyline points="20,12 20,22 4,22 4,12"/><rect x="2" y="7" width="20" height="5"/><path d="M12 22V7"/></svg>`;

    return `
      <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:${i < history.length-1 ? '1px solid #F8FBFF' : 'none'};transition:background .15s"
        onmouseover="this.style.background='#F8FBFF'" onmouseout="this.style.background='white'">
        <div style="width:36px;height:36px;border-radius:10px;background:${bg};display:flex;align-items:center;justify-content:center;flex-shrink:0">${icon}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:700;color:#0A2540;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${h.description}</div>
          <div style="font-size:10px;color:#5B8DB8;margin-top:2px">${timeAgo(h.createdAt)}</div>
        </div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:18px;color:${color};flex-shrink:0">${earn ? '+' : ''}${h.points}</div>
      </div>
    `;
  }).join('');
}

// ══ REWARDS ══
function _loadRewards(user) {
  document.getElementById('pcon-rewards').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:16px;max-width:600px;margin:0 auto">

      <!-- Free Parking Card -->
      <div style="background:white;border-radius:20px;border:1px solid #E3F2FD;box-shadow:0 2px 12px rgba(10,37,64,.06);overflow:hidden">

        <!-- Card Header -->
        <div style="background:linear-gradient(135deg,#0A2540 0%,#1255A0 100%);padding:24px;position:relative;overflow:hidden">
          <div style="position:absolute;top:-10px;right:-10px;width:80px;height:80px;border-radius:50%;background:rgba(41,171,226,.1)"></div>
          <div style="display:flex;align-items:center;gap:14px;position:relative">
            <div style="width:52px;height:52px;border-radius:16px;background:rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <span style="font-size:28px">🅿️</span>
            </div>
            <div>
              <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;color:white;letter-spacing:1px">Free Parking</div>
              <div style="font-size:12px;color:rgba(255,255,255,.5);margin-top:2px">Redeem your points for free parking</div>
            </div>
            <div style="margin-left:auto;background:rgba(255,165,0,.2);color:#FFB74D;font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;white-space:nowrap">Coming Soon</div>
          </div>
        </div>

        <!-- Card Body -->
        <div style="padding:24px">

          <!-- Tiers -->
          <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px">

            <div style="display:flex;align-items:center;gap:14px;padding:14px;background:#F8FBFF;border-radius:12px;border:1.5px solid #E3F2FD;opacity:.6">
              <div style="width:40px;height:40px;border-radius:12px;background:#E3F2FD;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                <span style="font-size:20px">⏱️</span>
              </div>
              <div style="flex:1">
                <div style="font-size:14px;font-weight:700;color:#0A2540">30 Min Free</div>
                <div style="font-size:12px;color:#5B8DB8;margin-top:2px">Half hour at any partner garage</div>
              </div>
              <div style="text-align:right">
                <div style="font-family:'Bebas Neue',sans-serif;font-size:20px;color:#29ABE2">100 pts</div>
              </div>
            </div>

            <div style="display:flex;align-items:center;gap:14px;padding:14px;background:#F8FBFF;border-radius:12px;border:1.5px solid #E3F2FD;opacity:.6">
              <div style="width:40px;height:40px;border-radius:12px;background:#E8F5E9;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                <span style="font-size:20px">🕐</span>
              </div>
              <div style="flex:1">
                <div style="font-size:14px;font-weight:700;color:#0A2540">1 Hour Free</div>
                <div style="font-size:12px;color:#5B8DB8;margin-top:2px">Full hour at any partner garage</div>
              </div>
              <div style="text-align:right">
                <div style="font-family:'Bebas Neue',sans-serif;font-size:20px;color:#29ABE2">200 pts</div>
              </div>
            </div>

            <div style="display:flex;align-items:center;gap:14px;padding:14px;background:#F8FBFF;border-radius:12px;border:1.5px solid #E3F2FD;opacity:.6">
              <div style="width:40px;height:40px;border-radius:12px;background:#FFF3E0;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                <span style="font-size:20px">🌟</span>
              </div>
              <div style="flex:1">
                <div style="font-size:14px;font-weight:700;color:#0A2540">Full Day Free</div>
                <div style="font-size:12px;color:#5B8DB8;margin-top:2px">Entire day at any partner garage</div>
              </div>
              <div style="text-align:right">
                <div style="font-family:'Bebas Neue',sans-serif;font-size:20px;color:#29ABE2">500 pts</div>
              </div>
            </div>

          </div>

          <!-- Coming Soon Notice -->
          <div style="background:#FFF8E1;border:1.5px solid #FFE082;border-radius:12px;padding:14px 16px;display:flex;align-items:center;gap:12px">
            <span style="font-size:22px;flex-shrink:0">🔔</span>
            <div>
              <div style="font-size:13px;font-weight:700;color:#F57F17">Feature Not Available Yet</div>
              <div style="font-size:12px;color:#F9A825;margin-top:3px;line-height:1.5">This feature is coming soon! Keep earning points now so you're ready when it launches.</div>
            </div>
          </div>

        </div>
      </div>

      <!-- How to earn -->
      <div style="background:#0A2540;border-radius:14px;padding:14px 18px;display:flex;align-items:center;gap:12px">
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#29ABE2" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        <div style="font-size:11px;color:rgba(255,255,255,.55)">Report a spot <span style="color:#29ABE2;font-weight:700">+10 pts</span> · Add photo <span style="color:#29ABE2;font-weight:700">+15 pts</span> · Get confirmed <span style="color:#29ABE2;font-weight:700">+5 pts</span></div>
      </div>

    </div>
  `;
}

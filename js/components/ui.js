// js/components/ui.js

export function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${type === 'success' ? '✓' : '✕'}</span><span>${msg}</span>`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

export function showModal({ title, body, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, danger = false }) {
  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.innerHTML = `
    <div class="modal-box">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <h3 style="font-size:20px;font-weight:900;color:#0A2540">${title}</h3>
        <button id="mc" style="font-size:24px;color:#5B8DB8;background:none;border:none;cursor:pointer;line-height:1">×</button>
      </div>
      <div id="mb">${body}</div>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px">
        <button id="mcancel" class="btn btn-secondary">${cancelLabel}</button>
        ${confirmLabel != null ? `<button id="mok" class="btn ${danger ? 'btn-danger' : 'btn-primary'}">${confirmLabel}</button>` : ''}
      </div>
    </div>
  `;
  document.body.appendChild(ov);
  const close = () => ov.remove();
  ov.querySelector('#mc').onclick      = close;
  ov.querySelector('#mcancel').onclick = close;
  if (confirmLabel != null) ov.querySelector('#mok').onclick = () => { onConfirm?.(); close(); };
  ov.onclick = e => { if (e.target === ov) close(); };
  return ov;
}

export const statusPill = s => {
  const map = { available:['pill-available','Available'], few:['pill-few','Few Spots Left'], full:['pill-full','Full'] };
  const [cls, label] = map[s] ?? ['',''];
  return `<span class="pill ${cls}"><span style="width:6px;height:6px;border-radius:50%;background:currentColor;display:inline-block"></span>${label}</span>`;
};

export const capBar = (avail, total, status) => {
  const pct = total > 0 ? Math.round((avail/total)*100) : 0;
  const col = { available:'#43A047', few:'#FB8C00', full:'#E53935' }[status] ?? '#29ABE2';
  return `
    <div style="display:flex;justify-content:space-between;margin-bottom:8px">
      <span style="font-size:11px;color:#5B8DB8;font-weight:600">Capacity</span>
      <span style="font-size:11px;font-weight:700;color:#0A2540">${avail} / ${total}</span>
    </div>
    <div class="cap-bar"><div class="cap-fill" style="width:${pct}%;background:${col}"></div></div>
    <div style="font-size:10px;font-weight:700;color:${col};margin-top:4px">${pct}% full</div>`;
};

export const roleBadge = r => {
  const map = { admin:['badge-admin','Admin'], owner:['badge-owner','Owner'], user:['badge-user','User'] };
  const [cls, label] = map[r] ?? ['badge-user', r];
  return `<span class="badge ${cls}">${label}</span>`;
};

export const spinner = () => `<div class="spinner"></div>`;
export const empty   = (icon, msg) => `<div class="empty-state"><span style="font-size:40px;opacity:.3">${icon}</span><span>${msg}</span></div>`;

export function sectionTitle(label) {
  return `<div class="section-title">${label}</div>`;
}

import { timeAgo } from '../services/db.js';
export { timeAgo };

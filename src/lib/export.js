// CSV export of a space's expenses. Opens in Excel / Google Sheets with
// Hebrew intact (UTF-8 with BOM). The web downloads the file; Android saves it
// to the app cache and opens the share sheet.
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { isNative } from './platform.js';

const SOURCE_HE = { manual: 'ידני', wallet: 'Google Wallet', card: 'אשראי', sms: 'SMS', gmail: 'Gmail' };

function cell(v) {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Pure: rows sorted by date. `payerName(uid)` names who paid (shared spaces).
export function expensesToCSV(items, { payerName } = {}) {
  const head = ['תאריך', 'שם', 'קטגוריה', 'סכום', 'הערה', ...(payerName ? ['מי שילם'] : []), 'מקור'];
  const rows = [...items]
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
    .map((it) => [
      it.date || '', it.title || '', it.group || '', Number(it.amount) || 0, it.note || '',
      ...(payerName ? [payerName(it.paidBy || it.addedBy)] : []),
      SOURCE_HE[it.source] || SOURCE_HE.manual,
    ]);
  return '﻿' + [head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
}

export async function shareCSV(csv, filename) {
  if (isNative) {
    const { uri } = await Filesystem.writeFile({ path: filename, data: csv, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: filename, files: [uri] });
    return;
  }
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

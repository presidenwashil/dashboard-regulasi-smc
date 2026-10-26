import { describe, it, expect } from 'vitest';
import { loadGas } from './loadGas';

const ctx = loadGas(['Code.gs', 'Auth.gs', 'Users.gs', 'Pdf.gs']) as any;

describe('requireAccess_', () => {
  it('menolak token kosong', () => {
    const r = ctx.requireAccess_('', 'Admin');
    expect(r.error.success).toBe(false);
  });

  it('menolak user biasa untuk aksi Admin', () => {
    ctx.CacheService.getScriptCache().put('t1', JSON.stringify({ nrp: '1', role: 'User' }));
    const r = ctx.requireAccess_('t1', 'Admin');
    expect(r.error.message).toBe('Akses ditolak.');
  });

  it('meloloskan Admin', () => {
    ctx.CacheService.getScriptCache().put('t2', JSON.stringify({ nrp: '2', role: 'Admin' }));
    const r = ctx.requireAccess_('t2', 'Admin');
    expect(r.session.role).toBe('Admin');
  });
});

describe('escapeHtml_', () => {
  it('meng-escape karakter berbahaya', () => {
    expect(ctx.escapeHtml_('<b>"A" & \'B\'</b>')).toBe('&lt;b&gt;&quot;A&quot; &amp; &#39;B&#39;&lt;/b&gt;');
  });
});
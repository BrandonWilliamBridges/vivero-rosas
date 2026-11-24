(function(){
  const OWNER = 'BrandonWilliamBridges', REPO = 'vivero-rosas', BRANCH = 'main';
  const MENU_PATH = 'docs/menu.json', STORE_KEY = 'vr-admin';
  const API = 'https://api.github.com/repos/' + OWNER + '/' + REPO + '/contents/';
  const $ = id => document.getElementById(id);
  let token = null, data = null, dirty = false;

  /* ---------- small helpers ---------- */
  const enc = new TextEncoder(), dec = new TextDecoder();
  const b64 = u8 => btoa(String.fromCharCode(...u8));
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const b64utf8 = s => b64(enc.encode(s));
  const unb64utf8 = s => dec.decode(unb64(s.replace(/\n/g, '')));
  const esc = v => String(v == null ? '' : v).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const msg = (el, text, cls) => { el.textContent = text; el.className = 'msg ' + (cls || ''); };
  const store = {
    get(){ try{ return JSON.parse(localStorage.getItem(STORE_KEY) || 'null') }catch(e){ return null } },
    set(v){ try{ localStorage.setItem(STORE_KEY, JSON.stringify(v)) }catch(e){} },
    clear(){ try{ localStorage.removeItem(STORE_KEY) }catch(e){} }
  };

  /* ---------- the access key lives only in this browser, encrypted with the admin password ---------- */
  async function deriveKey(pw, salt, iter){
    const base = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({name:'PBKDF2', salt, iterations: iter, hash:'SHA-256'}, base, {name:'AES-GCM', length:256}, false, ['encrypt','decrypt']);
  }
  async function lock(pw, secret){
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12)), iter = 300000;
    const key = await deriveKey(pw, salt, iter);
    const ct = new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM', iv}, key, enc.encode(secret)));
    return {v:1, iter, salt:b64(salt), iv:b64(iv), ct:b64(ct)};
  }
  async function unlock(pw, box){
    const key = await deriveKey(pw, unb64(box.salt), box.iter);
    return dec.decode(await crypto.subtle.decrypt({name:'AES-GCM', iv: unb64(box.iv)}, key, unb64(box.ct)));
  }

  /* ---------- GitHub contents API ---------- */
  async function gh(path, opts){
    const r = await fetch(API + path + (opts && opts.method === 'PUT' ? '' : '?ref=' + BRANCH + '&t=' + Date.now()), Object.assign({
      headers: {'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28'}
    }, opts || {}));
    if (r.status === 404) return null;
    if (!r.ok){ const t = await r.text(); throw new Error('GitHub ' + r.status + ': ' + t.slice(0, 200)); }
    return r.json();
  }
  async function ghRead(path){ const j = await gh(path); return j ? {sha: j.sha, text: unb64utf8(j.content)} : null; }
  async function ghWrite(path, text, sha, message){
    const body = {message, content: b64utf8(text), branch: BRANCH};
    if (sha) body.sha = sha;
    const j = await gh(path, {method:'PUT', body: JSON.stringify(body)});
    return j.content.sha;
  }
  async function keyWorks(tok){
    const r = await fetch('https://api.github.com/repos/' + OWNER + '/' + REPO, {headers:{'Authorization':'Bearer ' + tok, 'Accept':'application/vnd.github+json'}});
    return r.ok;
  }

  /* ---------- boot: set up this device, or log in ---------- */
  function boot(){
    const box = store.get();
    $('setup').hidden = !!box; $('login').hidden = !box;
    if (box) setTimeout(() => $('liPw').focus(), 50);
  }

  $('suBtn').addEventListener('click', async () => {
    const tok = $('suToken').value.trim(), pw = $('suPw').value, pw2 = $('suPw2').value, m = $('suMsg');
    if (!tok.startsWith('github_pat_') && !tok.startsWith('ghp_')) return msg(m, 'That does not look like a GitHub access key.', 'err');
    if (pw.length < 8) return msg(m, 'Use a password of at least 8 characters.', 'err');
    if (pw !== pw2) return msg(m, 'The passwords do not match.', 'err');
    $('suBtn').disabled = true; msg(m, 'Checking the key with GitHub…');
    try{
      if (!(await keyWorks(tok))) throw new Error('GitHub rejected the key, or it has no access to the vivero-rosas repository.');
      store.set(await lock(pw, tok));
      token = tok;
      msg(m, 'Saved on this device. Opening the editor…', 'ok');
      await openEditor();
    }catch(e){ msg(m, e.message, 'err'); $('suBtn').disabled = false; }
  });

  $('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const m = $('liMsg'); $('liBtn').disabled = true; msg(m, 'Checking…');
    try{
      token = await unlock($('liPw').value, store.get());
      if (!(await keyWorks(token))) throw new Error('The password is right, but GitHub rejected the saved access key. It may have expired: set this device up again with a new key.');
      await openEditor();
    }catch(e){
      token = null;
      msg(m, e.name === 'OperationError' ? 'Wrong password.' : e.message, 'err');
      $('liBtn').disabled = false;
    }
  });
  $('resetBtn').addEventListener('click', () => {
    if (!confirm('This forgets the access key saved on this device. You will need to paste the key again. Continue?')) return;
    store.clear(); token = null; boot();
  });

  $('logoutBtn').addEventListener('click', () => { token = null; location.reload(); });
  $('pwBtn').addEventListener('click', async () => {
    const pw = prompt('New admin password for this device (at least 8 characters):'); if (!pw) return;
    if (pw.length < 8) return alert('Use at least 8 characters.');
    const pw2 = prompt('Repeat the new password:'); if (pw2 !== pw) return alert('The passwords do not match.');
    store.set(await lock(pw, token));
    alert('Password changed on this device.');
  });

  /* ---------- editor ---------- */
  async function openEditor(){
    const f = await ghRead(MENU_PATH);
    data = f ? JSON.parse(f.text) : {menu:[], combos:[], carnes:[], breakfast:[], catering:{note_en:'', note_es:'', items:[]}};
    data.combos = data.combos || []; data.carnes = data.carnes || []; data.breakfast = data.breakfast || [];
    data.catering = data.catering || {note_en:'', note_es:'', items:[]}; data.catering.items = data.catering.items || [];
    data.info = data.info || {phone:'', hours_en:'', hours_es:''};
    ['instagram','facebook','tiktok','doordash'].forEach(k => { if (data.info[k] == null) data.info[k] = ''; });
    $('setup').hidden = true; $('login').hidden = true;
    $('editor').hidden = false; $('savebar').hidden = false; $('logoutBtn').hidden = false; $('pwBtn').hidden = false;
    render(); setDirty(false);
  }

  function setDirty(v){
    dirty = v;
    $('saveSt').innerHTML = v ? '<span class="dot"></span>Unsaved changes' : 'All changes saved';
    $('saveBtn').disabled = !v;
  }

  function itemCard(list, i, kind){
    const m = list[i], priced = kind !== 'breakfast';
    return '<div class="card item" data-kind="' + kind + '" data-i="' + i + '">' +
      '<span class="n full">' + (i + 1) + '</span>' +
      '<label>Name (English)<input data-f="en" value="' + esc(m.en) + '"></label>' +
      '<label>Name (Spanish)<input data-f="es" value="' + esc(m.es) + '"></label>' +
      (priced ? '<label>Description (English)<input data-f="xen" value="' + esc(m.xen) + '"></label>' +
                '<label>Description (Spanish)<input data-f="xes" value="' + esc(m.xes) + '"></label>' : '') +
      '<div class="row">' +
      (priced ? '<label class="price">Price<input data-f="p" value="' + esc(m.p) + '" placeholder="$12"></label>' +
                (kind === 'menu' ? '<label class="ck"><input type="checkbox" data-f="u"' + (m.u ? ' checked' : '') + '> each</label>' : '') : '') +
      '<span class="sp"></span>' +
      '<button class="btn ic" data-act="up" title="Move up" aria-label="Move up">↑</button>' +
      '<button class="btn ic" data-act="down" title="Move down" aria-label="Move down">↓</button>' +
      '<button class="btn ic" data-act="del" title="Delete" aria-label="Delete">✕</button>' +
      '</div></div>';
  }
  const lists = { menu: () => data.menu, combos: () => data.combos, breakfast: () => data.breakfast, catering: () => data.catering.items };
  const holders = { menu: 'menuList', combos: 'combosList', breakfast: 'breakfastList', catering: 'cateringList' };

  function render(){
    Object.keys(lists).forEach(k => {
      const l = lists[k]();
      $(holders[k]).innerHTML = l.length ? l.map((_, i) => itemCard(l, i, k)).join('') : '<p class="hint" style="margin-top:10px">Nothing here yet.</p>';
    });
    $('carnesList').innerHTML = data.carnes.map((c, i) => '<span class="chip">' + esc(c) + '<button data-carne="' + i + '" title="Remove" aria-label="Remove ' + esc(c) + '">×</button></span>').join('') || '<p class="hint">No carnes listed.</p>';
    $('catEn').value = data.catering.note_en || '';
    $('catEs').value = data.catering.note_es || '';
    $('infoPhone').value = data.info.phone || '';
    $('infoHoursEn').value = data.info.hours_en || '';
    $('infoHoursEs').value = data.info.hours_es || '';
    $('infoInstagram').value = data.info.instagram || '';
    $('infoFacebook').value = data.info.facebook || '';
    $('infoTiktok').value = data.info.tiktok || '';
    $('infoDoordash').value = data.info.doordash || '';
  }

  document.addEventListener('input', e => {
    const card = e.target.closest('.item[data-kind]');
    if (card){
      const l = lists[card.dataset.kind](), m = l[+card.dataset.i], f = e.target.dataset.f;
      if (!f) return;
      if (f === 'u') m.u = e.target.checked; else m[f] = e.target.value;
      setDirty(true); return;
    }
    if (e.target.id === 'catEn'){ data.catering.note_en = e.target.value; setDirty(true); }
    if (e.target.id === 'catEs'){ data.catering.note_es = e.target.value; setDirty(true); }
    if (e.target.id === 'infoPhone'){ data.info.phone = e.target.value; setDirty(true); }
    if (e.target.id === 'infoHoursEn'){ data.info.hours_en = e.target.value; setDirty(true); }
    if (e.target.id === 'infoHoursEs'){ data.info.hours_es = e.target.value; setDirty(true); }
    const soc = {infoInstagram:'instagram', infoFacebook:'facebook', infoTiktok:'tiktok', infoDoordash:'doordash'}[e.target.id];
    if (soc){ data.info[soc] = e.target.value; setDirty(true); }
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.add){
      const l = lists[b.dataset.add]();
      l.push(b.dataset.add === 'breakfast' ? {en:'', es:''} : {en:'', es:'', xen:'', xes:'', p:''});
      render(); setDirty(true);
      const cards = $(holders[b.dataset.add]).querySelectorAll('.item'); const last = cards[cards.length - 1];
      if (last){ last.scrollIntoView({behavior:'smooth', block:'center'}); last.querySelector('input').focus(); }
      return;
    }
    if (b.dataset.carne !== undefined){ data.carnes.splice(+b.dataset.carne, 1); render(); setDirty(true); return; }
    if (b.id === 'carneAdd'){
      const v = $('carneNew').value.trim(); if (!v) return;
      data.carnes.push(v); $('carneNew').value = ''; render(); setDirty(true); return;
    }
    const card = b.closest('.item[data-kind]'); if (!card || !b.dataset.act) return;
    const l = lists[card.dataset.kind](), i = +card.dataset.i;
    if (b.dataset.act === 'del'){ if (!confirm('Delete "' + (l[i].en || 'this item') + '"?')) return; l.splice(i, 1); }
    if (b.dataset.act === 'up' && i > 0) [l[i-1], l[i]] = [l[i], l[i-1]];
    if (b.dataset.act === 'down' && i < l.length - 1) [l[i+1], l[i]] = [l[i], l[i+1]];
    render(); setDirty(true);
  });
  $('carneNew').addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); $('carneAdd').click(); } });

  $('reloadBtn').addEventListener('click', async () => {
    if (dirty && !confirm('Throw away your unsaved changes?')) return;
    await openEditor();
  });

  $('saveBtn').addEventListener('click', async () => {
    const problems = [];
    ['menu','combos','catering'].forEach(k => lists[k]().forEach((m, i) => {
      if (!String(m.en || '').trim()) problems.push(k + ' item ' + (i + 1) + ' has no English name');
      if (!String(m.p || '').trim()) problems.push((m.en || k + ' item ' + (i + 1)) + ' has no price');
    }));
    data.breakfast.forEach((m, i) => { if (!String(m.en || '').trim()) problems.push('breakfast taco ' + (i + 1) + ' has no name'); });
    const ph = String(data.info.phone || '').replace(/\D/g, '');
    if (ph && ph.length !== 10) problems.push('the phone number should have 10 digits (area code + number)');
    if (problems.length) return alert('Please fix before saving:\n\n• ' + problems.join('\n• '));
    const clean = s => String(s || '').trim();
    const tidy = m => { const o = {en: clean(m.en), es: clean(m.es) || clean(m.en)}; if ('p' in m){ o.xen = clean(m.xen); o.xes = clean(m.xes) || clean(m.xen); o.p = clean(m.p); if (m.u) o.u = true; } return o; };
    const out = {
      menu: data.menu.map(tidy), combos: data.combos.map(tidy),
      carnes: data.carnes.map(clean).filter(Boolean), breakfast: data.breakfast.map(tidy),
      catering: {note_en: clean(data.catering.note_en), note_es: clean(data.catering.note_es), items: data.catering.items.map(tidy)},
      info: {phone: ph ? ph.slice(0,3) + '-' + ph.slice(3,6) + '-' + ph.slice(6) : '', hours_en: clean(data.info.hours_en), hours_es: clean(data.info.hours_es),
             instagram: clean(data.info.instagram), facebook: clean(data.info.facebook), tiktok: clean(data.info.tiktok), doordash: clean(data.info.doordash)}
    };
    $('saveBtn').disabled = true; $('saveSt').textContent = 'Saving…';
    try{
      const latest = await ghRead(MENU_PATH);
      await ghWrite(MENU_PATH, JSON.stringify(out, null, 2) + '\n', latest && latest.sha, 'Menu update from admin');
      data = out; render(); setDirty(false);
      $('saveSt').textContent = 'Saved at ' + new Date().toLocaleTimeString([], {hour:'numeric', minute:'2-digit'}) + '. The site shows it in about a minute.';
    }catch(e){
      $('saveSt').textContent = 'Could not save: ' + e.message; $('saveBtn').disabled = false;
    }
  });

  window.addEventListener('beforeunload', e => { if (dirty){ e.preventDefault(); e.returnValue = ''; } });
  boot();
})();

(function(){
  // --- Data ---------------------------------------------------------------
  const CATALOG = [
    { id: "drainage-rehab", name: "Urban Drainage Rehab", unit: "block", unitCost: 250000000, category: "Engineering", emoji: "🕳️", desc: "Rework clogged street drainage for a city block." },
    { id: "pump-station", name: "Pumping Station", unit: "station", unitCost: 800000000, category: "Engineering", emoji: "💧", desc: "High-capacity pumps for low-lying districts." },
    { id: "river-dredge", name: "River Dredging", unit: "km", unitCost: 120000000, category: "Engineering", emoji: "⚓", desc: "Deepen waterways to restore flow." },
    { id: "levee", name: "Levee Construction", unit: "km", unitCost: 350000000, category: "Engineering", emoji: "🛡️", desc: "Raised embankments for flood barriers." },
    { id: "retention-basin", name: "Retention Basin", unit: "hectare", unitCost: 90000000, category: "Engineering", emoji: "🏞️", desc: "Temporary water storage to delay surges." },
    { id: "culvert", name: "Culvert Upgrade", unit: "site", unitCost: 12000000, category: "Maintenance", emoji: "🏗️", desc: "Replace undersized culverts at choke points." },
    { id: "debris-booms", name: "Debris Booms", unit: "set", unitCost: 5000000, category: "Maintenance", emoji: "🪵", desc: "Floating barriers to catch trash and logs." },
    { id: "sensor-network", name: "Rain & River Sensors", unit: "node", unitCost: 1500000, category: "Monitoring", emoji: "📡", desc: "IoT sensors for early warnings." },
    { id: "sirens", name: "Community Sirens", unit: "siren", unitCost: 900000, category: "Preparedness", emoji: "🚨", desc: "Outdoor sirens for alerts." },
    { id: "evac-centers", name: "Evacuation Center Upgrade", unit: "center", unitCost: 35000000, category: "Preparedness", emoji: "🏫", desc: "Dry floors, power, and water." },
    { id: "mangrove", name: "Mangrove Rehabilitation", unit: "hectare", unitCost: 800000, category: "Nature-based", emoji: "🌿", desc: "Coastal buffers that slow storm surge." },
    { id: "floodplain-zoning", name: "Floodplain Zoning Plan", unit: "city", unitCost: 7000000, category: "Planning", emoji: "🗺️", desc: "Map risks, steer growth away from danger." },
  ];

  const DEFAULT_BUDGET = 300_000_000_000; // ₱300B
  const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 });

  // --- State --------------------------------------------------------------
  const state = {
    budget: DEFAULT_BUDGET,
    qty: Object.fromEntries(CATALOG.map(i => [i.id, 0])),
    filter: { q: "", cat: "All" }
  };

  // restore from URL or localStorage
  (function restore(){
    const url = new URL(location.href);
    const q = url.searchParams.get('q');
    const b = url.searchParams.get('b');
    if (q) {
      q.split(',').forEach(pair => {
        const [id, qty] = pair.split(':');
        if (state.qty.hasOwnProperty(id)) state.qty[id] = Math.max(0, parseInt(qty || '0', 10) || 0);
      });
    } else {
      try {
        const saved = JSON.parse(localStorage.getItem('sfcf_state') || 'null');
        if (saved) { Object.assign(state, saved); }
      } catch (e) { /* ignore */ }
    }
    if (b) { state.budget = Math.max(0, parseInt(b, 10) || DEFAULT_BUDGET); }
  })();

  // --- Theme Management ---------------------------------------------------
  function setTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('sfcf_theme', theme);
    const themeBtn = document.getElementById('themeToggleBtn');
    themeBtn.textContent = theme === 'dark' ? '🌙' : '☀️';
    themeBtn.title = `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`;
  }

  function toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  }

  function initTheme() {
    const savedTheme = localStorage.getItem('sfcf_theme') || 'dark';
    setTheme(savedTheme);
  }

  // --- DOM refs -----------------------------------------------------------
  const el = (q) => document.querySelector(q);
  const grid = el('#grid');
  const receipt = el('#receipt');
  const remaining = el('#remaining');
  const spent = el('#spent');
  const items = el('#items');
  const meter = el('#meter');
  const budgetInput = el('#budgetInput');
  const search = el('#search');
  const catFilter = el('#catFilter');

  // --- UI builders --------------------------------------------------------
  function buildFilters() {
    const cats = ['All', ...[...new Set(CATALOG.map(i => i.category))]];
    catFilter.innerHTML = '';
    cats.forEach(c => {
      const b = document.createElement('button');
      b.textContent = c;
      b.className = c === state.filter.cat ? 'active' : '';
      b.addEventListener('click', () => { state.filter.cat = c; buildFilters(); render(); });
      catFilter.appendChild(b);
    });
  }

  function buildCatalog() {
    const q = state.filter.q.toLowerCase();
    const cat = state.filter.cat;
    const list = CATALOG.filter(i =>
      (cat === 'All' || i.category === cat) &&
      (i.name.toLowerCase().includes(q) || i.desc.toLowerCase().includes(q) || i.category.toLowerCase().includes(q))
    );

    grid.innerHTML = '';
    list.forEach(i => {
      const card = document.createElement('div');
      card.className = 'item card';
      card.innerHTML = `
        <div class="title"><span class="emoji">${i.emoji}</span><strong>${i.name}</strong></div>
        <div class="desc">${i.desc}</div>
        <div class="price">${peso.format(i.unitCost)} / ${i.unit}</div>
        <div class="qty">
          <div class="stepper">
            <button aria-label="decrease">Sell</button>
            <input type="number" min="0" step="1" value="${state.qty[i.id]}" />
            <button aria-label="increase">Buy</button>
          </div>
        </div>`;
      const [minus, input, plus] = card.querySelectorAll('.stepper > *');
      minus.addEventListener('click', () => setQty(i.id, state.qty[i.id] - 1));
      plus.addEventListener('click', () => setQty(i.id, state.qty[i.id] + 1));
      input.addEventListener('input', () => setQty(i.id, parseInt(input.value || '0', 10) || 0));
      grid.appendChild(card);
    });
  }

  function buildReceipt() {
    receipt.innerHTML = '';
    const entries = CATALOG.map(i => ({ item: i, qty: state.qty[i.id] })).filter(x => x.qty > 0);
    if (entries.length === 0) {
      const p = document.createElement('div');
      p.className = 'muted';
      p.textContent = 'No items yet. Add something from the left!';
      receipt.appendChild(p);
      return;
    }
    entries.forEach(({ item, qty }) => {
      const row = document.createElement('div');
      row.className = 'row';
      const subtotal = qty * item.unitCost;
      row.innerHTML = `
        <div>
          <div><strong>${item.name}</strong></div>
          <div class="small muted">${qty} × ${peso.format(item.unitCost)} / ${item.unit}</div>
        </div>
        <div class="pill">${item.category}</div>
        <div><strong>${peso.format(subtotal)}</strong></div>`;
      receipt.appendChild(row);
    });
  }

  // --- Logic -------------------------------------------------------------
  function setQty(id, val) {
    state.qty[id] = Math.max(0, Math.floor(val || 0));
    render();
  }

  function compute() {
    const totals = CATALOG.reduce((acc, i) => {
      const q = state.qty[i.id] || 0;
      acc.items += q;
      acc.spent += q * i.unitCost;
      return acc;
    }, { items: 0, spent: 0 });
    totals.remaining = Math.max(0, state.budget - totals.spent);
    totals.usedPct = Math.min(100, (totals.spent / state.budget) * 100 || 0);
    totals.over = Math.max(0, totals.spent - state.budget);
    return totals;
  }

  function renderTotals() {
    const { spent: sp, remaining: rem, items: it, usedPct, over } = compute();
    remaining.textContent = peso.format(rem) + (over ? ` (over by ${peso.format(over)})` : '');
    spent.textContent = peso.format(sp);
    items.textContent = it;
    meter.style.width = usedPct + '%';
    remaining.classList.toggle('danger', over > 0);
  }

  function render() {
    save();
    buildCatalog();
    buildReceipt();
    renderTotals();
  }

  function save() {
    localStorage.setItem('sfcf_state', JSON.stringify(state));
  }

  function setBudgetFromInput() {
    const raw = budgetInput.value.replace(/[^0-9]/g, '');
    const val = parseInt(raw || '0', 10) || 0;
    state.budget = Math.max(0, val);
    budgetInput.value = peso.format(state.budget);
    render();
  }

  function initBudgetInput() {
    budgetInput.value = peso.format(state.budget);
    budgetInput.addEventListener('blur', setBudgetFromInput);
    budgetInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.currentTarget.blur(); } });
  }

  function initSearch() {
    search.addEventListener('input', () => { state.filter.q = search.value; render(); });
  }

  function download() {
    const { spent, remaining, items } = compute();
    const lines = [];
    lines.push('spendfloodcontrolfunds — Receipt');
    lines.push('');
    CATALOG.forEach(i => {
      const q = state.qty[i.id] || 0;
      if (!q) return;
      lines.push(`${i.name} — ${q} × ${peso.format(i.unitCost)} / ${i.unit} = ${peso.format(q * i.unitCost)}`);
    });
    lines.push('');
    lines.push(`TOTAL ITEMS: ${items}`);
    lines.push(`TOTAL SPENT: ${peso.format(spent)}`);
    lines.push(`REMAINING: ${peso.format(remaining)}`);
    lines.push(`BUDGET: ${peso.format(state.budget)}`);
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'spendfloodcontrolfunds-receipt.txt';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // --- Wire up -----------------------------------------------------------
  buildFilters();
  initBudgetInput();
  initSearch();
  initTheme();
  render();

  document.getElementById('resetBtn').addEventListener('click', () => {
    Object.keys(state.qty).forEach(k => state.qty[k] = 0);
    state.filter.q = '';
    search.value = '';
    state.filter.cat = 'All';
    buildFilters();
    state.budget = DEFAULT_BUDGET;
    budgetInput.value = peso.format(state.budget);
    render();
  });
  document.getElementById('themeToggleBtn').addEventListener('click', toggleTheme);
  document.getElementById('downloadBtn').addEventListener('click', download);
})();

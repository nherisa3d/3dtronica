// ===== STORAGE (localStorage) =====
const STORAGE_KEY = 'nherisa3d_v1';
let db = { pedidos: [], inventario: [], gastos: [], presupuestos: [] };
let deleteCallback = null;
let toastTimer = null;

async function loadData() {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return new Promise(resolve => {
      chrome.storage.local.get([STORAGE_KEY], (result) => {
        if (result[STORAGE_KEY]) {
          const d = result[STORAGE_KEY];
          resolve({ pedidos: d.pedidos||[], inventario: d.inventario||[], gastos: d.gastos||[], presupuestos: d.presupuestos||[] });
        } else {
          // fallback to localStorage on first load if it exists
          try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
              const d = JSON.parse(raw);
              const migrated = { pedidos: d.pedidos||[], inventario: d.inventario||[], gastos: d.gastos||[], presupuestos: d.presupuestos||[] };
              chrome.storage.local.set({ [STORAGE_KEY]: migrated });
              resolve(migrated);
            } else {
              resolve({ pedidos: [], inventario: [], gastos: [], presupuestos: [] });
            }
          } catch(e) { resolve({ pedidos: [], inventario: [], gastos: [], presupuestos: [] }); }
        }
      });
    });
  } else {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) { const d = JSON.parse(raw); return { pedidos: d.pedidos||[], inventario: d.inventario||[], gastos: d.gastos||[], presupuestos: d.presupuestos||[] }; }
    } catch(e) {}
    return { pedidos: [], inventario: [], gastos: [], presupuestos: [] };
  }
}

function saveData() { 
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({ [STORAGE_KEY]: db });
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); 
  }
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  db = await loadData();
  setupNav();
  setupModals();
  setupForms();
  setupFilters();
  setupExportImport();
  renderAll();
});

// ===== HELPERS =====
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function fmt(n) { return '$' + (parseFloat(n)||0).toLocaleString('es-AR', { minimumFractionDigits: 2 }); }
function fmtDate(d) { if (!d) return '-'; const [y,m,dd] = d.split('-'); return `${dd}/${m}/${y}`; }
function badgeHtml(val) { return `<span class="badge badge-${val}">${val.replace('_',' ')}</span>`; }
function stockStatus(item) {
  const q = parseFloat(item.cantidad)||0, m = parseFloat(item.stockMin)||0;
  if (q <= 0) return { cls: 'badge-critico', label: 'Sin stock' };
  if (q <= m) return { cls: 'badge-bajo', label: 'Stock bajo' };
  return { cls: 'badge-ok', label: 'OK' };
}
function toast(msg, type='success') {
  const el = document.getElementById('toast');
  el.textContent = msg; el.className = `toast show ${type}`;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.className = 'toast'; }, 3000);
}

// ===== NAV =====
function setupNav() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('section-' + btn.dataset.section).classList.add('active');
    });
  });
}

// ===== MODALS =====
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function setupModals() {
  document.querySelectorAll('.modal-close, [data-modal]').forEach(el => {
    el.addEventListener('click', () => closeModal(el.dataset.modal));
  });
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });
  });
  document.getElementById('confirm-cancel').onclick = () => closeModal('modal-confirm');
  document.getElementById('confirm-ok').onclick = () => {
    if (deleteCallback) { deleteCallback(); deleteCallback = null; }
    closeModal('modal-confirm');
  };
}
function confirmDelete(cb) { deleteCallback = cb; openModal('modal-confirm'); }

// ===== FILTERS =====
function setupFilters() {
  [['search-pedidos','filter-pedidos-estado',renderPedidos],
   ['search-inventario','filter-inventario-cat',renderInventario],
   ['search-gastos','filter-gastos-cat',renderGastos],
   ['search-presupuestos','filter-presupuestos-estado',renderPresupuestos]
  ].forEach(([sid,fid,fn]) => {
    document.getElementById(sid).addEventListener('input', fn);
    document.getElementById(fid).addEventListener('change', fn);
  });
  document.getElementById('filter-gastos-mes').addEventListener('change', renderGastos);
}

// ===== EXPORT / IMPORT =====
function setupExportImport() {
  document.getElementById('btn-export').onclick = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `3dtronica_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(url);
    toast('Datos exportados ✓', 'success');
  };
  const fileInput = document.getElementById('import-file');
  document.getElementById('btn-import').onclick = () => fileInput.click();
  fileInput.onchange = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        db = { pedidos: data.pedidos||[], inventario: data.inventario||[], gastos: data.gastos||[], presupuestos: data.presupuestos||[] };
        saveData(); renderAll(); toast('Datos importados ✓', 'success');
      } catch { toast('Error al importar el archivo', 'error'); }
    };
    reader.readAsText(file);
    fileInput.value = '';
  };
}

function renderAll() { renderPedidos(); renderInventario(); renderGastos(); renderPresupuestos(); }

// ===== FORMS =====
function setupForms() {
  // PEDIDOS
  document.getElementById('btn-new-pedido').onclick = () => {
    document.getElementById('pedido-id').value = '';
    document.getElementById('form-pedido').reset();
    document.getElementById('pedido-id').value = '';
    document.getElementById('pedido-fecha').value = new Date().toISOString().slice(0,10);
    document.getElementById('modal-pedido-title').textContent = 'Nuevo Pedido';
    openModal('modal-pedido');
  };
  document.getElementById('form-pedido').onsubmit = (e) => {
    e.preventDefault();
    const id = document.getElementById('pedido-id').value;
    const obj = {
      id: id || uid(),
      cliente:  document.getElementById('pedido-cliente').value.trim(),
      producto: document.getElementById('pedido-producto').value.trim(),
      material: document.getElementById('pedido-material').value.trim(),
      color:    document.getElementById('pedido-color').value.trim(),
      cantidad: document.getElementById('pedido-cantidad').value,
      precio:   document.getElementById('pedido-precio').value,
      fecha:    document.getElementById('pedido-fecha').value,
      estado:   document.getElementById('pedido-estado').value,
      notas:    document.getElementById('pedido-notas').value.trim(),
    };
    if (id) { const i = db.pedidos.findIndex(p=>p.id===id); db.pedidos[i]=obj; }
    else db.pedidos.unshift(obj);
    saveData(); closeModal('modal-pedido'); renderPedidos();
    toast(id ? 'Pedido actualizado' : 'Pedido creado ✓', 'success');
  };

  // INVENTARIO
  document.getElementById('btn-new-insumo').onclick = () => {
    document.getElementById('insumo-id').value = '';
    document.getElementById('form-insumo').reset();
    document.getElementById('modal-insumo-title').textContent = 'Nuevo Producto';
    openModal('modal-insumo');
  };
  document.getElementById('form-insumo').onsubmit = (e) => {
    e.preventDefault();
    const id = document.getElementById('insumo-id').value;
    const obj = {
      id: id || uid(),
      nombre:    document.getElementById('insumo-nombre').value.trim(),
      categoria: document.getElementById('insumo-categoria').value,
      cantidad:  document.getElementById('insumo-cantidad').value,
      unidad:    document.getElementById('insumo-unidad').value,
      stockMin:  document.getElementById('insumo-stock-min').value,
      costo:     document.getElementById('insumo-costo').value,
      proveedor: document.getElementById('insumo-proveedor').value.trim(),
      notas:     document.getElementById('insumo-notas').value.trim(),
    };
    if (id) { const i = db.inventario.findIndex(x=>x.id===id); db.inventario[i]=obj; }
    else db.inventario.unshift(obj);
    saveData(); closeModal('modal-insumo'); renderInventario();
    toast(id ? 'Producto actualizado' : 'Producto agregado ✓', 'success');
  };

  // GASTOS
  document.getElementById('btn-new-gasto').onclick = () => {
    document.getElementById('gasto-id').value = '';
    document.getElementById('form-gasto').reset();
    document.getElementById('gasto-fecha').value = new Date().toISOString().slice(0,10);
    document.getElementById('modal-gasto-title').textContent = 'Nuevo Gasto';
    openModal('modal-gasto');
  };
  document.getElementById('form-gasto').onsubmit = (e) => {
    e.preventDefault();
    const id = document.getElementById('gasto-id').value;
    const obj = {
      id: id || uid(),
      descripcion: document.getElementById('gasto-descripcion').value.trim(),
      categoria:   document.getElementById('gasto-categoria').value,
      monto:       document.getElementById('gasto-monto').value,
      fecha:       document.getElementById('gasto-fecha').value,
      nota:        document.getElementById('gasto-nota').value.trim(),
    };
    if (id) { const i = db.gastos.findIndex(x=>x.id===id); db.gastos[i]=obj; }
    else db.gastos.unshift(obj);
    saveData(); closeModal('modal-gasto'); renderGastos();
    toast(id ? 'Gasto actualizado' : 'Gasto registrado ✓', 'success');
  };

  // PRESUPUESTOS
  document.getElementById('btn-new-presupuesto').onclick = () => {
    document.getElementById('presupuesto-id').value = '';
    document.getElementById('form-presupuesto').reset();
    document.getElementById('modal-presupuesto-title').textContent = 'Nuevo Presupuesto';
    openModal('modal-presupuesto');
  };
  document.getElementById('form-presupuesto').onsubmit = (e) => {
    e.preventDefault();
    const id = document.getElementById('presupuesto-id').value;
    const obj = {
      id: id || uid(),
      cliente:       document.getElementById('presupuesto-cliente').value.trim(),
      descripcion:   document.getElementById('presupuesto-descripcion').value.trim(),
      material:      document.getElementById('presupuesto-material').value.trim(),
      tiempo:        document.getElementById('presupuesto-tiempo').value.trim(),
      costoMaterial: document.getElementById('presupuesto-costo-material').value,
      costoTrabajo:  document.getElementById('presupuesto-costo-trabajo').value,
      total:         document.getElementById('presupuesto-total').value,
      estado:        document.getElementById('presupuesto-estado').value,
      notas:         document.getElementById('presupuesto-notas').value.trim(),
      fecha:         new Date().toISOString().slice(0,10),
    };
    if (id) { const i = db.presupuestos.findIndex(x=>x.id===id); db.presupuestos[i]=obj; }
    else db.presupuestos.unshift(obj);
    saveData(); closeModal('modal-presupuesto'); renderPresupuestos();
    toast(id ? 'Presupuesto actualizado' : 'Presupuesto creado ✓', 'success');
  };
}

// ===== RENDER PEDIDOS =====
function renderPedidos() {
  const q = document.getElementById('search-pedidos').value.toLowerCase();
  const est = document.getElementById('filter-pedidos-estado').value;
  const list = db.pedidos.filter(p =>
    (!q || p.cliente.toLowerCase().includes(q) || p.producto.toLowerCase().includes(q)) &&
    (!est || p.estado === est)
  );
  const total = db.pedidos.reduce((s,p) => s+(parseFloat(p.precio)||0), 0);
  const c = {pendiente:0, en_proceso:0, listo:0, entregado:0};
  db.pedidos.forEach(p => { if(c[p.estado]!==undefined) c[p.estado]++; });
  document.getElementById('stats-pedidos').innerHTML = `
    <div class="stat-card"><div class="stat-label">Total pedidos</div><div class="stat-value purple">${db.pedidos.length}</div></div>
    <div class="stat-card"><div class="stat-label">Pendientes</div><div class="stat-value yellow">${c.pendiente}</div></div>
    <div class="stat-card"><div class="stat-label">En proceso</div><div class="stat-value blue">${c.en_proceso}</div></div>
    <div class="stat-card"><div class="stat-label">Listos</div><div class="stat-value green">${c.listo}</div></div>
    <div class="stat-card"><div class="stat-label">Facturado</div><div class="stat-value green">${fmt(total)}</div></div>`;
  const tbody = document.getElementById('tbody-pedidos');
  const empty = document.getElementById('empty-pedidos');
  if (!list.length) { tbody.innerHTML=''; empty.style.display='flex'; return; }
  empty.style.display='none';
  tbody.innerHTML = list.map((p,i) => `<tr>
    <td class="row-num">${i+1}</td>
    <td><strong>${p.cliente}</strong></td>
    <td>${p.producto}</td>
    <td>${p.material||'-'}</td>
    <td>${p.cantidad}</td>
    <td style="color:var(--success);font-weight:600">${fmt(p.precio)}</td>
    <td>${fmtDate(p.fecha)}</td>
    <td>${badgeHtml(p.estado)}</td>
    <td><div class="action-btns">
      <button class="btn-edit" title="Editar" onclick="editPedido('${p.id}')"><i class="fas fa-pen"></i></button>
      <button class="btn-delete" title="Eliminar" onclick="deletePedido('${p.id}')"><i class="fas fa-trash"></i></button>
    </div></td>
  </tr>`).join('');
}
window.editPedido = (id) => {
  const p = db.pedidos.find(x=>x.id===id); if(!p) return;
  ['cliente','producto','material','color','cantidad','precio','fecha','estado','notas'].forEach(f => {
    document.getElementById('pedido-'+f).value = p[f]||'';
  });
  document.getElementById('pedido-id').value = p.id;
  document.getElementById('modal-pedido-title').textContent = 'Editar Pedido';
  openModal('modal-pedido');
};
window.deletePedido = (id) => confirmDelete(() => {
  db.pedidos = db.pedidos.filter(x=>x.id!==id); saveData(); renderPedidos(); toast('Pedido eliminado','info');
});

// ===== RENDER INVENTARIO =====
function renderInventario() {
  const q = document.getElementById('search-inventario').value.toLowerCase();
  const cat = document.getElementById('filter-inventario-cat').value;
  const list = db.inventario.filter(x => (!q||x.nombre.toLowerCase().includes(q)) && (!cat||x.categoria===cat));
  const totalVal = db.inventario.reduce((s,x)=>s+(parseFloat(x.cantidad)||0)*(parseFloat(x.costo)||0),0);
  const bajos = db.inventario.filter(x=>(parseFloat(x.cantidad)||0)<=(parseFloat(x.stockMin)||0)&&(parseFloat(x.stockMin)||0)>0).length;
  document.getElementById('stats-inventario').innerHTML = `
    <div class="stat-card"><div class="stat-label">Total productos</div><div class="stat-value purple">${db.inventario.length}</div></div>
    <div class="stat-card"><div class="stat-label">Stock bajo/crítico</div><div class="stat-value yellow">${bajos}</div></div>
    <div class="stat-card"><div class="stat-label">Valor total stock</div><div class="stat-value green">${fmt(totalVal)}</div></div>`;
  const tbody = document.getElementById('tbody-inventario');
  const empty = document.getElementById('empty-inventario');
  if (!list.length) { tbody.innerHTML=''; empty.style.display='flex'; return; }
  empty.style.display='none';
  tbody.innerHTML = list.map((x,i) => {
    const s = stockStatus(x);
    return `<tr>
      <td class="row-num">${i+1}</td>
      <td><strong>${x.nombre}</strong></td>
      <td style="text-transform:capitalize">${x.categoria}</td>
      <td>${x.cantidad}</td>
      <td>${x.unidad || '-'}</td>
      <td>${x.stockMin||'-'}</td>
      <td style="color:var(--success);font-weight:600">${fmt(x.costo)}</td>
      <td><span class="badge ${s.cls}">${s.label}</span></td>
      <td><div class="action-btns">
        <button class="btn-edit" onclick="editInsumo('${x.id}')"><i class="fas fa-pen"></i></button>
        <button class="btn-delete" onclick="deleteInsumo('${x.id}')"><i class="fas fa-trash"></i></button>
      </div></td>
    </tr>`;
  }).join('');
}
window.editInsumo = (id) => {
  const x = db.inventario.find(i=>i.id===id); if(!x) return;
  document.getElementById('insumo-id').value=x.id;
  document.getElementById('insumo-nombre').value=x.nombre;
  document.getElementById('insumo-categoria').value=x.categoria;
  document.getElementById('insumo-cantidad').value=x.cantidad;
  document.getElementById('insumo-unidad').value=x.unidad;
  document.getElementById('insumo-stock-min').value=x.stockMin||'';
  document.getElementById('insumo-costo').value=x.costo||'';
  document.getElementById('insumo-proveedor').value=x.proveedor||'';
  document.getElementById('insumo-notas').value=x.notas||'';
  document.getElementById('modal-insumo-title').textContent='Editar Producto';
  openModal('modal-insumo');
};
window.deleteInsumo = (id) => confirmDelete(() => {
  db.inventario=db.inventario.filter(x=>x.id!==id); saveData(); renderInventario(); toast('Producto eliminado','info');
});

// ===== RENDER GASTOS =====
function renderGastos() {
  const q = document.getElementById('search-gastos').value.toLowerCase();
  const cat = document.getElementById('filter-gastos-cat').value;
  const mes = document.getElementById('filter-gastos-mes').value;
  const meses = [...new Set(db.gastos.map(g=>g.fecha?g.fecha.slice(0,7):'').filter(Boolean))].sort().reverse();
  const mesEl = document.getElementById('filter-gastos-mes');
  const curMes = mesEl.value;
  mesEl.innerHTML = '<option value="">Todos los meses</option>' + meses.map(m => {
    const [y,mo] = m.split('-');
    const label = new Date(y,mo-1).toLocaleDateString('es-AR',{month:'long',year:'numeric'});
    return `<option value="${m}"${m===curMes?' selected':''}>${label}</option>`;
  }).join('');
  const list = db.gastos.filter(g =>
    (!q||g.descripcion.toLowerCase().includes(q)) && (!cat||g.categoria===cat) && (!mes||(g.fecha&&g.fecha.startsWith(mes)))
  );
  const totalAcum = db.gastos.reduce((s,g)=>s+(parseFloat(g.monto)||0),0);
  const totalFilt = list.reduce((s,g)=>s+(parseFloat(g.monto)||0),0);
  document.getElementById('stats-gastos').innerHTML = `
    <div class="stat-card"><div class="stat-label">Total gastos</div><div class="stat-value purple">${db.gastos.length}</div></div>
    <div class="stat-card"><div class="stat-label">Total acumulado</div><div class="stat-value red">${fmt(totalAcum)}</div></div>
    <div class="stat-card"><div class="stat-label">Filtrado actual</div><div class="stat-value yellow">${fmt(totalFilt)}</div></div>`;
  const tbody = document.getElementById('tbody-gastos');
  const empty = document.getElementById('empty-gastos');
  if (!list.length) { tbody.innerHTML=''; empty.style.display='flex'; return; }
  empty.style.display='none';
  tbody.innerHTML = list.map((g,i) => `<tr>
    <td class="row-num">${i+1}</td>
    <td><strong>${g.descripcion}</strong></td>
    <td style="text-transform:capitalize">${g.categoria}</td>
    <td style="color:var(--danger);font-weight:600">${fmt(g.monto)}</td>
    <td>${fmtDate(g.fecha)}</td>
    <td style="color:var(--text-muted);font-size:12px">${g.nota||'-'}</td>
    <td><div class="action-btns">
      <button class="btn-edit" onclick="editGasto('${g.id}')"><i class="fas fa-pen"></i></button>
      <button class="btn-delete" onclick="deleteGasto('${g.id}')"><i class="fas fa-trash"></i></button>
    </div></td>
  </tr>`).join('');
}
window.editGasto = (id) => {
  const g = db.gastos.find(x=>x.id===id); if(!g) return;
  document.getElementById('gasto-id').value=g.id;
  document.getElementById('gasto-descripcion').value=g.descripcion;
  document.getElementById('gasto-categoria').value=g.categoria;
  document.getElementById('gasto-monto').value=g.monto;
  document.getElementById('gasto-fecha').value=g.fecha;
  document.getElementById('gasto-nota').value=g.nota||'';
  document.getElementById('modal-gasto-title').textContent='Editar Gasto';
  openModal('modal-gasto');
};
window.deleteGasto = (id) => confirmDelete(() => {
  db.gastos=db.gastos.filter(x=>x.id!==id); saveData(); renderGastos(); toast('Gasto eliminado','info');
});

// ===== RENDER PRESUPUESTOS =====
function renderPresupuestos() {
  const q = document.getElementById('search-presupuestos').value.toLowerCase();
  const est = document.getElementById('filter-presupuestos-estado').value;
  const list = db.presupuestos.filter(p =>
    (!q||p.cliente.toLowerCase().includes(q)||p.descripcion.toLowerCase().includes(q)) && (!est||p.estado===est)
  );
  const aprobadosVal = db.presupuestos.filter(p=>p.estado==='aprobado').reduce((s,p)=>s+(parseFloat(p.total)||0),0);
  document.getElementById('stats-presupuestos').innerHTML = `
    <div class="stat-card"><div class="stat-label">Total</div><div class="stat-value purple">${db.presupuestos.length}</div></div>
    <div class="stat-card"><div class="stat-label">Aprobados</div><div class="stat-value green">${db.presupuestos.filter(p=>p.estado==='aprobado').length}</div></div>
    <div class="stat-card"><div class="stat-label">Rechazados</div><div class="stat-value red">${db.presupuestos.filter(p=>p.estado==='rechazado').length}</div></div>
    <div class="stat-card"><div class="stat-label">Valor aprobado</div><div class="stat-value green">${fmt(aprobadosVal)}</div></div>`;
  const tbody = document.getElementById('tbody-presupuestos');
  const empty = document.getElementById('empty-presupuestos');
  if (!list.length) { tbody.innerHTML=''; empty.style.display='flex'; return; }
  empty.style.display='none';
  tbody.innerHTML = list.map((p,i) => `<tr>
    <td class="row-num">${i+1}</td>
    <td><strong>${p.cliente}</strong></td>
    <td>${p.descripcion}</td>
    <td>${p.material||'-'}</td>
    <td>${p.tiempo||'-'}</td>
    <td style="color:var(--success);font-weight:600">${fmt(p.total)}</td>
    <td>${fmtDate(p.fecha)}</td>
    <td>${badgeHtml(p.estado)}</td>
    <td><div class="action-btns">
      <button class="btn-edit" onclick="editPresupuesto('${p.id}')"><i class="fas fa-pen"></i></button>
      <button class="btn-convert" title="Convertir a pedido" onclick="convertirPedido('${p.id}')"><i class="fas fa-arrow-right"></i></button>
      <button class="btn-delete" onclick="deletePresupuesto('${p.id}')"><i class="fas fa-trash"></i></button>
    </div></td>
  </tr>`).join('');
}
window.editPresupuesto = (id) => {
  const p = db.presupuestos.find(x=>x.id===id); if(!p) return;
  document.getElementById('presupuesto-id').value=p.id;
  document.getElementById('presupuesto-cliente').value=p.cliente;
  document.getElementById('presupuesto-descripcion').value=p.descripcion;
  document.getElementById('presupuesto-material').value=p.material||'';
  document.getElementById('presupuesto-tiempo').value=p.tiempo||'';
  document.getElementById('presupuesto-costo-material').value=p.costoMaterial||'';
  document.getElementById('presupuesto-costo-trabajo').value=p.costoTrabajo||'';
  document.getElementById('presupuesto-total').value=p.total||'';
  document.getElementById('presupuesto-estado').value=p.estado;
  document.getElementById('presupuesto-notas').value=p.notas||'';
  document.getElementById('modal-presupuesto-title').textContent='Editar Presupuesto';
  openModal('modal-presupuesto');
};
window.deletePresupuesto = (id) => confirmDelete(() => {
  db.presupuestos=db.presupuestos.filter(x=>x.id!==id); saveData(); renderPresupuestos(); toast('Presupuesto eliminado','info');
});
window.convertirPedido = (id) => {
  const p = db.presupuestos.find(x=>x.id===id); if(!p) return;
  db.pedidos.unshift({ id:uid(), cliente:p.cliente, producto:p.descripcion, material:p.material||'', color:'', cantidad:1, precio:p.total||0, fecha:new Date().toISOString().slice(0,10), estado:'pendiente', notas:p.notas||'' });
  p.estado='aprobado';
  saveData(); renderPedidos(); renderPresupuestos();
  toast('Presupuesto convertido a pedido ✓','success');
};

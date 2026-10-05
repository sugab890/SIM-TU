/**
 * SIM-TU Main Application Controller (js/app.js)
 * Implements Routing, UI Interactions, Cashiering, Accounting & Print Generation
 */

// Terbilang Rupiah Helper (Indonesian number to words)
function terbilang(bilangan) {
  bilangan = Math.abs(Number(bilangan));
  const angka = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
  let hasil = "";

  if (bilangan < 12) {
    hasil = " " + angka[bilangan];
  } else if (bilangan < 20) {
    hasil = terbilang(bilangan - 10) + " Belas";
  } else if (bilangan < 100) {
    hasil = terbilang(Math.floor(bilangan / 10)) + " Puluh" + terbilang(bilangan % 10);
  } else if (bilangan < 200) {
    hasil = " Seratus" + terbilang(bilangan - 100);
  } else if (bilangan < 1000) {
    hasil = terbilang(Math.floor(bilangan / 100)) + " Ratus" + terbilang(bilangan % 100);
  } else if (bilangan < 2000) {
    hasil = " Seribu" + terbilang(bilangan - 1000);
  } else if (bilangan < 1000000) {
    hasil = terbilang(Math.floor(bilangan / 1000)) + " Ribu" + terbilang(bilangan % 1000);
  } else if (bilangan < 1000000000) {
    hasil = terbilang(Math.floor(bilangan / 1000000)) + " Juta" + terbilang(bilangan % 1000000);
  } else if (bilangan < 1000000000000) {
    hasil = terbilang(Math.floor(bilangan / 1000000000)) + " Milyar" + terbilang(bilangan % 1000000000);
  } else {
    hasil = "Angka terlalu besar";
  }
  return (hasil.trim() + " Rupiah").replace(/\s+/g, ' ');
}

function formatRupiah(number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(Number(number) || 0);
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const bgClass = type === 'success' ? 'bg-success text-white' : (type === 'danger' ? 'bg-danger text-white' : 'bg-warning text-dark');
  const icon = type === 'success' ? 'bi-check-circle-fill' : (type === 'danger' ? 'bi-exclamation-triangle-fill' : 'bi-info-circle-fill');

  const toastEl = document.createElement('div');
  toastEl.className = `toast align-items-center ${bgClass} border-0 shadow-lg show mb-2`;
  toastEl.setAttribute('role', 'alert');
  toastEl.innerHTML = `
    <div class="d-flex">
      <div class="toast-body d-flex align-items-center gap-2">
        <i class="bi ${icon}"></i>
        <span>${message}</span>
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>
  `;
  container.appendChild(toastEl);
  setTimeout(() => {
    toastEl.remove();
  }, 4000);
}

// Main App Object
const App = {
  currentPage: 'dashboard',
  cashierSelectedStudent: null,
  cashierSelectedBills: [],
  cashflowChart: null,

  init: function() {
    DB.init();

    // Check login
    if (!Auth.isLoggedIn()) {
      this.showLoginView();
      return;
    }

    this.showAppView();
    this.setupEventListeners();
    this.updateUserInterface();
    this.navigateTo('dashboard');
    this.initIdleTimerUI();
  },

  showLoginView: function() {
    document.getElementById('auth-view').classList.remove('d-none');
    document.getElementById('main-app-view').classList.add('d-none');
  },

  showAppView: function() {
    document.getElementById('auth-view').classList.add('d-none');
    document.getElementById('main-app-view').classList.remove('d-none');
    this.updateHeaderStatus();
  },

  updateHeaderStatus: function() {
    const config = DB.getConfig();
    const dot = document.getElementById('header-status-dot');
    const text = document.getElementById('header-status-text');
    if (config.mode === 'gas' && config.gasWebAppUrl) {
      if (dot) {
        dot.className = 'status-dot online';
      }
      if (text) text.textContent = 'GAS Online';
    } else {
      if (dot) {
        dot.className = 'status-dot demo';
      }
      if (text) text.textContent = 'Mode Lokal (Demo)';
    }
  },

  updateUserInterface: function() {
    const session = Auth.getSession();
    if (!session) return;

    document.getElementById('sidebar-user-name').textContent = session.nama_lengkap;
    const roleBadge = document.getElementById('sidebar-user-role');
    roleBadge.textContent = session.role;
    roleBadge.className = `user-role-badge ${session.role === 'Operator' ? 'role-operator' : 'role-manajemen'}`;

    // Role-based visibility
    const isOperator = session.role === 'Operator';
    const isManajemen = session.role === 'Manajemen';

    // Show/hide or disable specific action buttons based on PRD roles
    document.querySelectorAll('[data-role-required]').forEach(el => {
      const required = el.getAttribute('data-role-required');
      if (required === 'Operator' && !isOperator) {
        el.classList.add('d-none');
      } else if (required === 'Manajemen' && !isManajemen) {
        el.classList.add('d-none');
      } else {
        el.classList.remove('d-none');
      }
    });
  },

  initIdleTimerUI: function() {
    Auth.initIdleTracker(
      // On Warning (60s left)
      () => {
        showToast('Peringatan: Meja kasir akan otomatis logout dalam 60 detik karena tidak ada aktivitas.', 'warning');
      },
      // On Timeout
      () => {
        alert('Sesi kasir telah berakhir otomatis (15 menit idle) demi menjaga keamanan data keuangan.');
        App.showLoginView();
      },
      // On Tick
      (remainingSecs) => {
        const el = document.getElementById('idle-timer-display');
        if (el) {
          const mins = Math.floor(remainingSecs / 60);
          const secs = remainingSecs % 60;
          el.textContent = `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
        }
      }
    );
  },

  setupEventListeners: function() {
    // Navigation items
    document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = link.getAttribute('data-page');
        if (page) {
          this.navigateTo(page);
          // Auto close sidebar on mobile
          document.getElementById('app-sidebar').classList.remove('show');
          document.getElementById('sidebar-backdrop').classList.remove('show');
        }
      });
    });

    // Mobile sidebar toggle
    const toggleBtn = document.getElementById('btn-toggle-sidebar');
    const sidebar = document.getElementById('app-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('show');
        backdrop.classList.toggle('show');
      });
    }
    if (backdrop) {
      backdrop.addEventListener('click', () => {
        sidebar.classList.remove('show');
        backdrop.classList.remove('show');
      });
    }

    // Logout button
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        if (confirm('Apakah Anda yakin ingin logout dari SIM-TU?')) {
          Auth.clearSession('Logout User');
          this.showLoginView();
        }
      });
    }

    // Role switcher dropdown
    const btnSwitchRole = document.getElementById('btn-switch-role');
    if (btnSwitchRole) {
      btnSwitchRole.addEventListener('click', () => {
        const session = Auth.getSession();
        const target = session && session.role === 'Operator' ? 'Manajemen' : 'Operator';
        Auth.switchRole(target);
        this.updateUserInterface();
        this.renderCurrentPage();
        showToast(`Beralih peran menjadi: ${target}`, 'info');
      });
    }

    // Login Form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const u = document.getElementById('login-username').value.trim();
        const p = document.getElementById('login-password').value;
        const btn = loginForm.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Masuk...';

        const result = await Auth.login(u, p);
        btn.disabled = false;
        btn.innerHTML = 'Masuk ke Sistem';

        if (result.success) {
          App.showAppView();
          App.updateUserInterface();
          App.navigateTo('dashboard');
          showToast(`Selamat datang, ${result.session.nama_lengkap}!`, 'success');
        } else {
          document.getElementById('login-error-msg').textContent = result.message;
          document.getElementById('login-error-alert').classList.remove('d-none');
        }
      });
    }
  },

  navigateTo: function(page) {
    this.currentPage = page;

    // Update active nav link
    document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
      if (link.getAttribute('data-page') === page) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Show active page container
    document.querySelectorAll('.page-view').forEach(view => {
      view.classList.add('d-none');
    });

    const activeView = document.getElementById(`page-${page}`);
    if (activeView) {
      activeView.classList.remove('d-none');
    }

    this.renderCurrentPage();
  },

  renderCurrentPage: function() {
    switch (this.currentPage) {
      case 'dashboard':
        this.renderDashboard();
        break;
      case 'kesiswaan':
        this.renderKesiswaan();
        break;
      case 'tagihan':
        this.renderTagihan();
        break;
      case 'kasir':
        this.renderKasir();
        break;
      case 'kas_keluar':
        this.renderKasKeluar();
        break;
      case 'setoran':
        this.renderSetoran();
        break;
      case 'bku':
        this.renderBku();
        break;
      case 'laporan':
        this.renderLaporan();
        break;
      case 'pengaturan':
        this.renderPengaturan();
        break;
    }
  },

  // ============================================================================
  // DASHBOARD MODULE
  // ============================================================================
  renderDashboard: function() {
    const todaySummary = DB.getDailyCashSummary();
    const receivables = DB.getReceivablesReport();
    const students = DB.getStudents();
    const unsettled = DB.getUnsettledCashTransactions();

    // Stats
    document.getElementById('dash-cash-in').textContent = formatRupiah(todaySummary.cashIn);
    document.getElementById('dash-expense').textContent = formatRupiah(todaySummary.totalExpense);
    document.getElementById('dash-cash-drawer').textContent = formatRupiah(todaySummary.netCashDrawer);
    document.getElementById('dash-tunggakan').textContent = formatRupiah(receivables.totalTunggakan);
    document.getElementById('dash-students-count').textContent = students.filter(s => s.status === 'Aktif').length;
    document.getElementById('dash-unsettled-count').textContent = unsettled.length;

    // Recent Transactions
    const allIn = DB.getIncomeTransactions().slice(0, 5);
    const tbody = document.getElementById('dash-recent-trx-tbody');
    if (tbody) {
      tbody.innerHTML = allIn.map(t => {
        const isVoid = t.status_trx === 'DIBATALKAN';
        return `
          <tr>
            <td><span class="badge-code">${t.id_trx}</span></td>
            <td>${t.waktu.slice(0, 16)}</td>
            <td><span class="badge bg-light text-dark">${t.metode}</span></td>
            <td class="text-currency fw-bold text-success">${formatRupiah(t.nominal_bayar)}</td>
            <td>
              <span class="badge-status ${isVoid ? 'void' : 'success'}">${t.status_trx}</span>
            </td>
            <td>
              <button class="btn btn-sm btn-outline-secondary py-0 px-2" onclick="App.printSingleReceipt('${t.id_trx}')">
                <i class="bi bi-printer"></i>
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }

    // Chart.js initialization
    this.renderDashboardChart();
  },

  renderDashboardChart: function() {
    const ctx = document.getElementById('dashCashflowChart');
    if (!ctx) return;

    if (this.cashflowChart) {
      this.cashflowChart.destroy();
    }

    // Calculate last 7 days cash flow
    const dates = [];
    const inData = [];
    const outData = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = d.toISOString().slice(0, 10);
      dates.push(d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }));
      const s = DB.getDailyCashSummary(dStr);
      inData.push(s.totalIn);
      outData.push(s.totalExpense);
    }

    this.cashflowChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: dates,
        datasets: [
          {
            label: 'Penerimaan (Kas Masuk)',
            data: inData,
            backgroundColor: 'rgba(16, 185, 129, 0.75)',
            borderColor: '#10b981',
            borderRadius: 6,
            borderWidth: 1
          },
          {
            label: 'Pengeluaran (BKK)',
            data: outData,
            backgroundColor: 'rgba(239, 68, 68, 0.75)',
            borderColor: '#ef4444',
            borderRadius: 6,
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              label: (context) => `${context.dataset.label}: ${formatRupiah(context.raw)}`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (val) => 'Rp ' + (val / 1000).toLocaleString('id-ID') + 'k'
            }
          }
        }
      }
    });
  },

  // ============================================================================
  // KESISWAAN MODULE (Master Data, Bulk Import & Kenaikan Kelas Batch)
  // ============================================================================
  renderKesiswaan: function() {
    const students = DB.getStudents();
    const searchVal = (document.getElementById('filter-siswa-search')?.value || '').toLowerCase();
    const kelasVal = document.getElementById('filter-siswa-kelas')?.value || '';
    const statusVal = document.getElementById('filter-siswa-status')?.value || '';

    // Populate Kelas options
    const kelasOptions = [...new Set(students.map(s => s.kelas))].sort();
    const filterKelasEl = document.getElementById('filter-siswa-kelas');
    if (filterKelasEl && filterKelasEl.options.length <= 1) {
      kelasOptions.forEach(k => {
        filterKelasEl.innerHTML += `<option value="${k}">${k}</option>`;
      });
    }

    const filtered = students.filter(s => {
      const matchSearch = String(s.nis).toLowerCase().includes(searchVal) || s.nama.toLowerCase().includes(searchVal);
      const matchKelas = !kelasVal || s.kelas === kelasVal;
      const matchStatus = !statusVal || s.status === statusVal;
      return matchSearch && matchKelas && matchStatus;
    });

    const tbody = document.getElementById('siswa-table-tbody');
    if (tbody) {
      if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">Tidak ada data siswa ditemukan</td></tr>`;
      } else {
        tbody.innerHTML = filtered.map(s => `
          <tr>
            <td><span class="badge-code">${s.nis}</span></td>
            <td class="fw-bold">${s.nama}</td>
            <td><span class="badge bg-secondary">${s.kelas}</span></td>
            <td>${s.angkatan}</td>
            <td>
              <span class="badge-status ${s.status === 'Aktif' ? 'success' : 'secondary'}">${s.status}</span>
            </td>
            <td>
              <div class="btn-group btn-group-sm">
                <button class="btn btn-outline-primary" onclick="App.openStudentDetailModal('${s.nis}')" title="Lihat Kartu Piutang & Riwayat">
                  <i class="bi bi-person-lines-fill"></i> Detail
                </button>
                <button class="btn btn-outline-secondary" onclick="App.openEditStudentModal('${s.nis}')" title="Edit Biodata">
                  <i class="bi bi-pencil"></i>
                </button>
              </div>
            </td>
          </tr>
        `).join('');
      }
    }
  },

  openAddStudentModal: function() {
    document.getElementById('modal-student-title').textContent = 'Tambah Siswa Baru';
    document.getElementById('form-student-nis').value = '';
    document.getElementById('form-student-nis').disabled = false;
    document.getElementById('form-student-nama').value = '';
    document.getElementById('form-student-kelas').value = 'X-RPL-1';
    document.getElementById('form-student-angkatan').value = new Date().getFullYear();
    document.getElementById('form-student-status').value = 'Aktif';

    const modal = new bootstrap.Modal(document.getElementById('modalStudentForm'));
    modal.show();
  },

  openEditStudentModal: function(nis) {
    const student = DB.getStudentByNis(nis);
    if (!student) return;

    document.getElementById('modal-student-title').textContent = 'Edit Data Siswa';
    document.getElementById('form-student-nis').value = student.nis;
    document.getElementById('form-student-nis').disabled = true;
    document.getElementById('form-student-nama').value = student.nama;
    document.getElementById('form-student-kelas').value = student.kelas;
    document.getElementById('form-student-angkatan').value = student.angkatan;
    document.getElementById('form-student-status').value = student.status;

    const modal = new bootstrap.Modal(document.getElementById('modalStudentForm'));
    modal.show();
  },

  saveStudentForm: function() {
    const nis = document.getElementById('form-student-nis').value.trim();
    const nama = document.getElementById('form-student-nama').value.trim();
    const kelas = document.getElementById('form-student-kelas').value.trim();
    const angkatan = document.getElementById('form-student-angkatan').value.trim();
    const status = document.getElementById('form-student-status').value;

    if (!nis || !nama || !kelas) {
      alert('NIS, Nama, dan Kelas wajib diisi!');
      return;
    }

    const sess = Auth.getSession();
    DB.saveStudent({ nis, nama, kelas, angkatan, status }, sess?.username);
    bootstrap.Modal.getInstance(document.getElementById('modalStudentForm')).hide();
    this.renderKesiswaan();
    showToast('Data siswa berhasil disimpan!', 'success');
  },

  openBulkImportModal: function() {
    document.getElementById('bulk-import-csv-text').value = '';
    const modal = new bootstrap.Modal(document.getElementById('modalBulkImport'));
    modal.show();
  },

  executeBulkImport: function() {
    const rawText = document.getElementById('bulk-import-csv-text').value.trim();
    if (!rawText) {
      alert('Masukkan data CSV atau teks siswa!');
      return;
    }

    const lines = rawText.split('\n');
    const studentsToImport = [];

    lines.forEach(line => {
      const parts = line.split(/[,;\t]/).map(p => p.trim());
      if (parts.length >= 2) {
        // Skip header if present
        if (parts[0].toLowerCase() === 'nis') return;
        studentsToImport.push({
          nis: parts[0],
          nama: parts[1],
          kelas: parts[2] || 'X',
          angkatan: parts[3] || new Date().getFullYear().toString(),
          status: parts[4] || 'Aktif'
        });
      }
    });

    if (studentsToImport.length === 0) {
      alert('Format data tidak sesuai. Pastikan ada kolom NIS dan Nama.');
      return;
    }

    const sess = Auth.getSession();
    const res = DB.bulkImportStudents(studentsToImport, sess?.username);
    bootstrap.Modal.getInstance(document.getElementById('modalBulkImport')).hide();
    this.renderKesiswaan();
    showToast(`Bulk Import Berhasil: ${res.added} siswa baru ditambahkan, ${res.updated} diperbarui!`, 'success');
  },

  openKenaikanKelasModal: function() {
    const students = DB.getStudents().filter(s => s.status === 'Aktif');
    const kelasList = [...new Set(students.map(s => s.kelas))].sort();

    const selectAsal = document.getElementById('batch-kelas-asal');
    selectAsal.innerHTML = '<option value="">-- Pilih Kelas Saat Ini --</option>' + kelasList.map(k => `<option value="${k}">${k}</option>`).join('');

    this.renderBatchChecklist([]);
    const modal = new bootstrap.Modal(document.getElementById('modalKenaikanKelas'));
    modal.show();
  },

  onKelasAsalChange: function() {
    const kelas = document.getElementById('batch-kelas-asal').value;
    const students = DB.getStudents().filter(s => s.status === 'Aktif' && s.kelas === kelas);
    this.renderBatchChecklist(students);
  },

  renderBatchChecklist: function(students) {
    const tbody = document.getElementById('batch-siswa-checklist-tbody');
    if (!tbody) return;

    if (students.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center py-3 text-muted">Pilih kelas asal terlebih dahulu</td></tr>`;
      return;
    }

    tbody.innerHTML = students.map(s => `
      <tr>
        <td class="text-center">
          <input type="checkbox" class="form-check-input batch-student-cb" value="${s.nis}" checked>
        </td>
        <td><span class="badge-code">${s.nis}</span></td>
        <td class="fw-bold">${s.nama}</td>
        <td><span class="badge bg-secondary">${s.kelas}</span></td>
      </tr>
    `).join('');
  },

  toggleSelectAllBatch: function(masterCb) {
    document.querySelectorAll('.batch-student-cb').forEach(cb => {
      cb.checked = masterCb.checked;
    });
  },

  executeBatchPromotion: function() {
    const targetClass = document.getElementById('batch-kelas-tujuan').value.trim();
    if (!targetClass) {
      alert('Tentukan kelas tujuan mutasi / kenaikan!');
      return;
    }

    const selectedNis = [];
    document.querySelectorAll('.batch-student-cb:checked').forEach(cb => {
      selectedNis.push(cb.value);
    });

    if (selectedNis.length === 0) {
      alert('Pilih minimal satu siswa untuk dinaikkan kelasnya!');
      return;
    }

    if (!confirm(`Yakin memindahkan ${selectedNis.length} siswa ke kelas "${targetClass}"?`)) {
      return;
    }

    const sess = Auth.getSession();
    const count = DB.batchUpdateClass(selectedNis, targetClass, sess?.username);
    bootstrap.Modal.getInstance(document.getElementById('modalKenaikanKelas')).hide();
    this.renderKesiswaan();
    showToast(`Berhasil! ${count} siswa berhasil dipindahkan ke ${targetClass}.`, 'success');
  },

  openStudentDetailModal: function(nis) {
    const student = DB.getStudentByNis(nis);
    if (!student) return;

    document.getElementById('modal-detail-nis').textContent = student.nis;
    document.getElementById('modal-detail-nama').textContent = student.nama;
    document.getElementById('modal-detail-kelas').textContent = `${student.kelas} (Angkatan ${student.angkatan})`;

    const bills = DB.getBillsForStudent(nis);
    let totalBeban = 0;
    let totalBayar = 0;

    const tbodyBills = document.getElementById('modal-detail-bills-tbody');
    tbodyBills.innerHTML = bills.map(b => {
      totalBeban += Number(b.nominal_dibebankan);
      totalBayar += Number(b.terbayar);
      const isLunas = b.status_lunas === 'LUNAS';
      return `
        <tr>
          <td class="fw-bold">${b.nama_tagihan} <span class="text-muted small">(${b.bulan_tahun})</span></td>
          <td class="text-currency">${formatRupiah(b.nominal_dibebankan)}</td>
          <td class="text-currency text-success">${formatRupiah(b.terbayar)}</td>
          <td class="text-currency text-danger fw-bold">${formatRupiah(b.sisa_tagihan)}</td>
          <td>
            <span class="badge-status ${isLunas ? 'success' : (b.terbayar > 0 ? 'warning' : 'danger')}">
              ${b.status_lunas}
            </span>
          </td>
          <td>
            <button class="btn btn-sm btn-outline-secondary py-0" onclick="App.openAdjustBillModal('${b.id_tagihan}', ${b.nominal_dibebankan})" title="Penyesuaian Beasiswa/PIP">
              <i class="bi bi-sliders"></i> Ubah
            </button>
          </td>
        </tr>
      `;
    }).join('');

    const sisaTunggakan = Math.max(0, totalBeban - totalBayar);
    document.getElementById('modal-detail-total-beban').textContent = formatRupiah(totalBeban);
    document.getElementById('modal-detail-total-bayar').textContent = formatRupiah(totalBayar);
    document.getElementById('modal-detail-sisa').textContent = formatRupiah(sisaTunggakan);

    const modal = new bootstrap.Modal(document.getElementById('modalStudentDetail'));
    modal.show();
  },

  // ============================================================================
  // TAGIHAN & PIUTANG MODULE (Bulk Bill Generator & Beasiswa Adjustment)
  // ============================================================================
  renderTagihan: function() {
    const masterBills = DB.getMasterBills();
    const students = DB.getStudents();
    const allStudentBills = DB.getStudentBills();

    // Populate Generator dropdowns
    const genAngkatan = document.getElementById('gen-tagihan-angkatan');
    if (genAngkatan && genAngkatan.options.length <= 1) {
      const angkatans = [...new Set(students.map(s => s.angkatan))].sort();
      angkatans.forEach(a => genAngkatan.innerHTML += `<option value="${a}">Angkatan ${a}</option>`);
    }

    const genKelas = document.getElementById('gen-tagihan-kelas');
    if (genKelas && genKelas.options.length <= 1) {
      const kelases = [...new Set(students.map(s => s.kelas))].sort();
      kelases.forEach(k => genKelas.innerHTML += `<option value="${k}">Kelas ${k}</option>`);
    }

    const genJenis = document.getElementById('gen-tagihan-jenis');
    if (genJenis && genJenis.options.length <= 1) {
      masterBills.forEach(m => genJenis.innerHTML += `<option value="${m.id_jenis}">${m.nama_tagihan} (${formatRupiah(m.nominal_default)})</option>`);
    }

    // Set default month to current YYYY-MM
    const currentYm = new Date().toISOString().slice(0, 7);
    const monthEl = document.getElementById('gen-tagihan-bulan');
    if (monthEl && !monthEl.value) monthEl.value = currentYm;

    // Render Master Tagihan List
    const tbodyMaster = document.getElementById('master-tagihan-tbody');
    if (tbodyMaster) {
      tbodyMaster.innerHTML = masterBills.map(m => `
        <tr>
          <td><span class="badge-code">${m.id_jenis}</span></td>
          <td class="fw-bold">${m.nama_tagihan}</td>
          <td><span class="badge bg-light text-dark">${m.kategori}</span></td>
          <td class="text-currency">${formatRupiah(m.nominal_default)}</td>
        </tr>
      `).join('');
    }

    // Render Tagihan Siswa Table
    this.renderStudentBillsTable();
  },

  onGenJenisChange: function() {
    const jenisId = document.getElementById('gen-tagihan-jenis').value;
    const master = DB.getMasterBills().find(m => m.id_jenis === jenisId);
    if (master) {
      document.getElementById('gen-tagihan-nominal').value = master.nominal_default;
    }
  },

  executeGenerateBills: function() {
    const angkatan = document.getElementById('gen-tagihan-angkatan').value;
    const kelas = document.getElementById('gen-tagihan-kelas').value;
    const id_jenis = document.getElementById('gen-tagihan-jenis').value;
    const bulan_tahun = document.getElementById('gen-tagihan-bulan').value;
    const nominal = document.getElementById('gen-tagihan-nominal').value;

    if (!id_jenis || !bulan_tahun || !nominal) {
      alert('Pilih Jenis Tagihan, Bulan/Tahun, dan tentukan Nominal!');
      return;
    }

    const sess = Auth.getSession();
    const count = DB.generateBills({ angkatan, kelas, id_jenis, bulan_tahun, nominal }, sess?.username);
    this.renderTagihan();
    showToast(`Berhasil men-generate ${count} tagihan siswa baru!`, 'success');
  },

  renderStudentBillsTable: function() {
    const allBills = DB.getStudentBills();
    const students = DB.getStudents();
    const masterBills = DB.getMasterBills();
    const allTrx = DB.getIncomeTransactions().filter(t => t.status_trx === 'VALID');

    const filterKelas = document.getElementById('filter-tagihan-kelas')?.value || '';
    const filterStatus = document.getElementById('filter-tagihan-status')?.value || '';

    const rows = allBills.map(b => {
      const student = students.find(s => String(s.nis) === String(b.nis)) || { nama: 'Siswa', kelas: '-' };
      const master = masterBills.find(m => m.id_jenis === b.id_jenis) || { nama_tagihan: b.id_jenis };
      const paid = allTrx.filter(t => t.id_tagihan === b.id_tagihan).reduce((sum, t) => sum + Number(t.nominal_bayar || 0), 0);
      const sisa = Math.max(0, Number(b.nominal_dibebankan) - paid);
      const statusLunas = sisa === 0 ? 'LUNAS' : (paid > 0 ? 'SEBAGIAN' : 'BELUM BAYAR');

      return {
        ...b,
        nama: student.nama,
        kelas: student.kelas,
        nama_tagihan: master.nama_tagihan,
        terbayar: paid,
        sisa,
        statusLunas
      };
    }).filter(item => {
      if (filterKelas && item.kelas !== filterKelas) return false;
      if (filterStatus && item.statusLunas !== filterStatus) return false;
      return true;
    });

    const tbody = document.getElementById('tagihan-siswa-tbody');
    if (tbody) {
      if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">Belum ada tagihan terdaftar</td></tr>`;
      } else {
        tbody.innerHTML = rows.map(r => `
          <tr>
            <td><span class="badge-code">${r.nis}</span></td>
            <td class="fw-bold">${r.nama} <span class="badge bg-light text-dark small">${r.kelas}</span></td>
            <td>${r.nama_tagihan} <span class="text-muted small">(${r.bulan_tahun})</span></td>
            <td class="text-currency">${formatRupiah(r.nominal_dibebankan)}</td>
            <td class="text-currency text-success">${formatRupiah(r.terbayar)}</td>
            <td class="text-currency text-danger fw-bold">${formatRupiah(r.sisa)}</td>
            <td>
              <span class="badge-status ${r.statusLunas === 'LUNAS' ? 'success' : (r.terbayar > 0 ? 'warning' : 'danger')}">
                ${r.statusLunas}
              </span>
            </td>
          </tr>
        `).join('');
      }
    }
  },

  openAdjustBillModal: function(id_tagihan, currentNominal) {
    document.getElementById('adjust-bill-id').value = id_tagihan;
    document.getElementById('adjust-bill-nominal').value = currentNominal;
    document.getElementById('adjust-bill-reason').value = '';

    const modal = new bootstrap.Modal(document.getElementById('modalAdjustBill'));
    modal.show();
  },

  executeAdjustBill: function() {
    const id = document.getElementById('adjust-bill-id').value;
    const nominal = document.getElementById('adjust-bill-nominal').value;
    const reason = document.getElementById('adjust-bill-reason').value.trim();

    if (!nominal || !reason) {
      alert('Nominal baru dan alasan penyesuaian (misal: Diskon Beasiswa / Dana PIP) wajib diisi!');
      return;
    }

    const sess = Auth.getSession();
    DB.updateBillNominal(id, nominal, sess?.username, reason);
    bootstrap.Modal.getInstance(document.getElementById('modalAdjustBill')).hide();
    
    // Refresh student detail if open
    const currentNis = document.getElementById('modal-detail-nis')?.textContent;
    if (currentNis) {
      this.openStudentDetailModal(currentNis);
    }
    this.renderTagihan();
    showToast('Beban tagihan berhasil disesuaikan permanen!', 'success');
  },

  // ============================================================================
  // KASIR / TRANSAKSI MASUK MODULE (Flexible Partial Payment & Multi-Item)
  // ============================================================================
  renderKasir: function() {
    // Populate student select
    const students = DB.getStudents().filter(s => s.status === 'Aktif');
    const select = document.getElementById('kasir-student-select');
    if (select) {
      select.innerHTML = '<option value="">-- Ketik NIS atau Pilih Siswa --</option>' + students.map(s => `
        <option value="${s.nis}">${s.nis} - ${s.nama} (${s.kelas})</option>
      `).join('');
    }

    this.renderKasirTodayTransactions();
  },

  onKasirStudentSelect: function() {
    const nis = document.getElementById('kasir-student-select').value;
    if (!nis) {
      this.cashierSelectedStudent = null;
      document.getElementById('kasir-bills-container').innerHTML = '<div class="text-center py-4 text-muted">Pilih siswa di atas untuk memuat tagihan</div>';
      document.getElementById('kasir-checkout-card').classList.add('d-none');
      return;
    }

    const student = DB.getStudentByNis(nis);
    this.cashierSelectedStudent = student;
    const bills = DB.getBillsForStudent(nis).filter(b => b.sisa_tagihan > 0);

    const container = document.getElementById('kasir-bills-container');
    if (bills.length === 0) {
      container.innerHTML = `
        <div class="alert alert-success d-flex align-items-center gap-2">
          <i class="bi bi-check-circle-fill fs-5"></i>
          <div><strong>Hebat!</strong> Siswa ${student.nama} (${student.nis}) tidak memiliki tunggakan tagihan saat ini.</div>
        </div>
      `;
      document.getElementById('kasir-checkout-card').classList.add('d-none');
      return;
    }

    container.innerHTML = bills.map(b => `
      <div class="bill-select-item" id="bill-card-${b.id_tagihan}">
        <div class="d-flex align-items-center gap-3">
          <input type="checkbox" class="form-check-input bill-pay-cb" value="${b.id_tagihan}" data-sisa="${b.sisa_tagihan}" onchange="App.onBillCheckboxToggle(this, '${b.id_tagihan}', ${b.sisa_tagihan})">
          <div class="bill-info">
            <div class="bill-name">${b.nama_tagihan} <span class="badge bg-light text-dark ms-1">${b.bulan_tahun}</span></div>
            <div class="bill-meta">
              Beban: ${formatRupiah(b.nominal_dibebankan)} | Terbayar: ${formatRupiah(b.terbayar)} | 
              <strong class="text-danger">Sisa: ${formatRupiah(b.sisa_tagihan)}</strong>
            </div>
          </div>
        </div>
        <div class="d-flex align-items-center gap-2">
          <span class="small text-muted d-none d-md-inline">Nominal Bayar:</span>
          <div class="input-group input-group-sm bill-amount-input">
            <span class="input-group-text">Rp</span>
            <input type="number" class="form-control text-end bill-amount-field" id="pay-amount-${b.id_tagihan}" value="${b.sisa_tagihan}" max="${b.sisa_tagihan}" min="1000" step="5000" disabled oninput="App.calculateCashierTotal()">
          </div>
        </div>
      </div>
    `).join('');

    document.getElementById('kasir-checkout-card').classList.remove('d-none');
    this.calculateCashierTotal();
  },

  onBillCheckboxToggle: function(cb, id_tagihan, sisa) {
    const input = document.getElementById(`pay-amount-${id_tagihan}`);
    const card = document.getElementById(`bill-card-${id_tagihan}`);

    if (cb.checked) {
      input.disabled = false;
      card.classList.add('selected');
    } else {
      input.disabled = true;
      card.classList.remove('selected');
    }
    this.calculateCashierTotal();
  },

  calculateCashierTotal: function() {
    let total = 0;
    const selected = [];

    document.querySelectorAll('.bill-pay-cb:checked').forEach(cb => {
      const id = cb.value;
      const amountInput = document.getElementById(`pay-amount-${id}`);
      const amount = Number(amountInput.value) || 0;
      total += amount;
      selected.push({ id_tagihan: id, nominal_bayar: amount });
    });

    this.cashierSelectedBills = selected;
    document.getElementById('kasir-total-checkout').textContent = formatRupiah(total);
    const btnPay = document.getElementById('btn-process-payment');
    if (btnPay) {
      btnPay.disabled = selected.length === 0 || total <= 0;
    }
  },

  processCashierPayment: function() {
    if (this.cashierSelectedBills.length === 0) {
      alert('Pilih minimal satu tagihan untuk dibayar!');
      return;
    }

    const metode = document.getElementById('kasir-metode-bayar').value;
    const sess = Auth.getSession();

    const res = DB.addPaymentTransaction({
      payments: this.cashierSelectedBills,
      metode: metode,
      userInput: sess?.username || 'operator'
    });

    // Reset cashier state
    this.cashierSelectedBills = [];
    this.onKasirStudentSelect();
    this.renderKasirTodayTransactions();
    this.renderDashboard();

    showToast('Pembayaran berhasil dicatat!', 'success');

    // Trigger Print Receipt Modal or Direct Print
    if (confirm('Transaksi tersimpan! Apakah Anda ingin mencetak kwitansi pembayaran sekarang?')) {
      this.printBatchReceipt(res.batchReceiptId);
    }
  },

  renderKasirTodayTransactions: function() {
    const today = new Date().toISOString().slice(0, 10);
    const allIn = DB.getIncomeTransactions();
    const students = DB.getStudents();
    const studentBills = DB.getStudentBills();
    const masterBills = DB.getMasterBills();

    const todayTrx = allIn.filter(t => t.waktu.startsWith(today));
    const tbody = document.getElementById('kasir-today-trx-tbody');
    if (!tbody) return;

    if (todayTrx.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">Belum ada transaksi pembayaran hari ini</td></tr>`;
      return;
    }

    tbody.innerHTML = todayTrx.map(t => {
      const bill = studentBills.find(b => b.id_tagihan === t.id_tagihan) || {};
      const student = students.find(s => String(s.nis) === String(bill.nis)) || { nama: 'Siswa', nis: '-' };
      const master = masterBills.find(m => m.id_jenis === bill.id_jenis) || { nama_tagihan: '-' };
      const isVoid = t.status_trx === 'DIBATALKAN';

      return `
        <tr>
          <td><span class="badge-code">${t.id_trx}</span></td>
          <td class="fw-bold">${student.nama} <span class="badge bg-light text-dark small">${student.nis}</span></td>
          <td>${master.nama_tagihan} <span class="text-muted small">(${bill.bulan_tahun || '-'})</span></td>
          <td><span class="badge bg-light text-dark">${t.metode}</span></td>
          <td class="text-currency text-success fw-bold">${formatRupiah(t.nominal_bayar)}</td>
          <td>
            <span class="badge-status ${isVoid ? 'void' : 'success'}">${t.status_trx}</span>
            ${t.reprint_count > 0 ? `<span class="badge bg-warning text-dark small ms-1">Reprint x${t.reprint_count}</span>` : ''}
          </td>
          <td>
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-secondary" onclick="App.printSingleReceipt('${t.id_trx}')" title="Cetak Ulang Kwitansi">
                <i class="bi bi-printer"></i> Cetak
              </button>
              ${!isVoid && !t.kode_setoran ? `
                <button class="btn btn-outline-danger" onclick="App.openVoidIncomeModal('${t.id_trx}')" title="Batalkan Transaksi (Audit Trail)">
                  <i class="bi bi-x-circle"></i> Void
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  openVoidIncomeModal: function(id_trx) {
    document.getElementById('void-trx-id').value = id_trx;
    document.getElementById('void-trx-reason').value = '';

    const modal = new bootstrap.Modal(document.getElementById('modalVoidTransaction'));
    modal.show();
  },

  executeVoidIncome: function() {
    const id = document.getElementById('void-trx-id').value;
    const reason = document.getElementById('void-trx-reason').value.trim();

    if (!reason) {
      alert('Alasan pembatalan wajib diisi untuk rekam jejak audit (Audit Trail)!');
      return;
    }

    const sess = Auth.getSession();
    const res = DB.voidIncomeTransaction(id, sess?.username, reason);

    if (res.success) {
      bootstrap.Modal.getInstance(document.getElementById('modalVoidTransaction')).hide();
      this.renderKasirTodayTransactions();
      this.renderDashboard();
      showToast(`Transaksi ${id} telah dibatalkan dengan status DIBATALKAN.`, 'warning');
    } else {
      alert(res.message);
    }
  },

  // ============================================================================
  // KAS KELUAR (BKK - BUKTI KAS KELUAR) MODULE
  // ============================================================================
  renderKasKeluar: function() {
    const expenses = DB.getExpenseTransactions();
    const masterExp = DB.getMasterExpenses();

    // Populate category dropdown
    const selectCat = document.getElementById('form-bkk-kategori');
    if (selectCat && selectCat.options.length <= 1) {
      selectCat.innerHTML = '<option value="">-- Pilih Kategori Kas Keluar --</option>' + masterExp.map(m => `
        <option value="${m.kategori}">${m.kategori}</option>
      `).join('');
    }

    const tbody = document.getElementById('kas-keluar-tbody');
    if (!tbody) return;

    if (expenses.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">Belum ada pencatatan kas keluar</td></tr>`;
      return;
    }

    tbody.innerHTML = expenses.map(e => {
      const isVoid = e.status_trx === 'DIBATALKAN';
      return `
        <tr>
          <td><span class="badge-code">${e.id_out}</span></td>
          <td>${e.waktu.slice(0, 16)}</td>
          <td><span class="badge bg-light text-dark">${e.kategori}</span></td>
          <td class="text-currency text-danger fw-bold">${formatRupiah(e.nominal)}</td>
          <td class="fw-bold">${e.penerima}</td>
          <td><span class="small text-muted">${e.keterangan}</span></td>
          <td>
            <span class="badge-status ${isVoid ? 'void' : 'success'}">${e.status_trx}</span>
            ${e.reprint_count > 0 ? `<span class="badge bg-warning text-dark small ms-1">Reprint x${e.reprint_count}</span>` : ''}
          </td>
          <td>
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-secondary" onclick="App.printBkk('${e.id_out}')" title="Cetak Bukti Kas Keluar A5">
                <i class="bi bi-printer"></i> BKK A5
              </button>
              ${!isVoid ? `
                <button class="btn btn-outline-danger" onclick="App.voidBkk('${e.id_out}')" title="Batalkan Kas Keluar">
                  <i class="bi bi-x-circle"></i> Void
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  openAddBkkModal: function() {
    document.getElementById('form-bkk-kategori').value = '';
    document.getElementById('form-bkk-nominal').value = '';
    document.getElementById('form-bkk-penerima').value = '';
    document.getElementById('form-bkk-keterangan').value = '';

    const modal = new bootstrap.Modal(document.getElementById('modalAddBkk'));
    modal.show();
  },

  executeAddBkk: function() {
    const kategori = document.getElementById('form-bkk-kategori').value;
    const nominal = document.getElementById('form-bkk-nominal').value;
    const penerima = document.getElementById('form-bkk-penerima').value.trim();
    const keterangan = document.getElementById('form-bkk-keterangan').value.trim();

    if (!kategori || !nominal || !penerima || !keterangan) {
      alert('Semua kolom wajib diisi lengkap!');
      return;
    }

    const sess = Auth.getSession();
    const record = DB.addExpenseTransaction({
      kategori,
      nominal,
      penerima,
      keterangan,
      userInput: sess?.username || 'operator'
    });

    bootstrap.Modal.getInstance(document.getElementById('modalAddBkk')).hide();
    this.renderKasKeluar();
    this.renderDashboard();
    showToast(`Bukti Kas Keluar ${record.id_out} berhasil disimpan!`, 'success');

    if (confirm('Kas keluar tersimpan! Apakah ingin mencetak dokumen BKK A5 sekarang?')) {
      this.printBkk(record.id_out);
    }
  },

  voidBkk: function(id_out) {
    const reason = prompt(`Masukkan alasan pembatalan BKK ${id_out} untuk rekam jejak audit:`);
    if (!reason) return;

    const sess = Auth.getSession();
    const res = DB.voidExpenseTransaction(id_out, sess?.username, reason);
    if (res.success) {
      this.renderKasKeluar();
      this.renderDashboard();
      showToast(`BKK ${id_out} berhasil dibatalkan.`, 'warning');
    } else {
      alert(res.message);
    }
  },

  // ============================================================================
  // SETORAN KE PIMPINAN MODULE
  // ============================================================================
  renderSetoran: function() {
    const unsettled = DB.getUnsettledCashTransactions();
    const setoranList = DB.getSetoranList();
    const config = DB.getConfig();

    const totalUnsettled = unsettled.reduce((s, t) => s + Number(t.nominal_bayar), 0);
    document.getElementById('setoran-unsettled-total').textContent = formatRupiah(totalUnsettled);
    document.getElementById('setoran-unsettled-count').textContent = unsettled.length;

    // Render Unsettled Transactions Table
    const tbodyUnsettled = document.getElementById('setoran-unsettled-tbody');
    if (tbodyUnsettled) {
      if (unsettled.length === 0) {
        tbodyUnsettled.innerHTML = `<tr><td colspan="5" class="text-center py-3 text-muted">Semua penerimaan kas tunai telah disetorkan</td></tr>`;
      } else {
        tbodyUnsettled.innerHTML = unsettled.map(t => `
          <tr>
            <td class="text-center">
              <input type="checkbox" class="form-check-input setoran-item-cb" value="${t.id_trx}" checked onchange="App.calculateSetoranDraft()">
            </td>
            <td><span class="badge-code">${t.id_trx}</span></td>
            <td>${t.waktu.slice(0, 16)}</td>
            <td class="text-currency text-success fw-bold">${formatRupiah(t.nominal_bayar)}</td>
            <td>${t.user_input}</td>
          </tr>
        `).join('');
      }
    }

    // Set default penerima to Kepala Sekolah
    const inputPenerima = document.getElementById('setoran-penerima-input');
    if (inputPenerima && !inputPenerima.value) {
      inputPenerima.value = config.kepalaSekolah;
    }

    this.calculateSetoranDraft();

    // Render Setoran History
    const tbodyHistory = document.getElementById('setoran-history-tbody');
    if (tbodyHistory) {
      if (setoranList.length === 0) {
        tbodyHistory.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">Belum ada riwayat setoran kas ke pimpinan</td></tr>`;
      } else {
        tbodyHistory.innerHTML = setoranList.map(s => `
          <tr>
            <td><span class="badge-code">${s.kode_setoran}</span></td>
            <td>${s.waktu.slice(0, 16)}</td>
            <td class="text-currency fw-bold text-success">${formatRupiah(s.total_nominal)}</td>
            <td><span class="badge bg-secondary">${s.jumlah_trx} Transaksi</span></td>
            <td>${s.petugas}</td>
            <td class="fw-bold">${s.penerima}</td>
            <td>
              <button class="btn btn-sm btn-outline-primary" onclick="App.printTandaTerimaSetoran('${s.kode_setoran}')">
                <i class="bi bi-printer"></i> Berita Acara
              </button>
            </td>
          </tr>
        `).join('');
      }
    }
  },

  toggleSelectAllSetoran: function(masterCb) {
    document.querySelectorAll('.setoran-item-cb').forEach(cb => cb.checked = masterCb.checked);
    this.calculateSetoranDraft();
  },

  calculateSetoranDraft: function() {
    const unsettled = DB.getUnsettledCashTransactions();
    let total = 0;
    let count = 0;

    document.querySelectorAll('.setoran-item-cb:checked').forEach(cb => {
      const trx = unsettled.find(t => t.id_trx === cb.value);
      if (trx) {
        total += Number(trx.nominal_bayar);
        count++;
      }
    });

    const totalEl = document.getElementById('setoran-draft-total');
    if (totalEl) totalEl.textContent = formatRupiah(total);

    const btnExec = document.getElementById('btn-execute-setoran');
    if (btnExec) btnExec.disabled = count === 0;
  },

  executeCreateSetoran: function() {
    const selectedIds = [];
    document.querySelectorAll('.setoran-item-cb:checked').forEach(cb => selectedIds.push(cb.value));

    if (selectedIds.length === 0) {
      alert('Pilih transaksi yang akan disetorkan!');
      return;
    }

    const sess = Auth.getSession();
    const penerima = document.getElementById('setoran-penerima-input').value.trim();
    const keterangan = document.getElementById('setoran-keterangan-input').value.trim();

    if (!penerima) {
      alert('Tentukan nama pimpinan / penerima setoran!');
      return;
    }

    const res = DB.createSetoran({
      trxIds: selectedIds,
      petugas: sess?.nama_lengkap || 'Staf TU',
      penerima: penerima,
      keterangan: keterangan || 'Setoran penerimaan kas tunai ke pimpinan'
    });

    this.renderSetoran();
    this.renderDashboard();
    showToast(`Setoran ${res.kode_setoran} berhasil diproses!`, 'success');

    if (confirm('Setoran berhasil dibuat! Apakah ingin mencetak Tanda Terima & Berita Acara Setoran sekarang?')) {
      this.printTandaTerimaSetoran(res.kode_setoran);
    }
  },

  // ============================================================================
  // BUKU KAS UMUM (BKU LEDGER) MODULE
  // ============================================================================
  renderBku: function() {
    const startDate = document.getElementById('bku-start-date')?.value || '';
    const endDate = document.getElementById('bku-end-date')?.value || '';

    const ledger = DB.getBkuLedger(startDate, endDate);

    let totalDebit = 0;
    let totalKredit = 0;

    const tbody = document.getElementById('bku-ledger-tbody');
    if (!tbody) return;

    if (ledger.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">Belum ada pergerakan kas pada periode ini</td></tr>`;
    } else {
      tbody.innerHTML = ledger.map(item => {
        totalDebit += item.debit;
        totalKredit += item.kredit;
        return `
          <tr>
            <td>${item.waktu.slice(0, 16)}</td>
            <td><span class="badge-code">${item.bukti}</span></td>
            <td>${item.uraian}</td>
            <td class="text-currency text-success text-end">${item.debit > 0 ? formatRupiah(item.debit) : '-'}</td>
            <td class="text-currency text-danger text-end">${item.kredit > 0 ? formatRupiah(item.kredit) : '-'}</td>
            <td class="text-currency fw-bold text-end">${formatRupiah(item.saldo)}</td>
          </tr>
        `;
      }).join('');
    }

    document.getElementById('bku-total-debit').textContent = formatRupiah(totalDebit);
    document.getElementById('bku-total-kredit').textContent = formatRupiah(totalKredit);
    document.getElementById('bku-final-balance').textContent = formatRupiah(totalDebit - totalKredit);
  },

  exportBkuCsv: function() {
    const ledger = DB.getBkuLedger();
    let csv = 'Tanggal,No_Bukti,Uraian,Debit_Masuk,Kredit_Keluar,Saldo_Berjalan\n';
    ledger.forEach(i => {
      csv += `"${i.waktu}","${i.bukti}","${i.uraian.replace(/"/g, '""')}",${i.debit},${i.kredit},${i.saldo}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `BKU_SIM_TU_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
  },

  // ============================================================================
  // LAPORAN & DASHBOARDS MODULE (Tutup Shift, Rekap Tunggakan, Riwayat Siswa)
  // ============================================================================
  renderLaporan: function() {
    this.renderLaporanTutupShift();
    this.renderLaporanTunggakan();
  },

  renderLaporanTutupShift: function() {
    const dateInput = document.getElementById('shift-date-picker');
    const targetDate = dateInput?.value || new Date().toISOString().slice(0, 10);
    if (dateInput && !dateInput.value) dateInput.value = targetDate;

    const summary = DB.getDailyCashSummary(targetDate);

    document.getElementById('shift-kas-masuk-tunai').textContent = formatRupiah(summary.cashIn);
    document.getElementById('shift-kas-masuk-transfer').textContent = formatRupiah(summary.transferIn);
    document.getElementById('shift-kas-masuk-pip').textContent = formatRupiah(summary.pipIn);
    document.getElementById('shift-total-masuk').textContent = formatRupiah(summary.totalIn);
    document.getElementById('shift-total-keluar').textContent = formatRupiah(summary.totalExpense);
    document.getElementById('shift-saldo-laci').textContent = formatRupiah(summary.netCashDrawer);
  },

  renderLaporanTunggakan: function() {
    const data = DB.getReceivablesReport();
    const students = DB.getStudents();

    // Populate filter dropdown
    const filterKelas = document.getElementById('report-tunggakan-kelas');
    if (filterKelas && filterKelas.options.length <= 1) {
      const kelases = [...new Set(students.map(s => s.kelas))].sort();
      kelases.forEach(k => filterKelas.innerHTML += `<option value="${k}">${k}</option>`);
    }

    const selectedKelas = filterKelas?.value || '';
    const filtered = data.students.filter(s => !selectedKelas || s.kelas === selectedKelas);

    const totalBeban = filtered.reduce((s, i) => s + i.total_beban, 0);
    const totalBayar = filtered.reduce((s, i) => s + i.total_bayar, 0);
    const totalTunggakan = filtered.reduce((s, i) => s + i.tunggakan, 0);

    document.getElementById('report-total-beban').textContent = formatRupiah(totalBeban);
    document.getElementById('report-total-bayar').textContent = formatRupiah(totalBayar);
    document.getElementById('report-total-tunggakan').textContent = formatRupiah(totalTunggakan);

    const tbody = document.getElementById('report-tunggakan-tbody');
    if (tbody) {
      tbody.innerHTML = filtered.map(s => `
        <tr>
          <td><span class="badge-code">${s.nis}</span></td>
          <td class="fw-bold">${s.nama}</td>
          <td><span class="badge bg-secondary">${s.kelas}</span></td>
          <td class="text-currency text-end">${formatRupiah(s.total_beban)}</td>
          <td class="text-currency text-success text-end">${formatRupiah(s.total_bayar)}</td>
          <td class="text-currency text-danger fw-bold text-end">${formatRupiah(s.tunggakan)}</td>
          <td class="text-center">
            <span class="badge-status ${s.status_keuangan === 'LUNAS' ? 'success' : (s.status_keuangan === 'SEBAGIAN' ? 'warning' : 'danger')}">
              ${s.status_keuangan}
            </span>
          </td>
        </tr>
      `).join('');
    }
  },

  exportTunggakanCsv: function() {
    const data = DB.getReceivablesReport();
    let csv = 'NIS,Nama,Kelas,Angkatan,Status_Siswa,Total_Beban,Total_Bayar,Sisa_Tunggakan,Status_Keuangan\n';
    data.students.forEach(s => {
      csv += `"${s.nis}","${s.nama}","${s.kelas}","${s.angkatan}","${s.status}",${s.total_beban},${s.total_bayar},${s.tunggakan},"${s.status_keuangan}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Laporan_Tunggakan_SIM_TU_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
  },

  // ============================================================================
  // PENGATURAN & INTEGRASI GAS MODULE
  // ============================================================================
  renderPengaturan: function() {
    const config = DB.getConfig();

    document.getElementById('setting-mode-select').value = config.mode || 'local';
    document.getElementById('setting-gas-url').value = config.gasWebAppUrl || '';
    document.getElementById('setting-nama-sekolah').value = config.namaSekolah || '';
    document.getElementById('setting-alamat-sekolah').value = config.alamatSekolah || '';
    document.getElementById('setting-telepon-sekolah').value = config.teleponSekolah || '';
    document.getElementById('setting-kepala-sekolah').value = config.kepalaSekolah || '';
    document.getElementById('setting-bendahara').value = config.bendahara || '';
    document.getElementById('setting-idle-timeout').value = config.idleTimeoutMinutes || 15;

    // Render Audit Trail
    const logs = DB.getAuditLogs();
    const tbodyLogs = document.getElementById('audit-logs-tbody');
    if (tbodyLogs) {
      tbodyLogs.innerHTML = logs.slice(0, 30).map(l => `
        <tr>
          <td><small>${l.waktu}</small></td>
          <td><span class="badge bg-light text-dark">${l.user}</span></td>
          <td class="fw-bold">${l.aksi}</td>
          <td><small class="text-muted">${l.details || '-'}</small></td>
        </tr>
      `).join('');
    }
  },

  saveSettingsForm: function() {
    const mode = document.getElementById('setting-mode-select').value;
    const gasWebAppUrl = document.getElementById('setting-gas-url').value.trim();
    const namaSekolah = document.getElementById('setting-nama-sekolah').value.trim();
    const alamatSekolah = document.getElementById('setting-alamat-sekolah').value.trim();
    const teleponSekolah = document.getElementById('setting-telepon-sekolah').value.trim();
    const kepalaSekolah = document.getElementById('setting-kepala-sekolah').value.trim();
    const bendahara = document.getElementById('setting-bendahara').value.trim();
    const idleTimeoutMinutes = Number(document.getElementById('setting-idle-timeout').value) || 15;

    const sess = Auth.getSession();

    DB.saveConfig({
      mode,
      gasWebAppUrl,
      namaSekolah,
      alamatSekolah,
      teleponSekolah,
      kepalaSekolah,
      bendahara,
      idleTimeoutMinutes,
      currentUser: sess?.username
    });

    this.updateHeaderStatus();
    showToast('Konfigurasi sistem berhasil disimpan!', 'success');

    if (mode === 'gas' && gasWebAppUrl) {
      this.syncFromGas();
    }
  },

  syncFromGas: async function() {
    const btn = document.getElementById('btn-sync-gas');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Menyinkronkan...';
    }

    const res = await DB.syncFromGas();

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-cloud-arrow-down-fill me-1"></i> Tarik & Sinkronkan Data dari Google Sheets';
    }

    if (res.success) {
      this.renderCurrentPage();
      showToast(res.message, 'success');
    } else {
      alert(res.message);
    }
  },

  testGasConnection: async function() {
    const url = document.getElementById('setting-gas-url').value.trim();
    if (!url) {
      alert('Masukkan URL Web App Google Apps Script terlebih dahulu!');
      return;
    }

    const btn = document.getElementById('btn-test-gas');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Menguji...';

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'ping' })
      });
      const data = await res.json();
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-broadcast"></i> Uji Koneksi GAS';

      if (data.success) {
        alert('Koneksi Berhasil!\n\nGoogle Apps Script merespons dengan pesan:\n"' + data.message + '"');
      } else {
        alert('Koneksi Gagal: ' + data.message);
      }
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-broadcast"></i> Uji Koneksi GAS';
      alert('Gagal menghubungi GAS Web App:\n' + err.message + '\n\nPastikan akses disetel ke "Anyone" (Siapa saja).');
    }
  },

  resetDemoData: function() {
    if (confirm('PERINGATAN: Seluruh data transaksi lokal akan direset ke data awal demo. Lanjutkan?')) {
      DB.resetToDefault();
      this.init();
      showToast('Data demo berhasil direset ke kondisi awal.', 'info');
    }
  },

  // ============================================================================
  // PRINT ENGINE (Kwitansi Siswa, BKK A5, Berita Acara Setoran & Watermark)
  // ============================================================================
  printSingleReceipt: function(id_trx) {
    const allTrx = DB.getIncomeTransactions();
    const trx = allTrx.find(t => t.id_trx === id_trx);
    if (!trx) return;

    const isReprint = trx.reprint_count > 0;
    DB.incrementIncomeReprint(id_trx);

    this.renderKwitansiHtml([trx], isReprint);
    window.print();
  },

  printBatchReceipt: function(batchId) {
    const allTrx = DB.getIncomeTransactions();
    const items = allTrx.filter(t => t.batch_id === batchId || t.id_trx === batchId);
    if (items.length === 0) return;

    const isReprint = items[0].reprint_count > 0;
    items.forEach(i => DB.incrementIncomeReprint(i.id_trx));

    this.renderKwitansiHtml(items, isReprint);
    window.print();
  },

  renderKwitansiHtml: function(transactions, isReprint) {
    const config = DB.getConfig();
    const students = DB.getStudents();
    const studentBills = DB.getStudentBills();
    const masterBills = DB.getMasterBills();

    const firstTrx = transactions[0];
    const bill = studentBills.find(b => b.id_tagihan === firstTrx.id_tagihan) || {};
    const student = students.find(s => String(s.nis) === String(bill.nis)) || { nama: 'Siswa', nis: bill.nis, kelas: '-' };

    const totalBayar = transactions.reduce((sum, t) => sum + Number(t.nominal_bayar), 0);
    const docNo = transactions.length > 1 ? (firstTrx.batch_id || firstTrx.id_trx) : firstTrx.id_trx;

    const printArea = document.getElementById('print-area');
    printArea.innerHTML = `
      <div class="print-document">
        ${isReprint ? `<div class="reprint-watermark">SALINAN / CETAK ULANG</div>` : ''}

        <div class="print-kop">
          <div class="print-kop-logo">
            <svg viewBox="0 0 24 24" width="50" height="50" fill="#2563eb">
              <path d="M12 3L1 9L12 15L21 10.09V17H23V9M5 13.18V17.18L12 21L19 17.18V13.18L12 17L5 13.18Z"/>
            </svg>
          </div>
          <div class="print-kop-text">
            <h2>${config.namaSekolah}</h2>
            <h3>BAGIAN TATA USAHA & KEUANGAN</h3>
            <p>${config.alamatSekolah} | Telp: ${config.teleponSekolah}</p>
          </div>
        </div>

        <div class="print-title">
          <h4>KWITANSI PEMBAYARAN SISWA</h4>
          <div class="doc-number">No. Bukti: ${docNo}</div>
        </div>

        <table class="print-meta-table">
          <tr>
            <td class="label">Telah Terima Dari</td>
            <td class="colon">:</td>
            <td><strong>${student.nama}</strong> (${student.nis}) - Kelas: ${student.kelas}</td>
            <td class="label">Tanggal</td>
            <td class="colon">:</td>
            <td>${firstTrx.waktu}</td>
          </tr>
          <tr>
            <td class="label">Metode Pembayaran</td>
            <td class="colon">:</td>
            <td>${firstTrx.metode}</td>
            <td class="label">Kasir / Operator</td>
            <td class="colon">:</td>
            <td>${firstTrx.user_input}</td>
          </tr>
        </table>

        <table class="print-items-table">
          <thead>
            <tr>
              <th style="width: 40px;">No</th>
              <th>Rincian Pos Pembayaran</th>
              <th style="width: 120px;">Periode</th>
              <th style="width: 160px;" class="text-right">Nominal Bayar</th>
            </tr>
          </thead>
          <tbody>
            ${transactions.map((t, idx) => {
              const b = studentBills.find(x => x.id_tagihan === t.id_tagihan) || {};
              const m = masterBills.find(x => x.id_jenis === b.id_jenis) || { nama_tagihan: b.id_jenis };
              return `
                <tr>
                  <td class="text-center">${idx + 1}</td>
                  <td>${m.nama_tagihan}</td>
                  <td class="text-center">${b.bulan_tahun || '-'}</td>
                  <td class="text-right">${formatRupiah(t.nominal_bayar)}</td>
                </tr>
              `;
            }).join('')}
            <tr>
              <td colspan="3" class="text-right" style="font-weight: bold;">TOTAL PEMBAYARAN</td>
              <td class="text-right" style="font-weight: bold;">${formatRupiah(totalBayar)}</td>
            </tr>
          </tbody>
        </table>

        <div class="terbilang-box">
          <strong>Terbilang:</strong> <em># ${terbilang(totalBayar)} #</em>
        </div>

        <div class="print-signatures">
          <div class="sig-block">
            <div>Siswa / Pembayar,</div>
            <div class="sig-space"></div>
            <div class="sig-name">( ${student.nama} )</div>
          </div>
          <div class="sig-block">
            <div>Bendahara / Kasir TU,</div>
            <div class="sig-space"></div>
            <div class="sig-name">( ${firstTrx.user_input} )</div>
            <div class="sig-title">NIP / NUPTK: -</div>
          </div>
        </div>

        <div class="print-footer-note">
          <span>* Simpan kwitansi sah ini sebagai bukti pembayaran yang sah.</span>
          <span>Dicetak: ${new Date().toLocaleString('id-ID')}</span>
        </div>
      </div>
    `;
  },

  printBkk: function(id_out) {
    const allExpenses = DB.getExpenseTransactions();
    const exp = allExpenses.find(e => e.id_out === id_out);
    if (!exp) return;

    const isReprint = exp.reprint_count > 0;
    DB.incrementExpenseReprint(id_out);

    const config = DB.getConfig();
    const printArea = document.getElementById('print-area');

    printArea.innerHTML = `
      <div class="print-document">
        ${isReprint ? `<div class="reprint-watermark">SALINAN / CETAK ULANG</div>` : ''}

        <div class="print-kop">
          <div class="print-kop-logo">
            <svg viewBox="0 0 24 24" width="50" height="50" fill="#dc2626">
              <path d="M19 3H5C3.89 3 3 3.89 3 5V19C3 20.1 3.89 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.89 20.1 3 19 3M19 19H5V5H19V19M17 12H7V10H17V12Z"/>
            </svg>
          </div>
          <div class="print-kop-text">
            <h2>${config.namaSekolah}</h2>
            <h3>BUKTI KAS KELUAR (BKK) OPERASIONAL A5</h3>
            <p>${config.alamatSekolah} | Telp: ${config.teleponSekolah}</p>
          </div>
        </div>

        <div class="print-title">
          <h4>BUKTI PENGELUARAN KAS (BKK)</h4>
          <div class="doc-number">Nomor Bukti: ${exp.id_out}</div>
        </div>

        <table class="print-meta-table">
          <tr>
            <td class="label">Dibayarkan Kepada</td>
            <td class="colon">:</td>
            <td><strong>${exp.penerima}</strong></td>
            <td class="label">Tanggal Keluar</td>
            <td class="colon">:</td>
            <td>${exp.waktu}</td>
          </tr>
          <tr>
            <td class="label">Pos Kategori</td>
            <td class="colon">:</td>
            <td><span style="border: 1px solid #000; padding: 2px 6px;">${exp.kategori}</span></td>
            <td class="label">Petugas Input</td>
            <td class="colon">:</td>
            <td>${exp.user_input}</td>
          </tr>
          <tr>
            <td class="label">Uraian / Keterangan</td>
            <td class="colon">:</td>
            <td colspan="4">${exp.keterangan}</td>
          </tr>
        </table>

        <table class="print-items-table">
          <thead>
            <tr>
              <th>Rincian Belanja / Pengeluaran</th>
              <th style="width: 200px;" class="text-right">Jumlah Uang</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${exp.keterangan} (${exp.kategori})</td>
              <td class="text-right fw-bold">${formatRupiah(exp.nominal)}</td>
            </tr>
            <tr>
              <td class="text-right" style="font-weight: bold;">TOTAL PENGELUARAN</td>
              <td class="text-right" style="font-weight: bold;">${formatRupiah(exp.nominal)}</td>
            </tr>
          </tbody>
        </table>

        <div class="terbilang-box">
          <strong>Jumlah Terbilang:</strong> <em># ${terbilang(exp.nominal)} #</em>
        </div>

        <div class="print-signatures">
          <div class="sig-block">
            <div>Menyetujui,</div>
            <div class="sig-title">Kepala Sekolah</div>
            <div class="sig-space"></div>
            <div class="sig-name">( ${config.kepalaSekolah} )</div>
          </div>
          <div class="sig-block">
            <div>Lunas Dibayar,</div>
            <div class="sig-title">Bendahara Pengeluaran</div>
            <div class="sig-space"></div>
            <div class="sig-name">( ${config.bendahara} )</div>
          </div>
          <div class="sig-block">
            <div>Yang Menerima Uang,</div>
            <div class="sig-title">Penerima</div>
            <div class="sig-space"></div>
            <div class="sig-name">( ${exp.penerima} )</div>
          </div>
        </div>

        <div class="print-footer-note">
          <span>* Lembar 1: Kasir TU | Lembar 2: Arsip Yayasan</span>
          <span>Dicetak: ${new Date().toLocaleString('id-ID')}</span>
        </div>
      </div>
    `;

    window.print();
  },

  printTandaTerimaSetoran: function(kodeSetoran) {
    const setoranList = DB.getSetoranList();
    const setoran = setoranList.find(s => s.kode_setoran === kodeSetoran);
    if (!setoran) return;

    const allIn = DB.getIncomeTransactions();
    const studentBills = DB.getStudentBills();
    const students = DB.getStudents();
    const masterBills = DB.getMasterBills();

    const items = allIn.filter(t => t.kode_setoran === kodeSetoran);
    const config = DB.getConfig();

    const printArea = document.getElementById('print-area');
    printArea.innerHTML = `
      <div class="print-document">
        <div class="print-kop">
          <div class="print-kop-logo">
            <svg viewBox="0 0 24 24" width="50" height="50" fill="#059669">
              <path d="M12 2C6.48 2 2 6.48 2 12S6.48 22 12 22 22 17.52 22 12 17.52 2 12 2M12 20C7.59 20 4 16.41 4 12S7.59 4 12 4 20 7.59 20 12 16.41 20 12 20M11 7H13V9H11V7M11 11H13V17H11V11Z"/>
            </svg>
          </div>
          <div class="print-kop-text">
            <h2>${config.namaSekolah}</h2>
            <h3>BERITA ACARA SERAH TERIMA SETORAN KAS FISIK</h3>
            <p>${config.alamatSekolah} | Telp: ${config.teleponSekolah}</p>
          </div>
        </div>

        <div class="print-title">
          <h4>TANDA TERIMA & BERITA ACARA SETORAN KAS</h4>
          <div class="doc-number">Kode Setoran: ${setoran.kode_setoran}</div>
        </div>

        <table class="print-meta-table">
          <tr>
            <td class="label">Tanggal & Waktu</td>
            <td class="colon">:</td>
            <td>${setoran.waktu}</td>
            <td class="label">Disetorkan Oleh</td>
            <td class="colon">:</td>
            <td>${setoran.petugas}</td>
          </tr>
          <tr>
            <td class="label">Diterima Oleh</td>
            <td class="colon">:</td>
            <td><strong>${setoran.penerima}</strong></td>
            <td class="label">Jumlah Bundel Trx</td>
            <td class="colon">:</td>
            <td>${setoran.jumlah_trx} Transaksi Kas Tunai</td>
          </tr>
          <tr>
            <td class="label">Keterangan</td>
            <td class="colon">:</td>
            <td colspan="4">${setoran.keterangan}</td>
          </tr>
        </table>

        <div style="font-weight: bold; margin: 10px 0 5px; font-size: 10pt;">Lampiran Rincian Transaksi yang Disetorkan:</div>
        <table class="print-items-table">
          <thead>
            <tr>
              <th style="width: 35px;">No</th>
              <th style="width: 150px;">ID Transaksi</th>
              <th>Nama Siswa / NIS</th>
              <th>Pos Tagihan</th>
              <th style="width: 140px;" class="text-right">Nominal Tunai</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((t, idx) => {
              const b = studentBills.find(x => x.id_tagihan === t.id_tagihan) || {};
              const st = students.find(s => String(s.nis) === String(b.nis)) || { nama: '-', nis: '-' };
              const m = masterBills.find(x => x.id_jenis === b.id_jenis) || { nama_tagihan: '-' };
              return `
                <tr>
                  <td class="text-center">${idx + 1}</td>
                  <td><span class="badge-code">${t.id_trx}</span></td>
                  <td>${st.nama} (${st.nis})</td>
                  <td>${m.nama_tagihan} (${b.bulan_tahun || '-'})</td>
                  <td class="text-right">${formatRupiah(t.nominal_bayar)}</td>
                </tr>
              `;
            }).join('')}
            <tr>
              <td colspan="4" class="text-right" style="font-weight: bold;">TOTAL UANG FISIK YANG DISERAHKAN</td>
              <td class="text-right" style="font-weight: bold;">${formatRupiah(setoran.total_nominal)}</td>
            </tr>
          </tbody>
        </table>

        <div class="terbilang-box">
          <strong>Terbilang:</strong> <em># ${terbilang(setoran.total_nominal)} #</em>
        </div>

        <div class="print-signatures">
          <div class="sig-block">
            <div>Yang Menyerahkan (Penyetor),</div>
            <div class="sig-title">Kasir / Staf TU</div>
            <div class="sig-space"></div>
            <div class="sig-name">( ${setoran.petugas} )</div>
          </div>
          <div class="sig-block">
            <div>Yang Menerima Uang Fisik,</div>
            <div class="sig-title">Kepala Sekolah / Yayasan</div>
            <div class="sig-space"></div>
            <div class="sig-name">( ${setoran.penerima} )</div>
          </div>
        </div>

        <div class="print-footer-note">
          <span>* Berita acara ini membuktikan bahwa fisik uang kas telah berpindah tangan ke pimpinan.</span>
          <span>Dicetak: ${new Date().toLocaleString('id-ID')}</span>
        </div>
      </div>
    `;

    window.print();
  }
};

// Initialize App on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

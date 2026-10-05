/**
 * SIM-TU Database Layer (js/db.js)
 * Manages Data Storage, Local Persistence & Google Apps Script (GAS) API Integration
 */

const DB = (function() {
  const STORAGE_KEYS = {
    CONFIG: 'simtu_config',
    USERS: 'simtu_data_user',
    STUDENTS: 'simtu_data_siswa',
    MASTER_BILLS: 'simtu_master_tagihan',
    MASTER_EXPENSES: 'simtu_master_pengeluaran',
    STUDENT_BILLS: 'simtu_tagihan_siswa',
    TRANSACTIONS_IN: 'simtu_transaksi_masuk',
    TRANSACTIONS_OUT: 'simtu_transaksi_keluar',
    SETORAN: 'simtu_data_setoran',
    AUDIT_LOGS: 'simtu_audit_logs'
  };

  // Default seed data with realistic Indonesian School data
  const SEED_DATA = {
    users: [
      {
        username: 'operator',
        // SHA-256 for 'operator123'
        password_hash: 'ec6e1c25258002eb1c67d15c7f45da7945fa4c58778fd7d88faa5e53e3b4698d',
        role: 'Operator',
        nama_lengkap: 'Siti Rahmawati, S.Kom'
      },
      {
        username: 'manajemen',
        // SHA-256 for 'admin123'
        password_hash: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
        role: 'Manajemen',
        nama_lengkap: 'Drs. H. Mulyadi, M.Pd (Kepala Sekolah)'
      }
    ],
    masterBills: [
      { id_jenis: 'TAG-SPP', nama_tagihan: 'SPP Bulanan', kategori: 'Rutin', nominal_default: 250000 },
      { id_jenis: 'TAG-DSP', nama_tagihan: 'Dana Sumbangan Pendidikan (DSP)', kategori: 'Insidental', nominal_default: 2500000 },
      { id_jenis: 'TAG-SRG', nama_tagihan: 'Paket Seragam & Atribut', kategori: 'Insidental', nominal_default: 850000 },
      { id_jenis: 'TAG-UJN', nama_tagihan: 'Ujian Akhir Semester (UAS)', kategori: 'Semester', nominal_default: 150000 },
      { id_jenis: 'TAG-PRK', nama_tagihan: 'Bahan Praktik Kejuruan', kategori: 'Semester', nominal_default: 300000 }
    ],
    masterExpenses: [
      { kategori: 'ATK & Cetak', deskripsi: 'Kertas, tinta printer, fotocopy berkas' },
      { kategori: 'Sarana & Prasarana', deskripsi: 'Perbaikan meja, kursi, AC, lampu' },
      { kategori: 'Bahan Praktik', deskripsi: 'Komponen laboratorium, bengkel, kimia' },
      { kategori: 'Konsumsi Rapat', deskripsi: 'Snack dan makan rapat kedinasan' },
      { kategori: 'Honor Ekstrakurikuler', deskripsi: 'Pelatih pramuka, futsal, seni' },
      { kategori: 'Operasional Lainnya', deskripsi: 'Listrik, air, kebersihan sekolah' }
    ],
    students: [
      { nis: '2026101', nama: 'Ahmad Fauzi', kelas: 'X-RPL-1', angkatan: '2026', status: 'Aktif' },
      { nis: '2026102', nama: 'Bella Safitri', kelas: 'X-RPL-1', angkatan: '2026', status: 'Aktif' },
      { nis: '2026103', nama: 'Dimas Setiawan', kelas: 'X-RPL-2', angkatan: '2026', status: 'Aktif' },
      { nis: '2025101', nama: 'Farhan Maulana', kelas: 'XI-TKJ-1', angkatan: '2025', status: 'Aktif' },
      { nis: '2025102', nama: 'Gita Permata', kelas: 'XI-TKJ-1', angkatan: '2025', status: 'Aktif' },
      { nis: '2024101', nama: 'Ilham Hidayat', kelas: 'XII-AKL-1', angkatan: '2024', status: 'Aktif' },
      { nis: '2024102', nama: 'Kirana Larasati', kelas: 'XII-AKL-1', angkatan: '2024', status: 'Aktif' }
    ],
    studentBills: [
      { id_tagihan: 'BILL-1001', nis: '2026101', bulan_tahun: '2026-10', id_jenis: 'TAG-SPP', nominal_dibebankan: 250000 },
      { id_tagihan: 'BILL-1002', nis: '2026101', bulan_tahun: '2026-07', id_jenis: 'TAG-DSP', nominal_dibebankan: 2500000 },
      { id_tagihan: 'BILL-1003', nis: '2026102', bulan_tahun: '2026-10', id_jenis: 'TAG-SPP', nominal_dibebankan: 200000 }, // Beasiswa potongan
      { id_tagihan: 'BILL-1004', nis: '2026102', bulan_tahun: '2026-07', id_jenis: 'TAG-DSP', nominal_dibebankan: 2500000 },
      { id_tagihan: 'BILL-1005', nis: '2025101', bulan_tahun: '2026-10', id_jenis: 'TAG-SPP', nominal_dibebankan: 250000 },
      { id_tagihan: 'BILL-1006', nis: '2025102', bulan_tahun: '2026-10', id_jenis: 'TAG-SPP', nominal_dibebankan: 250000 },
      { id_tagihan: 'BILL-1007', nis: '2024101', bulan_tahun: '2026-10', id_jenis: 'TAG-SPP', nominal_dibebankan: 250000 },
      { id_tagihan: 'BILL-1008', nis: '2024102', bulan_tahun: '2026-10', id_jenis: 'TAG-SPP', nominal_dibebankan: 250000 }
    ],
    transactionsIn: [
      {
        id_trx: 'TRX-20261001-001',
        waktu: '2026-10-01 08:30:15',
        id_tagihan: 'BILL-1001',
        nominal_bayar: 250000,
        metode: 'Kas Tunai',
        kode_setoran: 'STR-20261001-01',
        user_input: 'operator',
        status_trx: 'VALID',
        reprint_count: 0
      },
      {
        id_trx: 'TRX-20261002-002',
        waktu: '2026-10-02 09:15:40',
        id_tagihan: 'BILL-1002',
        nominal_bayar: 1000000, // Pembayaran parsial eceran
        metode: 'Kas Tunai',
        kode_setoran: '',
        user_input: 'operator',
        status_trx: 'VALID',
        reprint_count: 0
      },
      {
        id_trx: 'TRX-20261003-003',
        waktu: '2026-10-03 10:20:10',
        id_tagihan: 'BILL-1005',
        nominal_bayar: 250000,
        metode: 'Transfer',
        kode_setoran: '',
        user_input: 'operator',
        status_trx: 'VALID',
        reprint_count: 0
      }
    ],
    transactionsOut: [
      {
        id_out: 'BKK-20261001-001',
        waktu: '2026-10-01 11:00:00',
        kategori: 'ATK & Cetak',
        nominal: 185000,
        keterangan: 'Pembelian 3 rim kertas HVS A4 & pulpen kantor',
        penerima: 'Toko Buku Nusantara',
        user_input: 'operator',
        status_trx: 'VALID',
        reprint_count: 0
      },
      {
        id_out: 'BKK-20261002-002',
        waktu: '2026-10-02 14:30:00',
        kategori: 'Sarana & Prasarana',
        nominal: 250000,
        keterangan: 'Service berkala AC ruang guru',
        penerima: 'CV Sejuk Abadi',
        user_input: 'operator',
        status_trx: 'VALID',
        reprint_count: 0
      }
    ],
    setoran: [
      {
        kode_setoran: 'STR-20261001-01',
        waktu: '2026-10-01 14:00:00',
        total_nominal: 250000,
        jumlah_trx: 1,
        petugas: 'Siti Rahmawati, S.Kom',
        penerima: 'Drs. H. Mulyadi, M.Pd',
        keterangan: 'Setoran kas masuk harian shift pagi'
      }
    ],
    config: {
      mode: 'local', // 'local' or 'gas'
      gasWebAppUrl: '',
      namaSekolah: 'SMK NEGERI 1 INFORMATIKA',
      alamatSekolah: 'Jl. Pendidikan Mandiri No. 45, Gedung Tata Usaha Lantai 1',
      teleponSekolah: '(021) 7890-1234',
      emailSekolah: 'tu.keuangan@smkn1informatika.sch.id',
      kepalaSekolah: 'Drs. H. Mulyadi, M.Pd',
      bendahara: 'Siti Rahmawati, S.Kom',
      idleTimeoutMinutes: 15
    }
  };

  // Helper to load or initialize storage
  function initData() {
    if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
      resetToDefault();
    } else {
      // Auto-migrate operator password hash if stored with legacy incorrect hash
      try {
        const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
        let updated = false;
        users.forEach(u => {
          if (u.username === 'operator' && u.password_hash !== 'ec6e1c25258002eb1c67d15c7f45da7945fa4c58778fd7d88faa5e53e3b4698d') {
            u.password_hash = 'ec6e1c25258002eb1c67d15c7f45da7945fa4c58778fd7d88faa5e53e3b4698d';
            updated = true;
          }
        });
        if (updated) {
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
        }
      } catch (e) {
        console.error('User migration error:', e);
      }
    }
  }

  function resetToDefault() {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(SEED_DATA.users));
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(SEED_DATA.students));
    localStorage.setItem(STORAGE_KEYS.MASTER_BILLS, JSON.stringify(SEED_DATA.masterBills));
    localStorage.setItem(STORAGE_KEYS.MASTER_EXPENSES, JSON.stringify(SEED_DATA.masterExpenses));
    localStorage.setItem(STORAGE_KEYS.STUDENT_BILLS, JSON.stringify(SEED_DATA.studentBills));
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS_IN, JSON.stringify(SEED_DATA.transactionsIn));
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS_OUT, JSON.stringify(SEED_DATA.transactionsOut));
    localStorage.setItem(STORAGE_KEYS.SETORAN, JSON.stringify(SEED_DATA.setoran));
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(SEED_DATA.config));
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify([
      { waktu: new Date().toISOString(), user: 'SYSTEM', aksi: 'Inisialisasi Database Sistem SIM-TU' }
    ]));
  }

  function getFromStore(key) {
    initData();
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error reading localStorage for key:', key, e);
      return [];
    }
  }

  function saveToStore(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('Error saving to localStorage for key:', key, e);
      return false;
    }
  }

  function logAudit(user, action, details = '') {
    const logs = getFromStore(STORAGE_KEYS.AUDIT_LOGS);
    logs.unshift({
      waktu: new Date().toLocaleString('id-ID'),
      user: user || 'Anonymous',
      aksi: action,
      details: typeof details === 'object' ? JSON.stringify(details) : details
    });
    // Keep max 200 logs
    if (logs.length > 200) logs.pop();
    saveToStore(STORAGE_KEYS.AUDIT_LOGS, logs);
  }

  // GAS API Call wrapper
  async function callGasApi(action, payload = {}) {
    const config = getConfig();
    if (config.mode !== 'gas' || !config.gasWebAppUrl) {
      return { success: false, message: 'Mode GAS belum diaktifkan atau URL Web App kosong' };
    }

    try {
      const response = await fetch(config.gasWebAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, ...payload })
      });
      const resJson = await response.json();
      return resJson;
    } catch (err) {
      console.error('GAS API Fetch Error:', err);
      return { success: false, message: 'Koneksi ke Google Apps Script gagal: ' + err.message };
    }
  }

  // --- Public Interface ---
  return {
    init: initData,
    resetToDefault: resetToDefault,
    logAudit: logAudit,

    // Sync From Google Sheets (Download all tables)
    syncFromGas: async function() {
      const config = this.getConfig();
      if (config.mode !== 'gas' || !config.gasWebAppUrl) {
        return { success: false, message: 'Mode GAS belum aktif atau URL Web App kosong. Periksa menu Pengaturan.' };
      }

      try {
        const res = await callGasApi('getAllData');
        if (res && res.success && res.data) {
          const d = res.data;
          if (Array.isArray(d['Data_Siswa']) && d['Data_Siswa'].length > 0) {
            const mappedStudents = d['Data_Siswa'].map(s => ({
              nis: String(s.NIS || s.nis),
              nama: s.Nama || s.nama,
              kelas: s.Kelas || s.kelas,
              angkatan: String(s.Angkatan || s.angkatan),
              status: s.Status || s.status || 'Aktif'
            }));
            saveToStore(STORAGE_KEYS.STUDENTS, mappedStudents);
          }
          if (Array.isArray(d['Master_Tagihan']) && d['Master_Tagihan'].length > 0) {
            const mappedBills = d['Master_Tagihan'].map(m => ({
              id_jenis: m.ID_Jenis || m.id_jenis,
              nama_tagihan: m.Nama_Tagihan || m.nama_tagihan,
              kategori: m.Kategori || m.kategori,
              nominal_default: Number(m.Nominal_Default || m.nominal_default || 0)
            }));
            saveToStore(STORAGE_KEYS.MASTER_BILLS, mappedBills);
          }
          if (Array.isArray(d['Master_Pengeluaran']) && d['Master_Pengeluaran'].length > 0) {
            const mappedExp = d['Master_Pengeluaran'].map(e => ({
              kategori: e.Kategori || e.kategori,
              deskripsi: e.Deskripsi || e.deskripsi || ''
            }));
            saveToStore(STORAGE_KEYS.MASTER_EXPENSES, mappedExp);
          }
          if (Array.isArray(d['Tagihan_Siswa']) && d['Tagihan_Siswa'].length > 0) {
            const mappedTb = d['Tagihan_Siswa'].map(b => ({
              id_tagihan: b.ID_Tagihan || b.id_tagihan,
              nis: String(b.NIS || b.nis),
              bulan_tahun: b.Bulan_Tahun || b.bulan_tahun,
              id_jenis: b.ID_Jenis || b.id_jenis,
              nominal_dibebankan: Number(b.Nominal_Dibebankan || b.nominal_dibebankan || 0)
            }));
            saveToStore(STORAGE_KEYS.STUDENT_BILLS, mappedTb);
          }
          if (Array.isArray(d['Transaksi_Masuk']) && d['Transaksi_Masuk'].length > 0) {
            const mappedIn = d['Transaksi_Masuk'].map(t => ({
              id_trx: t.ID_Trx || t.id_trx,
              waktu: t.Waktu || t.waktu,
              id_tagihan: t.ID_Tagihan || t.id_tagihan,
              nominal_bayar: Number(t.Nominal_Bayar || t.nominal_bayar || 0),
              metode: t.Metode || t.metode,
              kode_setoran: t.Kode_Setoran || t.kode_setoran || '',
              user_input: t.User_Input || t.user_input,
              status_trx: t.Status_Trx || t.status_trx || 'VALID',
              reprint_count: 0
            }));
            saveToStore(STORAGE_KEYS.TRANSACTIONS_IN, mappedIn);
          }
          if (Array.isArray(d['Transaksi_Keluar']) && d['Transaksi_Keluar'].length > 0) {
            const mappedOut = d['Transaksi_Keluar'].map(e => ({
              id_out: e.ID_Out || e.id_out,
              waktu: e.Waktu || e.waktu,
              kategori: e.Kategori || e.kategori,
              nominal: Number(e.Nominal || e.nominal || 0),
              keterangan: e.Keterangan || e.keterangan,
              penerima: e.Penerima || e.penerima,
              user_input: e.User_Input || e.user_input,
              status_trx: e.Status_Trx || e.status_trx || 'VALID',
              reprint_count: 0
            }));
            saveToStore(STORAGE_KEYS.TRANSACTIONS_OUT, mappedOut);
          }
          if (Array.isArray(d['Data_Setoran']) && d['Data_Setoran'].length > 0) {
            const mappedSetoran = d['Data_Setoran'].map(s => ({
              kode_setoran: s.Kode_Setoran || s.kode_setoran,
              waktu: s.Waktu || s.waktu,
              total_nominal: Number(s.Total_Nominal || s.total_nominal || 0),
              jumlah_trx: Number(s.Jumlah_Trx || s.jumlah_trx || 0),
              petugas: s.Petugas || s.petugas,
              penerima: s.Penerima || s.penerima,
              keterangan: s.Keterangan || s.keterangan || ''
            }));
            saveToStore(STORAGE_KEYS.SETORAN, mappedSetoran);
          }

          logAudit(config.currentUser || 'SYSTEM', 'Sinkronisasi Sukses dari Google Sheets (Cloud)');
          return { success: true, message: 'Data berhasil disinkronkan langsung dari Google Sheets!' };
        }
        return { success: false, message: res ? res.message : 'Respon kosong dari Google Apps Script' };
      } catch (e) {
        return { success: false, message: 'Gagal sinkronisasi: ' + e.message };
      }
    },

    // Config & Settings
    getConfig: function() {
      initData();
      try {
        const c = localStorage.getItem(STORAGE_KEYS.CONFIG);
        return c ? JSON.parse(c) : SEED_DATA.config;
      } catch (e) {
        return SEED_DATA.config;
      }
    },
    saveConfig: function(newConfig) {
      const current = this.getConfig();
      const updated = { ...current, ...newConfig };
      saveToStore(STORAGE_KEYS.CONFIG, updated);
      logAudit(updated.currentUser || 'SYSTEM', 'Perubahan Konfigurasi Sistem');
      return updated;
    },

    // Users
    getUsers: function() {
      return getFromStore(STORAGE_KEYS.USERS);
    },
    getUserByUsername: function(username) {
      const users = this.getUsers();
      return users.find(u => u.username.toLowerCase() === (username || '').toLowerCase());
    },

    // Students
    getStudents: function() {
      return getFromStore(STORAGE_KEYS.STUDENTS);
    },
    getStudentByNis: function(nis) {
      const students = this.getStudents();
      return students.find(s => String(s.nis) === String(nis));
    },
    saveStudent: function(student, currentUser) {
      const students = this.getStudents();
      const existingIdx = students.findIndex(s => String(s.nis) === String(student.nis));
      if (existingIdx >= 0) {
        students[existingIdx] = { ...students[existingIdx], ...student };
        logAudit(currentUser, `Update Data Siswa NIS: ${student.nis}`, student);
      } else {
        students.push(student);
        logAudit(currentUser, `Tambah Siswa Baru NIS: ${student.nis}`, student);
      }
      saveToStore(STORAGE_KEYS.STUDENTS, students);

      // Dispatch to GAS if active
      const cfg = this.getConfig();
      if (cfg.mode === 'gas') {
        callGasApi('saveStudent', student).catch(console.error);
      }

      return true;
    },
    bulkImportStudents: function(studentsList, currentUser) {
      const current = this.getStudents();
      let added = 0;
      let updated = 0;

      studentsList.forEach(st => {
        if (!st.nis || !st.nama) return;
        const idx = current.findIndex(s => String(s.nis) === String(st.nis));
        if (idx >= 0) {
          current[idx] = { ...current[idx], ...st };
          updated++;
        } else {
          current.push({
            nis: String(st.nis),
            nama: st.nama,
            kelas: st.kelas || 'X',
            angkatan: st.angkatan || new Date().getFullYear().toString(),
            status: st.status || 'Aktif'
          });
          added++;
        }
      });

      saveToStore(STORAGE_KEYS.STUDENTS, current);
      logAudit(currentUser, `Bulk Import Siswa: ${added} baru, ${updated} diperbarui`);

      const cfg = this.getConfig();
      if (cfg.mode === 'gas') {
        callGasApi('bulkImportStudents', { students: studentsList }).catch(console.error);
      }

      return { added, updated, total: current.length };
    },
    batchUpdateClass: function(nisList, newClass, currentUser) {
      const students = this.getStudents();
      let count = 0;
      students.forEach(st => {
        if (nisList.includes(String(st.nis))) {
          st.kelas = newClass;
          count++;
        }
      });
      saveToStore(STORAGE_KEYS.STUDENTS, students);
      logAudit(currentUser, `Kenaikan Kelas Batch: ${count} siswa dipindah ke ${newClass}`);

      const cfg = this.getConfig();
      if (cfg.mode === 'gas') {
        callGasApi('batchUpdateClass', { nisList, newClass }).catch(console.error);
      }

      return count;
    },

    // Master Bills & Expenses
    getMasterBills: function() {
      return getFromStore(STORAGE_KEYS.MASTER_BILLS);
    },
    saveMasterBill: function(bill) {
      const bills = this.getMasterBills();
      const idx = bills.findIndex(b => b.id_jenis === bill.id_jenis);
      if (idx >= 0) bills[idx] = bill;
      else bills.push(bill);
      saveToStore(STORAGE_KEYS.MASTER_BILLS, bills);
      return bills;
    },
    getMasterExpenses: function() {
      return getFromStore(STORAGE_KEYS.MASTER_EXPENSES);
    },
    saveMasterExpense: function(exp) {
      const expenses = this.getMasterExpenses();
      if (!expenses.find(e => e.kategori === exp.kategori)) {
        expenses.push(exp);
        saveToStore(STORAGE_KEYS.MASTER_EXPENSES, expenses);
      }
      return expenses;
    },

    // Student Bills (Piutang Siswa)
    getStudentBills: function() {
      return getFromStore(STORAGE_KEYS.STUDENT_BILLS);
    },
    getBillsForStudent: function(nis) {
      const allBills = this.getStudentBills();
      const allTrx = this.getIncomeTransactions().filter(t => t.status_trx === 'VALID');
      const masterBills = this.getMasterBills();

      return allBills
        .filter(b => String(b.nis) === String(nis))
        .map(b => {
          const master = masterBills.find(m => m.id_jenis === b.id_jenis) || { nama_tagihan: b.id_jenis, kategori: '-' };
          // Calculate total paid for this bill
          const paid = allTrx
            .filter(t => t.id_tagihan === b.id_tagihan)
            .reduce((sum, t) => sum + Number(t.nominal_bayar || 0), 0);
          
          const sisa = Math.max(0, Number(b.nominal_dibebankan) - paid);
          const isLunas = sisa === 0;

          return {
            ...b,
            nama_tagihan: master.nama_tagihan,
            kategori: master.kategori,
            terbayar: paid,
            sisa_tagihan: sisa,
            status_lunas: isLunas ? 'LUNAS' : (paid > 0 ? 'SEBAGIAN' : 'BELUM BAYAR')
          };
        });
    },
    generateBills: function({ angkatan, kelas, id_jenis, bulan_tahun, nominal }, currentUser) {
      const students = this.getStudents();
      const existingBills = this.getStudentBills();
      let generatedCount = 0;

      // Filter target students
      const targets = students.filter(st => {
        if (st.status !== 'Aktif') return false;
        if (angkatan && st.angkatan !== angkatan) return false;
        if (kelas && st.kelas !== kelas) return false;
        return true;
      });

      targets.forEach(st => {
        // Prevent duplicate bill for the same student, month, and bill type
        const exists = existingBills.some(b => 
          String(b.nis) === String(st.nis) && 
          b.id_jenis === id_jenis && 
          b.bulan_tahun === bulan_tahun
        );

        if (!exists) {
          const newId = 'BILL-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
          existingBills.push({
            id_tagihan: newId,
            nis: String(st.nis),
            bulan_tahun: bulan_tahun,
            id_jenis: id_jenis,
            nominal_dibebankan: Number(nominal)
          });
          generatedCount++;
        }
      });

      saveToStore(STORAGE_KEYS.STUDENT_BILLS, existingBills);
      logAudit(currentUser, `Generate Tagihan Massal: ${generatedCount} tagihan dibuat (${id_jenis}, ${bulan_tahun})`);

      const cfg = this.getConfig();
      if (cfg.mode === 'gas') {
        callGasApi('generateBills', { angkatan, kelas, id_jenis, bulan_tahun, nominal }).catch(console.error);
      }

      return generatedCount;
    },
    updateBillNominal: function(id_tagihan, newNominal, currentUser, alasan = '') {
      const bills = this.getStudentBills();
      const bill = bills.find(b => b.id_tagihan === id_tagihan);
      if (bill) {
        const oldNominal = bill.nominal_dibebankan;
        bill.nominal_dibebankan = Number(newNominal);
        saveToStore(STORAGE_KEYS.STUDENT_BILLS, bills);
        logAudit(currentUser, `Penyesuaian Tagihan ${id_tagihan}: Rp ${oldNominal} -> Rp ${newNominal} (${alasan})`);

        const cfg = this.getConfig();
        if (cfg.mode === 'gas') {
          callGasApi('updateBillNominal', { id_tagihan, newNominal }).catch(console.error);
        }

        return true;
      }
      return false;
    },

    // Transactions IN (Penerimaan Siswa)
    getIncomeTransactions: function() {
      return getFromStore(STORAGE_KEYS.TRANSACTIONS_IN);
    },
    addPaymentTransaction: function({ payments, metode, userInput }) {
      // payments is an array of { id_tagihan, nominal_bayar }
      const allTrx = this.getIncomeTransactions();
      const nowStr = new Date().toLocaleString('sv-SE'); // YYYY-MM-DD HH:mm:ss format
      const batchReceiptId = 'TRX-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' + Math.floor(1000 + Math.random() * 9000);
      const createdTrx = [];

      payments.forEach((p, idx) => {
        const trxId = payments.length > 1 ? `${batchReceiptId}-${idx + 1}` : batchReceiptId;
        const record = {
          id_trx: trxId,
          waktu: nowStr,
          id_tagihan: p.id_tagihan,
          nominal_bayar: Number(p.nominal_bayar),
          metode: metode || 'Kas Tunai',
          kode_setoran: '',
          user_input: userInput || 'operator',
          status_trx: 'VALID',
          reprint_count: 0,
          batch_id: batchReceiptId
        };
        allTrx.unshift(record);
        createdTrx.push(record);
      });

      saveToStore(STORAGE_KEYS.TRANSACTIONS_IN, allTrx);
      logAudit(userInput, `Transaksi Masuk: ${batchReceiptId} sebesar Rp ${payments.reduce((s, p) => s + Number(p.nominal_bayar), 0)}`);

      const cfg = this.getConfig();
      if (cfg.mode === 'gas') {
        callGasApi('addPayment', { payments, metode, userInput }).catch(console.error);
      }

      return { batchReceiptId, transactions: createdTrx };
    },
    voidIncomeTransaction: function(id_trx, currentUser, alasan = '') {
      const allTrx = this.getIncomeTransactions();
      const trx = allTrx.find(t => t.id_trx === id_trx);
      if (!trx) return { success: false, message: 'Transaksi tidak ditemukan' };
      if (trx.status_trx === 'DIBATALKAN') return { success: false, message: 'Transaksi sudah dibatalkan sebelumnya' };
      if (trx.kode_setoran) return { success: false, message: 'Transaksi sudah disetor ke pimpinan, tidak dapat dibatalkan!' };

      trx.status_trx = 'DIBATALKAN';
      trx.void_reason = alasan;
      trx.void_by = currentUser;
      trx.void_at = new Date().toLocaleString('sv-SE');

      saveToStore(STORAGE_KEYS.TRANSACTIONS_IN, allTrx);
      logAudit(currentUser, `VOID Transaksi Masuk ${id_trx}: ${alasan}`);

      const cfg = this.getConfig();
      if (cfg.mode === 'gas') {
        callGasApi('voidPayment', { id_trx, currentUser, alasan }).catch(console.error);
      }

      return { success: true, transaction: trx };
    },
    incrementIncomeReprint: function(id_trx) {
      const allTrx = this.getIncomeTransactions();
      const trx = allTrx.find(t => t.id_trx === id_trx || t.batch_id === id_trx);
      if (trx) {
        trx.reprint_count = (trx.reprint_count || 0) + 1;
        saveToStore(STORAGE_KEYS.TRANSACTIONS_IN, allTrx);
        return trx.reprint_count;
      }
      return 0;
    },

    // Transactions OUT (Kas Keluar / BKK)
    getExpenseTransactions: function() {
      return getFromStore(STORAGE_KEYS.TRANSACTIONS_OUT);
    },
    addExpenseTransaction: function({ kategori, nominal, keterangan, penerima, userInput }) {
      const allExpenses = this.getExpenseTransactions();
      const nowStr = new Date().toLocaleString('sv-SE');
      const bkkId = 'BKK-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' + Math.floor(1000 + Math.random() * 9000);

      const record = {
        id_out: bkkId,
        waktu: nowStr,
        kategori: kategori,
        nominal: Number(nominal),
        keterangan: keterangan,
        penerima: penerima,
        user_input: userInput || 'operator',
        status_trx: 'VALID',
        reprint_count: 0
      };

      allExpenses.unshift(record);
      saveToStore(STORAGE_KEYS.TRANSACTIONS_OUT, allExpenses);
      logAudit(userInput, `Kas Keluar ${bkkId}: Rp ${nominal} untuk ${penerima} (${kategori})`);

      const cfg = this.getConfig();
      if (cfg.mode === 'gas') {
        callGasApi('addExpense', { kategori, nominal, keterangan, penerima, userInput }).catch(console.error);
      }

      return record;
    },
    voidExpenseTransaction: function(id_out, currentUser, alasan = '') {
      const allExpenses = this.getExpenseTransactions();
      const exp = allExpenses.find(e => e.id_out === id_out);
      if (!exp) return { success: false, message: 'BKK tidak ditemukan' };
      if (exp.status_trx === 'DIBATALKAN') return { success: false, message: 'BKK sudah dibatalkan sebelumnya' };

      exp.status_trx = 'DIBATALKAN';
      exp.void_reason = alasan;
      exp.void_by = currentUser;
      exp.void_at = new Date().toLocaleString('sv-SE');

      saveToStore(STORAGE_KEYS.TRANSACTIONS_OUT, allExpenses);
      logAudit(currentUser, `VOID BKK ${id_out}: ${alasan}`);

      const cfg = this.getConfig();
      if (cfg.mode === 'gas') {
        callGasApi('voidExpense', { id_out, currentUser, alasan }).catch(console.error);
      }

      return { success: true, expense: exp };
    },
    incrementExpenseReprint: function(id_out) {
      const allExpenses = this.getExpenseTransactions();
      const exp = allExpenses.find(e => e.id_out === id_out);
      if (exp) {
        exp.reprint_count = (exp.reprint_count || 0) + 1;
        saveToStore(STORAGE_KEYS.TRANSACTIONS_OUT, allExpenses);
        return exp.reprint_count;
      }
      return 0;
    },

    // Setoran ke Pimpinan (Cash Deposit Bundling)
    getSetoranList: function() {
      return getFromStore(STORAGE_KEYS.SETORAN);
    },
    getUnsettledCashTransactions: function() {
      const allIn = this.getIncomeTransactions();
      return allIn.filter(t => 
        t.status_trx === 'VALID' && 
        t.metode === 'Kas Tunai' && 
        (!t.kode_setoran || t.kode_setoran.trim() === '')
      );
    },
    createSetoran: function({ trxIds, petugas, penerima, keterangan }) {
      const allIn = this.getIncomeTransactions();
      const setoranList = this.getSetoranList();
      const nowStr = new Date().toLocaleString('sv-SE');
      const kodeSetoran = 'STR-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' + Math.floor(100 + Math.random() * 900);

      let totalNominal = 0;
      let count = 0;

      allIn.forEach(t => {
        if (trxIds.includes(t.id_trx)) {
          t.kode_setoran = kodeSetoran;
          totalNominal += Number(t.nominal_bayar || 0);
          count++;
        }
      });

      const setoranRecord = {
        kode_setoran: kodeSetoran,
        waktu: nowStr,
        total_nominal: totalNominal,
        jumlah_trx: count,
        petugas: petugas,
        penerima: penerima,
        keterangan: keterangan || 'Setoran penerimaan kas tunai ke pimpinan',
        trx_ids: trxIds
      };

      setoranList.unshift(setoranRecord);
      saveToStore(STORAGE_KEYS.TRANSACTIONS_IN, allIn);
      saveToStore(STORAGE_KEYS.SETORAN, setoranList);
      logAudit(petugas, `Buat Setoran ${kodeSetoran}: Total Rp ${totalNominal} (${count} transaksi)`);

      const cfg = this.getConfig();
      if (cfg.mode === 'gas') {
        callGasApi('createSetoran', { trxIds, petugas, penerima, keterangan }).catch(console.error);
      }

      return setoranRecord;
    },

    // Calculations & Reporting Helpers
    getDailyCashSummary: function(dateStr) {
      // dateStr in YYYY-MM-DD format (default today)
      const targetDate = dateStr || new Date().toISOString().slice(0,10);
      const allIn = this.getIncomeTransactions();
      const allOut = this.getExpenseTransactions();

      let cashIn = 0;
      let transferIn = 0;
      let pipIn = 0;
      let totalExpense = 0;

      allIn.forEach(t => {
        if (t.status_trx !== 'VALID') return;
        if (t.waktu.startsWith(targetDate)) {
          const nom = Number(t.nominal_bayar || 0);
          if (t.metode === 'Kas Tunai') cashIn += nom;
          else if (t.metode === 'Transfer') transferIn += nom;
          else if (t.metode === 'PIP / Bantuan') pipIn += nom;
        }
      });

      allOut.forEach(e => {
        if (e.status_trx !== 'VALID') return;
        if (e.waktu.startsWith(targetDate)) {
          totalExpense += Number(e.nominal || 0);
        }
      });

      const netCashDrawer = cashIn - totalExpense;

      return {
        date: targetDate,
        cashIn,
        transferIn,
        pipIn,
        totalIn: cashIn + transferIn + pipIn,
        totalExpense,
        netCashDrawer
      };
    },

    // Buku Kas Umum (BKU Ledger)
    getBkuLedger: function(startDate, endDate) {
      const allIn = this.getIncomeTransactions().filter(t => t.status_trx === 'VALID');
      const allOut = this.getExpenseTransactions().filter(e => e.status_trx === 'VALID');
      const students = this.getStudents();
      const studentBills = this.getStudentBills();
      const masterBills = this.getMasterBills();

      const ledgerItems = [];

      allIn.forEach(t => {
        const bill = studentBills.find(b => b.id_tagihan === t.id_tagihan) || {};
        const student = students.find(s => String(s.nis) === String(bill.nis)) || { nama: 'Siswa', nis: bill.nis };
        const master = masterBills.find(m => m.id_jenis === bill.id_jenis) || { nama_tagihan: bill.id_jenis };

        ledgerItems.push({
          waktu: t.waktu,
          bukti: t.id_trx,
          uraian: `Penerimaan ${master.nama_tagihan} an. ${student.nama} (${student.nis}) - [${t.metode}]`,
          debit: Number(t.nominal_bayar),
          kredit: 0,
          kategori: 'Penerimaan Siswa',
          type: 'IN'
        });
      });

      allOut.forEach(e => {
        ledgerItems.push({
          waktu: e.waktu,
          bukti: e.id_out,
          uraian: `Pengeluaran [${e.kategori}]: ${e.keterangan} (Penerima: ${e.penerima})`,
          debit: 0,
          kredit: Number(e.nominal),
          kategori: e.kategori,
          type: 'OUT'
        });
      });

      // Sort chronologically ascending
      ledgerItems.sort((a, b) => new Date(a.waktu) - new Date(b.waktu));

      // Calculate running balance
      let runningBalance = 0;
      const ledgerWithBalance = ledgerItems.map(item => {
        runningBalance += (item.debit - item.kredit);
        return {
          ...item,
          saldo: runningBalance
        };
      });

      // Filter by date if requested
      if (startDate && endDate) {
        return ledgerWithBalance.filter(i => {
          const d = i.waktu.slice(0, 10);
          return d >= startDate && d <= endDate;
        });
      }

      return ledgerWithBalance;
    },

    // Total Piutang Sekolah & Rekapitulasi Tunggakan
    getReceivablesReport: function() {
      const students = this.getStudents();
      const allBills = this.getStudentBills();
      const allTrx = this.getIncomeTransactions().filter(t => t.status_trx === 'VALID');

      let totalDibebankan = 0;
      let totalTerbayar = 0;
      let totalTunggakan = 0;

      const studentSummary = students.map(st => {
        const studentBills = allBills.filter(b => String(b.nis) === String(st.nis));
        let studentBeban = 0;
        let studentBayar = 0;

        studentBills.forEach(b => {
          studentBeban += Number(b.nominal_dibebankan || 0);
          const paidForThisBill = allTrx
            .filter(t => t.id_tagihan === b.id_tagihan)
            .reduce((sum, t) => sum + Number(t.nominal_bayar || 0), 0);
          studentBayar += paidForThisBill;
        });

        const tunggakan = Math.max(0, studentBeban - studentBayar);

        totalDibebankan += studentBeban;
        totalTerbayar += studentBayar;
        totalTunggakan += tunggakan;

        return {
          nis: st.nis,
          nama: st.nama,
          kelas: st.kelas,
          angkatan: st.angkatan,
          status: st.status,
          total_beban: studentBeban,
          total_bayar: studentBayar,
          tunggakan: tunggakan,
          status_keuangan: tunggakan === 0 ? 'LUNAS' : (studentBayar > 0 ? 'SEBAGIAN' : 'MENUNGGAK')
        };
      });

      return {
        totalDibebankan,
        totalTerbayar,
        totalTunggakan,
        students: studentSummary
      };
    },

    // Audit Logs
    getAuditLogs: function() {
      return getFromStore(STORAGE_KEYS.AUDIT_LOGS);
    },

    // Backup & Restore
    exportAllData: function() {
      const dump = {};
      Object.keys(STORAGE_KEYS).forEach(k => {
        dump[STORAGE_KEYS[k]] = getFromStore(STORAGE_KEYS[k]);
      });
      return JSON.stringify(dump, null, 2);
    },
    importAllData: function(jsonString) {
      try {
        const parsed = JSON.parse(jsonString);
        Object.keys(parsed).forEach(k => {
          localStorage.setItem(k, JSON.stringify(parsed[k]));
        });
        return { success: true };
      } catch (e) {
        return { success: false, message: e.message };
      }
    }
  };
})();

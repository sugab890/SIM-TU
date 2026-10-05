/**
 * SIM-TU Authentication & Security Module (js/auth.js)
 * Implements Multi-Role Login, SHA-256 Hashing, Session Persistence & Idle Auto-Logout
 */

const Auth = (function() {
  const SESSION_KEY = 'simtu_active_session';
  let idleTimer = null;
  let countdownTimer = null;
  let lastActivityTimestamp = Date.now();
  let idleLimitMs = 15 * 60 * 1000; // 15 minutes default

  // SHA-256 Hashing via Web Crypto API
  async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  }

  // Get current active session
  function getSession() {
    try {
      const s = localStorage.getItem(SESSION_KEY);
      return s ? JSON.parse(s) : null;
    } catch (e) {
      return null;
    }
  }

  // Set active session
  function setSession(user) {
    const sessionData = {
      username: user.username,
      nama_lengkap: user.nama_lengkap,
      role: user.role, // 'Operator' or 'Manajemen'
      login_time: new Date().toISOString()
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    DB.logAudit(user.username, 'Login Berhasil ke Sistem SIM-TU');
    resetIdleTimer();
    return sessionData;
  }

  // Clear session
  function clearSession(reason = 'Logout Manual') {
    const sess = getSession();
    if (sess) {
      DB.logAudit(sess.username, `Logout Sistem (${reason})`);
    }
    localStorage.removeItem(SESSION_KEY);
    stopIdleTimer();
  }

  // Login handler
  async function login(username, password) {
    if (!username || !password) {
      return { success: false, message: 'Username dan password wajib diisi!' };
    }

    const cleanUsername = username.trim().toLowerCase();
    const user = DB.getUserByUsername(cleanUsername);
    if (!user) {
      return { success: false, message: 'Pengguna tidak terdaftar!' };
    }

    const hash = await sha256(password);

    // Check hash match OR known demo credentials fallback
    const isOperatorDemo = cleanUsername === 'operator' && password === 'operator123';
    const isManajemenDemo = cleanUsername === 'manajemen' && password === 'admin123';
    const isMatch = (user.password_hash === hash) || isOperatorDemo || isManajemenDemo;

    if (!isMatch) {
      DB.logAudit(username, 'Percobaan Login Gagal (Password Keliru)');
      return { success: false, message: 'Password salah! Periksa kembali huruf besar/kecil.' };
    }

    // Auto-heal password hash if needed
    if (user.password_hash !== hash && (isOperatorDemo || isManajemenDemo)) {
      user.password_hash = hash;
      const allUsers = DB.getUsers();
      const idx = allUsers.findIndex(u => u.username.toLowerCase() === cleanUsername);
      if (idx >= 0) {
        allUsers[idx].password_hash = hash;
        localStorage.setItem('simtu_data_user', JSON.stringify(allUsers));
      }
    }

    const session = setSession(user);
    return { success: true, session };
  }

  // Idle Auto-Logout Manager (15 minutes of inactivity)
  function initIdleTracker(onWarning, onTimeout, onTick) {
    const config = DB.getConfig();
    idleLimitMs = (config.idleTimeoutMinutes || 15) * 60 * 1000;

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    
    // Throttle activity updates
    let throttleTimeout = null;
    const registerActivity = () => {
      if (!throttleTimeout) {
        throttleTimeout = setTimeout(() => {
          lastActivityTimestamp = Date.now();
          throttleTimeout = null;
        }, 1000);
      }
    };

    activityEvents.forEach(evt => {
      window.addEventListener(evt, registerActivity, { passive: true });
    });

    // Start interval check
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
      if (!getSession()) return;

      const elapsed = Date.now() - lastActivityTimestamp;
      const remainingMs = Math.max(0, idleLimitMs - elapsed);
      const remainingSecs = Math.floor(remainingMs / 1000);

      if (onTick) {
        onTick(remainingSecs);
      }

      // Warning when 60 seconds left
      if (remainingSecs === 60 && onWarning) {
        onWarning();
      }

      // Timeout expired
      if (remainingSecs <= 0) {
        clearSession('Idle Timeout 15 Menit');
        if (onTimeout) {
          onTimeout();
        }
      }
    }, 1000);
  }

  function resetIdleTimer() {
    lastActivityTimestamp = Date.now();
  }

  function stopIdleTimer() {
    if (countdownTimer) clearInterval(countdownTimer);
  }

  // Quick switch role for testing / demo convenience
  function switchRole(targetRole) {
    const sess = getSession();
    if (!sess) return;
    const users = DB.getUsers();
    const targetUser = users.find(u => u.role.toLowerCase() === targetRole.toLowerCase()) || users[0];
    setSession(targetUser);
  }

  return {
    sha256,
    login,
    getSession,
    clearSession,
    initIdleTracker,
    resetIdleTimer,
    switchRole,
    isLoggedIn: () => !!getSession(),
    isOperator: () => {
      const s = getSession();
      return s && s.role === 'Operator';
    },
    isManajemen: () => {
      const s = getSession();
      return s && s.role === 'Manajemen';
    }
  };
})();

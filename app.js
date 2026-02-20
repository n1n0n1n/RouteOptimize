/* ==================== STATE ==================== */
let currentScreen = 'login';
let loginMode = 'driver'; // 'driver' or 'admin'

const screens = ['login', 'home', 'packages', 'navigate', 'settings'];

/* ==================== SCREEN NAVIGATION ==================== */

/**
 * Navigate to a named screen with a slide transition.
 * Direction is inferred from screen order.
 * @param {string} name - Screen ID suffix (e.g. 'home', 'packages')
 */
function goTo(name) {
  const prev = document.getElementById('screen-' + currentScreen);
  const next = document.getElementById('screen-' + name);

  if (!next || name === currentScreen) return;

  const prevIndex = screens.indexOf(currentScreen);
  const nextIndex = screens.indexOf(name);
  const goingForward = nextIndex >= prevIndex;

  // Slide previous screen out
  prev.classList.add(goingForward ? 'slide-left' : 'hidden');
  prev.classList.remove(goingForward ? 'hidden' : 'slide-left');

  // Bring next screen in
  next.classList.remove('hidden', 'slide-left');

  currentScreen = name;

  // Reset scroll position
  const scrollEl = next.querySelector('.scroll');
  if (scrollEl) scrollEl.scrollTop = 0;
}

/* ==================== LOGIN ==================== */

/**
 * Switch between Driver and Admin login modes.
 * Updates toggle buttons, sign-in label, and pre-fills email.
 * @param {string} mode - 'driver' or 'admin'
 */
function setLoginMode(mode) {
  loginMode = mode;

  document.getElementById('driver-toggle').classList.toggle('active', mode === 'driver');
  document.getElementById('admin-toggle').classList.toggle('active', mode === 'admin');

  document.getElementById('sign-btn-label').textContent =
    mode === 'driver' ? 'Sign In as Driver' : 'Sign In as Admin';

  document.getElementById('login-email').value =
    mode === 'driver' ? 'john.driver@example.com' : 'admin@routeoptimize.com';

  checkLoginBtn();
}

/**
 * Enable or disable the Sign In button based on field values.
 */
function checkLoginBtn() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-pw').value.trim();
  document.getElementById('sign-btn').disabled = !(email && password);
}

/**
 * Simulate credential validation and redirect to the correct dashboard.
 * Populates role-specific content in Home and Settings screens.
 */
function doLogin() {
  const btn = document.getElementById('sign-btn');
  btn.style.opacity = '0.6';
  btn.style.pointerEvents = 'none';
  document.getElementById('sign-btn-label').textContent = 'Signing in...';

  setTimeout(() => {
    btn.style.opacity = '';
    btn.style.pointerEvents = '';

    if (loginMode === 'admin') {
      // Populate admin view
      document.getElementById('home-greeting').textContent  = 'Welcome back,';
      document.getElementById('home-name').textContent      = 'Admin User';
      document.getElementById('home-avatar').textContent    = 'AU';
      document.getElementById('admin-home-banner').style.display = 'block';
      document.getElementById('driver-stats').style.display      = 'none';
      document.getElementById('settings-name').textContent    = 'Admin User';
      document.getElementById('settings-email').textContent   = 'admin@routeoptimize.com';
      document.getElementById('settings-driverid').textContent = 'Admin · Fleet Manager';
      document.getElementById('settings-avatar').textContent  = 'AU';
    } else {
      // Populate driver view
      document.getElementById('home-greeting').textContent  = 'Good morning,';
      document.getElementById('home-name').textContent      = 'John Driver';
      document.getElementById('home-avatar').textContent    = 'JD';
      document.getElementById('admin-home-banner').style.display = 'none';
      document.getElementById('driver-stats').style.display      = 'grid';
      document.getElementById('settings-name').textContent    = 'John Driver';
      document.getElementById('settings-email').textContent   = 'john.driver@example.com';
      document.getElementById('settings-driverid').textContent = 'Driver ID: DRV-2026-456';
      document.getElementById('settings-avatar').textContent  = 'JD';
    }

    document.getElementById('sign-btn-label').textContent =
      loginMode === 'driver' ? 'Sign In as Driver' : 'Sign In as Admin';

    goTo('home');
  }, 900);
}

/**
 * Log the current user out and return to the Login screen.
 */
function doLogout() {
  if (confirm('Log out of RouteOptimize?')) {
    setLoginMode('driver');
    goTo('login');
  }
}

/* ==================== PACKAGES ==================== */

/**
 * Switch the active package tab and filter visible cards by status.
 * @param {string} tab  - 'active' | 'pending' | 'completed'
 * @param {HTMLElement} btn - The tab button that was clicked
 */
function setPkgTab(tab, btn) {
  document.querySelectorAll('.pkg-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');

  document.querySelectorAll('.pkg-card').forEach(card => {
    if (tab === 'active') {
      card.style.display = card.dataset.status === 'active' ? 'block' : 'none';
    } else if (tab === 'pending') {
      card.style.display = card.dataset.status === 'pending' ? 'block' : 'none';
    } else {
      // 'completed' tab — no completed cards in demo
      card.style.display = 'none';
    }
  });
}

/**
 * Toggle the expanded detail panel on a package card.
 * @param {HTMLElement} card - The package card element
 */
function togglePkg(card) {
  card.classList.toggle('open');
}

/**
 * Live-filter package cards by tracking number or address text.
 * @param {string} val - Current search input value
 */
function filterPkgs(val) {
  const query = val.toLowerCase();
  document.querySelectorAll('.pkg-card').forEach(card => {
    const text = card.textContent.toLowerCase();
    card.style.display = text.includes(query) ? 'block' : 'none';
  });
}

/* ==================== SETTINGS ==================== */

/**
 * Toggle an on/off setting switch within a setting row.
 * @param {HTMLElement} row - The setting row element containing a .toggle
 */
function toggleSetting(row) {
  const toggle = row.querySelector('.toggle');
  if (toggle) toggle.classList.toggle('on');
}

/**
 * Toggle the Dark Mode setting switch.
 * (Extend this function to swap CSS variables for a full theme change.)
 * @param {HTMLElement} row - The dark mode setting row
 */
function toggleDarkMode(row) {
  const toggle = row.querySelector('.toggle');
  if (toggle) toggle.classList.toggle('on');
}

/* ==================== NAVIGATION SCREEN ==================== */

/**
 * Mark the current stop as arrived.
 * Shows confirmation feedback on the button, then resets.
 */
function arrivalAlert() {
  const btn = document.querySelector('.nav-btn-arrived');
  btn.innerHTML = '✓ Marked Arrived!';
  btn.style.background = '#00a37a';

  setTimeout(() => {
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2.5">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      Arrived`;
    btn.style.background = '';
  }, 2000);
}

/* ==================== INIT ==================== */
checkLoginBtn();

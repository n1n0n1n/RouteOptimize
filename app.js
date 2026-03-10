// RouteOptimize — Static / GitHub Pages version
// No Node.js backend required.

const DEMO_USERS = {
  'admin@demo.com': { email: 'admin@demo.com', role: 'admin', name: 'Admin Master',  password: 'password123' },
  'user@demo.com':  { email: 'user@demo.com',  role: 'user',  name: 'Standard User', password: 'password123' }
};

let currentUser   = null;
let map, directionsService;
let vehicleMarker = null;
let currentRoutePath = [];
let trackingInterval = null;
let deliveryHistory  = [];
let mapsApiReady     = false;

// All drawn polylines + markers tracked here for easy cleanup
let drawnPolylines = [];

/* ─────────────────────────────────────────
   MAP INIT
───────────────────────────────────────── */
function onMapsReady() {
  mapsApiReady = true;
  if (document.getElementById('screen-dashboard').classList.contains('active')) {
    initGoogleMap();
  }
}

function initGoogleMap() {
  if (map) {
    google.maps.event.trigger(map, 'resize');
    map.setCenter({ lat: 14.6091, lng: 121.0223 });
    return;
  }
  if (!mapsApiReady) return;

  const mapEl = document.getElementById('map');
  if (!mapEl) return;

  map = new google.maps.Map(mapEl, {
    zoom: 12,
    center: { lat: 14.6091, lng: 121.0223 },
    disableDefaultUI: true,
    zoomControl: true,
    gestureHandling: 'greedy',
    // Slightly muted style so colored route lines pop
    styles: [
      { featureType: 'road', elementType: 'geometry',
        stylers: [{ color: '#f0f0f0' }] },
      { featureType: 'road.highway', elementType: 'geometry',
        stylers: [{ color: '#e0e0e0' }] },
      { featureType: 'poi', stylers: [{ visibility: 'off' }] },
      { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    ],
  });

  directionsService = new google.maps.DirectionsService();
  // NOTE: No TrafficLayer — we color only our route lines, not every road
  setTimeout(() => google.maps.event.trigger(map, 'resize'), 300);
}

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */
function clearAllRoutes() {
  drawnPolylines.forEach(p => p.setMap(null));
  drawnPolylines = [];
  if (vehicleMarker) { vehicleMarker.setMap(null); vehicleMarker = null; }
  clearInterval(trackingInterval);
  currentRoutePath = [];
}

function addPolyline(path, color, weight, opacity, zIndex) {
  const p = new google.maps.Polyline({
    path, strokeColor: color, strokeWeight: weight,
    strokeOpacity: opacity, zIndex, map,
  });
  drawnPolylines.push(p);
  return p;
}

/* ─────────────────────────────────────────
   DRAW ALTERNATIVE ROUTE  — solid grey
───────────────────────────────────────── */
function drawAlternativeRoute(route, altMins) {
  const path = route.overview_path;
  // White halo for contrast against map, then grey line on top
  addPolyline(path, '#ffffff', 9,  0.7, 1);
  addPolyline(path, '#b0b8c4', 6, 0.65, 2);

  // Duration chip at the midpoint of the alternative
  const mid = path[Math.floor(path.length / 2)];
  const chip = new google.maps.Marker({
    position: mid, map, zIndex: 3,
    icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0 },
    label: {
      text: `${altMins} min`,
      color: '#687076',
      fontSize: '11px',
      fontWeight: '700',
    },
  });
  drawnPolylines.push(chip);
}

/* ─────────────────────────────────────────
   DRAW MAIN ROUTE
   Colors the entire route one color based on
   the overall traffic delay ratio — the only
   traffic data the Directions API actually
   provides. Per-street coloring is not
   possible without Google's internal data feed.

   Ratio thresholds:
     < 1.15  → blue   (clear / minor delay)
     1.15–1.4 → orange (moderate traffic)
     > 1.4   → red    (heavy traffic)
───────────────────────────────────────── */
function drawMainRoute(route) {
  const totalNormal  = route.legs.reduce((s, l) => s + l.duration.value, 0);
  const totalTraffic = route.legs.reduce((s, l) =>
    s + (l.duration_in_traffic ? l.duration_in_traffic.value : l.duration.value), 0);
  const ratio = totalNormal > 0 ? totalTraffic / totalNormal : 1;

  const color = ratio >= 1.4  ? '#e03131'  // red    — heavy
              : ratio >= 1.15 ? '#f08c00'  // orange — moderate
              :                 '#3b82f6'; // blue   — clear

  // Collect full detailed path from steps for maximum resolution
  const path = [];
  route.legs.forEach(leg => {
    leg.steps.forEach(step => {
      if (step.lat_lngs && step.lat_lngs.length) {
        path.push(...step.lat_lngs);
      } else {
        path.push(step.start_location, step.end_location);
      }
    });
  });

  if (path.length < 2) return ratio;

  // White halo behind for contrast, colored line on top
  addPolyline(path, '#ffffff', 11, 0.6,  8);
  addPolyline(path, color,      7, 0.95, 9);

  return ratio;
}

/* ─────────────────────────────────────────
   PLACE START / END MARKERS
───────────────────────────────────────── */
function placeMarkers(route) {
  const start = route.legs[0].start_location;
  const end   = route.legs[route.legs.length - 1].end_location;

  [
    { pos: start, color: '#3b5bdb', label: 'A' },
    { pos: end,   color: '#1a7a2e', label: 'B' },
  ].forEach(({ pos, color, label }) => {
    const m = new google.maps.Marker({
      position: pos, map, zIndex: 20,
      label: { text: label, color: '#fff', fontWeight: 'bold', fontSize: '12px' },
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: color, fillOpacity: 1,
        strokeColor: '#fff', strokeWeight: 2.5,
        scale: 13,
      },
    });
    drawnPolylines.push(m);
  });
}

/* ─────────────────────────────────────────
   AUTH
───────────────────────────────────────── */
function doLogin() {
  const email    = document.getElementById('login-email').value.trim().toLowerCase();
  const password = document.getElementById('login-pw').value.trim();
  const user     = DEMO_USERS[email];
  if (user && user.password === password) {
    loginSuccess({ email: user.email, role: user.role, name: user.name });
  } else {
    alert('Login failed.\nTry: admin@demo.com / password123');
  }
}

function loginSuccess(user) {
  currentUser = user;
  document.getElementById('user-display-role').textContent = user.role.toUpperCase();
  document.getElementById('prof-fname').value  = user.name;
  document.getElementById('prof-email').value  = user.email;
  document.getElementById('screen-login').classList.remove('active');
  document.getElementById('screen-dashboard').classList.add('active');

  // Wait for the dashboard flex layout to paint, then init/resize the map
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      initGoogleMap();
    });
  });
}

function doLogout() {
  currentUser = null;
  document.getElementById('screen-dashboard').classList.remove('active');
  document.getElementById('screen-login').classList.add('active');
  resetForNewDelivery();
}

function doSSO() {
  const btn = document.querySelector('.btn-sso');
  const orig = btn.textContent;
  btn.textContent = 'Redirecting…';
  btn.disabled = true;
  setTimeout(() => {
    loginSuccess(DEMO_USERS['user@demo.com']);
    btn.textContent = orig;
    btn.disabled = false;
  }, 1500);
}

function doForgotPw() {
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const target = prompt('Enter email to reset:', email);
  if (target) alert(`If ${target} exists, a reset link has been sent.`);
}

/* ─────────────────────────────────────────
   UI
───────────────────────────────────────── */
function selectVehicle(el) {
  document.querySelectorAll('.vehicle-card').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
}

function addWaypoint() {
  const container = document.getElementById('waypoints-container');
  const div = document.createElement('div');
  div.className = 'stop waypoint-entry';
  div.innerHTML = `
    <span class="dot waypoint"></span>
    <input type="text" placeholder="Intermediate stop" class="wp-input"/>
    <button class="remove-wp" onclick="this.parentElement.remove()">×</button>
  `;
  container.appendChild(div);
}

/* Lock inputs after optimizing so user can't accidentally type mid-dispatch */
function lockRouteInputs() {
  document.getElementById('pickup-input').readOnly = true;
  document.getElementById('destination-input').readOnly = true;
  document.querySelectorAll('.wp-input').forEach(i => i.readOnly = true);
  document.getElementById('btn-add-wp').style.display = 'none';
  document.getElementById('btn-edit-route').style.display = 'inline-flex';
  document.querySelector('.stop-card').classList.add('locked');
}

function unlockRouteInputs() {
  document.getElementById('pickup-input').readOnly = false;
  document.getElementById('destination-input').readOnly = false;
  document.querySelectorAll('.wp-input').forEach(i => i.readOnly = false);
  document.getElementById('btn-add-wp').style.display = 'inline-block';
  document.getElementById('btn-edit-route').style.display = 'none';
  document.querySelector('.stop-card').classList.remove('locked');
}

/* Edit route — keep addresses, clear the drawn route, go back to optimize state */
function editRoute() {
  unlockRouteInputs();
  clearAllRoutes();

  document.getElementById('ai-results').style.display = 'none';
  document.getElementById('btn-new-delivery').style.display = 'none';
  document.getElementById('btn-dispatch').style.display = 'none';
  document.getElementById('btn-dispatch').textContent = '🚀 Dispatch & Track';
  document.getElementById('btn-dispatch').disabled = false;
  document.getElementById('btn-dispatch').style.background = '#1a7a2e';

  const aiBtn = document.getElementById('btn-ai');
  aiBtn.style.display = 'block';
  aiBtn.disabled = false;
  aiBtn.textContent = '✦ Optimize Route';

  document.getElementById('peek-sub').textContent = 'Tap to set your route';
  document.getElementById('pickup-input').focus();
}

function resetForNewDelivery() {
  unlockRouteInputs();
  clearAllRoutes();

  document.getElementById('ai-results').style.display = 'none';
  document.getElementById('btn-new-delivery').style.display = 'none';
  document.getElementById('btn-dispatch').style.display = 'none';
  document.getElementById('btn-dispatch').textContent = '🚀 Dispatch & Track';
  document.getElementById('btn-dispatch').disabled = false;
  document.getElementById('btn-dispatch').style.background = '#1a7a2e';

  const aiBtn = document.getElementById('btn-ai');
  aiBtn.style.display = 'block';
  aiBtn.disabled = false;
  aiBtn.textContent = '✦ Optimize Route';
  document.getElementById('ai-status-text').textContent = 'Route optimized!';
  document.getElementById('peek-sub').textContent = 'Tap to set your route';

  document.getElementById('waypoints-container').innerHTML = '';
  document.getElementById('pickup-input').value = '';
  document.getElementById('destination-input').value = '';

  if (map) map.setCenter({ lat: 14.6091, lng: 121.0223 });
}

/* ─────────────────────────────────────────
   HISTORY
───────────────────────────────────────── */
function renderHistory() {
  const container = document.getElementById('history-list');
  if (!deliveryHistory.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <p>No dispatch records yet.</p>
      </div>`;
    return;
  }
  container.innerHTML = [...deliveryHistory].reverse().map(r => `
    <div class="history-card">
      <div class="history-card-body">
        <div class="history-route">${r.pickup} → ${r.dropoff}</div>
        <div class="history-meta">${r.vehicle} · ${r.date}</div>
      </div>
      <div class="history-footer">
        <span class="badge-done">Completed</span>
        <span class="history-savings">${r.savings}</span>
      </div>
    </div>
  `).join('');
}

/* ─────────────────────────────────────────
   ROUTE OPTIMIZATION
───────────────────────────────────────── */
function optimizeRoute() {
  if (!directionsService) return;

  const btn     = document.getElementById('btn-ai');
  const pickup  = document.getElementById('pickup-input').value.trim();
  const dropoff = document.getElementById('destination-input').value.trim();

  if (!pickup || !dropoff) {
    alert('Please enter both a pickup and drop-off location.');
    return;
  }

  btn.textContent = '⏳ Computing…';
  btn.disabled = true;
  clearAllRoutes();

  const waypoints = Array.from(document.querySelectorAll('.wp-input'))
    .map(i => i.value.trim()).filter(Boolean)
    .map(loc => ({ location: loc, stopover: true }));

  directionsService.route({
    origin: pickup, destination: dropoff, waypoints,
    optimizeWaypoints: true,
    travelMode: google.maps.TravelMode.DRIVING,
    provideRouteAlternatives: true,
    drivingOptions: {
      departureTime: new Date(),
      trafficModel: google.maps.TrafficModel.BEST_GUESS,
    },
  }, (response, status) => {
    if (status !== 'OK') {
      alert('Directions failed: ' + status);
      btn.textContent = '✦ Optimize Route';
      btn.disabled = false;
      return;
    }

    btn.textContent = '⏳ Analyzing traffic…';

    setTimeout(() => {
      const routes = response.routes;

      // ── 1. Pick the fastest route by traffic-aware total duration ──
      let mainIdx   = 0;
      let mainSecs  = Infinity;
      routes.forEach((r, i) => {
        const secs = r.legs.reduce((s, l) =>
          s + (l.duration_in_traffic ? l.duration_in_traffic.value : l.duration.value), 0);
        if (secs < mainSecs) { mainSecs = secs; mainIdx = i; }
      });

      // Pick up to 2 alternatives (every route that isn't the main)
      const altRoutes = routes
        .map((r, i) => ({ r, i }))
        .filter(({ i }) => i !== mainIdx)
        .slice(0, 2);

      // ── 2. Draw alternatives first (grey, behind main route) ──
      altRoutes.forEach(({ r: altRoute }) => {
        const altSecs = altRoute.legs.reduce((s, l) =>
          s + (l.duration_in_traffic ? l.duration_in_traffic.value : l.duration.value), 0);
        drawAlternativeRoute(altRoute, Math.round(altSecs / 60));
      });

      // ── 3. Draw main route on top with per-step traffic colors ──
      const mainRoute    = routes[mainIdx];
      const overallRatio = drawMainRoute(mainRoute);

      // Build flat step path for vehicle animation (higher resolution than overview_path)
      currentRoutePath = [];
      mainRoute.legs.forEach(leg => {
        leg.steps.forEach(step => {
          if (step.lat_lngs && step.lat_lngs.length) {
            currentRoutePath.push(...step.lat_lngs);
          } else {
            currentRoutePath.push(step.start_location, step.end_location);
          }
        });
      });
      // Fallback to overview_path if steps gave nothing
      if (!currentRoutePath.length) currentRoutePath = mainRoute.overview_path;

      // ── 4. Place A / B markers on top of everything ──
      placeMarkers(mainRoute);

      // ── 5. Fit map bounds to show both routes ──
      const bounds = new google.maps.LatLngBounds();
      routes.forEach(r => r.overview_path.forEach(p => bounds.extend(p)));
      map.fitBounds(bounds, { top: 60, bottom: 220, left: 24, right: 24 });

      // ── 6. Update panel UI ──
      const trafficMins = Math.round(mainSecs / 60);
      const normalMins  = Math.round(
        mainRoute.legs.reduce((s, l) => s + l.duration.value, 0) / 60);
      const savedMins   = Math.max(0, normalMins - trafficMins);
      const distKm      = (
        mainRoute.legs.reduce((s, l) => s + l.distance.value, 0) / 1000).toFixed(1);

      const trafficLabel =
        overallRatio >= 1.35 ? '🔴 Heavy traffic on route'
        : overallRatio >= 1.12 ? '🟠 Moderate traffic on route'
        : '🔵 Route is clear';

      btn.style.display = 'none';
      document.getElementById('btn-dispatch').style.display = 'block';
      document.getElementById('ai-results').style.display   = 'block';
      lockRouteInputs();

      document.getElementById('time-saved').textContent =
        savedMins > 0 ? `⏱ ${savedMins} min faster` : `⏱ ${trafficMins} min`;
      document.getElementById('gas-saved').textContent  = `📍 ${distKm} km`;
      document.getElementById('ai-message').textContent =
        `${trafficLabel}. ${altRoutes.length > 0 ? `${altRoutes.length} alternative${altRoutes.length > 1 ? 's' : ''} shown in grey.` : ''}`;
      document.getElementById('peek-sub').textContent   =
        `${trafficMins} min · ${distKm} km`;

    }, 400);
  });
}

/* ─────────────────────────────────────────
   LIVE TRACKING
───────────────────────────────────────── */
function startLiveTracking() {
  const btn = document.getElementById('btn-dispatch');
  btn.textContent = '📍 En Route…';
  btn.disabled = true;
  if (!currentRoutePath.length) return;

  const totalSteps = currentRoutePath.length;
  const peekSub = document.getElementById('peek-sub');

  const activeCard = document.querySelector('.vehicle-card.active');
  const vType = activeCard ? activeCard.dataset.vehicle : 'Standard Van';
  const icon  = vType === 'Box Truck'
    ? 'https://maps.google.com/mapfiles/ms/icons/truck.png'
    : 'https://maps.google.com/mapfiles/ms/icons/cabs.png';

  if (vehicleMarker) { vehicleMarker.setMap(null); vehicleMarker = null; }
  vehicleMarker = new google.maps.Marker({
    position: currentRoutePath[0], map, icon, title: 'Delivery Vehicle'
  });

  let step = 0;
  trackingInterval = setInterval(() => {
    step += 2;

    // Live progress in peek bar
    const pct = Math.min(100, Math.round((step / totalSteps) * 100));
    peekSub.textContent = `En route · ${pct}% complete`;

    if (step >= currentRoutePath.length) {
      clearInterval(trackingInterval);
      btn.textContent = '✅ Arrived';
      btn.style.background = '#4b5563';
      document.getElementById('ai-status-text').textContent = 'Delivery complete!';
      document.getElementById('btn-new-delivery').style.display = 'block';
      peekSub.textContent = 'Delivered ✓';

      deliveryHistory.push({
        pickup:  document.getElementById('pickup-input').value,
        dropoff: document.getElementById('destination-input').value,
        vehicle: vType,
        savings: document.getElementById('time-saved').textContent,
        date: new Date().toLocaleString()
      });
      return;
    }
    vehicleMarker.setPosition(currentRoutePath[step]);
  }, 150);
}

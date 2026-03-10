// RouteOptimize — Static / GitHub Pages version
// No Node.js backend required.

const DEMO_USERS = {
  'admin@demo.com': { email: 'admin@demo.com', role: 'admin', name: 'Admin Master',  password: 'password123' },
  'user@demo.com':  { email: 'user@demo.com',  role: 'user',  name: 'Standard User', password: 'password123' }
};

let currentUser   = null;
let map, directionsService;
let trafficLayer  = null;
let vehicleMarker = null;
let currentRoutePath = [];
let trackingInterval = null;
let deliveryHistory  = [];
let mapsApiReady     = false;

// Track all drawn polylines so we can clear them
let drawnPolylines = [];

/* ─────────────────────────────────────────
   MAP INIT — called by Google Maps callback
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
  });

  directionsService = new google.maps.DirectionsService();

  // Traffic Layer — same coloured overlay as Google Maps app
  // Red = heavy, Orange = moderate, Green = clear, Blue = unknown
  trafficLayer = new google.maps.TrafficLayer();
  trafficLayer.setMap(map);

  setTimeout(() => google.maps.event.trigger(map, 'resize'), 300);
}

/* ─────────────────────────────────────────
   CLEAR ALL DRAWN ROUTES
───────────────────────────────────────── */
function clearAllRoutes() {
  drawnPolylines.forEach(p => p.setMap(null));
  drawnPolylines = [];
  if (vehicleMarker) { vehicleMarker.setMap(null); vehicleMarker = null; }
  clearInterval(trackingInterval);
  currentRoutePath = [];
}

/* ─────────────────────────────────────────
   DRAW A ROUTE AS A PLAIN POLYLINE
   Used for alternative (greyed) routes
───────────────────────────────────────── */
function drawPolyline(path, color, weight, opacity, zIndex) {
  const poly = new google.maps.Polyline({
    path,
    strokeColor: color,
    strokeWeight: weight,
    strokeOpacity: opacity,
    zIndex,
    map,
  });
  drawnPolylines.push(poly);
  return poly;
}

/* ─────────────────────────────────────────
   DRAW THE OPTIMAL ROUTE WITH TRAFFIC COLORS
   Segments the overview_path and colors each
   chunk based on traffic speed ratio.
   The TrafficLayer already shows colors on the
   map tiles — this draws the route LINE on top
   with matching traffic-aware colors.
───────────────────────────────────────── */
function drawTrafficColoredRoute(route) {
  const path = route.overview_path;
  if (!path || path.length < 2) return;

  const normalSecs  = route.legs.reduce((s, l) => s + l.duration.value, 0);
  const trafficSecs = route.legs.reduce((s, l) =>
    s + (l.duration_in_traffic ? l.duration_in_traffic.value : l.duration.value), 0);

  // Traffic ratio: how much slower than normal
  // > 1.4 = heavy (red), 1.15–1.4 = moderate (orange), else clear (blue/green)
  const ratio = normalSecs > 0 ? trafficSecs / normalSecs : 1;

  let routeColor, borderColor;
  if (ratio >= 1.4) {
    routeColor  = '#e03131'; // heavy — red
    borderColor = '#c92a2a';
  } else if (ratio >= 1.15) {
    routeColor  = '#f08c00'; // moderate — orange
    borderColor = '#e67700';
  } else {
    routeColor  = '#3b5bdb'; // clear — blue (optimal)
    borderColor = '#2f4ac2';
  }

  // White border underneath for contrast (like Google Maps)
  drawPolyline(path, '#ffffff', 10, 0.6, 9);
  // Coloured route on top
  drawPolyline(path, routeColor, 7, 0.95, 10);

  return { color: routeColor, ratio };
}

/* ─────────────────────────────────────────
   PLACE START / END MARKERS
───────────────────────────────────────── */
function placeMarkers(route) {
  const start = route.legs[0].start_location;
  const end   = route.legs[route.legs.length - 1].end_location;

  [
    { pos: start, color: '#3b5bdb', label: 'A' },
    { pos: end,   color: '#e03131', label: 'B' },
  ].forEach(({ pos, color, label }) => {
    const marker = new google.maps.Marker({
      position: pos,
      map,
      label: { text: label, color: '#fff', fontWeight: 'bold', fontSize: '12px' },
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: color,
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 2,
        scale: 12,
      },
      zIndex: 20,
    });
    drawnPolylines.push(marker); // store so we can clear
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
      trafficModel: google.maps.TrafficModel.BEST_GUESS
    }
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

      // ── 1. Find the fastest route by traffic-aware duration ──
      let fastestIdx = 0;
      let fastestSecs = Infinity;
      routes.forEach((route, i) => {
        const secs = route.legs.reduce((s, l) =>
          s + (l.duration_in_traffic ? l.duration_in_traffic.value : l.duration.value), 0);
        if (secs < fastestSecs) { fastestSecs = secs; fastestIdx = i; }
      });

      // ── 2. Draw all alternative routes FIRST (lower z-index, grey) ──
      routes.forEach((route, i) => {
        if (i === fastestIdx) return; // skip optimal — drawn last on top

        const altSecs   = route.legs.reduce((s, l) =>
          s + (l.duration_in_traffic ? l.duration_in_traffic.value : l.duration.value), 0);
        const altMins   = Math.round(altSecs / 60);
        const altDistKm = (route.legs.reduce((s, l) => s + l.distance.value, 0) / 1000).toFixed(1);

        // White border + grey line for alternatives
        drawPolyline(route.overview_path, '#ffffff', 8,  0.5, 1);
        drawPolyline(route.overview_path, '#9ca3af', 5,  0.55, 2);

        // Small info label at midpoint of the alternative
        const midPt = route.overview_path[Math.floor(route.overview_path.length / 2)];
        const infoMarker = new google.maps.Marker({
          position: midPt,
          map,
          zIndex: 3,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 0,
          },
          label: {
            text: `${altMins} min`,
            color: '#6b7280',
            fontSize: '11px',
            fontWeight: '600',
            className: 'route-label',
          },
        });
        drawnPolylines.push(infoMarker);
      });

      // ── 3. Draw the optimal route with traffic colors on top ──
      const fastRoute   = routes[fastestIdx];
      const trafficInfo = drawTrafficColoredRoute(fastRoute);
      currentRoutePath  = fastRoute.overview_path;

      // ── 4. Place A/B markers ──
      placeMarkers(fastRoute);

      // ── 5. Fit map to show all routes ──
      const bounds = new google.maps.LatLngBounds();
      routes.forEach(r => r.overview_path.forEach(p => bounds.extend(p)));
      map.fitBounds(bounds, { top: 60, bottom: 200, left: 20, right: 20 });

      // ── 6. Update UI ──
      const trafficMins = Math.round(fastestSecs / 60);
      const normalMins  = Math.round(
        fastRoute.legs.reduce((s, l) => s + l.duration.value, 0) / 60);
      const savedMins   = Math.max(0, normalMins - trafficMins);
      const distanceKm  = (
        fastRoute.legs.reduce((s, l) => s + l.distance.value, 0) / 1000).toFixed(1);

      const trafficRatio = trafficInfo ? trafficInfo.ratio : 1;
      const trafficLabel = trafficRatio >= 1.4 ? '🔴 Heavy traffic'
        : trafficRatio >= 1.15 ? '🟠 Moderate traffic'
        : '🔵 Clear route';

      btn.style.display = 'none';
      document.getElementById('btn-dispatch').style.display = 'block';
      document.getElementById('ai-results').style.display = 'block';
      lockRouteInputs();

      document.getElementById('time-saved').textContent =
        savedMins > 0 ? `⏱ ${savedMins} min saved` : `⏱ ${trafficMins} min`;
      document.getElementById('gas-saved').textContent = `📍 ${distanceKm} km`;
      document.getElementById('ai-message').textContent =
        `${trafficLabel}. ${routes.length > 1 ? `${routes.length} routes compared.` : ''} Optimal path selected.`;
      document.getElementById('peek-sub').textContent =
        `${trafficMins} min · ${distanceKm} km`;

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

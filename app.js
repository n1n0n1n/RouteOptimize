// RouteOptimize — Static / GitHub Pages version
// No Node.js backend required.

const DEMO_USERS = {
  'admin@demo.com': { email: 'admin@demo.com', role: 'admin', name: 'Admin Master',  password: 'password123' },
  'user@demo.com':  { email: 'user@demo.com',  role: 'user',  name: 'Standard User', password: 'password123' }
};

let currentUser   = null;
let map, directionsService, directionsRenderer, aiDirectionsRenderer;
let vehicleMarker = null;
let currentRoutePath = [];
let trackingInterval = null;
let deliveryHistory  = [];
let mapsApiReady     = false; // set to true once Google fires onMapsReady

/* ─────────────────────────────────────────
   MAP INIT — called by Google Maps callback
───────────────────────────────────────── */
function onMapsReady() {
  mapsApiReady = true;
  // If user already logged in before API finished loading, init now
  if (document.getElementById('screen-dashboard').classList.contains('active')) {
    initGoogleMap();
  }
}

function initGoogleMap() {
  if (map) {
    // Already created — just force a resize so it fills its container
    google.maps.event.trigger(map, 'resize');
    map.setCenter({ lat: 14.6091, lng: 121.0223 });
    return;
  }
  if (!mapsApiReady) return; // API not loaded yet, onMapsReady will call us

  const mapEl = document.getElementById('map');
  if (!mapEl) return;

  map = new google.maps.Map(mapEl, {
    zoom: 12,
    center: { lat: 14.6091, lng: 121.0223 },
    disableDefaultUI: true,
    zoomControl: true,
    gestureHandling: 'greedy', // better for mobile (one-finger pan)
  });

  directionsService = new google.maps.DirectionsService();

  directionsRenderer = new google.maps.DirectionsRenderer({
    map,
    suppressMarkers: false,
    polylineOptions: { strokeColor: '#9ca3af', strokeWeight: 4, strokeOpacity: 0.7 }
  });

  aiDirectionsRenderer = new google.maps.DirectionsRenderer({
    map,
    suppressMarkers: true,
    polylineOptions: { strokeColor: '#3b5bdb', strokeWeight: 6, strokeOpacity: 0.9 }
  });

  // Force another resize after a short delay to handle any layout settling
  setTimeout(() => google.maps.event.trigger(map, 'resize'), 300);
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

function resetForNewDelivery() {
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

  clearInterval(trackingInterval);
  if (vehicleMarker) vehicleMarker.setMap(null);
  if (directionsRenderer)   directionsRenderer.setDirections({ routes: [] });
  if (aiDirectionsRenderer) aiDirectionsRenderer.setDirections({ routes: [] });
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

  const btn    = document.getElementById('btn-ai');
  const pickup = document.getElementById('pickup-input').value.trim();
  const dropoff = document.getElementById('destination-input').value.trim();

  if (!pickup || !dropoff) {
    alert('Please enter both a pickup and drop-off location.');
    return;
  }

  btn.textContent = '⏳ Computing…';
  btn.disabled = true;
  clearInterval(trackingInterval);
  if (vehicleMarker) vehicleMarker.setMap(null);

  const waypoints = Array.from(document.querySelectorAll('.wp-input'))
    .map(i => i.value.trim()).filter(Boolean)
    .map(loc => ({ location: loc, stopover: true }));

  directionsService.route({
    origin: pickup, destination: dropoff, waypoints,
    optimizeWaypoints: true,
    travelMode: google.maps.TravelMode.DRIVING,
    provideRouteAlternatives: true
  }, (response, status) => {
    if (status !== 'OK') {
      alert('Directions failed: ' + status);
      btn.textContent = '✦ Optimize Route';
      btn.disabled = false;
      return;
    }

    directionsRenderer.setDirections(response);
    currentRoutePath = response.routes[0].overview_path;
    btn.textContent = '⏳ Analyzing alternatives…';

    setTimeout(() => {
      if (response.routes.length > 1) {
        const alt = Object.assign({}, response);
        alt.routes = [response.routes[1]];
        aiDirectionsRenderer.setDirections(alt);
        currentRoutePath = response.routes[1].overview_path;
      }

      btn.style.display = 'none';
      document.getElementById('btn-dispatch').style.display = 'block';
      document.getElementById('ai-results').style.display = 'block';

      const s = getMockSavings(dropoff);
      document.getElementById('time-saved').textContent = `⏱ ${s.time} saved`;
      document.getElementById('gas-saved').textContent  = `⛽ ${s.fuel} saved`;
      document.getElementById('ai-message').textContent = s.message;
      document.getElementById('peek-sub').textContent   = `${s.time} saved · ${s.fuel} fuel`;
    }, 1200);
  });
}

function getMockSavings(destination) {
  const mins = Math.floor(Math.random() * 16) + 10;
  const fuel = (Math.random() * 1.5 + 0.5).toFixed(1);
  return {
    time: `${mins} mins`,
    fuel: `${fuel} L`,
    message: `Heavy traffic detected on primary route to ${destination}. Re-routing via express lanes.`
  };
}

/* ─────────────────────────────────────────
   LIVE TRACKING
───────────────────────────────────────── */
function startLiveTracking() {
  const btn = document.getElementById('btn-dispatch');
  btn.textContent = '📍 En Route…';
  btn.disabled = true;
  if (!currentRoutePath.length) return;

  const activeCard = document.querySelector('.vehicle-card.active');
  const vType = activeCard ? activeCard.dataset.vehicle : 'Standard Van';
  const icon  = vType === 'Box Truck'
    ? 'https://maps.google.com/mapfiles/ms/icons/truck.png'
    : 'https://maps.google.com/mapfiles/ms/icons/cabs.png';

  if (vehicleMarker) vehicleMarker.setMap(null);
  vehicleMarker = new google.maps.Marker({
    position: currentRoutePath[0], map, icon, title: 'Delivery Vehicle'
  });

  let step = 0;
  trackingInterval = setInterval(() => {
    step += 2;
    if (step >= currentRoutePath.length) {
      clearInterval(trackingInterval);
      btn.textContent = '✅ Arrived';
      btn.style.background = '#4b5563';
      document.getElementById('ai-status-text').textContent = 'Delivery complete!';
      document.getElementById('btn-new-delivery').style.display = 'block';
      document.getElementById('peek-sub').textContent = 'Delivery completed';

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

// RouteOptimize - Static Version (No Node.js required)
// All backend logic is now handled client-side for GitHub Pages hosting

let currentUser = null;

// --- DEMO ACCOUNTS (replaces server.js /api/login) ---
const DEMO_USERS = {
  'admin@demo.com': { email: 'admin@demo.com', role: 'admin', name: 'Admin Master', password: 'password123' },
  'user@demo.com':  { email: 'user@demo.com',  role: 'user',  name: 'Standard User', password: 'password123' }
};

// --- GOOGLE MAPS & ROUTING VARIABLES ---
let map;
let directionsService;
let directionsRenderer;
let aiDirectionsRenderer;
let vehicleMarker = null;
let currentRoutePath = [];
let trackingInterval = null;
let deliveryHistory = [];

// --- INITIALIZATION ---
function initGoogleMap() {
  if (map) return;

  map = new google.maps.Map(document.getElementById("map"), {
    zoom: 12,
    center: { lat: 14.6091, lng: 121.0223 },
    disableDefaultUI: true,
    zoomControl: true,
  });

  directionsService = new google.maps.DirectionsService();

  directionsRenderer = new google.maps.DirectionsRenderer({
    map: map,
    suppressMarkers: false,
    polylineOptions: { strokeColor: "#9ca3af", strokeWeight: 4, strokeOpacity: 0.7 }
  });

  aiDirectionsRenderer = new google.maps.DirectionsRenderer({
    map: map,
    suppressMarkers: true,
    polylineOptions: { strokeColor: "#4f46e5", strokeWeight: 6, strokeOpacity: 0.9 }
  });
}

// --- AUTHENTICATION (now fully client-side) ---
function doLogin() {
  const email    = document.getElementById('login-email').value.trim().toLowerCase();
  const password = document.getElementById('login-pw').value.trim();

  const user = DEMO_USERS[email];

  if (user && user.password === password) {
    loginSuccess({ email: user.email, role: user.role, name: user.name });
  } else {
    alert('Login failed. Please use:\nEmail: admin@demo.com OR user@demo.com\nPass: password123');
  }
}

function loginSuccess(user) {
  currentUser = user;

  document.getElementById('user-display-role').textContent = currentUser.role.toUpperCase();
  document.getElementById('prof-fname').value  = currentUser.name;
  document.getElementById('prof-email').value  = currentUser.email;

  document.getElementById('screen-login').classList.remove('active');
  document.getElementById('screen-dashboard').classList.add('active');

  setTimeout(() => {
    initGoogleMap();
    if (map) google.maps.event.trigger(map, 'resize');
  }, 350);
}

function doLogout() {
  currentUser = null;
  document.getElementById('screen-dashboard').classList.remove('active');
  document.getElementById('screen-login').classList.add('active');
  resetForNewDelivery();
}

function doSSO() {
  const btn = document.querySelector('.btn-outline');
  const originalText = btn.textContent;
  btn.textContent = 'Redirecting to Provider...';
  btn.disabled = true;

  // Simulate SSO delay, then auto-login as demo user
  setTimeout(() => {
    loginSuccess(DEMO_USERS['user@demo.com']);
    btn.textContent = originalText;
    btn.disabled = false;
  }, 1500);
}

function doForgotPw() {
  const currentEmail = document.getElementById('login-email').value.trim().toLowerCase();
  const resetEmail = prompt("Enter email to reset password:", currentEmail);
  if (!resetEmail) return;
  // Client-side mock — always returns the same message
  alert(`If ${resetEmail.trim().toLowerCase()} exists, a reset link has been sent.`);
}

// --- UI INTERACTIONS ---
function switchTab(tabId, element) {
  document.querySelectorAll('.nav-links a').forEach(el => el.classList.remove('active'));
  element.classList.add('active');

  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));

  const targetTab = document.getElementById('tab-' + tabId);
  if (targetTab) {
    targetTab.classList.add('active');

    if (tabId === 'dispatch' && map) {
      setTimeout(() => {
        google.maps.event.trigger(map, 'resize');
        map.setCenter({ lat: 14.6091, lng: 121.0223 });
      }, 100);
    }

    if (tabId === 'records') renderHistory();
  }
}

function selectVehicle(el) {
  document.querySelectorAll('.vehicle-card').forEach(card => card.classList.remove('active'));
  el.classList.add('active');
}

function addWaypoint() {
  const container = document.getElementById('waypoints-container');
  const wpDiv = document.createElement('div');
  wpDiv.className = 'stop waypoint-entry';
  wpDiv.innerHTML = `
    <span class="dot waypoint"></span>
    <input type="text" placeholder="Intermediate stop (e.g. Pasig, Manila)" class="wp-input" />
    <button class="remove-wp" onclick="this.parentElement.remove()">×</button>
  `;
  container.appendChild(wpDiv);
}

function resetForNewDelivery() {
  document.getElementById('ai-results').style.display = 'none';
  document.getElementById('btn-new-delivery').style.display = 'none';
  document.getElementById('btn-dispatch').style.display = 'none';
  document.getElementById('btn-dispatch').textContent = '🚀 Dispatch & Track Vehicle';
  document.getElementById('btn-dispatch').disabled = false;
  document.getElementById('btn-dispatch').style.background = '#16a34a';

  const aiBtn = document.getElementById('btn-ai');
  aiBtn.style.display = 'block';
  aiBtn.disabled = false;
  aiBtn.textContent = '✨ AI Optimize Route';
  document.getElementById('ai-status-text').textContent = 'Route Optimized!';

  document.getElementById('waypoints-container').innerHTML = '';
  document.getElementById('pickup-input').value = '';
  document.getElementById('destination-input').value = '';

  clearInterval(trackingInterval);
  if (vehicleMarker) vehicleMarker.setMap(null);

  if (directionsRenderer)   directionsRenderer.setDirections({ routes: [] });
  if (aiDirectionsRenderer) aiDirectionsRenderer.setDirections({ routes: [] });

  if (map) map.setCenter({ lat: 14.6091, lng: 121.0223 });
}

// --- HISTORY ---
function renderHistory() {
  const container = document.getElementById('history-list');

  if (deliveryHistory.length === 0) {
    container.innerHTML = `
      <div class="empty-state" id="history-empty">
        <div class="empty-icon">📊</div>
        <p>No past dispatch records found.</p>
      </div>`;
    return;
  }

  let html = '';
  [...deliveryHistory].reverse().forEach(record => {
    html += `
      <div class="history-card">
        <div class="history-card-left">
          <h4>${record.pickup} ➔ ${record.dropoff}</h4>
          <p>Vehicle: ${record.vehicle} | ${record.date}</p>
        </div>
        <div class="history-card-right">
          <span class="badge-completed">Completed</span>
          <p style="font-size: 12px; color: var(--text-muted);">${record.savings}</p>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}

// --- ROUTE OPTIMIZATION ---
function optimizeRoute() {
  if (!directionsService) return;

  const btn = document.getElementById('btn-ai');
  btn.textContent = '🤖 Computing via Google Maps...';
  btn.disabled = true;

  clearInterval(trackingInterval);
  if (vehicleMarker) vehicleMarker.setMap(null);

  const pickup = document.getElementById('pickup-input').value;
  const dropoff = document.getElementById('destination-input').value;

  if (!pickup || !dropoff) {
    alert("Please enter both a pickup and drop-off location.");
    btn.textContent = '✨ AI Optimize Route';
    btn.disabled = false;
    return;
  }

  const waypoints = Array.from(document.querySelectorAll('.wp-input'))
    .map(inp => inp.value)
    .filter(val => val)
    .map(loc => ({ location: loc, stopover: true }));

  directionsService.route({
    origin: pickup,
    destination: dropoff,
    waypoints: waypoints,
    optimizeWaypoints: true,
    travelMode: google.maps.TravelMode.DRIVING,
    provideRouteAlternatives: true
  }, (response, status) => {
    if (status === "OK") {
      directionsRenderer.setDirections(response);
      currentRoutePath = response.routes[0].overview_path;

      btn.textContent = '🤖 AI Analyzing alternative paths...';

      setTimeout(() => {
        if (response.routes.length > 1) {
          const aiResponse = Object.assign({}, response);
          aiResponse.routes = [response.routes[1]];
          aiDirectionsRenderer.setDirections(aiResponse);
          currentRoutePath = response.routes[1].overview_path;
        }

        btn.style.display = 'none';
        document.getElementById('btn-dispatch').style.display = 'block';
        document.getElementById('ai-results').style.display = 'block';

        // Client-side mock savings (replaces Node.js /api/route/optimize)
        const mockSavings = getMockSavings(dropoff);
        document.getElementById('time-saved').textContent  = `Time Saved: ${mockSavings.time}`;
        document.getElementById('gas-saved').textContent   = `Fuel Saved: ${mockSavings.fuel}`;
        document.getElementById('ai-message').textContent  = mockSavings.message;

      }, 1200);
    } else {
      window.alert("Directions request failed: " + status);
      btn.textContent = '✨ AI Optimize Route';
      btn.disabled = false;
    }
  });
}

// Replaces the Node.js backend mock — returns randomised plausible savings
function getMockSavings(destination) {
  const timeSaved = Math.floor(Math.random() * 15) + 10; // 10–25 mins
  const fuelSaved = (Math.random() * 1.5 + 0.5).toFixed(1); // 0.5–2.0 L
  return {
    time: `${timeSaved} mins`,
    fuel: `${fuelSaved} Liters`,
    message: `System identified heavy traffic along primary highway to ${destination}. Re-routing via alternate express lanes.`
  };
}

// --- LIVE TRACKING ANIMATION ---
function startLiveTracking() {
  const dispatchBtn = document.getElementById('btn-dispatch');
  dispatchBtn.textContent = "📍 Vehicle En Route...";
  dispatchBtn.disabled = true;

  if (currentRoutePath.length === 0) return;

  const activeVehicleCard = document.querySelector('.vehicle-card.active');
  const vehicleType = activeVehicleCard ? activeVehicleCard.dataset.vehicle : 'Standard Van';

  const iconBaseUrl = vehicleType === 'Box Truck'
    ? 'https://maps.google.com/mapfiles/ms/icons/truck.png'
    : 'https://maps.google.com/mapfiles/ms/icons/cabs.png';

  if (vehicleMarker) vehicleMarker.setMap(null);

  vehicleMarker = new google.maps.Marker({
    position: currentRoutePath[0],
    map: map,
    icon: iconBaseUrl,
    title: "Delivery Vehicle"
  });

  let currentStep = 0;

  trackingInterval = setInterval(() => {
    currentStep += 2;

    if (currentStep >= currentRoutePath.length) {
      clearInterval(trackingInterval);

      dispatchBtn.textContent = "✅ Delivery Arrived";
      dispatchBtn.style.background = "#4b5563";
      document.getElementById('ai-status-text').textContent = "Delivery Completed!";
      document.getElementById('btn-new-delivery').style.display = 'block';

      const pickup   = document.getElementById('pickup-input').value;
      const dropoff  = document.getElementById('destination-input').value;
      const timeSaved = document.getElementById('time-saved').textContent;

      deliveryHistory.push({
        pickup, dropoff,
        vehicle: vehicleType,
        savings: timeSaved,
        date: new Date().toLocaleString()
      });

      return;
    }

    vehicleMarker.setPosition(currentRoutePath[currentStep]);
  }, 150);
}

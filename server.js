// RouteOptimize - Static Version (GitHub Pages compatible)
// All logic is client-side — no Node.js required.

let currentUser = null;

// --- DEMO ACCOUNTS ---
const DEMO_USERS = {
  'admin@demo.com': { email: 'admin@demo.com', role: 'admin', name: 'Admin Master', password: 'password123' },
  'user@demo.com':  { email: 'user@demo.com',  role: 'user',  name: 'Standard User', password: 'password123' }
};

// --- GOOGLE MAPS VARIABLES ---
let map;
let directionsService;
let directionsRenderer;
let aiDirectionsRenderer;
let vehicleMarker = null;
let currentRoutePath = [];
let trackingInterval = null;
let deliveryHistory = [];

// --- MOBILE SIDEBAR TOGGLE ---
// Tapping the drag handle (::before pseudo-element area) toggles expanded
function handleSidebarTap(event) {
  const sidebar = document.getElementById('main-sidebar');
  // The drag handle is roughly the top 24px
  const rect = sidebar.getBoundingClientRect();
  const tapY = event.clientY - rect.top;
  if (tapY < 28) {
    sidebar.classList.toggle('expanded');
  }
}

// --- MOBILE BOTTOM NAV ---
function mobileNav(tabId, el) {
  // Update mobile nav active state
  document.querySelectorAll('.mobile-bottom-nav a').forEach(a => a.classList.remove('active'));
  el.classList.add('active');

  // Sync desktop nav
  const desktopLinks = document.querySelectorAll('.nav-links a');
  const tabOrder = ['dispatch', 'records', 'drivers', 'settings'];
  const idx = tabOrder.indexOf(tabId);
  desktopLinks.forEach(a => a.classList.remove('active'));
  if (desktopLinks[idx]) desktopLinks[idx].classList.add('active');

  // Switch tab content
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  const target = document.getElementById('tab-' + tabId);
  if (target) {
    target.classList.add('active');
    if (tabId === 'dispatch' && map) {
      setTimeout(() => {
        google.maps.event.trigger(map, 'resize');
        map.setCenter({ lat: 14.6091, lng: 121.0223 });
      }, 100);
    }
    if (tabId === 'records') renderHistory();
  }
}

// --- INITIALIZATION ---
function initGoogleMap() {
  if (map) return;

  map = new google.maps.Map(document.getElementById("map"), {
    zoom: 12,
    center: { lat: 14.6091, lng: 121.0223 },
    disableDefaultUI: true,
    zoomControl: true,
    gestureHandling: 'greedy' // Better for mobile
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

// --- AUTHENTICATION ---
function doLogin() {
  const email    = document.getElementById('login-email').value.trim().toLowerCase();
  const password = document.getElementById('login-pw').value.trim();
  const user = DEMO_USERS[email];

  if (user && user.password === password) {
    loginSuccess({ email: user.email, role: user.role, name: user.name });
  } else {
    alert('Login failed. Please use:\nEmail: admin@demo.com OR user@demo.com\nPassword: password123');
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
  alert(`If ${resetEmail.trim().toLowerCase()} exists, a reset link has been sent.`);
}

// --- UI INTERACTIONS ---
function switchTab(tabId, element) {
  // Desktop nav active state
  document.querySelectorAll('.nav-links a').forEach(el => el.classList.remove('active'));
  if (element) element.classList.add('active');

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

  // Sync mobile bottom nav
  const tabOrder = ['dispatch', 'records', 'drivers', 'settings'];
  const mobileLinks = document.querySelectorAll('.mobile-bottom-nav a');
  mobileLinks.forEach(a => a.classList.remove('active'));
  const idx = tabOrder.indexOf(tabId);
  if (mobileLinks[idx]) mobileLinks[idx].classList.add('active');
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
    <input type="text" placeholder="Intermediate stop (e.g. Pasig, Manila)" class="wp-input" autocomplete="off"/>
    <button class="remove-wp" onclick="this.parentElement.remove()">×</button>
  `;
  container.appendChild(wpDiv);
}

function resetForNewDelivery() {
  document.getElementById('ai-results').style.display = 'none';
  document.getElementById('btn-new-delivery').style.display = 'none';
  document.getElementById('btn-dispatch').style.display = 'none';
  document.getElementById('btn-dispatch').textContent = '🚀 Dispatch & Track';
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

  // Collapse mobile sidebar
  const sidebar = document.getElementById('main-sidebar');
  if (sidebar) sidebar.classList.remove('expanded');
}

// --- HISTORY ---
function renderHistory() {
  const container = document.getElementById('history-list');
  if (deliveryHistory.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📊</div>
        <p>No past dispatch records found.<br>Complete a delivery to see it here.</p>
      </div>`;
    return;
  }

  let html = '';
  [...deliveryHistory].reverse().forEach(record => {
    html += `
      <div class="history-card">
        <div class="history-card-left">
          <h4>${record.pickup} ➔ ${record.dropoff}</h4>
          <p>Vehicle: ${record.vehicle} &nbsp;|&nbsp; ${record.date}</p>
        </div>
        <div class="history-card-right">
          <span class="badge-completed">Completed</span>
          <p style="font-size:12px; color:var(--text-muted); margin-top:2px;">${record.savings}</p>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}

// --- ROUTE OPTIMIZATION ---
function optimizeRoute() {
  if (!directionsService) {
    alert('Google Maps is not loaded. Please add your API key to index.html.');
    return;
  }

  const btn = document.getElementById('btn-ai');
  btn.textContent = '🤖 Computing via Google Maps...';
  btn.disabled = true;

  clearInterval(trackingInterval);
  if (vehicleMarker) vehicleMarker.setMap(null);

  const pickup = document.getElementById('pickup-input').value.trim();
  const dropoff = document.getElementById('destination-input').value.trim();

  if (!pickup || !dropoff) {
    alert("Please enter both a pickup and drop-off location.");
    btn.textContent = '✨ AI Optimize Route';
    btn.disabled = false;
    return;
  }

  // Expand sidebar on mobile so user can see results
  const sidebar = document.getElementById('main-sidebar');
  if (sidebar && window.innerWidth <= 768) {
    sidebar.classList.add('expanded');
  }

  const waypoints = Array.from(document.querySelectorAll('.wp-input'))
    .map(inp => inp.value.trim())
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

      btn.textContent = '🤖 Analyzing alternative paths...';

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

        const mockSavings = getMockSavings(dropoff);
        document.getElementById('time-saved').textContent  = `⏱ ${mockSavings.time} saved`;
        document.getElementById('gas-saved').textContent   = `⛽ ${mockSavings.fuel} saved`;
        document.getElementById('ai-message').textContent  = mockSavings.message;

      }, 1200);
    } else {
      alert("Directions request failed: " + status);
      btn.textContent = '✨ AI Optimize Route';
      btn.disabled = false;
    }
  });
}

function getMockSavings(destination) {
  const timeSaved = Math.floor(Math.random() * 15) + 10;
  const fuelSaved = (Math.random() * 1.5 + 0.5).toFixed(1);
  return {
    time: `${timeSaved} mins`,
    fuel: `${fuelSaved} L`,
    message: `System identified heavy traffic along primary highway to ${destination}. Re-routing via alternate express lanes.`
  };
}

// --- LIVE TRACKING ---
function startLiveTracking() {
  const dispatchBtn = document.getElementById('btn-dispatch');
  dispatchBtn.textContent = "📍 Vehicle En Route...";
  dispatchBtn.disabled = true;

  if (currentRoutePath.length === 0) return;

  const activeVehicleCard = document.querySelector('.vehicle-card.active');
  const vehicleType = activeVehicleCard ? activeVehicleCard.dataset.vehicle : 'Standard Van';

  const iconUrl = vehicleType === 'Box Truck'
    ? 'https://maps.google.com/mapfiles/ms/icons/truck.png'
    : 'https://maps.google.com/mapfiles/ms/icons/cabs.png';

  if (vehicleMarker) vehicleMarker.setMap(null);

  vehicleMarker = new google.maps.Marker({
    position: currentRoutePath[0],
    map: map,
    icon: iconUrl,
    title: "Delivery Vehicle"
  });

  // Collapse sidebar on mobile to show map during tracking
  const sidebar = document.getElementById('main-sidebar');
  if (sidebar && window.innerWidth <= 768) {
    sidebar.classList.remove('expanded');
  }

  let currentStep = 0;

  trackingInterval = setInterval(() => {
    currentStep += 2;

    if (currentStep >= currentRoutePath.length) {
      clearInterval(trackingInterval);

      dispatchBtn.textContent = "✅ Delivery Arrived";
      dispatchBtn.style.background = "#4b5563";
      document.getElementById('ai-status-text').textContent = "Delivery Completed!";
      document.getElementById('btn-new-delivery').style.display = 'block';

      // Expand sidebar to show completion
      if (sidebar && window.innerWidth <= 768) {
        sidebar.classList.add('expanded');
      }

      const pickup  = document.getElementById('pickup-input').value;
      const dropoff = document.getElementById('destination-input').value;
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

const API_BASE = 'http://localhost:3000/api';
let currentUser = null;

// --- GOOGLE MAPS & ROUTING VARIABLES ---
let map;
let directionsService;
let directionsRenderer;
let aiDirectionsRenderer;
let vehicleMarker = null;
let currentRoutePath = []; // Array of LatLng objects for animation
let trackingInterval = null;
let deliveryHistory = []; 

// --- INITIALIZATION ---
function initGoogleMap() {
  if (map) return;
  
  // Center on Metro Manila
  map = new google.maps.Map(document.getElementById("map"), {
    zoom: 12,
    center: { lat: 14.6091, lng: 121.0223 },
    disableDefaultUI: true,
    zoomControl: true,
  });

  directionsService = new google.maps.DirectionsService();
  
  // Standard Route Renderer (Gray)
  directionsRenderer = new google.maps.DirectionsRenderer({
    map: map,
    suppressMarkers: false,
    polylineOptions: { strokeColor: "#9ca3af", strokeWeight: 4, strokeOpacity: 0.7 }
  });

  // AI Route Renderer (Indigo)
  aiDirectionsRenderer = new google.maps.DirectionsRenderer({
    map: map,
    suppressMarkers: true,
    polylineOptions: { strokeColor: "#4f46e5", strokeWeight: 6, strokeOpacity: 0.9 }
  });
}

// --- AUTHENTICATION ---
function doLogin() {
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const password = document.getElementById('login-pw').value.trim();

  fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      currentUser = data.user;
      
      document.getElementById('user-display-role').textContent = currentUser.role.toUpperCase();
      document.getElementById('prof-fname').value = currentUser.name;
      document.getElementById('prof-email').value = currentUser.email;

      document.getElementById('screen-login').classList.remove('active');
      document.getElementById('screen-dashboard').classList.add('active');
      
      // Delay to let CSS flexbox finish rendering before forcing Google Maps to draw
      setTimeout(() => {
        initGoogleMap();
        if (map) google.maps.event.trigger(map, 'resize');
      }, 350);
    } else {
      alert('Strict Login Enforced. Please use:\nEmail: admin@demo.com OR user@demo.com\nPass: password123');
    }
  }).catch(err => {
    console.error(err);
    alert('Cannot connect to backend. Start Node.js server!');
  });
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
    fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@demo.com', password: 'password123' }) 
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        currentUser = data.user;
        document.getElementById('user-display-role').textContent = currentUser.role.toUpperCase();
        document.getElementById('prof-fname').value = currentUser.name;
        document.getElementById('prof-email').value = currentUser.email;

        document.getElementById('screen-login').classList.remove('active');
        document.getElementById('screen-dashboard').classList.add('active');
        
        setTimeout(() => {
          initGoogleMap();
          if (map) google.maps.event.trigger(map, 'resize');
        }, 350);
      }
    })
    .finally(() => {
      btn.textContent = originalText;
      btn.disabled = false;
    });
  }, 1500);
}

function doForgotPw() {
  const currentEmail = document.getElementById('login-email').value.trim().toLowerCase();
  const resetEmail = prompt("Enter email to reset password:", currentEmail);
  if (!resetEmail) return;

  fetch(`${API_BASE}/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: resetEmail.trim().toLowerCase() })
  }).then(res => res.json()).then(data => alert(data.message));
}

// --- UI INTERACTIONS ---
function switchTab(tabId, element) {
  document.querySelectorAll('.nav-links a').forEach(el => el.classList.remove('active'));
  element.classList.add('active');

  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  
  const targetTab = document.getElementById('tab-' + tabId);
  if(targetTab) {
    targetTab.classList.add('active');
    
    // Force Map to wake up when tab changes back to it
    if(tabId === 'dispatch' && map) {
      setTimeout(() => { 
        google.maps.event.trigger(map, 'resize');
        map.setCenter({ lat: 14.6091, lng: 121.0223 });
      }, 100);
    }
    
    if(tabId === 'records') renderHistory();
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

// Reset UI for next job
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
  
  if(directionsRenderer) directionsRenderer.setDirections({routes: []});
  if(aiDirectionsRenderer) aiDirectionsRenderer.setDirections({routes: []});
  
  if(map) map.setCenter({ lat: 14.6091, lng: 121.0223 });
}

// --- HISTORY LOGIC ---
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

// --- GOOGLE MAPS ROUTING ---
function optimizeRoute() {
  if (!directionsService) return;

  const btn = document.getElementById('btn-ai');
  btn.textContent = '🤖 Computing via Google Maps...';
  btn.disabled = true;

  clearInterval(trackingInterval);
  if (vehicleMarker) vehicleMarker.setMap(null);

  const pickup = document.getElementById('pickup-input').value;
  const dropoff = document.getElementById('destination-input').value;
  
  if(!pickup || !dropoff) {
    alert("Please enter both a pickup and drop-off location.");
    btn.textContent = '✨ AI Optimize Route';
    btn.disabled = false;
    return;
  }

  // Grab waypoints
  const waypoints = Array.from(document.querySelectorAll('.wp-input'))
                         .map(inp => inp.value)
                         .filter(val => val)
                         .map(loc => ({ location: loc, stopover: true }));

  // Call Google Maps Directions API
  directionsService.route({
    origin: pickup,
    destination: dropoff,
    waypoints: waypoints,
    optimizeWaypoints: true,
    travelMode: google.maps.TravelMode.DRIVING,
    provideRouteAlternatives: true // Get multiple routes!
  }, (response, status) => {
    if (status === "OK") {
      
      // Render Standard Route (Usually the first one)
      directionsRenderer.setDirections(response);
      
      // Save the path for animation
      currentRoutePath = response.routes[0].overview_path;

      btn.textContent = '🤖 AI Analyzing alternative paths...';
      
      setTimeout(() => {
        // If Google provides an alternative route, draw it as the "AI" route
        if (response.routes.length > 1) {
           const aiResponse = Object.assign({}, response);
           aiResponse.routes = [response.routes[1]]; // Set to 2nd route
           aiDirectionsRenderer.setDirections(aiResponse);
           currentRoutePath = response.routes[1].overview_path; // Track the AI route instead
        }

        // Update UI
        btn.style.display = 'none';
        document.getElementById('btn-dispatch').style.display = 'block';
        document.getElementById('ai-results').style.display = 'block';
        
        // Fetch Mocked AI Savings from Node Backend
        fetch(`${API_BASE}/route/optimize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ destination: dropoff })
        }).then(r => r.json()).then(backendData => {
           document.getElementById('time-saved').textContent = `Time Saved: ${backendData.savings.time}`;
           document.getElementById('gas-saved').textContent = `Fuel Saved: ${backendData.savings.fuel}`;
           document.getElementById('ai-message').textContent = backendData.message;
        });

      }, 1200);

    } else {
      window.alert("Directions request failed due to " + status);
      btn.textContent = '✨ AI Optimize Route';
      btn.disabled = false;
    }
  });
}

// --- GOOGLE MAPS LIVE TRACKING ANIMATION ---
function startLiveTracking() {
  const dispatchBtn = document.getElementById('btn-dispatch');
  dispatchBtn.textContent = "📍 Vehicle En Route...";
  dispatchBtn.disabled = true;

  if (currentRoutePath.length === 0) return;

  const activeVehicleCard = document.querySelector('.vehicle-card.active');
  const vehicleType = activeVehicleCard ? activeVehicleCard.dataset.vehicle : 'Standard Van';

  // Create custom marker for Google Maps
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
  
  // Animate Marker
  trackingInterval = setInterval(() => {
    currentStep += 2; 
    
    // ARRIVAL LOGIC
    if (currentStep >= currentRoutePath.length) {
      clearInterval(trackingInterval);
      
      // Update UI for Arrival
      dispatchBtn.textContent = "✅ Delivery Arrived";
      dispatchBtn.style.background = "#4b5563";
      document.getElementById('ai-status-text').textContent = "Delivery Completed!";
      document.getElementById('btn-new-delivery').style.display = 'block';

      // Save to History Tab
      const pickup = document.getElementById('pickup-input').value;
      const dropoff = document.getElementById('destination-input').value;
      const timeSaved = document.getElementById('time-saved').textContent;
      
      deliveryHistory.push({
        pickup: pickup,
        dropoff: dropoff,
        vehicle: vehicleType,
        savings: timeSaved,
        date: new Date().toLocaleString()
      });

      return;
    }
    
    // Move marker
    vehicleMarker.setPosition(currentRoutePath[currentStep]);
  }, 150);
}
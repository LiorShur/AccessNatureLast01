// === GLOBAL VARIABLES ===
let map, marker, watchId;
let path = [];
let routeData = [];
let lastCoords = null;
let totalDistance = 0;
let startTime = null;
let timerInterval = null;
let isPaused = false;
let elapsedTime = 0;
let autoSaveInterval = null;
let mediaRecorder;
let audioChunks = [];
let noteMarkers = [];

// === INIT MAP ===
window.initMap = function (callback) {
  const initial = path.length > 0 ? path[0] : { lat: 0, lng: 0 };

  map = new google.maps.Map(document.getElementById("map"), {
    zoom: 15,
    center: initial,
    mapTypeId: 'terrain'
  });

  marker = new google.maps.Marker({
    position: initial,
    map,
    title: "Start"
  });

  if (callback) callback();
};

// === AUTO BACKUP ===
function startAutoBackup() {
  autoSaveInterval = setInterval(() => {
    if (routeData.length > 0) {
      const backupData = {
        routeData,
        totalDistance,
        elapsedTime
      };
      localStorage.setItem("route_backup", JSON.stringify(backupData));
    }
  }, 20000); // Every 20 seconds
}

function stopAutoBackup() {
  clearInterval(autoSaveInterval);
  localStorage.removeItem("route_backup");
}

// === START TRACKING ===
window.startTracking = function () {
  if (navigator.geolocation) {
    watchId = navigator.geolocation.watchPosition(
      position => {
        const { latitude, longitude, accuracy } = position.coords;
        if (accuracy > 25) return;
        if (lastCoords) {
          const dist = haversineDistance(lastCoords, { lat: latitude, lng: longitude });
          if (dist > 0.2) return;
        }
        if (!isPaused) {
          const latLng = { lat: latitude, lng: longitude };
          if (lastCoords) {
            const dist = haversineDistance(lastCoords, latLng);
            totalDistance += dist;
            updateDistanceDisplay();
          }
          lastCoords = latLng;
          path.push(latLng);
          marker.setPosition(latLng);
          map.panTo(latLng);

          new google.maps.Polyline({
            path,
            geodesic: true,
            strokeColor: "#00FF00",
            strokeOpacity: 1.0,
            strokeWeight: 2,
            map
          });

          routeData.push({
            type: "location",
            timestamp: Date.now(),
            coords: latLng
          });
        }
      },
      err => console.error("GPS error:", err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
    startTimer();
    startAutoBackup();
  } else {
    alert("Geolocation not supported");
  }
};

// === STOP TRACKING ===
window.stopTracking = function () {
  if (watchId) navigator.geolocation.clearWatch(watchId);
  stopTimer();
  stopAutoBackup();
  showSummary();

  const wantsToSave = confirm("💾 Do you want to save this route?");
  if (wantsToSave) saveSession();

  resetApp();
};

// === TIMER FUNCTIONS ===
function startTimer() {
  startTime = Date.now() - elapsedTime;
  clearInterval(timerInterval);
  timerInterval = setInterval(updateTimerDisplay, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
}

function updateTimerDisplay() {
  const now = Date.now();
  elapsedTime = now - startTime;
  const hrs = Math.floor(elapsedTime / (1000 * 60 * 60));
  const mins = Math.floor((elapsedTime % (1000 * 60 * 60)) / (1000 * 60));
  const secs = Math.floor((elapsedTime % (1000 * 60)) / 1000);
  const formatted = `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;

  document.getElementById("timer").textContent = formatted;
  document.getElementById("liveTimer").textContent = formatted;
}

function pad(n) {
  return n.toString().padStart(2, "0");
}

function updateDistanceDisplay() {
  document.getElementById("distance").textContent = totalDistance.toFixed(2) + " km";
  document.getElementById("liveDistance").textContent = totalDistance.toFixed(2) + " km";
}

// === RESET APP ===
function resetApp() {
  routeData = [];
  path = [];
  lastCoords = null;
  totalDistance = 0;
  elapsedTime = 0;
  startTime = null;
  isPaused = false;

  updateDistanceDisplay();
  document.getElementById("timer").textContent = "00:00:00";
  document.getElementById("liveTimer").textContent = "00:00:00";

  if (map && marker) {
    marker.setPosition({ lat: 0, lng: 0 });
    map.setCenter({ lat: 0, lng: 0 });
    map.setZoom(15);
  }

  noteMarkers.forEach(m => m.setMap(null));
  noteMarkers = [];

  stopAutoBackup();
}

// === OTHER FUNCTIONS ===
window.togglePause = function () {
  isPaused = !isPaused;
  document.getElementById("pauseButtonLabel").textContent = isPaused ? "Resume" : "Pause";
  if (!isPaused) startTimer();
  else stopTimer();
};

function showSummary() {
  alert(`🏁 Route Completed!
Total Distance: ${totalDistance.toFixed(2)} km
Total Time: ${document.getElementById("timer").textContent}`);
}

// === DISTANCE ===
function haversineDistance(coord1, coord2) {
  const R = 6371;
  const toRad = deg => deg * Math.PI / 180;
  const dLat = toRad(coord2.lat - coord1.lat);
  const dLng = toRad(coord2.lng - coord1.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(coord1.lat)) * Math.cos(toRad(coord2.lat)) * Math.sin(dLng / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

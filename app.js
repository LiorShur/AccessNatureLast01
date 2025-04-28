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
// === SAVE SESSION ===
window.saveSession = function () {
  const name = prompt("Enter a name for this route:");
  if (!name) return;

  const session = {
    name,
    date: new Date().toISOString(),
    time: document.getElementById("timer").textContent,
    distance: totalDistance.toFixed(2),
    data: routeData
  };

  let sessions = JSON.parse(localStorage.getItem("sessions") || "[]");
  sessions.push(session);

  localStorage.setItem("sessions", JSON.stringify(sessions));
  localStorage.removeItem("route_backup"); // ✅ Clear auto-backup after successful save

  alert("✅ Route saved successfully!");
  loadSavedSessions();
};

// === LOAD SAVED SESSIONS LIST ===
window.loadSavedSessions = function () {
  const list = document.getElementById("savedSessionsList");
  if (!list) return; // Safety check
  list.innerHTML = "";

  const sessions = JSON.parse(localStorage.getItem("sessions") || "[]");
  sessions.forEach((session, index) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${session.name}</strong>
      <button onclick="loadSession(${index})">View</button>
    `;
    list.appendChild(li);
  });
};

// === LOAD A SESSION ===
window.loadSession = function (index) {
  const sessions = JSON.parse(localStorage.getItem("sessions") || "[]");
  const session = sessions[index];
  if (!session) {
    alert("Session not found!");
    return;
  }

  routeData = session.data;
  totalDistance = parseFloat(session.distance);
  elapsedTime = 0;
  lastCoords = null;
  path = routeData.filter(e => e.type === "location").map(e => e.coords);

  updateDistanceDisplay();
  document.getElementById("timer").textContent = session.time;
  document.getElementById("liveTimer").textContent = session.time;

  initMap(() => {
    drawSavedRoutePath();
    showRouteDataOnMap();
  });
};

function drawSavedRoutePath() {
  if (path.length > 1) {
    new google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: "#00FF00",
      strokeOpacity: 1.0,
      strokeWeight: 3,
      map
    });

    map.setCenter(path[0]);
    marker.setPosition(path[0]);
  }
}

// === SHOW ROUTE NOTES/MEDIA ===
function showRouteDataOnMap() {
  if (noteMarkers.length > 0) {
    noteMarkers.forEach(marker => marker.setMap(null));
    noteMarkers = [];
  }

  if (!routeData || routeData.length === 0) return;

  const bounds = new google.maps.LatLngBounds();

  routeData.forEach(entry => {
    const { coords, type, content } = entry;
    if (!coords) return;

    if (type === "location") {
      bounds.extend(coords);
      return;
    }

    let infoContent = "";

    if (type === "text") {
      infoContent = `<p>${content}</p>`;
    } else if (type === "photo") {
      infoContent = `<img src="${content}" alt="Photo" style="width:150px" onclick="showMediaFullScreen('${content}', 'photo')">`;
    } else if (type === "audio") {
      infoContent = `<audio controls src="${content}"></audio>`;
    } else if (type === "video") {
      infoContent = `<video controls width="200" src="${content}" onclick="showMediaFullScreen('${content}', 'video')"></video>`;
    }

    const marker = new google.maps.Marker({
      position: coords,
      map: map,
      icon: {
        url: type === "photo" ? "📸" :
             type === "audio" ? "🎙️" :
             type === "video" ? "🎬" :
             "📝",
        scaledSize: new google.maps.Size(32, 32)
      }
    });

    const infoWindow = new google.maps.InfoWindow({ content: infoContent });

    marker.addListener("click", () => {
      infoWindow.open(map, marker);
    });

    noteMarkers.push(marker);
    bounds.extend(coords);
  });

  if (!bounds.isEmpty()) {
    map.fitBounds(bounds);
  }
}

// === FULLSCREEN MEDIA VIEWER ===
window.showMediaFullScreen = function (content, type) {
  const overlay = document.createElement("div");
  overlay.style = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.8); display: flex; justify-content: center; align-items: center; z-index: 9999;
  `;
  const media = document.createElement(type === "photo" ? "img" : "video");
  media.src = content;
  media.style.maxWidth = "90%";
  media.style.maxHeight = "90%";
  if (type === "video") media.controls = true;

  overlay.appendChild(media);

  overlay.onclick = () => document.body.removeChild(overlay);

  document.body.appendChild(overlay);
};
// === WINDOW ONLOAD: Shared Link or Backup Recovery ===
window.onload = function () {
  const params = new URLSearchParams(window.location.search);
  const base64Data = params.get("data");

  if (base64Data) {
    // Shared Link
    try {
      const json = atob(base64Data);
      const sharedData = JSON.parse(json);
      routeData = sharedData;
      path = routeData.filter(e => e.type === "location").map(e => e.coords);

      initMap(() => {
        drawSavedRoutePath();
        showRouteDataOnMap();
      });

      alert("✅ Shared route loaded!");

    } catch (e) {
      console.error("Invalid shared route data.");
    }
  } else {
    // Local Auto-backup
    const backup = localStorage.getItem("route_backup");
    if (backup) {
      const restore = confirm("🛠️ Unsaved route found! Restore it?");
      if (restore) {
        try {
          const backupData = JSON.parse(backup);
          routeData = backupData.routeData || [];
          totalDistance = backupData.totalDistance || 0;
          elapsedTime = backupData.elapsedTime || 0;

          path = routeData.filter(e => e.type === "location").map(e => e.coords);

          initMap(() => {
            drawSavedRoutePath();
            showRouteDataOnMap();
          });

          updateDistanceDisplay();
          startTime = Date.now() - elapsedTime;
          startTimer();
          startAutoBackup();

          alert("✅ Previous session recovered!");

        } catch (e) {
          console.error("Corrupt backup data. Clearing...");
          resetApp();
          localStorage.removeItem("route_backup");
        }
      } else {
        localStorage.removeItem("route_backup");
        resetApp();
      }
    } else {
      loadSavedSessions();
    }
  }
};

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
let trackingActive = false;

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
    trackingActive = true;
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
// === PAUSE / RESUME ===
window.togglePause = function () {
  isPaused = !isPaused;
  document.getElementById("pauseButtonLabel").textContent = isPaused ? "Resume" : "Pause";
  if (!isPaused) startTimer();
  else stopTimer();
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

// === BACKUP LOGIC ===
function startAutoBackup() {
  autoSaveInterval = setInterval(() => {
    if (routeData.length > 0) {
      const backupData = {
        routeData,
        totalDistance,
        elapsedTime
      };
      localStorage.setItem("route_backup", JSON.stringify(backupData));
      console.log("🔄 Auto-backup updated.");
    }
  }, 20000);
}

function stopAutoBackup() {
  clearInterval(autoSaveInterval);
  localStorage.removeItem("route_backup");
  console.log("✅ Auto-backup stopped and cleared.");
}

// === CONFIRM ON PAGE LEAVE ===
window.addEventListener("beforeunload", function (e) {
  if (trackingActive && routeData.length > 0) {
    e.preventDefault();
    e.returnValue = '';
    return '';
  }
});

// === RESET APP CLEANLY ===
function resetApp() {
  trackingActive = false;
  routeData = [];
  path = [];
  lastCoords = null;
  totalDistance = 0;
  elapsedTime = 0;
  startTime = null;
  isPaused = false;

  document.getElementById("distance").textContent = "0.00 km";
  document.getElementById("timer").textContent = "00:00:00";
  document.getElementById("liveDistance").textContent = "0.00 km";
  document.getElementById("liveTimer").textContent = "00:00:00";

  if (map && marker) {
    marker.setPosition({ lat: 0, lng: 0 });
    map.setCenter({ lat: 0, lng: 0 });
    map.setZoom(15);
  }

  if (noteMarkers.length > 0) {
    noteMarkers.forEach(marker => marker.setMap(null));
    noteMarkers = [];
  }

  stopAutoBackup();
  localStorage.removeItem("route_backup");

  console.log("🧹 App fully reset and ready!");
}
// === MEDIA CAPTURE ===
window.capturePhoto = () => document.getElementById("photoInput").click();
window.captureVideo = () => document.getElementById("videoInput").click();

window.addTextNote = function () {
  const note = prompt("Enter your note:");
  if (note) {
    navigator.geolocation.getCurrentPosition(position => {
      routeData.push({
        type: "text",
        timestamp: Date.now(),
        coords: { lat: position.coords.latitude, lng: position.coords.longitude },
        content: note
      });
      alert("📝 Note saved successfully!");
    });
  }
};

window.startAudioRecording = function () {
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.ondataavailable = event => audioChunks.push(event.data);
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onload = () => {
          navigator.geolocation.getCurrentPosition(pos => {
            routeData.push({
              type: "audio",
              timestamp: Date.now(),
              coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
              content: reader.result
            });
            alert("🎙️ Audio saved successfully!");
          });
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorder.start();
      setTimeout(() => mediaRecorder.stop(), 5000);
    })
    .catch(() => alert("⚠️ Microphone access denied"));
};

// === MEDIA INPUT EVENTS ===
window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("photoInput").addEventListener("change", e => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        navigator.geolocation.getCurrentPosition(pos => {
          routeData.push({
            type: "photo",
            timestamp: Date.now(),
            coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
            content: reader.result
          });
          alert("📸 Photo saved successfully!");
        });
      };
      reader.readAsDataURL(file);
    }
  });

  document.getElementById("videoInput").addEventListener("change", e => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        navigator.geolocation.getCurrentPosition(pos => {
          routeData.push({
            type: "video",
            timestamp: Date.now(),
            coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
            content: reader.result
          });
          alert("🎬 Video saved successfully!");
        });
      };
      reader.readAsDataURL(file);
    }
  });
});
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
  localStorage.removeItem("route_backup");

  alert("✅ Route saved successfully!");

  loadSavedSessions();
};

// === LOAD SESSION LIST ===
window.loadSavedSessions = function () {
  const list = document.getElementById("savedSessionsList");
  if (!list) return;
  list.innerHTML = "";

  const sessions = JSON.parse(localStorage.getItem("sessions") || "[]");
  sessions.forEach((session, index) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${session.name}</strong> 
      (${session.distance} km, ${session.time})
      <button onclick="loadSession(${index})">View</button>`;
    list.appendChild(li);
  });
};

// === LOAD SPECIFIC SESSION ===
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

// === DARK MODE TOGGLE ===
window.toggleDarkMode = function () {
  document.body.classList.toggle("dark-mode");
};

// === CLEAR ALL SAVED SESSIONS ===
window.clearAllSessions = function () {
  const confirmClear = confirm("⚠️ Are you sure you want to clear all saved routes? This cannot be undone!");
  if (confirmClear) {
    localStorage.removeItem("sessions");
    localStorage.removeItem("route_backup");
    document.getElementById("savedSessionsList").innerHTML = "";
    if (document.getElementById("historyList")) {
      document.getElementById("historyList").innerHTML = "";
    }
    alert("✅ All saved routes cleared!");
  }
};

// === CONFIRM ON LEAVING PAGE ===
window.addEventListener("beforeunload", function (e) {
  if (trackingActive && routeData.length > 0) {
    e.preventDefault();
    e.returnValue = '';
    return '';
  }
});
// === FULLSCREEN MEDIA VIEWER ===
window.showMediaFullScreen = function (content, type) {
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.top = 0;
  overlay.style.left = 0;
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.background = "rgba(0,0,0,0.8)";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = "9999";

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Close";
  closeBtn.style.position = "absolute";
  closeBtn.style.top = "20px";
  closeBtn.style.right = "20px";
  closeBtn.style.padding = "10px 20px";
  closeBtn.style.backgroundColor = "#f44336";
  closeBtn.style.color = "#fff";
  closeBtn.onclick = () => document.body.removeChild(overlay);

  overlay.appendChild(closeBtn);

  const media = document.createElement(type === "photo" ? "img" : "video");
  media.src = content;
  media.style.maxWidth = "90%";
  media.style.maxHeight = "90%";
  if (type === "video") media.controls = true;

  overlay.appendChild(media);
  document.body.appendChild(overlay);
};

// === SHOW ROUTE DATA (Map Notes) ===
function showRouteDataOnMap() {
  if (noteMarkers.length > 0) {
    noteMarkers.forEach(marker => marker.setMap(null));
    noteMarkers = [];
  }

  if (!routeData || routeData.length === 0) {
    alert("No media to show!");
    return;
  }

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
      infoContent = `<img src="${content}" style="width:150px" onclick="showMediaFullScreen('${content}', 'photo')">`;
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

    const infoWindow = new google.maps.InfoWindow({
      content: infoContent
    });

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

// === EXPORT JSON FILE ===
window.exportData = function () {
  const fileName = `route-${new Date().toISOString()}.json`;
  const blob = new Blob([JSON.stringify(routeData, null, 2)], { type: "application/json" });

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// === EXPORT GPX FILE ===
window.exportGPX = function () {
  let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="NatureTracker" xmlns="http://www.topografix.com/GPX/1/1">
<trk><name>Route</name><trkseg>\n`;

  routeData.filter(e => e.type === "location").forEach(e => {
    gpx += `<trkpt lat="${e.coords.lat}" lon="${e.coords.lng}">
  <time>${new Date(e.timestamp).toISOString()}</time>
</trkpt>\n`;
  });

  gpx += `</trkseg></trk></gpx>`;

  const blob = new Blob([gpx], { type: "application/gpx+xml" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `route-${Date.now()}.gpx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// === EXPORT PDF FILE ===
window.exportPDF = async function () {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let y = 10;

  doc.setFontSize(16);
  doc.text("Nature Tracker - Route Summary", 10, y); y += 10;

  for (const entry of routeData) {
    if (y > 260) { doc.addPage(); y = 10; }

    doc.setFontSize(12);
    doc.text(`Type: ${entry.type}`, 10, y); y += 6;
    doc.text(`Time: ${new Date(entry.timestamp).toLocaleString()}`, 10, y); y += 6;
    doc.text(`Lat: ${entry.coords.lat.toFixed(5)}, Lng: ${entry.coords.lng.toFixed(5)}`, 10, y); y += 6;

    if (entry.type === "text") {
      doc.text(`Note: ${entry.content}`, 10, y); y += 10;
    } else if (entry.type === "photo") {
      try {
        doc.addImage(entry.content, "JPEG", 10, y, 50, 40);
        y += 50;
      } catch {
        doc.text("Photo not embedded", 10, y); y += 10;
      }
    } else if (entry.type === "audio") {
      doc.text("Audio note recorded (not embeddable)", 10, y); y += 10;
    } else if (entry.type === "video") {
      doc.text("Video recorded (not embeddable)", 10, y); y += 10;
    }
  }

  doc.save(`route-${Date.now()}.pdf`);
};

// === SHAREABLE LINK GENERATION ===
window.generateShareableLink = function () {
  const json = JSON.stringify(routeData);
  const base64 = btoa(json);
  const url = `${location.origin}${location.pathname}?data=${encodeURIComponent(base64)}`;

  navigator.clipboard.writeText(url)
    .then(() => alert("✅ Shareable link copied to clipboard!"));
};

// === SHARED LINK HANDLER ON PAGE LOAD ===
window.onload = function () {
  const params = new URLSearchParams(window.location.search);
  const base64Data = params.get("data");

  if (base64Data) {
    try {
      const json = atob(base64Data);
      const sharedData = JSON.parse(json);
      routeData = sharedData;
      alert("✅ Shared route loaded!");

      path = routeData.filter(e => e.type === "location").map(e => e.coords);
      initMap(() => {
        drawSavedRoutePath();
        showRouteDataOnMap();
      });
    } catch (e) {
      console.error("Invalid share data.");
    }
  } else {
    loadSavedSessions();
  }
};


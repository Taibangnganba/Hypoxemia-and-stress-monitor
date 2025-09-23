// ---------------- Global Variables ----------------
let bpmHistory = [];
let spo2History = [];
let lastBPM = 0;
let lastSpo2 = 0;
let currentView = "landingPage";

// ---------------- Browser History Management ----------------
function handleBrowserNavigation() {
  window.addEventListener("popstate", function (event) {
    if (event.state && event.state.view) {
      navigateToView(event.state.view, false);
    } else {
      navigateToView("landingPage", false);
    }
  });
}

function navigateToView(viewId, addToHistory = true) {
  const views = {
    landingPage: document.getElementById("landingPage"),
    mainDashboard: document.getElementById("mainDashboard"),
    bpmReport: document.getElementById("bpmReport"),
    spo2Report: document.getElementById("spo2Report"),
  };

  // Hide all views
  Object.values(views).forEach((view) => {
    if (view) {
      view.style.display = "none";
      view.style.opacity = "0";
    }
  });

  // Show target view
  const targetView = views[viewId];
  if (targetView) {
    if (viewId === "landingPage") {
      targetView.style.display = "flex";
    } else {
      targetView.style.display = "block";
    }

    setTimeout(() => {
      targetView.style.opacity = "1";
    }, 50);

    currentView = viewId;

    // Add to browser history if needed
    if (addToHistory) {
      window.history.pushState({ view: viewId }, "", `#${viewId}`);
    }

    // Initialize specific views if needed
    if (viewId === "bpmReport") {
      initializeBPMReport();
    } else if (viewId === "spo2Report") {
      initializeSpO2Report();
    } else if (viewId === "mainDashboard") {
      // Re-initialize dashboard if needed
      if (typeof initializeDashboard === "function") {
        initializeDashboard();
      }
    }
  }
}

// ---------------- Landing Page Functionality ----------------
document.addEventListener("DOMContentLoaded", function () {
  const landingPage = document.getElementById("landingPage");
  const mainDashboard = document.getElementById("mainDashboard");
  const bpmReport = document.getElementById("bpmReport");
  const spo2Report = document.getElementById("spo2Report");

  const enterDashboardBtn = document.getElementById("enterDashboard");
  const backToLandingBtn = document.getElementById("backToLanding");
  const featureCards = document.querySelectorAll(".feature-card");

  // BPM Report Navigation
  const bpmToDashboard = document.getElementById("bpmToDashboard");
  const bpmToLanding = document.getElementById("bpmToLanding");

  // SpO2 Report Navigation
  const spo2ToDashboard = document.getElementById("spo2ToDashboard");
  const spo2ToLanding = document.getElementById("spo2ToLanding");

  // Initialize browser history management
  handleBrowserNavigation();
  window.history.replaceState({ view: "landingPage" }, "", "#landingPage");

  // Enter Dashboard (Full View)
  enterDashboardBtn.addEventListener("click", function () {
    navigateToView("mainDashboard", true);
  });

  // Back to Landing Page from Main Dashboard
  backToLandingBtn.addEventListener("click", function () {
    navigateToView("landingPage", true);
  });

  // Feature Card Clicks for Specific Reports
  featureCards.forEach((card) => {
    card.addEventListener("click", function () {
      const reportType = this.getAttribute("data-report");
      if (reportType === "bpm") {
        navigateToView("bpmReport", true);
      } else if (reportType === "spo2") {
        navigateToView("spo2Report", true);
      } else {
        // For hypoxemia and stress, show main dashboard for now
        navigateToView("mainDashboard", true);
      }
    });
  });

  // BPM Report Navigation
  bpmToDashboard.addEventListener("click", function () {
    navigateToView("mainDashboard", true);
  });

  bpmToLanding.addEventListener("click", function () {
    navigateToView("landingPage", true);
  });

  // SpO2 Report Navigation
  spo2ToDashboard.addEventListener("click", function () {
    navigateToView("mainDashboard", true);
  });

  spo2ToLanding.addEventListener("click", function () {
    navigateToView("landingPage", true);
  });

  // ---- Clickable Stat Cards ----
  const statCards = document.querySelectorAll(".clickable-stat");
  statCards.forEach((card) => {
    card.addEventListener("click", function () {
      const reportType = this.getAttribute("data-report");
      if (reportType === "bpm") {
        navigateToView("bpmReport", true);
      } else if (reportType === "spo2") {
        navigateToView("spo2Report", true);
      }
    });
  });

  // ---- Clickable Gauge Labels ----
  const gaugeWrappers = document.querySelectorAll(".gauge-wrapper");
  gaugeWrappers.forEach((gauge) => {
    gauge.addEventListener("click", function () {
      // Check which gauge was clicked based on the label text
      const label = this.querySelector(".gauge-label").textContent;
      if (label.includes("Heart Rate")) {
        navigateToView("bpmReport", true);
      } else if (label.includes("SpO2")) {
        navigateToView("spo2Report", true);
      }
    });
  });

  // Initialize dashboard functionality
  initializeDashboard();
});

function initializeDashboard() {
  // ---------------- Firebase Config ----------------
  const firebaseConfig = {
    apiKey: "AIzaSyAJ2tFrdAT2fFhShvVoPixYK2PaCtN0M2c",
    authDomain: "hypoxemia-and-stress-monitor.firebaseapp.com",
    databaseURL:
      "https://hypoxemia-and-stress-monitor-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "hypoxemia-and-stress-monitor",
    storageBucket: "hypoxemia-and-stress-monitor.firebasestorage.app",
    messagingSenderId: "490451597399",
    appId: "1:490451597399:web:d36e7c23b5c9a05e9fcb12",
    measurementId: "G-X180PM2HSN",
  };

  firebase.initializeApp(firebaseConfig);
  const db = firebase.database();

  // ---------------- Chart.js Data ----------------
  const chartData = {
    labels: [],
    datasets: [
      {
        label: "Heart Rate (bpm)",
        data: [],
        borderColor: "#e63946",
        backgroundColor: "rgba(230, 57, 70, 0.1)",
        fill: true,
        tension: 0.4,
      },
      {
        label: "SpO2 (%)",
        data: [],
        borderColor: "#4361ee",
        backgroundColor: "rgba(67, 97, 238, 0.1)",
        fill: true,
        tension: 0.4,
      },
    ],
  };

  let chart = null;
  let chartInitialized = false;

  // ---- Theme-Responsive Color Functions ----
  function getThemeColors() {
    const style = getComputedStyle(document.documentElement);
    return {
      text: style.getPropertyValue("--text").trim(),
      border: style.getPropertyValue("--border").trim(),
      bpmColor: style.getPropertyValue("--bpm-label-color").trim(),
      spo2Color: style.getPropertyValue("--spo2-label-color").trim(),
      grid: style.getPropertyValue("--border").trim(),
    };
  }

  // ---- Theme-Responsive Mini Gauges ----
  function renderMiniGauges(bpm = 0, spo2 = 0) {
    const colors = getThemeColors();
    drawSmallGauge(
      "bpmGauge",
      bpm,
      0,
      160,
      colors.bpmColor,
      colors.border,
      colors.text
    );
    drawSmallGauge(
      "spo2Gauge",
      spo2,
      0,
      100,
      colors.spo2Color,
      colors.border,
      colors.text
    );
    updateStatsOverview(bpm, spo2);
  }

  function drawSmallGauge(
    containerId,
    value,
    min,
    max,
    arcColor,
    bgColor,
    textColor
  ) {
    const size = 120;
    const center = size / 2;
    const radius = size / 2 - 10;
    const angleRange = 1.5 * Math.PI;
    value = Math.max(min, Math.min(max, value));
    const frac = (value - min) / (max - min);

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    canvas.style.width = size + "px";
    canvas.style.height = size + "px";
    const ctx = canvas.getContext("2d");

    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    // Background arc
    ctx.beginPath();
    ctx.arc(center, center, radius, 0.75 * Math.PI, 0.25 * Math.PI, false);
    ctx.lineWidth = 8;
    ctx.strokeStyle = bgColor;
    ctx.stroke();

    // Value arc
    const endA = 0.75 * Math.PI + frac * angleRange;
    ctx.beginPath();
    ctx.arc(center, center, radius, 0.75 * Math.PI, endA, false);
    ctx.strokeStyle = arcColor;
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.stroke();

    // Number
    ctx.font = "bold 20px 'Segoe UI'";
    ctx.fillStyle = textColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(Math.round(value), center, center);

    // Label
    ctx.font = "12px 'Segoe UI'";
    ctx.fillStyle = textColor;
    ctx.fillText(
      containerId === "bpmGauge" ? "BPM" : "SpO2",
      center,
      center + 25
    );

    document.getElementById(containerId).innerHTML = "";
    document.getElementById(containerId).appendChild(canvas);
  }

  function updateStatsOverview(bpm, spo2) {
    document.getElementById("currentBPM").textContent = bpm || "--";
    document.getElementById("currentSpO2").textContent = spo2 > 0 ? spo2 : "--";
  }

  // ---- Chart.js Drawing ----
  function drawChart() {
    const ctx = document.getElementById("healthChart").getContext("2d");
    const colors = getThemeColors();

    // If chart exists, destroy it first
    if (chart) {
      chart.destroy();
    }

    chart = new Chart(ctx, {
      type: "line",
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 0,
        },
        plugins: {
          legend: {
            labels: {
              color: colors.text,
              font: {
                family: "'Segoe UI', sans-serif",
              },
            },
          },
        },
        scales: {
          x: {
            ticks: {
              color: colors.text,
              font: {
                family: "'Segoe UI', sans-serif",
              },
            },
            grid: {
              color: colors.grid,
            },
          },
          y: {
            ticks: {
              color: colors.text,
              font: {
                family: "'Segoe UI', sans-serif",
              },
            },
            grid: {
              color: colors.grid,
            },
          },
        },
      },
    });
  }

  // ---- Dashboard Update ----
  function updateDashboard(label, bpm, spo2) {
    // Update latest reading
    const latestDiv = document.getElementById("latest");
    latestDiv.innerHTML = `
      <div class="data-item">
        <label>Time:</label>
        <span>${label}</span>
      </div>
      <div class="data-item">
        <label>Heart Rate:</label>
        <span>${bpm ?? 0} bpm</span>
      </div>
      <div class="data-item">
        <label>SpO2:</label>
        <span>${spo2 > 0 ? spo2 : 0} %</span>
      </div>
    `;

    // Update chart data
    chartData.labels.push(label);
    chartData.datasets[0].data.push(bpm ?? 0);
    chartData.datasets[1].data.push(spo2 > 0 ? spo2 : 0);

    if (chartData.labels.length > 30) {
      chartData.labels.shift();
      chartData.datasets[0].data.shift();
      chartData.datasets[1].data.shift();
    }

    lastBPM = bpm ?? 0;
    lastSpo2 = spo2 > 0 ? spo2 : 0;

    // Store historical data
    const timestamp = new Date().toISOString();
    bpmHistory.push({ value: bpm, timestamp, label });
    spo2History.push({ value: spo2, timestamp, label });

    // Keep only last 100 readings
    if (bpmHistory.length > 100) bpmHistory.shift();
    if (spo2History.length > 100) spo2History.shift();

    if (chart) chart.update();

    // Only render mini-gauges if visible
    if (document.getElementById("gaugeRow").style.display !== "none") {
      renderMiniGauges(lastBPM, lastSpo2);
    }
  }

  // ---- View Toggle ----
  const chartContainer = document.getElementById("chartContainer");
  const gaugeRow = document.getElementById("gaugeRow");
  const toggleViewBtn = document.getElementById("toggleViewBtn");

  let showingChart = false;

  toggleViewBtn.addEventListener("click", () => {
    showingChart = !showingChart;
    if (showingChart) {
      chartContainer.style.display = "block";
      gaugeRow.style.display = "none";
      toggleViewBtn.innerHTML =
        '<i class="fas fa-gauge"></i><span>Show Meter</span>';
      if (!chartInitialized) {
        drawChart();
        chartInitialized = true;
      }
      if (chart) chart.update();
    } else {
      chartContainer.style.display = "none";
      gaugeRow.style.display = "flex";
      toggleViewBtn.innerHTML =
        '<i class="fas fa-chart-line"></i><span>Show Chart</span>';
      renderMiniGauges(lastBPM, lastSpo2);
    }
  });

  chartContainer.style.display = "none";
  gaugeRow.style.display = "flex";
  toggleViewBtn.innerHTML =
    '<i class="fas fa-chart-line"></i><span>Show Chart</span>';

  // ---- Firebase Data ----
  const sensorDataRef = db.ref("SensorData");
  const predictionsRef = db.ref("predictions");

  sensorDataRef.on("child_added", (snapshot) => {
    const data = snapshot.val();
    console.log("Firebase data received:", data); // Debug log

    const label =
      `${data.date ?? ""} ${data.time ?? ""}`.trim() ||
      new Date().toLocaleTimeString();
    updateDashboard(
      label,
      Number(data.dev60_HR) || 0,
      Number(data.saturation) || 0
    );
  });

  predictionsRef.limitToLast(1).on("child_added", (snapshot) => {
    const pred = snapshot.val();
    if (!pred) return;

    const predictionsDiv = document.getElementById("predictions");
    predictionsDiv.innerHTML = `
      <div class="alert-header">
        <i class="fas fa-brain"></i>
        <h4>AI Predictions</h4>
      </div>
      <div class="alert-content">
        <p><strong>Stress Level:</strong> ${pred.stress_class}</p>
        <p><strong>Hypoxemia:</strong> ${pred.hypoxemia_class}</p>
      </div>
    `;

    // Update stats overview
    document.getElementById("currentStress").textContent = pred.stress_class;
    document.getElementById("currentHypoxemia").textContent =
      pred.hypoxemia_class;

    predictionsDiv.classList.remove("good", "warning", "danger", "neutral");
    if (pred.stress_class === "High" || pred.hypoxemia_class === "Yes") {
      predictionsDiv.classList.add("danger");
    } else if (pred.stress_class === "Moderate") {
      predictionsDiv.classList.add("warning");
    } else {
      predictionsDiv.classList.add("good");
    }
  });

  // Initial render
  renderMiniGauges(0, 0);
}

// ---- BPM Report Functions ----
function initializeBPMReport() {
  const db = firebase.database();
  const sensorDataRef = db.ref("SensorData");

  // Listen for new readings in real-time
  sensorDataRef.limitToLast(10).on("child_added", (snapshot) => {
    const data = snapshot.val();
    const currentBPM = Number(data.dev60_HR) || 0;
    const label =
      `${data.date ?? ""} ${data.time ?? ""}`.trim() ||
      new Date().toLocaleTimeString();

    // Push to history
    bpmHistory.push({
      value: currentBPM,
      timestamp: new Date().toISOString(),
      label,
    });
    if (bpmHistory.length > 100) bpmHistory.shift(); // Keep last 100 readings

    // Update UI
    document.getElementById("bpmCurrent").textContent = currentBPM;
    document.getElementById("bpmAverage").textContent = calculateBPMAverage();
    document.getElementById("bpmMax").textContent = calculateBPMMax();
    document.getElementById("bpmMin").textContent = calculateBPMMin();

    updateBPMStatus(currentBPM);
    updateBPMAnalysis(currentBPM);
    updateBPMReadings();
    initializeBPMChart();
  });
}

function calculateBPMAverage() {
  if (bpmHistory.length === 0) return "--";
  const sum = bpmHistory.reduce(
    (acc, reading) => acc + (reading.value || 0),
    0
  );
  return Math.round(sum / bpmHistory.length);
}

function calculateBPMMax() {
  if (bpmHistory.length === 0) return "--";
  return Math.max(...bpmHistory.map((reading) => reading.value || 0));
}

function calculateBPMMin() {
  if (bpmHistory.length === 0) return "--";
  const validReadings = bpmHistory
    .map((reading) => reading.value || 0)
    .filter((val) => val > 0);
  return validReadings.length > 0 ? Math.min(...validReadings) : "--";
}

function updateBPMStatus(bpm) {
  const statusElement = document.getElementById("bpmStatus");
  let status, message, statusClass;

  if (bpm < 60) {
    status = "Low";
    message = "Heart rate is below normal range";
    statusClass = "status-warning";
  } else if (bpm > 100) {
    status = "High";
    message = "Heart rate is above normal range";
    statusClass = "status-danger";
  } else {
    status = "Normal";
    message = "Heart rate is within healthy range";
    statusClass = "status-normal";
  }

  statusElement.innerHTML = `<h4>Status: ${status}</h4><p>${message}</p>`;
  statusElement.className = `status-indicator ${statusClass}`;
}

function updateBPMAnalysis(bpm) {
  if (bpmHistory.length === 0) return;

  // Calculate real variability from historical data
  const recentBPM = bpmHistory
    .slice(-10)
    .map((reading) => reading.value || 0)
    .filter((val) => val > 0);
  let variability = "-- ms";
  if (recentBPM.length > 1) {
    const differences = [];
    for (let i = 1; i < recentBPM.length; i++) {
      differences.push(Math.abs(recentBPM[i] - recentBPM[i - 1]));
    }
    const avgDifference =
      differences.reduce((a, b) => a + b, 0) / differences.length;
    variability = `${Math.round(avgDifference)} ms`;
  }
  document.getElementById("bpmVariability").textContent = variability;

  // Calculate real trend
  let trend = "Stable";
  if (bpmHistory.length >= 3) {
    const recentValues = bpmHistory
      .slice(-3)
      .map((reading) => reading.value || 0);
    const trendDiff = recentValues[2] - recentValues[0];
    if (trendDiff > 5) trend = "Increasing";
    else if (trendDiff < -5) trend = "Decreasing";
  }
  document.getElementById("bpmTrend").textContent = trend;

  // Update zone based on actual BPM
  let zone = "Resting";
  if (bpm > 100) zone = "Active";
  else if (bpm > 120) zone = "Exercise";
  document.getElementById("bpmZone").textContent = zone;

  // Calculate real historical averages (last hour simulation)
  const hourAvg = calculateRecentAverage(bpmHistory, 60); // Last 60 readings
  const dayAvg = calculateRecentAverage(bpmHistory, 100); // Last 100 readings

  document.getElementById("bpmHourAvg").textContent =
    hourAvg > 0 ? `${Math.round(hourAvg)} bpm` : "--";
  document.getElementById("bpmDayAvg").textContent =
    dayAvg > 0 ? `${Math.round(dayAvg)} bpm` : "--";
  document.getElementById("bpmPeak").textContent = calculateBPMMax();
  document.getElementById("bpmLow").textContent = calculateBPMMin();

  // Update health insights based on real data
  document.getElementById("cardiacLoad").textContent =
    bpm > 90 ? "Moderate" : "Low";
  document.getElementById("recoveryIndex").textContent =
    bpm < 70 ? "Excellent" : "Good";
  document.getElementById("fitnessLevel").textContent =
    bpm < 65 ? "High" : "Average";
}

function updateBPMReadings() {
  const readingsContainer = document.getElementById("bpmReadings");
  const recentReadings = bpmHistory.slice(-10).reverse();

  if (recentReadings.length === 0) {
    readingsContainer.innerHTML =
      "<p>No recent heart rate readings available</p>";
    return;
  }

  readingsContainer.innerHTML = recentReadings
    .map(
      (reading) => `
    <div class="data-item">
      <label>${reading.label}:</label>
      <span>${reading.value || 0} bpm</span>
    </div>
  `
    )
    .join("");
}

function initializeBPMChart() {
  const ctx = document.getElementById("bpmChart").getContext("2d");
  const bpmData = bpmHistory.map((reading) => reading.value || 0);
  const labels = bpmHistory.map((reading) => reading.label);

  // Clear previous chart if exists
  if (window.bpmChartInstance) {
    window.bpmChartInstance.destroy();
  }

  window.bpmChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Heart Rate (bpm)",
          data: bpmData,
          borderColor: "#ff6b6b",
          backgroundColor: "rgba(255, 107, 107, 0.1)",
          fill: true,
          tension: 0.4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: "#f5f5f5",
          },
        },
      },
      scales: {
        x: {
          ticks: { color: "#f5f5f5" },
          grid: { color: "#333" },
        },
        y: {
          ticks: { color: "#f5f5f5" },
          grid: { color: "#333" },
        },
      },
    },
  });
}

// ---- SpO2 Report Functions ----
function initializeSpO2Report() {
  const db = firebase.database();
  const sensorDataRef = db.ref("SensorData");

  // Listen for new readings in real-time
  sensorDataRef.limitToLast(10).on("child_added", (snapshot) => {
    const data = snapshot.val();
    const currentSpO2 = Number(data.saturation) || 0;
    const label =
      `${data.date ?? ""} ${data.time ?? ""}`.trim() ||
      new Date().toLocaleTimeString();

    // Push to history
    spo2History.push({
      value: currentSpO2,
      timestamp: new Date().toISOString(),
      label,
    });
    if (spo2History.length > 100) spo2History.shift(); // Keep last 100 readings

    // Update UI
    document.getElementById("spo2Current").textContent = currentSpO2;
    document.getElementById("spo2Average").textContent = calculateSpO2Average();
    document.getElementById("spo2Max").textContent = calculateSpO2Max();
    document.getElementById("spo2Min").textContent = calculateSpO2Min();

    updateSpO2Status(currentSpO2);
    updateSpO2Analysis(currentSpO2);
    updateSpO2Readings();
    initializeSpO2Chart();
  });
}

function calculateSpO2Average() {
  if (spo2History.length === 0) return "--";
  const validReadings = spo2History
    .map((reading) => reading.value || 0)
    .filter((val) => val > 0);
  if (validReadings.length === 0) return "--";
  const sum = validReadings.reduce((acc, value) => acc + value, 0);
  return Math.round(sum / validReadings.length);
}

function calculateSpO2Max() {
  if (spo2History.length === 0) return "--";
  const validReadings = spo2History
    .map((reading) => reading.value || 0)
    .filter((val) => val > 0);
  return validReadings.length > 0 ? Math.max(...validReadings) : "--";
}

function calculateSpO2Min() {
  if (spo2History.length === 0) return "--";
  const validReadings = spo2History
    .map((reading) => reading.value || 0)
    .filter((val) => val > 0);
  return validReadings.length > 0 ? Math.min(...validReadings) : "--";
}

function updateSpO2Status(spo2) {
  const statusElement = document.getElementById("spo2Status");
  let status, message, statusClass;

  if (spo2 < 90) {
    status = "Critical";
    message = "Oxygen level is critically low";
    statusClass = "status-danger";
  } else if (spo2 < 95) {
    status = "Warning";
    message = "Oxygen level is below normal";
    statusClass = "status-warning";
  } else {
    status = "Normal";
    message = "Oxygen levels are within healthy range";
    statusClass = "status-normal";
  }

  statusElement.innerHTML = `<h4>Status: ${status}</h4><p>${message}</p>`;
  statusElement.className = `status-indicator ${statusClass}`;
}

function updateSpO2Analysis(spo2) {
  if (spo2History.length === 0) return;

  // Calculate stability from historical data
  const recentSpO2 = spo2History
    .slice(-10)
    .map((reading) => reading.value || 0)
    .filter((val) => val > 0);
  let stability = "Stable";
  if (recentSpO2.length > 1) {
    const maxDiff = Math.max(...recentSpO2) - Math.min(...recentSpO2);
    if (maxDiff <= 2) stability = "Very Stable";
    else if (maxDiff <= 5) stability = "Stable";
    else stability = "Variable";
  }
  document.getElementById("spo2Stability").textContent = stability;

  // Calculate real trend
  let trend = "Good";
  if (spo2History.length >= 3) {
    const recentValues = spo2History
      .slice(-3)
      .map((reading) => reading.value || 0);
    const trendDiff = recentValues[2] - recentValues[0];
    if (trendDiff > 1) trend = "Improving";
    else if (trendDiff < -1) trend = "Declining";
    else trend = "Stable";
  }
  document.getElementById("spo2Trend").textContent = trend;

  // Update quality based on actual value and stability
  let quality = "Good";
  if (spo2 >= 98 && stability === "Very Stable") quality = "Excellent";
  else if (spo2 >= 95) quality = "Good";
  else quality = "Fair";
  document.getElementById("spo2Quality").textContent = quality;

  // Calculate real historical averages
  const hourAvg = calculateRecentAverage(spo2History, 60);
  const dayAvg = calculateRecentAverage(spo2History, 100);

  document.getElementById("spo2HourAvg").textContent =
    hourAvg > 0 ? `${Math.round(hourAvg)}%` : "--";
  document.getElementById("spo2DayAvg").textContent =
    dayAvg > 0 ? `${Math.round(dayAvg)}%` : "--";
  document.getElementById("spo2Peak").textContent = calculateSpO2Max();
  document.getElementById("spo2Low").textContent = calculateSpO2Min();

  // Update risk assessment based on real data
  document.getElementById("hypoxemiaRisk").textContent =
    spo2 < 90 ? "High" : spo2 < 94 ? "Moderate" : "Low";
  document.getElementById("oxygenEfficiency").textContent =
    spo2 >= 97 ? "Excellent" : spo2 >= 95 ? "Good" : "Fair";
  document.getElementById("respiratoryHealth").textContent =
    spo2 >= 96 ? "Normal" : "Monitor";
}

// Add this helper function to calculate recent averages
function calculateRecentAverage(history, count) {
  const recent = history
    .slice(-count)
    .map((reading) => reading.value || 0)
    .filter((val) => val > 0);
  if (recent.length === 0) return 0;
  return recent.reduce((a, b) => a + b, 0) / recent.length;
}

function updateSpO2Readings() {
  const readingsContainer = document.getElementById("spo2Readings");
  const recentReadings = spo2History.slice(-10).reverse();

  if (recentReadings.length === 0) {
    readingsContainer.innerHTML = "<p>No recent SpO2 readings available</p>";
    return;
  }

  readingsContainer.innerHTML = recentReadings
    .map(
      (reading) => `
    <div class="data-item">
      <label>${reading.label}:</label>
      <span>${reading.value || 0} %</span>
    </div>
  `
    )
    .join("");
}

function initializeSpO2Chart() {
  const ctx = document.getElementById("spo2Chart").getContext("2d");
  const spo2Data = spo2History.map((reading) => reading.value || 0);
  const labels = spo2History.map((reading) => reading.label);

  // Clear previous chart if exists
  if (window.spo2ChartInstance) {
    window.spo2ChartInstance.destroy();
  }

  window.spo2ChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "SpO2 (%)",
          data: spo2Data,
          borderColor: "#51cf66",
          backgroundColor: "rgba(81, 207, 102, 0.1)",
          fill: true,
          tension: 0.4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: "#f5f5f5",
          },
        },
      },
      scales: {
        x: {
          ticks: { color: "#f5f5f5" },
          grid: { color: "#333" },
        },
        y: {
          ticks: { color: "#f5f5f5" },
          grid: { color: "#333" },
        },
      },
    },
  });
}

function refreshBPMReport() {
  if (document.getElementById("bpmReport").style.display !== "block") return;

  const currentBPM = lastBPM || 72;
  document.getElementById("bpmCurrent").textContent = currentBPM;
  document.getElementById("bpmAverage").textContent = calculateBPMAverage();
  document.getElementById("bpmMax").textContent = calculateBPMMax();
  document.getElementById("bpmMin").textContent = calculateBPMMin();
  updateBPMStatus(currentBPM);
  updateBPMAnalysis(currentBPM);
  updateBPMReadings();

  if (window.bpmChartInstance) {
    window.bpmChartInstance.data.labels = bpmHistory.map((r) => r.label);
    window.bpmChartInstance.data.datasets[0].data = bpmHistory.map(
      (r) => r.value || 0
    );
    window.bpmChartInstance.update();
  }
}

function refreshSpO2Report() {
  if (document.getElementById("spo2Report").style.display !== "block") return;

  const currentSpO2 = lastSpo2 || 98;
  document.getElementById("spo2Current").textContent = currentSpO2;
  document.getElementById("spo2Average").textContent = calculateSpO2Average();
  document.getElementById("spo2Max").textContent = calculateSpO2Max();
  document.getElementById("spo2Min").textContent = calculateSpO2Min();
  updateSpO2Status(currentSpO2);
  updateSpO2Analysis(currentSpO2);
  updateSpO2Readings();

  if (window.spo2ChartInstance) {
    window.spo2ChartInstance.data.labels = spo2History.map((r) => r.label);
    window.spo2ChartInstance.data.datasets[0].data = spo2History.map(
      (r) => r.value || 0
    );
    window.spo2ChartInstance.update();
  }
}

import React, { useState, useEffect } from "react";
import {
  FaSnowflake,
  FaLightbulb,
  FaMusic,
  FaRegSnowflake,
  FaWifi,
  FaBluetooth,
  FaMicrophone,
  FaDoorOpen,
  FaRegDotCircle,
} from "react-icons/fa";
import { Chart, Line } from "react-chartjs-2";
import "chart.js/auto";
import { CSSTransition, TransitionGroup } from "react-transition-group";
import { useHistory } from "react-router-dom";
import { auth } from "../utils/firebase";
import { getDatabase, ref, onValue, update } from "firebase/database";

function getTimeLabels() {
  const now = new Date();
  // Làm tròn xuống 30 phút gần nhất
  now.setMinutes(now.getMinutes() - (now.getMinutes() % 30), 0, 0);
  const labels = [];
  for (let i = 15; i >= 0; i--) {
    // 24 mốc cho 12 tiếng
    const d = new Date(now.getTime() - i * 30 * 60 * 1000);
    labels.push(
      d.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    );
  }
  return labels;
}

const timeLabels = getTimeLabels();
// const humidityData = Array.from(
//   { length: 16 },
//   () => Math.floor(Math.random() * 30) + 40
// );
// const temperatureData = Array.from(
//   { length: 16 },
//   () => Math.floor(Math.random() * 10) + 20
// );

function HomePage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [loading, setLoading] = useState(true);
  const [deviceStates, setDeviceStates] = useState({
    doorState: false,
    fanState: false,
    light1State: false,
    light2State: false,
  });
  const [chartData, setChartData] = useState({
    humidity: Array(timeLabels.length).fill(null),
    temperature: Array(timeLabels.length).fill(null),
  });
  const history = useHistory();

  useEffect(() => {
    // Lắng nghe trạng thái đăng nhập
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setLoading(false);
      if (!user) {
        history.replace("/login");
      }
    });
    return () => unsubscribe();
  }, [history]);

  useEffect(() => {
    const db = getDatabase();
    const dbRef = ref(db);
    const off = onValue(dbRef, (snapshot) => {
      const data = snapshot.val();
      console.log("Firebase data:", data);
      setDeviceStates({
        doorState: data.doorState,
        fanState: data.fanState,
        light1State: data.light1State,
        light2State: data.light2State,
      });
      console.log("Device states:", deviceStates);
      // Lấy dữ liệu humidity và temperature từ Firebase
      const humidityObj = data.humidity || {};
      const temperatureObj = data.temperature || {};
      console.log("humidityObj:", humidityObj);
      console.log("temperatureObj:", temperatureObj);

      // Map dữ liệu vào đúng mốc thời gian
      const humidityArr = timeLabels.map((label) =>
        humidityObj[label] !== undefined ? humidityObj[label] : 0
      );
      const temperatureArr = timeLabels.map((label) =>
        temperatureObj[label] !== undefined ? temperatureObj[label] : 0
      );

      setChartData({
        humidity: humidityArr,
        temperature: temperatureArr,
      });
    });
    return () => off();
  }, []);

  useEffect(() => {
    const handler = (e) => {
      setSidebarCollapsed(e.detail);
    };
    window.addEventListener("sidebar:collapse", handler);
    return () => window.removeEventListener("sidebar:collapse", handler);
  }, []);

  // Hàm cập nhật trạng thái thiết bị lên Firebase
  const handleToggle = (key, value) => {
    const db = getDatabase();
    update(ref(db), { [key]: value });
  };

  if (loading) return null;

  const monitorData = {
    labels: timeLabels,
    datasets: [
      {
        label: "Humidity",
        data: chartData.humidity,
        borderColor: "#00bcd4",
        backgroundColor: "rgba(0,188,212,0.0)",
        borderWidth: 3,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 0,
        fill: false,
        yAxisID: "y",
      },
      {
        label: "Temperature",
        data: chartData.temperature,
        borderColor: "#d6a4ff",
        backgroundColor: "rgba(214,164,255,0.0)",
        borderWidth: 3,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 0,
        fill: false,
        yAxisID: "y",
      },
    ],
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url('https://images.wallpaperscraft.com/image/single/furniture_sofa_white_83779_1920x1080.jpg') center/cover no-repeat`,
        fontFamily: "Inter, sans-serif",
        position: "relative",
        overflowX: "auto",
      }}
    >
      <div style={{ padding: 32 }}>
        <div
          style={{
            width: "fit-content",
            minWidth: "100vw",
          }}
        >
          <div
            className="homepage-main-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 1.8fr",
              gridTemplateRows: "auto auto",
              gap: 32,
              position: "relative",
              zIndex: 2,
              color: "#fff",
              transition: "margin-left 0.5s",
              paddingBottom: "32px",
              margin: "0 auto",
              width: "100%",
              maxWidth: 1100,
            }}
          >
            {/* Left Column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {/* Active Devices */}
              <div style={glassCard}>
                <h3 style={{ fontWeight: 600 }}>Active Devices</h3>
                <p
                  style={{
                    fontSize: 13,
                    color: "rgba(255,255,255,0.8)",
                    marginBottom: 16,
                  }}
                >
                  Track Active Devices for connectivity.
                </p>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                  }}
                >
                  <DeviceCard
                    icon={<FaLightbulb size={22} />}
                    name="Living Room"
                    time="6hr 10min"
                    checked={deviceStates.light1State}
                    onToggle={() =>
                      handleToggle("light1State", !deviceStates.light1State)
                    }
                  />
                  <DeviceCard
                    icon={<FaLightbulb size={22} />}
                    name="Kitchen"
                    time="3hr 45min"
                    checked={deviceStates.light2State}
                    onToggle={() =>
                      handleToggle("light2State", !deviceStates.light2State)
                    }
                  />
                  <DeviceCard
                    icon={<FaRegDotCircle size={22} />}
                    name="Fan"
                    time="2hr 30min"
                    checked={deviceStates.fanState}
                    onToggle={() =>
                      handleToggle("fanState", !deviceStates.fanState)
                    }
                  />
                  <DeviceCard
                    icon={<FaDoorOpen size={22} />}
                    name="Door"
                    time="Opened 1 time"
                    checked={deviceStates.doorState}
                    onToggle={() =>
                      handleToggle("doorState", !deviceStates.doorState)
                    }
                  />
                </div>
              </div>
              {/* Camera */}
              <div
                style={{
                  ...glassCard,
                  padding: 0,
                  overflow: "hidden",
                  position: "relative",
                  minHeight: 180,
                }}
              >
                <SlideshowImages />
                <div
                  style={{
                    position: "absolute",
                    top: 12,
                    left: 12,
                    background: "rgba(255,0,0,0.7)",
                    color: "#fff",
                    borderRadius: 8,
                    padding: "2px 10px",
                    fontSize: 12,
                  }}
                >
                  ● Live
                </div>
                <div
                  style={{
                    position: "absolute",
                    top: 12,
                    right: 12,
                    display: "flex",
                    gap: 8,
                  }}
                >
                  <FaRegDotCircle size={18} style={{ color: "#fff" }} />
                  <FaLightbulb size={18} style={{ color: "#fff" }} />
                  <FaMusic size={18} style={{ color: "#fff" }} />
                </div>
              </div>
              {/* Voice Assistant */}
              <div
                style={{
                  ...glassCard,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <FaMicrophone size={22} />
                  <span style={{ fontWeight: 600 }}>Voice Assistant</span>
                </div>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.8)" }}>
                  Voice control your smart home.
                </span>
                <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                  <SwitchIcon
                    icon={<FaBluetooth />}
                    label="Bluetooth"
                    checked={true}
                    subLabel="Connected to JBL"
                  />
                  <SwitchIcon
                    icon={<FaWifi />}
                    label="WIFI"
                    subLabel="Disconnected"
                  />
                </div>
              </div>
            </div>
            {/* Right Column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {/* Humidity & Temperature Status Bar*/}
              <div style={{ display: "flex", gap: 16 }}>
                <HumidityStatusBar
                  value={chartData.humidity[chartData.humidity.length - 1]}
                />
                <TemperatureStatusBar
                  value={
                    chartData.temperature[chartData.temperature.length - 1]
                  }
                />
              </div>
              {/* Humidity & Temperature Chart */}
              <div
                style={{
                  ...glassCard,
                  flex: 1,
                  minHeight: "30vh",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  paddingTop: 8,
                  paddingBottom: "20vh",
                }}
              >
                <h3 style={{ fontWeight: 600, marginBottom: 0, marginTop: 0 }}>
                  Humidity & Temperature
                </h3>
                <span
                  style={{
                    fontSize: 13,
                    color: "rgba(255,255,255,0.8)",
                    marginBottom: 8,
                  }}
                >
                  Monitor humidity and temperature.
                </span>
                <div style={{ height: 180 }}>
                  <Line data={monitorData} options={energyOptions} />
                </div>
              </div>
              {/* Doorbell & Homepad Mini */}
              <div style={{ display: "flex", gap: 16 }}>
                <div
                  style={{
                    ...glassCard,
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <FaDoorOpen size={38} style={{ color: "#222" }} />
                  <span style={{ fontWeight: 600 }}>Doorbell</span>
                  <Switch checked={false} />
                </div>
                <div
                  style={{
                    ...glassCard,
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <img
                    src="https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/homepod-mini-select-202110?wid=2000&hei=2000&fmt=jpeg&qlt=95&.v=1632925511000"
                    alt="Homepad Mini"
                    style={{ width: 48, height: 48, borderRadius: "50%" }}
                  />
                  <span style={{ fontWeight: 600 }}>Homepad Mini</span>
                  <Switch checked={false} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @media (max-width: 768px) {
          .homepage-main-grid {
            width: 100vw !important;
            min-width: 110vw !important;
            max-width: none !important;
            margin: 0 !important;
            overflow-x: auto !important;
            padding-right: 24px !important;
          }
        }
      `}</style>
    </div>
  );
}

const energyOptions = {
  responsive: true,
  plugins: {
    legend: {
      display: true,
      position: "bottom",
      align: "center",
      labels: {
        color: "#fff",
        font: { size: 15, weight: "bold" },
        usePointStyle: true,
        padding: 16,
        boxWidth: 18,
        boxHeight: 4,
        pointStyle: "line",
        generateLabels: (chart) => [
          {
            text: "Humidity",
            fillStyle: "#00bcd4",
            strokeStyle: "#00bcd4",
            pointStyle: "line",
            fontColor: "#00bcd4",
          },
          {
            text: "Temperature",
            fillStyle: "#d6a4ff",
            strokeStyle: "#d6a4ff",
            pointStyle: "line",
            fontColor: "#d6a4ff",
          },
        ],
      },
    },
    tooltip: {
      enabled: true,
      backgroundColor: "#fff",
      titleColor: "#222",
      bodyColor: "#222",
      borderColor: "#eee",
      borderWidth: 1,
      displayColors: false,
      callbacks: {
        title: (ctx) => ctx[0]?.label || "",
        label: (ctx) => {
          if (ctx.dataset.label === "Humidity") {
            return `Humidity: ${ctx.parsed.y}%`;
          }
          if (ctx.dataset.label === "Temperature") {
            return `Temperature: ${ctx.parsed.y}°C`;
          }
          return "";
        },
        labelTextColor: (ctx) =>
          ctx.dataset.label === "Temperature" ? "#d6a4ff" : "#00bcd4",
      },
      bodyFont: { weight: "bold", size: 15 },
      padding: 14,
      caretSize: 6,
      cornerRadius: 8,
      yAlign: "bottom",
      xAlign: "center",
      boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    },
    annotation: {
      annotations: {}, // bỏ đường kẻ dọc cuối
    },
  },
  scales: {
    y: {
      display: false,
      grid: {
        color: "rgba(255,255,255,0.08)",
        drawBorder: false,
      },
    },
    x: {
      display: true,
      grid: {
        color: "rgba(255,255,255,0.08)",
        drawBorder: false,
      },
      ticks: {
        color: "#fff",
        font: { size: 13 },
        padding: 8,
      },
    },
  },
  layout: {
    padding: { top: 0, right: 16, bottom: 0, left: 16 },
  },
  elements: {
    line: {
      borderWidth: 3,
    },
    point: {
      radius: 0,
      hoverRadius: 6,
      hitRadius: 16,
    },
  },
};

// Glassmorphism card style
const glassCard = {
  background: "rgba(40,40,60,0.32)",
  borderRadius: 24,
  boxShadow: "0 8px 32px 0 rgba(31,38,135,0.18)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  border: "1px solid rgba(255,255,255,0.10)",
  padding: 24,
  color: "#fff",
};

// Device Card
function DeviceCard({ icon, name, on, time, power, checked, onToggle }) {
  return (
    <div
      style={{
        ...glassCard,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 4,
        padding: "12px 16px 16px 16px",
        background: "rgba(255,255,255,0.18)",
        border: "1.5px solid #fff",
        minHeight: 100,
        justifyContent: "flex-start",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          color: "#fff",
          fontSize: 18,
          fontWeight: 700,
          marginBottom: 2,
        }}
      >
        {icon}
        <span style={{ fontWeight: 700, fontSize: 17 }}>{name}</span>
      </div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}>{time}</div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}>
        {power}
      </div>
      <Switch checked={checked} onToggle={onToggle} />
    </div>
  );
}

// Switch dạng button
function Switch({ checked, onToggle }) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={onToggle}
      style={{
        display: "inline-block",
        width: 44,
        height: 24,
        borderRadius: 12,
        background: checked ? "#00bcd4" : "#444a5a",
        border: checked ? "2px solid #00bcd4" : "2px solid #888",
        position: "relative",
        transition: "background 0.2s, border 0.2s",
        outline: "none",
        cursor: "pointer",
        boxShadow: checked ? "0 0 6px #00bcd4" : "none",
        padding: 0,
        verticalAlign: "middle",
        marginTop: 8,
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
      }}
    >
      <span
        style={{
          display: "block",
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: checked ? "#fff" : "#bbb",
          position: "absolute",
          left: checked ? 22 : 2,
          top: "50%",
          transform: "translateY(-50%)",
          transition: "left 0.2s, background 0.2s",
          boxShadow: checked ? "0 0 4px #00bcd4" : "none",
        }}
      />
    </button>
  );
}

// Switch with icon and label
function SwitchIcon({ icon, label, checked, subLabel }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 2,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {icon}
        <span style={{ fontWeight: 500 }}>{label}</span>
        <Switch checked={checked} />
      </div>
      {subLabel && (
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.8)" }}>
          {subLabel}
        </span>
      )}
    </div>
  );
}

// Tạo component HumidityStatusBar để xử lý logic đặc biệt cho Humidity
function HumidityStatusBar({ value, ...props }) {
  // Thanh đầy nhất khi gần 50%
  let percent = 100 - Math.abs(value - 50) * 2;
  percent = Math.max(0, percent);
  // Status
  const diff = Math.abs(value - 50);
  let status = "";
  if (diff <= 5) status = "Very Good";
  else if (diff <= 15) status = "Good";
  else if (diff <= 30) status = "Normal";
  else status = "Bad";
  return (
    <StatusBar
      label="Humidity"
      value={value}
      status={status}
      color="#00bcd4"
      unit="%"
      gradient="linear-gradient(90deg, #00bcd4 0%, #2196f3 100%)"
      iconSrc="/icons/humidity-svgrepo-com.svg"
      alt="Humidity"
      percent={percent}
      {...props}
    />
  );
}

// Tạo component TemperatureStatusBar để xử lý logic đặc biệt cho Temperature
function TemperatureStatusBar({ value, ...props }) {
  // Clamp giá trị từ 10 đến 35
  const temp = Math.max(10, Math.min(35, value));
  // Thanh đầy nhất khi gần 25°C
  let percent = 100 - Math.abs(temp - 25) * (100 / 10); // 10 là khoảng cách max từ 25 đến 35 hoặc 10
  percent = Math.max(0, percent);
  // Status
  let status = "";
  if (temp >= 24 && temp <= 25) status = "Very Good";
  else if ((temp >= 22 && temp < 24) || (temp > 25 && temp <= 27))
    status = "Good";
  else if ((temp >= 20 && temp < 22) || (temp > 27 && temp <= 29))
    status = "Normal";
  else status = "Bad";
  return (
    <StatusBar
      label="Temperature"
      value={value}
      status={status}
      color="#d6a4ff"
      unit="°C"
      gradient="linear-gradient(90deg, #d6a4ff 0%, #ff6ec4 100%)"
      iconSrc="/icons/temperature.svg"
      alt="Temperature"
      percent={percent}
      {...props}
    />
  );
}

// StatusBar nhận thêm prop percent (nếu có) để custom chiều dài thanh
function StatusBar({
  label,
  value,
  status,
  color,
  unit,
  gradient,
  iconSrc,
  alt,
  percent,
}) {
  return (
    <div
      style={{
        ...glassCard,
        flex: 1,
        minWidth: 180,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 8,
        padding: 18,
      }}
    >
      <span
        style={{
          fontWeight: 500,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {label}
        {iconSrc && (
          <img
            src={iconSrc}
            alt={alt || label}
            style={{
              width: 28,
              height: 28,
              marginLeft: 0,
              verticalAlign: "middle",
              filter: "invert(1) brightness(2)",
            }}
          />
        )}
      </span>
      <div style={{ fontSize: 28, fontWeight: 700 }}>
        {value}
        <span style={{ fontSize: 16, fontWeight: 400 }}>{unit}</span>
      </div>
      <div
        style={{
          width: "100%",
          height: 6,
          background: "#eee",
          borderRadius: 4,
          overflow: "hidden",
          margin: "8px 0",
        }}
      >
        <div
          style={{
            width: `${percent !== undefined ? percent : value}%`,
            height: "100%",
            background: gradient || color,
            borderRadius: 4,
            transition: "width 0.3s",
          }}
        />
      </div>
      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.8)" }}>
        {status}
      </span>
    </div>
  );
}

const slideshowImages = [
  "https://images.unsplash.com/photo-1507089947368-19c1da9775ae?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1465101046530-73398c7f28ca?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1519125323398-675f0ddb6308?auto=format&fit=crop&w=800&q=80",
];

function SlideshowImages() {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState("next");

  useEffect(() => {
    const timer = setInterval(() => {
      setDirection("next");
      setIndex((prev) => (prev + 1) % slideshowImages.length);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div style={{ width: "100%", height: 180, position: "relative" }}>
      <TransitionGroup component={null}>
        <CSSTransition
          key={slideshowImages[index]}
          timeout={600}
          classNames={direction === "next" ? "slide-next" : "slide-prev"}
        >
          <img
            src={slideshowImages[index]}
            alt="room"
            style={{
              width: "100%",
              height: 180,
              objectFit: "cover",
              position: "absolute",
              left: 0,
              top: 0,
              borderRadius: 0,
              transition: "all 0.6s cubic-bezier(.77,0,.18,1)",
            }}
          />
        </CSSTransition>
      </TransitionGroup>
    </div>
  );
}

export default HomePage;

import React, { useEffect, useState } from "react";
import CollapsibleNavItem from "./CollapsibleNavItem";
import NavItem from "./NavItem";
import { useTranslation } from "react-i18next";
import { loadPageScript } from "../../utils/pagescript";

const Sidebar = () => {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/login";
  };

  useEffect(() => {
    loadPageScript();
  });

  // Ẩn sidebar khi resize về mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 768) setCollapsed(true);
      else setCollapsed(false);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <>
      {/* Nút mở sidebar khi đang ẩn (luôn hiển thị ở mọi kích thước) */}
      {collapsed && (
        <button
          className="sidebar-toggle-btn-mobile"
          onClick={() => setCollapsed(false)}
          style={{
            position: "fixed",
            top: 24,
            left: 8,
            zIndex: 2001,
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "#f3f3f3",
            border: "none",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <span style={{ fontSize: 24, color: "#222" }}>&#8250;</span>
        </button>
      )}
      <ul
        className={`navbar-nav bg-white sidebar accordion iot-sidebar${collapsed ? " sidebar-collapsed-mobile" : ""}`}
        id="accordionSidebar"
        style={{
          color: "#666",
          position: "fixed",
          top: 0,
          left: 0,
          height: "100vh",
          zIndex: 2000,
          transition: "transform 0.3s cubic-bezier(.77,0,.18,1)",
          transform: collapsed ? "translateX(-100%)" : "translateX(0)",
          boxShadow: collapsed ? "none" : "2px 0 12px rgba(0,0,0,0.08)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "18px 0 18px 0",
        }}
      >
        {/* Nút thu gọn sidebar (luôn hiển thị ở mọi kích thước) */}
        {!collapsed && (
          <button
            className="sidebar-toggle-btn-mobile"
            onClick={() => setCollapsed(true)}
            style={{
              position: "absolute",
              top: 24,
              right: -22,
              zIndex: 2001,
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "#f3f3f3",
              border: "none",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 24, color: "#222", transform: "rotate(180deg)" }}>&#8250;</span>
          </button>
        )}
        <a
          className="sidebar-brand d-flex align-items-center justify-content-center"
          href="/"
          style={{ color: "#00bcd4" }}
        >
          <div className="sidebar-brand-icon rotate-n-15">
            <i className="fas fa-chart-line"></i>
          </div>
          <div className="sidebar-brand-text mx-3">IoT DashBoard</div>
        </a>

        <hr className="sidebar-divider my-0" />

        <NavItem icon={"fa-home"} link={"/"} text={t("home")} />

        <NavItem icon={"fa-user"} link={"/profile"} text={t("profile")} />
        <NavItem icon={"fa-comments"} link={"/chat"} text={"Chat"} />
        <NavItem icon={"fa-cogs"} link={"/settings"} text={t("settings")} />
        <button
          className="sidebar-logout-btn"
          onClick={handleLogout}
          style={{
            gap: "2px",
            background: "transparent",
            border: "none",
            color: "red",
            cursor: "pointer",
            textAlign: "center",
            fontSize: "13px",
            transition: "background-color 0.2s",
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#f5f5f5")}
          onMouseOut={(e) =>
            (e.currentTarget.style.backgroundColor = "transparent")
          }
        >
          <i className="fas fa-sign-out-alt" style={{ fontSize: "20px", color: "red", marginBottom: "2px", marginRight: "4px" }}></i>
          <span className="sidebar-logout-text" style={{ color: "red", fontSize: "13px", fontWeight: 500 }}>Logout</span>
        </button>

        <hr className="sidebar-divider" />
        <div className="sidebar-heading">Interface</div>
        <CollapsibleNavItem id={"collapseTwo"} icon={"fa-cog"} text={"Support"} />

        <CollapsibleNavItem
          id={"collapseUtilities"}
          icon={"fa-wrench"}
          text={"Utilities"}
          subtext={"Custom Utilities:"}
          items={[
            ["Colors", "utilities-color.html"],
            ["Borders", "utilities-border.html"],
            ["Animations", "utilities-animation.html"],
            ["Other", "utilities-other.html"],
          ]}
        />

        {/* Responsive: Ẩn text logout khi thu nhỏ */}
        <style>{`
          .iot-sidebar {
            width: 180px;
            min-width: 160px;
            max-width: 240px;
          }
          .sidebar-logout-btn:hover {
            background: #f5f5f5 !important;
          }
          .sidebar-logout-btn:active {
            background: #f0f0f0 !important;
          }
          .sidebar-logout-text {
            color: red;
            font-size: 13px;
            font-weight: 500;
            margin-right: 128px;
          }
          .sidebar-toggle-btn-mobile {
            display: flex !important;
          }
          .iot-sidebar .sidebar-brand,
          .iot-sidebar .sidebar-heading,
          .iot-sidebar .sidebar-divider,
          .iot-sidebar .sidebar-logout-btn {
            width: 100%;
            margin: 8px 0;
            text-align: center;
          }
          .iot-sidebar .sidebar-brand {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            margin-bottom: 12px;
          }
          .iot-sidebar .nav-item,
          .iot-sidebar .sidebar-logout-btn {
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: center;
            width: 100%;
            box-sizing: border-box;
            padding-left: 0;
            padding-right: 0;
          }
          .iot-sidebar .sidebar-logout-btn {
            padding: 10px 0 6px 0;
            gap: 8px;
          }
          .iot-sidebar .sidebar-heading {
            margin-top: 12px;
            margin-bottom: 8px;
            font-weight: 600;
            font-size: 13px;
            letter-spacing: 1px;
          }
          @media (max-width: 768px) {
            .iot-sidebar {
              width: 60vw;
              min-width: 80px;
              max-width: 120px;
            }
            .iot-sidebar .sidebar-logout-btn {
              flex-direction: column;
              min-width: 60px;
              max-width: 110px;
              padding: 8px 0 4px 0;
              font-size: 12px;
              gap: 2px;
            }
            .sidebar-logout-text {
              margin-right: 4px;
            }
          }
        `}</style>
      </ul>
    </>
  );
};

export default Sidebar;

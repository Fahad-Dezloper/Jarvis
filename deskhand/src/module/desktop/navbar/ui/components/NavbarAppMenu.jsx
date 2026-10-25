import { useState, useEffect, useRef } from "react";
import useWindowsStore from "@store/window";

const NavbarAppMenu = ({ activeAppName, openWindow, isAppleMenuOpen, setIsAppleMenuOpen }) => {
  const { setAboutPortfolioOpen, setWindowData, windows } = useWindowsStore();
  const [openDropdown, setOpenDropdown] = useState(null); // 'portfolio' | 'go' | null
  const containerRef = useRef(null);

  const getActiveApp = () => {
    let activeKey = null;
    let maxZ = -1;

    Object.entries(windows).forEach(([key, win]) => {
      if (win.isOpen && !win.isMinimized && win.zIndex > maxZ) {
        maxZ = win.zIndex;
        activeKey = key;
      }
    });

    return activeKey;
  };

  const activeAppKey = getActiveApp();

  const toggleDropdown = (name, e) => {
    e.stopPropagation();
    if (isAppleMenuOpen) {
      setIsAppleMenuOpen(false);
    }
    setOpenDropdown((prev) => (prev === name ? null : name));
  };

  useEffect(() => {
    if (isAppleMenuOpen) {
      setOpenDropdown(null);
    }
  }, [isAppleMenuOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpenDropdown(null);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setOpenDropdown(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const handleAction = (callback) => {
    setOpenDropdown(null);
    if (callback) callback();
  };

  const aboutTargets = {
    Safari: "safari",
    Finder: "finder",
    Settings: "settings",
    Calculator: "calculator",
    Calendar: "calendar",
    Weather: "weather",
    Terminal: "terminal",
    Notes: "notes",
    "VS Code": "vscode",
  };

  const dropdowns = {
    portfolio: [
      [
        {
          label: `About ${activeAppName}`,
          onClick: () => {
            if (activeAppName === "Photos") {
              if (activeAppKey === "imgfile") {
                // Merge openAbout into existing data so the photos array is preserved
                const existing = windows["imgfile"]?.data || {};
                setWindowData("imgfile", { ...existing, openAbout: true });
              } else {
                openWindow("photos", { openAbout: true });
              }
            } else if (aboutTargets[activeAppName]) {
              openWindow(aboutTargets[activeAppName], { openAbout: true });
            } else if (activeAppName === "Orry") {
              setAboutPortfolioOpen(true);
            } else {
              openWindow("settings", { tab: "General" });
            }
          },
        },
      ],
      [
        {
          label: "Preferences...",
          meta: "⌘,",
          disabled: ["Calculator", "Calendar", "Weather", "Terminal", "Notes", "VS Code"].includes(
            activeAppName,
          ),
          onClick: () => {
            if (activeAppName === "Safari") {
              openWindow("safari", { openSettings: true });
            } else if (activeAppName === "Finder" || activeAppName === "Photos") {
              openWindow("settings", { tab: "General", subPage: "storage" });
            } else if (activeAppName === "Settings") {
              openWindow("settings", { tab: "General" });
            } else if (activeAppName === "Orry") {
              openWindow("settings", { tab: "General", subPage: "about" });
            } else {
              openWindow("settings");
            }
          },
        },
        {
          label: "Services",
          meta: "›",
          disabled: true,
        },
      ],
      [
        {
          label: `Hide ${activeAppName}`,
          meta: "⌘H",
          disabled: true,
        },
        {
          label: "Hide Others",
          meta: "⌥⌘H",
          disabled: true,
        },
        {
          label: "Show All",
          disabled: true,
        },
      ],
    ],
    go: [
      [
        {
          label: "Open Finder",
          meta: "⌘F",
          onClick: () => openWindow("finder"),
        },
        {
          label: "Code Editor",
          meta: "⌥⌘T",
          onClick: () => openWindow("vscode"),
        },
      ],
      [
        {
          label: "Launchpad",
          meta: "⇧⌘L",
          onClick: () => openWindow("launchpad"),
        },
        {
          label: "Terminal",
          onClick: () => openWindow("terminal"),
        },
      ],
    ],
  };

  const renderDropdown = (name) => {
    if (openDropdown !== name) return null;
    const sections = dropdowns[name];

    return (
      <div className="mac-dropdown" role="menu">
        {sections.map((section, sectionIndex) => (
          <div className="apple-menu-section" key={sectionIndex}>
            {section.map((item) => (
              <button
                type="button"
                className="apple-menu-item"
                disabled={item.disabled}
                key={item.label}
                onClick={(event) => {
                  event.stopPropagation();
                  handleAction(item.onClick);
                }}
                role="menuitem"
              >
                <span>{item.label}</span>
                {item.meta && <span className="apple-menu-meta">{item.meta}</span>}
              </button>
            ))}
          </div>
        ))}
      </div>
    );
  };

  return (
    <ul className="nav-links max-sm:hidden" ref={containerRef}>
      <li
        className={`font-bold min-w-[80px] shrink-0 relative rounded select-none ${
          openDropdown === "portfolio" ? "bg-white/15" : "hover:bg-white/10"
        }`}
        onClick={(e) => toggleDropdown("portfolio", e)}
      >
        {activeAppName}
        {renderDropdown("portfolio")}
      </li>
      <li
        className={`relative rounded select-none ${
          openDropdown === "go" ? "bg-white/15" : "hover:bg-white/10"
        }`}
        onClick={(e) => toggleDropdown("go", e)}
      >
        Go
        {renderDropdown("go")}
      </li>
      <li className="relative rounded select-none hover:bg-white/10">
        <a href="/docs" target="_self" className="block">
          Docs
        </a>
      </li>
    </ul>
  );
};

export default NavbarAppMenu;

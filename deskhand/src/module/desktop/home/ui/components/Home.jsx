import { useState, useCallback, useRef } from "react";
import { locations } from "@constants";
import useLocationStore from "@store/location";
import useWindowsStore from "@store/window";
import useSystemStore from "@store/system";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Draggable } from "gsap/Draggable";
import OptimizedImage from "@module/shared/ui/components/OptimizedImage";
import HomeFolder from "./HomeFolder";
import DesktopShortcut from "./DesktopShortcut";
import DesktopContextMenu from "./DesktopContextMenu";
import FolderRenameInput from "./FolderRenameInput";
import useWidgetsStore from "@store/widgets";
import { DESKTOP_BUILTINS } from "@module/desktop/system/builtins";
import { WALLPAPERS } from "@module/desktop/system/wallpaperCore";
import { autoPosition } from "@module/desktop/system/desktopItemsCore";
import { locationFor } from "@module/desktop/system/syncLocations";
import { openFileItem } from "@module/desktop/system/spotlight";

const projects = DESKTOP_BUILTINS;
const desktopWallpapers = WALLPAPERS;

const Home = () => {
  const { setActiveLocation } = useLocationStore();
  const {
    openWindow,
    unminimizeWindow,
    focusWindow,
    windows,
    desktopShortcuts,
    addDesktopShortcut,
    removeDesktopShortcut,
    updateShortcutPosition,
    setAboutPortfolioOpen,
  } = useWindowsStore();

  const [contextMenu, setContextMenu] = useState(null);
  const [editingFolderId, setEditingFolderId] = useState(null);
  const wallpaperId = useSystemStore((state) => state.wallpaperId);
  const setWallpaper = useSystemStore((state) => state.setWallpaper);
  const systemItems = useSystemStore((state) => state.items);
  const deletedFolderIds = useSystemStore((state) => state.deletedBuiltinIds);
  const renamedProjects = useSystemStore((state) => state.renamedBuiltins);
  const wallpaperIndex = Math.max(0, desktopWallpapers.findIndex((w) => w.id === wallpaperId));
  const deskItems = systemItems.filter((i) => !i.parent);
  const suppressCustomFolderClickRef = useRef(null);
  const activeWidgets = useWidgetsStore((state) => state.widgets);
  const toggleWidget = useWidgetsStore((state) => state.toggleWidget);

  const visibleProjects = projects.filter((project) => !deletedFolderIds.includes(project.id));

  const handleRenameFolder = (target) => {
    if (!target) return;
    setEditingFolderId(target.id);
  };

  const handleRenameProject = (projectId, newName) => {
    if (newName && newName.trim()) useSystemStore.getState().renameBuiltin(projectId, newName.trim());
    setEditingFolderId(null);
  };

  const handleRenameCustomFolder = (folderId, newName) => {
    if (newName && newName.trim()) useSystemStore.getState().renameItem(folderId, newName.trim());
    setEditingFolderId(null);
  };

  const handleOpenProjectFinder = (project) => {
    if (project?.kind === "file") {
      openWindow(`${project.fileType}file`, project);
      return;
    }
    setActiveLocation(project);
    openWindow("finder");
  };

  const handleOpenApp = (appId) => {
    const window = windows[appId];
    if (window?.isOpen) {
      if (window.isMinimized) {
        unminimizeWindow(appId);
      } else {
        focusWindow(appId);
      }
    } else {
      openWindow(appId);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const source = e.dataTransfer.getData("drag-source");
    const appId = e.dataTransfer.getData("text/plain");

    if (source === "dock" && appId) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left - 32; // center icon (half of w-16 = 32px)
      const y = e.clientY - rect.top - 40;
      addDesktopShortcut(appId, x, y);
    }
  };

  useGSAP(() => {
    const instances = Draggable.create(".folder, .desktop-shortcut", {
      bounds: "#home",
      allowContextMenu: true,
      cursor: "default",
      activeCursor: "default",
      onDragStart: function () {
        document.body.classList.add("folder-dragging");
      },
      onDragEnd: function () {
        document.body.classList.remove("folder-dragging");
        const el = this.target;
        if (el.classList.contains("desktop-shortcut")) {
          const id = el.dataset.id;
          const left = parseFloat(el.style.left || 0) + this.x;
          const top = parseFloat(el.style.top || 0) + this.y;

          updateShortcutPosition(id, left, top);
          gsap.set(el, { x: 0, y: 0 });
        } else if (el.dataset.custom === "true") {
          const id = el.dataset.id;
          suppressCustomFolderClickRef.current = id;
          const left = parseFloat(el.style.left || 0) + this.x;
          const top = parseFloat(el.style.top || 0) + this.y;
          useSystemStore.getState().moveItem(id, left, top);
          gsap.set(el, { x: 0, y: 0 });
        }
      },
      onRelease: function () {
        document.body.classList.remove("folder-dragging");
      },
    });

    return () => {
      document.body.classList.remove("folder-dragging");
      instances.forEach((instance) => instance.kill());
    };
  }, [desktopShortcuts, systemItems, deletedFolderIds]);

  // Context Menu Handlers
  const handleDesktopContextMenu = (e) => {
    // Only trigger desktop context menu if clicking directly on background
    if (e.target.closest(".folder") || e.target.closest(".desktop-shortcut")) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: "desktop",
      target: null,
    });
  };

  const handleFolderContextMenu = (e, project) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: "folder",
      target: project,
    });
  };

  const handleShortcutContextMenu = (e, shortcut) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: "shortcut",
      target: shortcut,
    });
  };

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleNewFolder = () => {
    const x = Math.max(20, Math.min(contextMenu?.x || 100, window.innerWidth - 120));
    const y = Math.max(50, Math.min((contextMenu?.y || 100) - 35, window.innerHeight - 150));
    const item = useSystemStore.getState().createItem("folder", "untitled folder", { x, y });
    setEditingFolderId(item.id);
  };

  const handleGetInfo = (target) => {
    if (target?.id && !target.isCustom && target.children) {
      handleOpenProjectFinder(target);
    } else {
      setAboutPortfolioOpen(true);
    }
  };

  const handleChangeWallpaper = (wallpaper) => {
    if (wallpaper?.id) setWallpaper(wallpaper.id);
  };

  const handleOpenProjects = () => {
    if (!locations.work) return;
    setActiveLocation(locations.work);
    openWindow("finder");
  };

  const handleCleanUp = () => {
    gsap.to(".folder, .desktop-shortcut", {
      x: 0,
      y: 0,
      duration: 0.4,
      ease: "power2.out",
      stagger: 0.03,
    });
  };

  const handleOpenTerminal = () => openWindow("terminal");
  const handleOpenSettings = () => openWindow("settings");

  const handleDeleteFolder = (target) => {
    if (!target) return;
    if (target.isCustom) useSystemStore.getState().trashItemById(target.id);
    else useSystemStore.getState().trashBuiltin(target.id, target.name || "Untitled Folder", target.kind === "file" ? "file" : "folder");
  };

  const openDeskItem = (item) => openFileItem(locationFor(item));

  return (
    <section
      id="home"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onContextMenu={handleDesktopContextMenu}
    >
      <ul>
        {visibleProjects.map((project) => (
          <HomeFolder
            key={project.id}
            project={project}
            displayName={renamedProjects[project.id]}
            isEditing={editingFolderId === project.id}
            onRename={(newName) => handleRenameProject(project.id, newName)}
            onClick={() => handleOpenProjectFinder(project)}
            onContextMenu={handleFolderContextMenu}
          />
        ))}

        {deskItems.map((folder, index) => {
          const isEditing = editingFolderId === folder.id;
          const pos =
            Number.isFinite(folder.x) && Number.isFinite(folder.y)
              ? { x: folder.x, y: folder.y }
              : autoPosition(index, { width: window.innerWidth, height: window.innerHeight });
          const icon =
            folder.kind === "folder"
              ? "/system/icons/files/folder.webp"
              : folder.kind === "image"
                ? folder.src || "/system/icons/files/image.webp"
                : "/system/icons/files/txt.webp";
          return (
            <li
              key={folder.id}
              data-id={folder.id}
              data-custom="true"
              data-desktop-item={folder.name}
              className="folder cursor-default absolute select-none flex items-center flex-col"
              style={{
                left: `${pos.x}px`,
                top: `${pos.y}px`,
              }}
              onPointerDown={() => {
                suppressCustomFolderClickRef.current = null;
              }}
              onClick={() => {
                if (suppressCustomFolderClickRef.current === folder.id) {
                  suppressCustomFolderClickRef.current = null;
                  return;
                }
                if (!isEditing) openDeskItem(folder);
              }}
              onContextMenu={(e) => handleFolderContextMenu(e, { ...folder, isCustom: true })}
            >
              <div className="w-[62px] h-[52px] flex items-center justify-center pointer-events-none">
                <OptimizedImage
                  src={icon}
                  alt={folder.name}
                  width={62}
                  height={52}
                  className="w-full h-full object-contain pointer-events-none"
                />
              </div>
              {isEditing ? (
                <FolderRenameInput
                  initialValue={folder.name}
                  onSave={(val) => handleRenameCustomFolder(folder.id, val)}
                  onCancel={() => setEditingFolderId(null)}
                />
              ) : (
                <p>{folder.name}</p>
              )}
            </li>
          );
        })}

        {desktopShortcuts.map((shortcut) => (
          <DesktopShortcut
            key={shortcut.id}
            shortcut={shortcut}
            onDoubleClick={() => handleOpenApp(shortcut.appId)}
            onRemove={() => removeDesktopShortcut(shortcut.id)}
            onContextMenu={handleShortcutContextMenu}
          />
        ))}
      </ul>

      {/* macOS Desktop Context Menu */}
      <DesktopContextMenu
        menu={contextMenu}
        onClose={handleCloseContextMenu}
        onNewFolder={handleNewFolder}
        onGetInfo={handleGetInfo}
        onChangeWallpaper={handleChangeWallpaper}
        wallpapers={desktopWallpapers}
        activeWallpaperIndex={wallpaperIndex}
        activeWidgets={activeWidgets}
        onToggleWidget={toggleWidget}
        onOpenProjects={handleOpenProjects}
        onOpenProject={handleOpenProjectFinder}
        projects={visibleProjects}
        onOpenApp={handleOpenApp}
        onCleanUp={handleCleanUp}
        onOpenTerminal={handleOpenTerminal}
        onOpenSettings={handleOpenSettings}
        onOpenFolder={handleOpenProjectFinder}
        onRenameFolder={handleRenameFolder}
        onDeleteFolder={handleDeleteFolder}
        onDeleteCustomFolder={handleDeleteFolder}
        onOpenShortcut={handleOpenApp}
        onDeleteShortcut={removeDesktopShortcut}
      />
    </section>
  );
};

export default Home;

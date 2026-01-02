(() => {
  const SESSION_KEY = "fleetManagerSession";
  const WORKSITE_STATE_KEY = "fleetManagerWorksites";
  const ROBOT_STATE_KEY = "fleetManagerRobots";
  const PACKAGING_STATE_KEY = "fleetManagerPackagingState";
  const LINE_REQUEST_KEY = "fleetManagerLineRequests";
  const PACKAGING_SIGNATURE_KEY = "fleetManagerPackagingSignature";
  const OPS_STATE_KEY = "fleetManagerOpsState";
  const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
  const DEFAULT_USER = { username: "admin", password: "123456" };
  const WORKSITE_OCCUPANCY = ["empty", "filled"];
  const LABEL_SIZE_PX = 10;
  const LABEL_OFFSET_PX = 10;
  const LABEL_MIN_ZOOM = 2;
  const ORDER_ASC = "asc";
  const ORDER_DESC = "desc";
  const SIM_TICK_MS = 140;
  const ROBOT_SPEED_MPS = 0.9;
  const ROBOT_ACCEL_MPS2 = 0.7;
  const ROBOT_DECEL_MPS2 = 1.2;
  const ROBOT_TURN_RATE_RAD_S = Math.PI;
  const ROBOT_ARRIVAL_DISTANCE = 0.18;
  const ROBOT_ARRIVAL_SPEED = 0.04;
  const ROBOT_MIN_TURN_SPEED_FACTOR = 0.2;
  const ROBOT_RADIUS = 0.6;
  const ROBOT_STOP_DISTANCE = ROBOT_RADIUS * 2 - 0.1;
  const ROBOT_YIELD_DISTANCE = ROBOT_STOP_DISTANCE + 0.6;
  const ROBOT_YIELD_SPEED_FACTOR = 0.35;
  const TRAFFIC_LOOKAHEAD_S = 2.2;
  const ACTION_WAIT_MS = 900;
  const OBSTACLE_RADIUS = 0.8;
  const OBSTACLE_CLEARANCE = 0.25;
  const OBSTACLE_AVOID_MARGIN = 0.6;
  const MANUAL_DRIVE_SPEED_MPS = 0.6;
  const MANUAL_ACTIONS = { goto: null, load: "load", unload: "unload" };
  const MANUAL_KEY_MAP = {
    arrowup: "up",
    w: "up",
    arrowdown: "down",
    s: "down",
    arrowleft: "left",
    a: "left",
    arrowright: "right",
    d: "right"
  };
  const PackagingEngine = window.PackagingEngine || null;

  const viewMeta = {
    map: {
      title: "Mapa",
      subtitle: "Graf, worksite i roboty w czasie rzeczywistym."
    },
    robots: {
      title: "Roboty",
      subtitle: "Lista robotow i ich statusy operacyjne."
    },
    streams: {
      title: "Streamy",
      subtitle: "Konfiguracja strumieni pracy i grup."
    },
    fields: {
      title: "Pola",
      subtitle: "Lista worksite i ich aktualny stan."
    },
    packaging: {
      title: "Bufory",
      subtitle: "Bufory produkcyjne i magazynowe oraz zgłoszenia strumieni."
    },
    tasks: {
      title: "Zadania",
      subtitle: "Aktywne zadania wykonywane przez fleet manager."
    },
    faults: {
      title: "Awarie",
      subtitle: "Symulowane blokady i przeszkody."
    }
  };

  const loginView = document.getElementById("login-view");
  const appView = document.getElementById("app-view");
  const loginForm = document.getElementById("login-form");
  const loginUserInput = document.getElementById("login-user");
  const loginPassInput = document.getElementById("login-pass");
  const loginError = document.getElementById("login-error");
  const logoutBtn = document.getElementById("logout-btn");

  const navItems = Array.from(document.querySelectorAll(".nav-item"));
  const panels = Array.from(document.querySelectorAll(".panel"));
  const viewTitle = document.getElementById("view-title");
  const viewSubtitle = document.getElementById("view-subtitle");
  const sessionUser = document.getElementById("session-user");

  const mapSvg = document.getElementById("map-svg");
  const mapWrap = document.querySelector(".map-wrap");
  const worksiteMenu = document.getElementById("worksite-menu");
  const worksiteMenuButtons = Array.from(worksiteMenu.querySelectorAll("button"));
  const manualMenu = document.getElementById("manual-menu");
  const manualMenuRobot = document.getElementById("manual-menu-robot");
  const navControls = document.getElementById("nav-controls");
  const navControlsName = document.getElementById("nav-controls-name");
  const navControlsPause = document.getElementById("nav-controls-pause");
  const navControlsStop = document.getElementById("nav-controls-stop");
  const manualDrivePanel = document.getElementById("manual-drive");
  const manualDriveRobot = document.getElementById("manual-drive-robot");
  const manualDriveToggle = document.getElementById("manual-drive-toggle");
  const resetViewBtn = document.getElementById("reset-view-btn");
  const fitViewBtn = document.getElementById("fit-view-btn");
  const miniMapSvg = document.getElementById("mini-map-svg");

  const robotsList = document.getElementById("robots-list");
  const streamsList = document.getElementById("streams-list");
  const fieldsList = document.getElementById("fields-list");
  const tasksList = document.getElementById("tasks-list");
  const faultRobotSelect = document.getElementById("fault-robot-select");
  const faultPickProblemBtn = document.getElementById("fault-pick-problem");
  const faultPickRobotBlockedBtn = document.getElementById("fault-pick-robot-blocked");
  const faultDropProblemBtn = document.getElementById("fault-drop-problem");
  const faultDriveBlockBtn = document.getElementById("fault-drive-block");
  const faultDriveAvoidBtn = document.getElementById("fault-drive-avoid");
  const faultClearObstaclesBtn = document.getElementById("fault-clear-obstacles");
  const faultClearBlockBtn = document.getElementById("fault-clear-block");
  const bufferGrid = document.getElementById("buffer-grid");
  const bufferEditor = document.getElementById("buffer-editor");
  const lineRequestsList = document.getElementById("line-requests");
  const placeOpsPanel = document.getElementById("place-ops");

  let graphData = null;
  let workflowData = null;
  let worksites = [];
  let robots = [];
  let tasks = [];
  let worksiteState = {};
  let dataLoaded = false;
  let packagingConfig = null;
  let bufferState = {};
  let lineRequests = [];
  let selectedBufferCell = null;
  let selectedBufferLevel = 1;
  let opsOverrides = { buffers: {}, places: {} };
  let selectedPlaceId = null;
  let selectedPlaceGoods = null;
  let worksiteElements = new Map();
  let worksiteRings = new Map();
  let robotMarkers = new Map();
  let actionPointMarkers = new Map();
  let mapClickBound = false;
  let mapState = null;
  let panState = null;
  let panZoomBound = false;
  let miniMapViewport = null;
  let miniMapBound = false;
  let miniMapDrag = null;
  let keyboardBound = false;
  let worksiteLabels = new Map();
  let robotTableBound = false;
  let robotRuntime = new Map();
  let pausedAutoRuntime = new Map();
  let manualTargetRobotId = null;
  let manualDrive = {
    enabled: false,
    robotId: null,
    driving: false,
    keys: new Set()
  };
  let taskCounter = 1;
  let obstacles = [];
  let obstacleIdSeq = 1;
  let obstacleLayer = null;
  let simTimer = null;
  let parkingPoint = null;
  let simLastTick = null;

  const svgNS = "http://www.w3.org/2000/svg";

  const safeParse = (value) => {
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch (error) {
      return null;
    }
  };

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const distancePointToSegment = (point, a, b) => {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const apx = point.x - a.x;
    const apy = point.y - a.y;
    const abLenSq = abx * abx + aby * aby;
    if (abLenSq === 0) {
      return Math.hypot(point.x - a.x, point.y - a.y);
    }
    const t = clamp((apx * abx + apy * aby) / abLenSq, 0, 1);
    const cx = a.x + abx * t;
    const cy = a.y + aby * t;
    return Math.hypot(point.x - cx, point.y - cy);
  };

  const unitVector = (dx, dy) => {
    const len = Math.hypot(dx, dy);
    if (len === 0) return { x: 0, y: 0 };
    return { x: dx / len, y: dy / len };
  };

  const pointsEqual = (a, b) => {
    if (!a || !b) return false;
    return Math.hypot(a.x - b.x, a.y - b.y) < 1e-3;
  };

  const normalizeAngle = (angle) => {
    let value = angle;
    while (value > Math.PI) value -= Math.PI * 2;
    while (value < -Math.PI) value += Math.PI * 2;
    return value;
  };

  const approachValue = (value, target, maxDelta) => {
    if (value < target) return Math.min(value + maxDelta, target);
    if (value > target) return Math.max(value - maxDelta, target);
    return target;
  };

  const ensureRobotMotion = (robot) => {
    if (!robot) return;
    if (!Number.isFinite(robot.heading)) robot.heading = 0;
    if (!Number.isFinite(robot.speed)) robot.speed = 0;
  };

  const computeTurnPenalty = (diff) => {
    const ratio = Math.min(Math.abs(diff) / (Math.PI / 2), 1);
    return clamp(1 - ratio, ROBOT_MIN_TURN_SPEED_FACTOR, 1);
  };

  const computeStoppingSpeed = (distance) => {
    if (!Number.isFinite(distance) || distance <= 0) return 0;
    return Math.sqrt(2 * ROBOT_DECEL_MPS2 * distance);
  };

  const getRobotVelocity = (robot) => {
    ensureRobotMotion(robot);
    return {
      vx: Math.cos(robot.heading) * robot.speed,
      vy: Math.sin(robot.heading) * robot.speed
    };
  };

  const getTrafficSpeedLimit = (robot, desiredSpeed) => {
    if (!robot?.pos) return { speedLimit: desiredSpeed, blockingId: null };
    const selfVel = getRobotVelocity(robot);
    let speedLimit = desiredSpeed;
    let blockingId = null;

    for (const other of robots) {
      if (other.id === robot.id) continue;
      if (!other.pos) continue;
      const dx = other.pos.x - robot.pos.x;
      const dy = other.pos.y - robot.pos.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= ROBOT_STOP_DISTANCE) {
        speedLimit = 0;
        blockingId = other.id;
        break;
      }
      const otherVel = getRobotVelocity(other);
      const relVx = selfVel.vx - otherVel.vx;
      const relVy = selfVel.vy - otherVel.vy;
      const relSpeedSq = relVx * relVx + relVy * relVy;
      let tClosest = 0;
      if (relSpeedSq > 1e-4) {
        tClosest = clamp(-(dx * relVx + dy * relVy) / relSpeedSq, 0, TRAFFIC_LOOKAHEAD_S);
      }
      const closestX = dx + relVx * tClosest;
      const closestY = dy + relVy * tClosest;
      const closestDist = Math.hypot(closestX, closestY);
      if (closestDist <= ROBOT_STOP_DISTANCE) {
        speedLimit = 0;
        blockingId = other.id;
        break;
      }
      if (closestDist <= ROBOT_YIELD_DISTANCE) {
        speedLimit = Math.min(speedLimit, ROBOT_SPEED_MPS * ROBOT_YIELD_SPEED_FACTOR);
      }
    }

    return { speedLimit, blockingId };
  };

  const applyKinematicMotion = (robot, desiredHeading, desiredSpeed, dt) => {
    if (!robot?.pos || !Number.isFinite(dt) || dt <= 0) {
      return { distance: 0, headingDiff: 0 };
    }
    ensureRobotMotion(robot);
    const diff = normalizeAngle(desiredHeading - robot.heading);
    const maxTurn = ROBOT_TURN_RATE_RAD_S * dt;
    const turnStep = clamp(diff, -maxTurn, maxTurn);
    robot.heading = normalizeAngle(robot.heading + turnStep);

    const turnPenalty = computeTurnPenalty(diff);
    const speedTarget = Math.max(0, desiredSpeed * turnPenalty);
    const accel = speedTarget >= robot.speed ? ROBOT_ACCEL_MPS2 : ROBOT_DECEL_MPS2;
    robot.speed = approachValue(robot.speed, speedTarget, accel * dt);

    const distance = robot.speed * dt;
    if (distance > 0) {
      robot.pos = {
        x: robot.pos.x + Math.cos(robot.heading) * distance,
        y: robot.pos.y + Math.sin(robot.heading) * distance
      };
    }
    return { distance, headingDiff: diff };
  };

  const getMapCenter = () => {
    if (!mapState) return { x: 0, y: 0 };
    return {
      x: mapState.x + mapState.width / 2,
      y: mapState.y + mapState.height / 2
    };
  };

  const updateWorksiteScale = () => {
    if (!mapState || !worksiteElements.size) return;
    const rect = mapSvg.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const scale = mapState.width / rect.width;
    const zoomLevel = mapState.baseWidth / mapState.width;
    const showLabels = zoomLevel >= LABEL_MIN_ZOOM;
    const labelOffset = LABEL_OFFSET_PX * scale;
    const fontSize = LABEL_SIZE_PX * scale;
    worksiteElements.forEach((marker) => {
      const sizePx = Number(marker.dataset.sizePx || "5");
      marker.setAttribute("r", (sizePx * scale).toFixed(3));
    });
    worksiteRings.forEach((ring) => {
      const sizePx = Number(ring.dataset.sizePx || "8");
      ring.setAttribute("r", (sizePx * scale).toFixed(3));
    });
    actionPointMarkers.forEach((marker) => {
      const sizePx = Number(marker.dataset.sizePx || "3");
      marker.setAttribute("r", (sizePx * scale).toFixed(3));
    });
    worksiteLabels.forEach((label) => {
      const baseX = Number(label.dataset.baseX || "0");
      const baseY = Number(label.dataset.baseY || "0");
      label.setAttribute("x", baseX.toFixed(3));
      label.setAttribute("y", (baseY + labelOffset).toFixed(3));
      label.setAttribute("font-size", fontSize.toFixed(3));
      label.classList.toggle("hidden", !showLabels);
    });
  };

  const updateMiniMapViewport = () => {
    if (!miniMapViewport || !mapState) return;
    miniMapViewport.setAttribute("x", mapState.x);
    miniMapViewport.setAttribute("y", mapState.y);
    miniMapViewport.setAttribute("width", mapState.width);
    miniMapViewport.setAttribute("height", mapState.height);
  };

  const updateViewBox = () => {
    if (!mapState) return;
    const minX = -mapState.width;
    const maxX = mapState.baseWidth;
    const minY = -mapState.height;
    const maxY = mapState.baseHeight;
    mapState.x = clamp(mapState.x, minX, maxX);
    mapState.y = clamp(mapState.y, minY, maxY);
    mapSvg.setAttribute(
      "viewBox",
      `${mapState.x} ${mapState.y} ${mapState.width} ${mapState.height}`
    );
    updateMiniMapViewport();
    updateWorksiteScale();
  };

  const resetViewBox = () => {
    if (!mapState) return;
    mapState.x = 0;
    mapState.y = 0;
    mapState.width = mapState.baseWidth;
    mapState.height = mapState.baseHeight;
    updateViewBox();
  };

  const fitViewBox = () => {
    if (!mapState) return;
    const points = [];
    worksites.forEach((site) => {
      if (site.pos) points.push(projectPoint(site.pos));
    });
    robots.forEach((robot) => {
      if (robot.pos) points.push(projectPoint(robot.pos));
    });
    if (!points.length) {
      resetViewBox();
      return;
    }
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const padding = 0.08;
    const boundsWidth = Math.max(maxX - minX, 1);
    const boundsHeight = Math.max(maxY - minY, 1);
    const baseRatio = mapState.baseWidth / mapState.baseHeight;
    let targetWidth = boundsWidth;
    let targetHeight = boundsHeight;
    if (targetWidth / targetHeight > baseRatio) {
      targetHeight = targetWidth / baseRatio;
    } else {
      targetWidth = targetHeight * baseRatio;
    }
    targetWidth *= 1 + padding;
    targetHeight *= 1 + padding;
    const clampedWidth = clamp(targetWidth, mapState.minWidth, mapState.maxWidth);
    const scale = clampedWidth / targetWidth;
    mapState.width = clampedWidth;
    mapState.height = targetHeight * scale;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    mapState.x = centerX - mapState.width / 2;
    mapState.y = centerY - mapState.height / 2;
    updateViewBox();
  };

  const projectPoint = (point) => {
    if (!mapState || !point) return { x: 0, y: 0 };
    return {
      x: point.x - mapState.offsetX,
      y: mapState.offsetY - point.y
    };
  };

  const getSvgPoint = (event) => {
    if (!mapState) return { x: 0, y: 0 };
    if (mapSvg.createSVGPoint && mapSvg.getScreenCTM) {
      const point = mapSvg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      const matrix = mapSvg.getScreenCTM();
      if (matrix) {
        const inverse = matrix.inverse();
        const svgPoint = point.matrixTransform(inverse);
        return { x: svgPoint.x, y: svgPoint.y };
      }
    }
    const rect = mapSvg.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: mapState.x, y: mapState.y };
    const x = mapState.x + ((event.clientX - rect.left) / rect.width) * mapState.width;
    const y = mapState.y + ((event.clientY - rect.top) / rect.height) * mapState.height;
    return { x, y };
  };

  const applyZoom = (factor, center) => {
    if (!mapState) return;
    const nextWidth = mapState.width * factor;
    const scale = clamp(nextWidth, mapState.minWidth, mapState.maxWidth) / mapState.width;
    if (scale === 1) return;
    const newWidth = mapState.width * scale;
    const newHeight = mapState.height * scale;
    mapState.x = center.x - (center.x - mapState.x) * scale;
    mapState.y = center.y - (center.y - mapState.y) * scale;
    mapState.width = newWidth;
    mapState.height = newHeight;
    updateViewBox();
  };

  const bindPanZoom = () => {
    if (panZoomBound) return;
    panZoomBound = true;

    mapSvg.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        const zoomFactor = event.deltaY > 0 ? 1.05 : 0.95;
        const center = getSvgPoint(event);
        applyZoom(zoomFactor, center);
      },
      { passive: false }
    );

    mapSvg.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      if (!mapState) return;
      if (event.target?.closest?.(".worksite-marker")) return;
      if (event.target?.closest?.(".robot-marker")) return;
      if (event.target?.closest?.(".action-point")) return;
      panState = {
        startX: event.clientX,
        startY: event.clientY,
        viewX: mapState?.x || 0,
        viewY: mapState?.y || 0
      };
      mapWrap.classList.add("panning");
      mapSvg.setPointerCapture(event.pointerId);
    });

    mapSvg.addEventListener("pointermove", (event) => {
      if (!panState || !mapState) return;
      const rect = mapSvg.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dx = ((event.clientX - panState.startX) / rect.width) * mapState.width;
      const dy = ((event.clientY - panState.startY) / rect.height) * mapState.height;
      mapState.x = panState.viewX - dx;
      mapState.y = panState.viewY - dy;
      updateViewBox();
    });

    const endPan = (event) => {
      if (!panState) return;
      panState = null;
      mapWrap.classList.remove("panning");
      if (event?.pointerId !== undefined) {
        mapSvg.releasePointerCapture(event.pointerId);
      }
    };

    mapSvg.addEventListener("pointerup", endPan);
    mapSvg.addEventListener("pointercancel", endPan);

    mapSvg.addEventListener("dblclick", (event) => {
      event.preventDefault();
      resetViewBox();
    });
  };

  const bindKeyboardShortcuts = () => {
    if (keyboardBound) return;
    keyboardBound = true;
    document.addEventListener("keydown", (event) => {
      if (!mapState) return;
      const target = document.activeElement;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const center = getMapCenter();
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        applyZoom(0.9, center);
      } else if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        applyZoom(1.1, center);
      } else if (event.key === "0") {
        event.preventDefault();
        resetViewBox();
      }
    });
  };

  const loadSession = () => {
    const stored = safeParse(localStorage.getItem(SESSION_KEY));
    if (!stored || !stored.expiresAt || !stored.username) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    if (Date.now() > stored.expiresAt) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return stored.username;
  };

  const saveSession = (username) => {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ username, expiresAt: Date.now() + SESSION_TTL_MS })
    );
  };

  const clearSession = () => {
    localStorage.removeItem(SESSION_KEY);
  };

  const showLogin = () => {
    loginView.classList.remove("hidden");
    appView.classList.add("hidden");
    loginUserInput.focus();
  };

  const showApp = (username) => {
    loginView.classList.add("hidden");
    appView.classList.remove("hidden");
    sessionUser.textContent = username;
    setView("map");
    if (!dataLoaded) {
      loadData();
    }
  };

  const setView = (viewName) => {
    navItems.forEach((item) => {
      item.classList.toggle("active", item.dataset.view === viewName);
    });

    panels.forEach((panel) => {
      panel.classList.toggle("active", panel.id === `view-${viewName}`);
    });

    const meta = viewMeta[viewName];
    if (meta) {
      viewTitle.textContent = meta.title;
      viewSubtitle.textContent = meta.subtitle;
    }
    if (viewName !== "map") {
      clearManualDriveKeys();
    }
  };

  const initNavigation = () => {
    navItems.forEach((item) => {
      item.addEventListener("click", () => {
        setView(item.dataset.view);
      });
    });
  };

  const initWorksiteMenu = () => {
    const hideMenu = () => {
      worksiteMenu.classList.add("hidden");
      worksiteMenu.dataset.id = "";
    };

    worksiteMenu.addEventListener("click", (event) => {
      event.stopPropagation();
      const button = event.target.closest("button");
      if (!button) return;
      const id = worksiteMenu.dataset.id;
      if (!id) return;
      const group = button.dataset.group;
      const value = button.dataset.value;
      if (group === "occupancy") {
        setWorksiteOccupancy(id, value);
      } else if (group === "blocked") {
        setWorksiteBlocked(id, value === "true");
      }
      hideMenu();
    });

    document.addEventListener("click", (event) => {
      if (!worksiteMenu.contains(event.target)) {
        hideMenu();
      }
    });

    mapWrap.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      const isWorksite = event.target?.classList?.contains("worksite-marker");
      if (!isWorksite) {
        hideMenu();
      }
    });

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        hideMenu();
      }
    });
  };

  const initManualMenu = () => {
    if (!manualMenu) return;
    const hideMenu = () => {
      manualMenu.classList.add("hidden");
      manualMenu.dataset.pointId = "";
      manualMenu.dataset.robotId = "";
    };

    manualMenu.addEventListener("click", (event) => {
      event.stopPropagation();
      const button = event.target.closest("button");
      if (!button) return;
      const pointId = manualMenu.dataset.pointId;
      const robotId = manualMenu.dataset.robotId;
      if (!pointId || !robotId) return;
      const action = button.dataset.action;
      issueManualCommand(robotId, pointId, action);
      hideMenu();
    });

    document.addEventListener("click", (event) => {
      if (!manualMenu.contains(event.target)) {
        hideMenu();
      }
    });

    mapWrap.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      if (!manualMenu.contains(event.target)) {
        hideMenu();
      }
    });

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        hideMenu();
      }
    });
  };

  const initFaultControls = () => {
    if (!faultRobotSelect) return;
    syncFaultRobotSelect();
    if (faultPickProblemBtn) {
      faultPickProblemBtn.addEventListener("click", () => {
        const robotId = getFaultRobotId();
        if (robotId) simulatePickProblem(robotId);
      });
    }
    if (faultPickRobotBlockedBtn) {
      faultPickRobotBlockedBtn.addEventListener("click", () => {
        const robotId = getFaultRobotId();
        if (robotId) simulatePickRobotBlocked(robotId);
      });
    }
    if (faultDropProblemBtn) {
      faultDropProblemBtn.addEventListener("click", () => {
        const robotId = getFaultRobotId();
        if (robotId) simulateDropProblem(robotId);
      });
    }
    if (faultDriveBlockBtn) {
      faultDriveBlockBtn.addEventListener("click", () => {
        const robotId = getFaultRobotId();
        if (robotId) simulateDriveProblem(robotId, "block");
      });
    }
    if (faultDriveAvoidBtn) {
      faultDriveAvoidBtn.addEventListener("click", () => {
        const robotId = getFaultRobotId();
        if (robotId) simulateDriveProblem(robotId, "avoid");
      });
    }
    if (faultClearObstaclesBtn) {
      faultClearObstaclesBtn.addEventListener("click", () => {
        clearObstacles();
      });
    }
    if (faultClearBlockBtn) {
      faultClearBlockBtn.addEventListener("click", () => {
        const robotId = getFaultRobotId();
        if (robotId) clearRobotBlock(robotId);
      });
    }
  };

  const initManualDriveControls = () => {
    if (manualDriveToggle) {
      manualDriveToggle.addEventListener("click", () => {
        const robotId = manualDriveToggle.dataset.id;
        if (!robotId) return;
        const enable = !manualDrive.enabled || manualDrive.robotId !== robotId;
        if (!manualDrive.enabled && manualDrive.robotId !== robotId) {
          setManualDriveTarget(robotId);
        }
        setManualDriveEnabled(robotId, enable);
      });
    }

    document.addEventListener("keydown", (event) => {
      handleManualDriveKey(event, true);
    });
    document.addEventListener("keyup", (event) => {
      handleManualDriveKey(event, false);
    });
    window.addEventListener("blur", () => {
      clearManualDriveKeys();
    });
  };

  const initLogin = () => {
    loginForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const username = loginUserInput.value.trim();
      const password = loginPassInput.value.trim();
      if (username === DEFAULT_USER.username && password === DEFAULT_USER.password) {
        loginError.classList.add("hidden");
        saveSession(username);
        showApp(username);
      } else {
        loginError.classList.remove("hidden");
      }
    });

    logoutBtn.addEventListener("click", () => {
      clearSession();
      showLogin();
    });
  };

  const fetchJson = async (path) => {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to load ${path}`);
    }
    return response.json();
  };

  const fetchJsonSafe = async (path) => {
    try {
      return await fetchJson(path);
    } catch (error) {
      return null;
    }
  };

  const resolvePointPosition = (pointId) => {
    if (!pointId) return null;
    const node = graphData?.nodes?.find((item) => item.id === pointId);
    if (node?.pos) return node.pos;
    const worksite = worksites.find((item) => item.point === pointId || item.id === pointId);
    return worksite?.pos || null;
  };

  const resolveLocationPos = (location) => {
    if (!location) return null;
    if (location.pos) return location.pos;
    return resolvePointPosition(location.point);
  };

  const loadOpsOverrides = () => {
    const raw = safeParse(localStorage.getItem(OPS_STATE_KEY));
    if (!raw || typeof raw !== "object") {
      return { buffers: {}, places: {} };
    }
    return {
      buffers: raw.buffers || {},
      places: raw.places || {}
    };
  };

  const persistOpsOverrides = () => {
    localStorage.setItem(OPS_STATE_KEY, JSON.stringify(opsOverrides));
  };

  const resolveBufferOps = (buffer, goodsType, level) => {
    const levelKey = String(level);
    const override =
      opsOverrides.buffers?.[buffer.id]?.[goodsType]?.levels?.[levelKey];
    if (override) return override;
    const byGoods = buffer.opsByGoods?.[goodsType]?.levels?.[levelKey];
    if (byGoods) return byGoods;
    const defaults = packagingConfig?.operations?.bufferDefaults?.[goodsType]?.levels?.[levelKey];
    return defaults || null;
  };

  const updateBufferOps = (bufferId, goodsType, level, updates, kind) => {
    if (!bufferId || !goodsType) return;
    const levelKey = String(level);
    const current =
      opsOverrides.buffers?.[bufferId]?.[goodsType]?.levels?.[levelKey] || {};
    const next = {
      ...current,
      [kind]: { ...(current[kind] || {}), ...updates }
    };
    opsOverrides = {
      ...opsOverrides,
      buffers: {
        ...opsOverrides.buffers,
        [bufferId]: {
          ...(opsOverrides.buffers?.[bufferId] || {}),
          [goodsType]: {
            ...(opsOverrides.buffers?.[bufferId]?.[goodsType] || {}),
            levels: {
              ...(opsOverrides.buffers?.[bufferId]?.[goodsType]?.levels || {}),
              [levelKey]: next
            }
          }
        }
      }
    };
    persistOpsOverrides();
    renderBufferEditor();
  };

  const resolvePlaceOps = (placeId, goodsType) => {
    const override = opsOverrides.places?.[placeId]?.[goodsType];
    if (override) return override;
    const place = getPlaceById(placeId);
    const byGoods = place?.opsByGoods?.[goodsType];
    if (byGoods) return byGoods;
    return packagingConfig?.operations?.placeDefaults?.[goodsType] || null;
  };

  const updatePlaceOps = (placeId, goodsType, updates, kind) => {
    if (!placeId || !goodsType) return;
    const current = opsOverrides.places?.[placeId]?.[goodsType] || {};
    const next = {
      ...current,
      [kind]: { ...(current[kind] || {}), ...updates }
    };
    opsOverrides = {
      ...opsOverrides,
      places: {
        ...opsOverrides.places,
        [placeId]: {
          ...(opsOverrides.places?.[placeId] || {}),
          [goodsType]: next
        }
      }
    };
    persistOpsOverrides();
    renderPlaceOps();
  };

  const buildBufferLayout = (buffer) => {
    if (!PackagingEngine) return [];
    return PackagingEngine.buildBufferLayout(buffer);
  };

  const buildBufferSignature = (config) => {
    if (!PackagingEngine) return "";
    return PackagingEngine.buildBufferSignature(config);
  };

  const buildBufferState = (buffer, config) => {
    if (!PackagingEngine) return [];
    return PackagingEngine.buildBufferState(buffer, config);
  };

  const loadBufferState = (config) => {
    const raw = safeParse(localStorage.getItem(PACKAGING_STATE_KEY));
    const savedSignature = localStorage.getItem(PACKAGING_SIGNATURE_KEY);
    if (!PackagingEngine) return {};
    const result = PackagingEngine.loadBufferState(config, raw, savedSignature);
    localStorage.setItem(PACKAGING_SIGNATURE_KEY, result.signature);
    return result.state;
  };

  const persistBufferState = () => {
    localStorage.setItem(PACKAGING_STATE_KEY, JSON.stringify(bufferState));
    if (packagingConfig) {
      localStorage.setItem(PACKAGING_SIGNATURE_KEY, buildBufferSignature(packagingConfig));
    }
  };

  const loadLineRequests = (config) => {
    const raw = safeParse(localStorage.getItem(LINE_REQUEST_KEY));
    if (!PackagingEngine) return [];
    return PackagingEngine.createLineRequests(config, raw);
  };

  const persistLineRequests = () => {
    localStorage.setItem(LINE_REQUEST_KEY, JSON.stringify(lineRequests));
  };

  const loadData = async () => {
    const placeholders = [robotsList, streamsList, fieldsList, tasksList];
    placeholders.forEach((list) => {
      list.innerHTML = "<div class=\"card\">Ladowanie danych...</div>";
    });
    if (bufferGrid) {
      bufferGrid.innerHTML = "<div class=\"card\">Ladowanie bufora...</div>";
    }
    if (lineRequestsList) {
      lineRequestsList.innerHTML = "<div class=\"card\">Ladowanie linii...</div>";
    }

    try {
      const [graph, workflow, packaging] = await Promise.all([
        fetchJson("/data/graph.json"),
        fetchJson("/data/workflow.json5"),
        fetchJsonSafe("/data/packaging.json")
      ]);
      graphData = graph;
      workflowData = workflow;
      packagingConfig = packaging;
      worksites = buildWorksites(workflowData);
      worksiteState = loadWorksiteState(worksites);
      robots = buildRobots(graphData, worksites);
      tasks = buildTasks();
      renderMap();
      renderRobots();
      renderManualDrivePanel();
      renderStreams();
      renderFields();
      renderTasks();
      renderPackaging();
      dataLoaded = true;
      startSimulation();
    } catch (error) {
      renderMapError("Brak danych mapy.");
      placeholders.forEach((list) => {
        list.innerHTML = "<div class=\"card\">Brak danych.</div>";
      });
      renderPackaging();
    }
  };

  const buildWorksites = (workflow) => {
    const locations = workflow?.bin_locations || {};
    return Object.entries(locations).map(([id, item]) => {
      const kind = id.startsWith("PICK") ? "pick" : id.startsWith("DROP") ? "drop" : "worksite";
      return {
        id,
        group: item.group,
        point: item.point,
        pos: item.pos,
        kind
      };
    });
  };

  const initPackagingState = () => {
    if (!packagingConfig || !bufferGrid || !lineRequestsList || !bufferEditor) {
      return;
    }
    if (Object.keys(bufferState).length && lineRequests.length) {
      return;
    }
    bufferState = loadBufferState(packagingConfig);
    lineRequests = loadLineRequests(packagingConfig);
    const firstBufferId = packagingConfig.buffers?.[0]?.id || null;
    const firstCell = firstBufferId ? bufferState[firstBufferId]?.[0] : null;
    selectedBufferCell = firstCell
      ? { bufferId: firstBufferId, cellId: firstCell.id }
      : null;
    opsOverrides = loadOpsOverrides();
    selectedBufferLevel = 1;
    const firstPlaceId = packagingConfig.places ? Object.keys(packagingConfig.places)[0] : null;
    selectedPlaceId = firstPlaceId;
    selectedPlaceGoods = packagingConfig.goodsTypes?.[0] || null;
  };

  const getBufferCell = (bufferId, cellId) =>
    (bufferState[bufferId] || []).find((cell) => cell.id === cellId);

  const updateBufferCell = (bufferId, cellId, updates) => {
    bufferState = {
      ...bufferState,
      [bufferId]: (bufferState[bufferId] || []).map((cell) =>
        cell.id === cellId ? { ...cell, ...updates } : cell
      )
    };
    persistBufferState();
    renderBufferGrid();
    renderBufferEditor();
  };

  const updateLineRequest = (lineId, key, updates) => {
    lineRequests = lineRequests.map((req) => {
      if (req.id !== lineId) return req;
      if (!key) {
        return { ...req, ...updates };
      }
      return { ...req, [key]: { ...req[key], ...updates } };
    });
    persistLineRequests();
    renderLineRequests();
    renderStreams();
  };

  const renderBufferGrid = () => {
    if (!bufferGrid || !packagingConfig) return;
    const buffers = packagingConfig.buffers || [];
    if (!buffers.length) {
      bufferGrid.innerHTML = "<div class=\"card\">Brak buforow.</div>";
      return;
    }
    bufferGrid.innerHTML = "";
    buffers.forEach((buffer) => {
      const card = document.createElement("div");
      card.className = "card buffer-card";
      const title = document.createElement("div");
      title.className = "card-title";
      title.textContent = buffer.name || buffer.id;
      card.appendChild(title);

      const grid = document.createElement("div");
      grid.className = "buffer-grid-inner";
      const layout = buildBufferLayout(buffer);
      layout.forEach((lane) => {
        const row = document.createElement("div");
        row.className = "buffer-row";
        lane.slots.forEach((slot, slotIndex) => {
          const cellId = slot.id;
          const cell = getBufferCell(buffer.id, cellId);
          const cellEl = document.createElement("div");
          cellEl.className = "buffer-cell";
          if (!cell || cell.stack === 0) {
            cellEl.classList.add("empty");
          }
          if (
            selectedBufferCell &&
            selectedBufferCell.bufferId === buffer.id &&
            selectedBufferCell.cellId === cellId
          ) {
            cellEl.classList.add("active");
          }
          cellEl.dataset.cellId = cellId;
          cellEl.dataset.bufferId = buffer.id;
          const pointLabel = slot.point || cell?.point || "--";
          const slotLabel = `${lane.id || `L${lane.laneIndex + 1}`}/D${slotIndex + 1}`;
          cellEl.innerHTML = `
            <div class="cell-title">${slotLabel}</div>
            <div class="cell-meta">${cell?.goodsType || "-"}</div>
            <div class="cell-meta">AP: ${pointLabel}</div>
            <div class="cell-meta">Stack: ${cell?.stack || 0}/${buffer.maxStack || 0}</div>
          `;
          cellEl.addEventListener("click", () => {
            selectedBufferCell = { bufferId: buffer.id, cellId };
            renderBufferGrid();
            renderBufferEditor();
          });
          row.appendChild(cellEl);
        });
        grid.appendChild(row);
      });

      const legend = document.createElement("div");
      legend.className = "buffer-legend";
      legend.innerHTML = `
        <span class="buffer-pill empty">Puste</span>
        <span class="buffer-pill filled">Zajete</span>
      `;

      card.appendChild(grid);
      card.appendChild(legend);
      bufferGrid.appendChild(card);
    });
  };

  const renderBufferEditor = () => {
    if (!bufferEditor || !packagingConfig) return;
    const cell = selectedBufferCell
      ? getBufferCell(selectedBufferCell.bufferId, selectedBufferCell.cellId)
      : null;
    const buffer = selectedBufferCell
      ? packagingConfig.buffers.find((item) => item.id === selectedBufferCell.bufferId)
      : null;
    if (!cell) {
      bufferEditor.innerHTML = "<div class=\"card-meta\">Wybierz komorke w buforze.</div>";
      return;
    }
    const maxStack = buffer?.maxStack || 0;
    const goodsOptions = [
      `<option value="">--</option>`,
      ...(buffer?.allowedGoods || packagingConfig.goodsTypes || []).map(
        (item) => `<option value="${item}">${item}</option>`
      )
    ].join("");
    const levelOptions = Array.from({ length: maxStack }, (_, idx) => {
      const level = idx + 1;
      return `<option value="${level}">${level}</option>`;
    }).join("");
    const ops = resolveBufferOps(buffer, cell.goodsType, selectedBufferLevel) || {};
    const loadOps = ops.load || {};
    const unloadOps = ops.unload || {};
    bufferEditor.innerHTML = `
      <div class="buffer-field">
        <label>Komorka</label>
        <div>${cell.id} (${buffer?.name || buffer?.id || "--"})</div>
      </div>
      <div class="buffer-field">
        <label>Action point</label>
        <div>${cell.point || "--"}</div>
      </div>
      <div class="buffer-field">
        <label>Typ opakowania</label>
        <select id="buffer-goods-select">${goodsOptions}</select>
      </div>
      <div class="buffer-field">
        <label>Poziom stacku</label>
        <input id="buffer-stack-input" type="number" min="0" max="${maxStack}" value="${cell.stack}" />
      </div>
      <div class="buffer-field">
        <label>Poziom operacji</label>
        <select id="buffer-level-select">${levelOptions}</select>
      </div>
      <div class="ops-section">
        <div class="ops-title">Pobieranie (load)</div>
        <div class="buffer-field">
          <label>start_height</label>
          <input id="op-load-start" type="number" step="0.01" value="${loadOps.start_height ?? ""}" />
        </div>
        <div class="buffer-field">
          <label>rec_height</label>
          <input id="op-load-rec" type="number" step="0.01" value="${loadOps.rec_height ?? ""}" />
        </div>
        <div class="buffer-field">
          <label>end_height</label>
          <input id="op-load-end" type="number" step="0.01" value="${loadOps.end_height ?? ""}" />
        </div>
        <div class="buffer-field">
          <label>recfile</label>
          <input id="op-load-recfile" type="text" value="${loadOps.recfile ?? ""}" />
        </div>
        <div class="buffer-field">
          <label>recognize</label>
          <select id="op-load-recognize">
            <option value="">--</option>
            <option value="true" ${loadOps.recognize === true ? "selected" : ""}>true</option>
            <option value="false" ${loadOps.recognize === false ? "selected" : ""}>false</option>
          </select>
        </div>
      </div>
      <div class="ops-section">
        <div class="ops-title">Odkladanie (unload)</div>
        <div class="buffer-field">
          <label>start_height</label>
          <input id="op-unload-start" type="number" step="0.01" value="${unloadOps.start_height ?? ""}" />
        </div>
        <div class="buffer-field">
          <label>end_height</label>
          <input id="op-unload-end" type="number" step="0.01" value="${unloadOps.end_height ?? ""}" />
        </div>
        <div class="buffer-field">
          <label>recognize</label>
          <select id="op-unload-recognize">
            <option value="">--</option>
            <option value="true" ${unloadOps.recognize === true ? "selected" : ""}>true</option>
            <option value="false" ${unloadOps.recognize === false ? "selected" : ""}>false</option>
          </select>
        </div>
      </div>
    `;
    const select = bufferEditor.querySelector("#buffer-goods-select");
    const input = bufferEditor.querySelector("#buffer-stack-input");
    if (select) {
      select.value = cell.goodsType || "";
      select.addEventListener("change", (event) => {
        updateBufferCell(selectedBufferCell.bufferId, cell.id, { goodsType: event.target.value });
      });
    }
    if (input) {
      input.addEventListener("change", (event) => {
        const next = clamp(Number(event.target.value || 0), 0, maxStack);
        updateBufferCell(selectedBufferCell.bufferId, cell.id, { stack: next });
      });
    }
    const levelSelect = bufferEditor.querySelector("#buffer-level-select");
    if (levelSelect) {
      levelSelect.value = String(selectedBufferLevel);
      levelSelect.addEventListener("change", (event) => {
        selectedBufferLevel = Number(event.target.value || 1);
        renderBufferEditor();
      });
    }

    const bindOpsInput = (id, kind, field, cast) => {
      const el = bufferEditor.querySelector(id);
      if (!el) return;
      el.addEventListener("change", (event) => {
        const rawValue = event.target.value;
        const value = cast ? cast(rawValue) : rawValue;
        updateBufferOps(selectedBufferCell.bufferId, cell.goodsType, selectedBufferLevel, { [field]: value }, kind);
      });
    };
    bindOpsInput("#op-load-start", "load", "start_height", (v) => (v === "" ? null : Number(v)));
    bindOpsInput("#op-load-rec", "load", "rec_height", (v) => (v === "" ? null : Number(v)));
    bindOpsInput("#op-load-end", "load", "end_height", (v) => (v === "" ? null : Number(v)));
    bindOpsInput("#op-load-recfile", "load", "recfile", (v) => v || null);
    bindOpsInput("#op-load-recognize", "load", "recognize", (v) => (v === "" ? null : v === "true"));
    bindOpsInput("#op-unload-start", "unload", "start_height", (v) => (v === "" ? null : Number(v)));
    bindOpsInput("#op-unload-end", "unload", "end_height", (v) => (v === "" ? null : Number(v)));
    bindOpsInput("#op-unload-recognize", "unload", "recognize", (v) => (v === "" ? null : v === "true"));
  };

  const renderLineRequests = () => {
    if (!lineRequestsList || !packagingConfig) return;
    const lines = packagingConfig.lines || [];
    if (!lines.length) {
      lineRequestsList.innerHTML = "<div class=\"card-meta\">Brak linii.</div>";
      return;
    }
    const groups = packagingConfig.goodsGroups || {};
    lineRequestsList.innerHTML = "";
    lines.forEach((line) => {
      const request = lineRequests.find((item) => item.id === line.id);
      const packagingOptions = (groups.packaging || packagingConfig.goodsTypes || [])
        .map(
          (item) =>
            `<option value="${item}" ${request?.supply?.goodsType === item ? "selected" : ""}>${item}</option>`
        )
        .join("");
      const returnOptions = (groups.return || groups.packaging || packagingConfig.goodsTypes || [])
        .map(
          (item) =>
            `<option value="${item}" ${request?.return?.goodsType === item ? "selected" : ""}>${item}</option>`
        )
        .join("");
      const supplyPoint = getPlaceById(line.supplyPoint)?.point || line.supplyPoint || "--";
      const outputPoint = getPlaceById(line.outputPoint)?.point || line.outputPoint || "--";
      const wastePoint = getPlaceById(line.wastePoint)?.point || line.wastePoint || "--";
      const auxPoint = getPlaceById(line.auxPoint)?.point || line.auxPoint || "--";
      const card = document.createElement("div");
      card.className = "line-request";
      card.innerHTML = `
        <div class="line-request-header">
          <div class="line-request-title">${line.name || line.id}</div>
          <div class="line-request-status">Linia ${line.id}</div>
        </div>
        <div class="line-request-actions">
          <div class="buffer-field">
            <label>Opakowania (${supplyPoint})</label>
            <select data-line-id="${line.id}" data-kind="supply">${packagingOptions}</select>
            <button class="${request?.supply?.active ? "off" : ""}" data-line-id="${line.id}" data-kind="supply">
              ${request?.supply?.active ? "Anuluj" : "Zamow"}
            </button>
          </div>
          <div class="buffer-field">
            <label>Materialy dodatkowe (${auxPoint})</label>
            <button class="${request?.aux?.active ? "off" : ""}" data-line-id="${line.id}" data-kind="aux">
              ${request?.aux?.active ? "Anuluj" : "Zamow"}
            </button>
          </div>
          <div class="buffer-field">
            <label>Odbior wyrobu (${outputPoint})</label>
            <button class="${request?.output?.active ? "off" : ""}" data-line-id="${line.id}" data-kind="output">
              ${request?.output?.active ? "Anuluj" : "Odbierz"}
            </button>
          </div>
          <div class="buffer-field">
            <label>Odbior odpadu (${wastePoint})</label>
            <button class="${request?.waste?.active ? "off" : ""}" data-line-id="${line.id}" data-kind="waste">
              ${request?.waste?.active ? "Anuluj" : "Odbierz"}
            </button>
          </div>
          <div class="buffer-field">
            <label>Zwrot opakowan (${supplyPoint})</label>
            <select data-line-id="${line.id}" data-kind="return">${returnOptions}</select>
            <button class="${request?.return?.active ? "off" : ""}" data-line-id="${line.id}" data-kind="return">
              ${request?.return?.active ? "Anuluj" : "Zwroc"}
            </button>
          </div>
        </div>
      `;
      card.querySelectorAll("select").forEach((select) => {
        select.addEventListener("change", (event) => {
          const kind = event.target.dataset.kind;
          updateLineRequest(line.id, kind, { goodsType: event.target.value });
        });
      });
      card.querySelectorAll("button").forEach((button) => {
        button.addEventListener("click", () => {
          const kind = button.dataset.kind;
          const current = request?.[kind]?.active;
          updateLineRequest(line.id, kind, { active: !current });
        });
      });
      lineRequestsList.appendChild(card);
    });
  };

  const renderPlaceOps = () => {
    if (!placeOpsPanel || !packagingConfig) return;
    const placeIds = packagingConfig.places ? Object.keys(packagingConfig.places) : [];
    if (!placeIds.length) {
      placeOpsPanel.innerHTML = "<div class=\"card-meta\">Brak miejsc.</div>";
      return;
    }
    if (!selectedPlaceId || !placeIds.includes(selectedPlaceId)) {
      selectedPlaceId = placeIds[0];
    }
    if (!selectedPlaceGoods) {
      selectedPlaceGoods = packagingConfig.goodsTypes?.[0] || "";
    }
    const goodsOptions = (packagingConfig.goodsTypes || [])
      .map(
        (item) =>
          `<option value="${item}" ${selectedPlaceGoods === item ? "selected" : ""}>${item}</option>`
      )
      .join("");
    const placeOptions = placeIds
      .map(
        (id) => `<option value="${id}" ${selectedPlaceId === id ? "selected" : ""}>${id}</option>`
      )
      .join("");
    const ops = resolvePlaceOps(selectedPlaceId, selectedPlaceGoods) || {};
    const loadOps = ops.load || {};
    const unloadOps = ops.unload || {};
    placeOpsPanel.innerHTML = `
      <div class="buffer-field">
        <label>Miejsce</label>
        <select id="place-select">${placeOptions}</select>
      </div>
      <div class="buffer-field">
        <label>Typ opakowania</label>
        <select id="place-goods">${goodsOptions}</select>
      </div>
      <div class="ops-section">
        <div class="ops-title">Pobieranie (load)</div>
        <div class="buffer-field">
          <label>start_height</label>
          <input id="place-load-start" type="number" step="0.01" value="${loadOps.start_height ?? ""}" />
        </div>
        <div class="buffer-field">
          <label>rec_height</label>
          <input id="place-load-rec" type="number" step="0.01" value="${loadOps.rec_height ?? ""}" />
        </div>
        <div class="buffer-field">
          <label>end_height</label>
          <input id="place-load-end" type="number" step="0.01" value="${loadOps.end_height ?? ""}" />
        </div>
        <div class="buffer-field">
          <label>recfile</label>
          <input id="place-load-recfile" type="text" value="${loadOps.recfile ?? ""}" />
        </div>
        <div class="buffer-field">
          <label>recognize</label>
          <select id="place-load-recognize">
            <option value="">--</option>
            <option value="true" ${loadOps.recognize === true ? "selected" : ""}>true</option>
            <option value="false" ${loadOps.recognize === false ? "selected" : ""}>false</option>
          </select>
        </div>
      </div>
      <div class="ops-section">
        <div class="ops-title">Odkladanie (unload)</div>
        <div class="buffer-field">
          <label>start_height</label>
          <input id="place-unload-start" type="number" step="0.01" value="${unloadOps.start_height ?? ""}" />
        </div>
        <div class="buffer-field">
          <label>end_height</label>
          <input id="place-unload-end" type="number" step="0.01" value="${unloadOps.end_height ?? ""}" />
        </div>
        <div class="buffer-field">
          <label>recognize</label>
          <select id="place-unload-recognize">
            <option value="">--</option>
            <option value="true" ${unloadOps.recognize === true ? "selected" : ""}>true</option>
            <option value="false" ${unloadOps.recognize === false ? "selected" : ""}>false</option>
          </select>
        </div>
      </div>
    `;
    const placeSelect = placeOpsPanel.querySelector("#place-select");
    const goodsSelect = placeOpsPanel.querySelector("#place-goods");
    if (placeSelect) {
      placeSelect.addEventListener("change", (event) => {
        selectedPlaceId = event.target.value;
        renderPlaceOps();
      });
    }
    if (goodsSelect) {
      goodsSelect.addEventListener("change", (event) => {
        selectedPlaceGoods = event.target.value;
        renderPlaceOps();
      });
    }
    const bindPlaceInput = (id, kind, field, cast) => {
      const el = placeOpsPanel.querySelector(id);
      if (!el) return;
      el.addEventListener("change", (event) => {
        const rawValue = event.target.value;
        const value = cast ? cast(rawValue) : rawValue;
        updatePlaceOps(selectedPlaceId, selectedPlaceGoods, { [field]: value }, kind);
      });
    };
    bindPlaceInput("#place-load-start", "load", "start_height", (v) => (v === "" ? null : Number(v)));
    bindPlaceInput("#place-load-rec", "load", "rec_height", (v) => (v === "" ? null : Number(v)));
    bindPlaceInput("#place-load-end", "load", "end_height", (v) => (v === "" ? null : Number(v)));
    bindPlaceInput("#place-load-recfile", "load", "recfile", (v) => v || null);
    bindPlaceInput("#place-load-recognize", "load", "recognize", (v) => (v === "" ? null : v === "true"));
    bindPlaceInput("#place-unload-start", "unload", "start_height", (v) => (v === "" ? null : Number(v)));
    bindPlaceInput("#place-unload-end", "unload", "end_height", (v) => (v === "" ? null : Number(v)));
    bindPlaceInput("#place-unload-recognize", "unload", "recognize", (v) => (v === "" ? null : v === "true"));
  };

  const renderPackaging = () => {
    if (!bufferGrid || !lineRequestsList || !bufferEditor || !placeOpsPanel) {
      return;
    }
    if (!packagingConfig) {
      bufferGrid.innerHTML = "<div class=\"card\">Brak konfiguracji.</div>";
      lineRequestsList.innerHTML = "<div class=\"card\">Brak konfiguracji.</div>";
      bufferEditor.innerHTML = "<div class=\"card-meta\">Brak konfiguracji.</div>";
      placeOpsPanel.innerHTML = "<div class=\"card-meta\">Brak konfiguracji.</div>";
      return;
    }
    initPackagingState();
    renderBufferGrid();
    renderBufferEditor();
    renderLineRequests();
    renderPlaceOps();
    renderStreams();
  };

  const parseWorksiteKey = (id) => {
    const match = String(id).match(/^(.*?)(\\d+)?$/);
    if (!match) return { prefix: String(id), num: null };
    const prefix = match[1] || String(id);
    const num = match[2] ? Number(match[2]) : null;
    return { prefix, num };
  };

  const sortWorksites = (list, direction) => {
    const dir = direction === ORDER_DESC ? -1 : 1;
    return [...list].sort((a, b) => {
      const aKey = parseWorksiteKey(a.id);
      const bKey = parseWorksiteKey(b.id);
      if (aKey.prefix !== bKey.prefix) {
        return aKey.prefix.localeCompare(bKey.prefix) * dir;
      }
      if (aKey.num !== null && bKey.num !== null && aKey.num !== bKey.num) {
        return (aKey.num - bKey.num) * dir;
      }
      return String(a.id).localeCompare(String(b.id)) * dir;
    });
  };

  const getGroupWorksites = (groupId) => {
    return worksites.filter((site) => site.group === groupId);
  };

  const getDropOrder = (stream) => {
    const order = stream?.drop_policy?.order;
    if (order === "asc" || order === "ascending") return ORDER_ASC;
    if (order === "desc" || order === "descending") return ORDER_DESC;
    return ORDER_DESC;
  };

  const getNextPickCandidate = (pickGroupId, order) => {
    const groupSites = sortWorksites(getGroupWorksites(pickGroupId), order);
    for (const site of groupSites) {
      const state = getWorksiteState(site.id);
      if (state.blocked) continue;
      if (state.occupancy === "filled") {
        return site;
      }
    }
    return null;
  };

  const getNextDropCandidate = (dropGroups, order) => {
    for (const groupId of dropGroups) {
      const groupSites = sortWorksites(getGroupWorksites(groupId), order);
      let blockedAhead = false;
      for (const site of groupSites) {
        const state = getWorksiteState(site.id);
        if (state.blocked || state.occupancy === "filled") {
          blockedAhead = true;
          break;
        }
        return { site, groupId };
      }
      if (blockedAhead) {
        continue;
      }
    }
    return null;
  };

  const normalizeWorksiteState = (value) => {
    if (typeof value === "string") {
      const occupancy = WORKSITE_OCCUPANCY.includes(value) ? value : "empty";
      return { occupancy, blocked: false };
    }
    if (value && typeof value === "object") {
      const occupancy = WORKSITE_OCCUPANCY.includes(value.occupancy) ? value.occupancy : "empty";
      return { occupancy, blocked: Boolean(value.blocked) };
    }
    return { occupancy: "empty", blocked: false };
  };

  const loadWorksiteState = (worksiteList) => {
    const stored = safeParse(localStorage.getItem(WORKSITE_STATE_KEY)) || {};
    const state = {};
    worksiteList.forEach((site) => {
      state[site.id] = normalizeWorksiteState(stored[site.id]);
    });
    localStorage.setItem(WORKSITE_STATE_KEY, JSON.stringify(state));
    return state;
  };

  const normalizeRobotState = (value) => {
    if (!value || typeof value !== "object") {
      return {
        dispatchable: true,
        online: true,
        controlled: false,
        blocked: false,
        manualMode: false
      };
    }
    const online = value.online !== false;
    return {
      dispatchable: online ? value.dispatchable !== false : false,
      online,
      controlled: Boolean(value.controlled),
      blocked: Boolean(value.blocked),
      manualMode: Boolean(value.manualMode)
    };
  };

  const loadRobotState = (robotList) => {
    const stored = safeParse(localStorage.getItem(ROBOT_STATE_KEY)) || {};
    return robotList.map((robot) => ({
      ...robot,
      ...normalizeRobotState(stored[robot.id])
    }));
  };

  const persistRobotState = () => {
    const stored = {};
    robots.forEach((robot) => {
      stored[robot.id] = {
        dispatchable: robot.dispatchable,
        online: robot.online,
        controlled: robot.controlled,
        blocked: robot.blocked,
        manualMode: robot.manualMode
      };
    });
    localStorage.setItem(ROBOT_STATE_KEY, JSON.stringify(stored));
  };

  const updateRobotState = (id, updates) => {
    robots = robots.map((robot) => (robot.id === id ? { ...robot, ...updates } : robot));
    persistRobotState();
    renderRobots();
    updateRobotMarkers();
    renderNavControls();
    renderManualDrivePanel();
  };

  const syncFaultRobotSelect = () => {
    if (!faultRobotSelect) return;
    const current = faultRobotSelect.value;
    faultRobotSelect.innerHTML = robots
      .map((robot) => `<option value="${robot.id}">${robot.name}</option>`)
      .join("");
    if (current && robots.some((robot) => robot.id === current)) {
      faultRobotSelect.value = current;
      return;
    }
    if (robots[0]) {
      faultRobotSelect.value = robots[0].id;
    }
  };

  const getFaultRobotId = () => {
    if (faultRobotSelect && faultRobotSelect.value) return faultRobotSelect.value;
    if (manualTargetRobotId) return manualTargetRobotId;
    return robots[0]?.id || null;
  };

  const clearRobotBlock = (robotId) => {
    const robot = getRobotById(robotId);
    if (!robot) return false;
    const runtime = getRobotRuntime(robotId);
    if (runtime && runtime.blockedReason) {
      runtime.paused = false;
      runtime.blockedReason = null;
    }
    if (runtime?.taskId) {
      updateTask(runtime.taskId, { status: "In progress" });
    }
    updateRobotState(robotId, { blocked: false, activity: runtime ? getRuntimeActivity(runtime) : "Idle" });
    return true;
  };

  const failRuntimeTask = (robotId, phaseLabel) => {
    const runtime = getRobotRuntime(robotId);
    if (!runtime) return false;
    if (runtime.taskId) {
      updateTask(runtime.taskId, { status: "Failed", phase: phaseLabel });
    }
    robotRuntime.delete(robotId);
    const robot = getRobotById(robotId);
    if (robot) {
      ensureRobotMotion(robot);
      robot.speed = 0;
    }
    updateRobotState(robotId, { task: null, activity: phaseLabel });
    return true;
  };

  const simulatePickProblem = (robotId) => {
    const runtime = getRobotRuntime(robotId);
    if (!runtime || runtime.mode !== "auto") return false;
    if (!["to_pick", "picking"].includes(runtime.phase)) return false;
    setWorksiteBlocked(runtime.pickId, true);
    return failRuntimeTask(robotId, "Pick blocked");
  };

  const simulatePickRobotBlocked = (robotId) => {
    const runtime = getRobotRuntime(robotId);
    if (runtime) {
      runtime.paused = true;
      runtime.blockedReason = "pick";
      if (runtime.taskId) {
        updateTask(runtime.taskId, { status: "Paused", phase: "Blocked at pick" });
      }
    }
    updateRobotState(robotId, { blocked: true, activity: "Blocked at pick" });
    return true;
  };

  const findAlternativeDrop = (runtime) => {
    let dropGroups = [];
    let order = ORDER_DESC;
    if (runtime.dropGroup) {
      dropGroups = [runtime.dropGroup];
    }
    const stream =
      workflowData?.streams?.find((entry) => entry.id === runtime.streamId) || workflowData?.streams?.[0];
    if (stream?.drop_group_order?.length) {
      dropGroups = stream.drop_group_order;
      order = getDropOrder(stream);
    }
    if (!dropGroups.length) return null;
    return getNextDropCandidate(dropGroups, order);
  };

  const simulateDropProblem = (robotId) => {
    const runtime = getRobotRuntime(robotId);
    if (!runtime || runtime.mode !== "auto") return false;
    if (!["to_drop", "dropping"].includes(runtime.phase)) return false;
    setWorksiteBlocked(runtime.dropId, true);
    const nextDrop = findAlternativeDrop(runtime);
    if (nextDrop && nextDrop.site && nextDrop.site.id !== runtime.dropId) {
      const nextPos = nextDrop.site.pos || resolvePointPosition(nextDrop.site.point);
      if (nextPos) {
        runtime.dropId = nextDrop.site.id;
        runtime.dropPos = { ...nextPos };
        runtime.target = { ...nextPos };
        runtime.phase = "to_drop";
        updateTask(runtime.taskId, { dropId: runtime.dropId, phase: "Reroute drop" });
        updateRobotState(robotId, { activity: "Reroute drop" });
        return true;
      }
    }
    return failRuntimeTask(robotId, "Drop blocked");
  };

  const simulateDriveProblem = (robotId, mode) => {
    return Boolean(addObstacleForRobot(robotId, mode));
  };

  const buildRobots = (graph, worksiteList) => {
    const worksiteIndex = new Map(worksiteList.map((site) => [site.id, site.pos]));
    const nodeIndex = new Map((graph?.nodes || []).map((node) => [node.id, node.pos]));

    const resolvePos = (ref) => {
      if (worksiteIndex.has(ref)) return worksiteIndex.get(ref);
      if (nodeIndex.has(ref)) return nodeIndex.get(ref);
      return worksiteList[0]?.pos || { x: 0, y: 0 };
    };

    const baseRobots = [
      {
        id: "RB-01",
        name: "Robot 01",
        battery: 82,
        blocked: false,
        task: null,
        activity: "Idle",
        ref: "PICK-03",
        pos: resolvePos("PICK-03"),
        heading: 0,
        speed: 0,
        dispatchable: true,
        online: true,
        controlled: false,
        manualMode: false
      }
    ];

    return loadRobotState(baseRobots);
  };

  const buildTasks = () => [];

  const findParkingPoint = () => {
    if (!graphData?.nodes?.length) return null;
    const park = graphData.nodes.find((node) => node.className === "ParkPoint");
    if (park?.pos) return park.pos;
    const charge = graphData.nodes.find((node) => node.className === "ChargePoint");
    if (charge?.pos) return charge.pos;
    return graphData.nodes[0]?.pos || null;
  };

  const getRobotById = (id) => robots.find((item) => item.id === id);

  const getRobotRuntime = (robotId) => robotRuntime.get(robotId) || null;

  const getManualCommandRobot = () => {
    if (manualTargetRobotId) {
      const robot = getRobotById(manualTargetRobotId);
      if (robot?.manualMode) return robot;
    }
    const manualRobots = robots.filter((robot) => robot.manualMode);
    return manualRobots.length === 1 ? manualRobots[0] : null;
  };

  const buildRobotMarkerClass = (robot) => {
    const runtime = getRobotRuntime(robot.id);
    const classes = ["robot-marker"];
    if (robot.manualMode) classes.push("manual");
    if (manualTargetRobotId === robot.id) classes.push("selected");
    if (runtime?.paused) classes.push("paused");
    if (robot.blocked) classes.push("blocked");
    return classes.join(" ");
  };

  const getRuntimeActivity = (runtime) => {
    if (!runtime) return "Idle";
    if (runtime.paused) {
      return runtime.mode === "manual" ? "Manual paused" : "Paused";
    }
    if (runtime.mode === "manual") {
      if (runtime.phase === "manual_action") {
        return runtime.manualAction === "load" ? "Manual: Loading" : "Manual: Unloading";
      }
      return "Manual: Enroute";
    }
    const phaseMap = {
      to_pick: "To pick",
      picking: "Picking",
      to_drop: "To drop",
      dropping: "Dropping",
      to_park: "Parking"
    };
    return phaseMap[runtime.phase] || "In progress";
  };

  const formatRobotActivity = (robot) => {
    if (robot.blocked) return "Blocked";
    if (robot.activity) return robot.activity;
    if (robot.manualMode) return "Manual idle";
    return "Idle";
  };

  const updateAllRobotMarkerStates = () => {
    if (!robotMarkers.size) return;
    robotMarkers.forEach((marker, id) => {
      const robot = getRobotById(id);
      if (!robot) return;
      marker.setAttribute("class", buildRobotMarkerClass(robot));
    });
  };

  const getNavControlTarget = () => {
    if (manualTargetRobotId) {
      const runtime = getRobotRuntime(manualTargetRobotId);
      const robot = getRobotById(manualTargetRobotId);
      if (robot && runtime) {
        return { robot, runtime };
      }
    }
    for (const [robotId, runtime] of robotRuntime.entries()) {
      const robot = getRobotById(robotId);
      if (robot && runtime) {
        return { robot, runtime };
      }
    }
    return null;
  };

  const renderNavControls = () => {
    if (!navControls || !navControlsName || !navControlsPause || !navControlsStop) return;
    const target = getNavControlTarget();
    if (!target) {
      navControls.classList.add("hidden");
      return;
    }
    navControls.classList.remove("hidden");
    const suffix = target.robot.manualMode ? " (Manual)" : "";
    navControlsName.textContent = `${target.robot.name}${suffix}`;
    navControlsPause.textContent = target.runtime.paused ? "Wznow" : "Pauzuj";
    navControlsPause.dataset.id = target.robot.id;
    navControlsStop.dataset.id = target.robot.id;
  };

  const pauseRuntimeForManual = (robotId) => {
    const runtime = getRobotRuntime(robotId);
    if (!runtime || runtime.mode === "manual") return null;
    runtime.mode = runtime.mode || "auto";
    runtime.wasPaused = Boolean(runtime.paused);
    runtime.paused = true;
    robotRuntime.delete(robotId);
    pausedAutoRuntime.set(robotId, runtime);
    const robot = getRobotById(robotId);
    if (robot) {
      ensureRobotMotion(robot);
      robot.speed = 0;
    }
    if (runtime.taskId) {
      updateTask(runtime.taskId, { status: "Paused" });
    }
    return runtime;
  };

  const restorePausedRuntime = (robotId) => {
    const runtime = pausedAutoRuntime.get(robotId);
    if (!runtime) return null;
    pausedAutoRuntime.delete(robotId);
    const wasPaused = Boolean(runtime.wasPaused);
    delete runtime.wasPaused;
    runtime.mode = runtime.mode || "auto";
    runtime.paused = wasPaused;
    robotRuntime.set(robotId, runtime);
    if (runtime.taskId) {
      updateTask(runtime.taskId, { status: runtime.paused ? "Paused" : "In progress" });
    }
    return runtime;
  };

  const stopManualRuntime = (robotId) => {
    const runtime = getRobotRuntime(robotId);
    if (!runtime || runtime.mode !== "manual") return;
    robotRuntime.delete(robotId);
    const robot = getRobotById(robotId);
    if (robot) {
      ensureRobotMotion(robot);
      robot.speed = 0;
    }
  };

  const setRobotManualMode = (robotId, enabled) => {
    const robot = getRobotById(robotId);
    if (!robot) return;
    if (robot.manualMode === enabled) {
      if (enabled) {
        manualTargetRobotId = robotId;
        updateAllRobotMarkerStates();
        renderNavControls();
      }
      return;
    }
    if (enabled) {
      pauseRuntimeForManual(robotId);
      manualTargetRobotId = robotId;
      if (manualDrive.enabled) {
        setManualDriveTarget(robotId);
      }
      updateRobotState(robotId, {
        manualMode: true,
        activity: robot.task ? "Manual override" : "Manual idle"
      });
      updateAllRobotMarkerStates();
      renderNavControls();
      renderManualDrivePanel();
      return;
    }
    stopManualRuntime(robotId);
    const restored = restorePausedRuntime(robotId);
    if (manualDrive.robotId === robotId) {
      manualDrive.enabled = false;
      manualDrive.keys.clear();
      manualDrive.driving = false;
      manualDrive.robotId = null;
    }
    if (manualTargetRobotId === robotId) {
      manualTargetRobotId = null;
    }
    const nextActivity = restored ? getRuntimeActivity(restored) : "Idle";
    updateRobotState(robotId, { manualMode: false, activity: nextActivity });
    updateAllRobotMarkerStates();
    renderNavControls();
    renderManualDrivePanel();
  };

  const handleRobotMarkerClick = (robotId) => {
    const robot = getRobotById(robotId);
    if (!robot) return;
    if (!robot.manualMode) {
      setRobotManualMode(robotId, true);
      return;
    }
    manualTargetRobotId = robotId;
    if (manualDrive.enabled) {
      setManualDriveTarget(robotId);
    }
    updateAllRobotMarkerStates();
    renderNavControls();
    renderManualDrivePanel();
  };

  const setManualDriveTarget = (robotId) => {
    if (manualDrive.robotId === robotId) return;
    if (manualDrive.enabled && manualDrive.robotId) {
      const previous = getRobotById(manualDrive.robotId);
      if (previous?.manualMode) {
        updateRobotState(previous.id, { activity: "Manual idle" });
      }
    }
    manualDrive.robotId = robotId;
    manualDrive.keys.clear();
    manualDrive.driving = false;
  };

  const setManualDriveDriving = (robotId, driving) => {
    if (manualDrive.driving === driving) return;
    manualDrive.driving = driving;
    const robot = getRobotById(robotId);
    if (!robot?.manualMode) return;
    updateRobotState(robotId, { activity: driving ? "Manual drive" : "Manual idle" });
  };

  const setManualDriveEnabled = (robotId, enabled) => {
    const robot = getRobotById(robotId);
    if (!robot || !robot.manualMode) return;
    if (enabled) {
      stopNavigation(robotId);
      manualDrive.enabled = true;
      setManualDriveTarget(robotId);
      updateRobotState(robotId, { activity: "Manual idle" });
    } else {
      manualDrive.enabled = false;
      manualDrive.keys.clear();
      manualDrive.driving = false;
      if (robot.manualMode) {
        updateRobotState(robotId, { activity: "Manual idle" });
      }
    }
    renderManualDrivePanel();
  };

  const renderManualDrivePanel = () => {
    if (!manualDrivePanel || !manualDriveRobot || !manualDriveToggle) return;
    const robot = getManualCommandRobot();
    if (!robot) {
      manualDrivePanel.classList.add("hidden");
      return;
    }
    manualDrivePanel.classList.remove("hidden");
    manualDrivePanel.classList.toggle("active", manualDrive.enabled);
    manualDriveRobot.textContent = robot.name;
    manualDriveToggle.textContent = manualDrive.enabled
      ? "Wylacz sterowanie"
      : "Wlacz sterowanie";
    manualDriveToggle.dataset.id = robot.id;
  };

  const getManualDriveVector = () => {
    let dx = 0;
    let dy = 0;
    if (manualDrive.keys.has("up")) dy += 1;
    if (manualDrive.keys.has("down")) dy -= 1;
    if (manualDrive.keys.has("left")) dx -= 1;
    if (manualDrive.keys.has("right")) dx += 1;
    if (!dx && !dy) return null;
    const length = Math.hypot(dx, dy) || 1;
    return { dx: dx / length, dy: dy / length };
  };

  const handleManualDriveKey = (event, pressed) => {
    if (!manualDrive.enabled || !manualDrive.robotId) return;
    if (manualDrivePanel?.classList.contains("hidden")) return;
    const mapPanel = document.getElementById("view-map");
    if (mapPanel && !mapPanel.classList.contains("active")) return;
    const target = event.target;
    const tag = target?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) {
      return;
    }
    const key = event.key.toLowerCase();
    const mapped = MANUAL_KEY_MAP[key];
    if (!mapped) return;
    event.preventDefault();
    if (pressed) {
      manualDrive.keys.add(mapped);
    } else {
      manualDrive.keys.delete(mapped);
    }
  };

  const clearManualDriveKeys = () => {
    if (!manualDrive.keys.size) return;
    manualDrive.keys.clear();
    if (manualDrive.robotId) {
      setManualDriveDriving(manualDrive.robotId, false);
    }
  };

  const applyManualDrive = (deltaMs) => {
    if (!manualDrive.enabled || !manualDrive.robotId) return;
    const robot = getRobotById(manualDrive.robotId);
    if (!robot || !robot.manualMode) return;
    const dt = deltaMs / 1000;
    if (!Number.isFinite(dt) || dt <= 0) return;
    ensureRobotMotion(robot);
    if (robot.blocked) {
      if (manualDrive.driving) {
        setManualDriveDriving(robot.id, false);
      }
      applyKinematicMotion(robot, robot.heading, 0, dt);
      return;
    }
    if (robotRuntime.has(robot.id)) return;
    const vector = getManualDriveVector();
    if (!vector) {
      if (manualDrive.driving) {
        setManualDriveDriving(robot.id, false);
      }
      applyKinematicMotion(robot, robot.heading, 0, dt);
      return;
    }
    let desiredSpeed = MANUAL_DRIVE_SPEED_MPS;
    const previewTarget = {
      x: robot.pos.x + vector.dx * (ROBOT_STOP_DISTANCE + OBSTACLE_RADIUS),
      y: robot.pos.y + vector.dy * (ROBOT_STOP_DISTANCE + OBSTACLE_RADIUS)
    };
    const obstacle = findObstacleOnPath(robot.pos, previewTarget);
    if (obstacle && obstacle.mode !== "avoid") {
      desiredSpeed = 0;
    } else if (obstacle && obstacle.mode === "avoid") {
      desiredSpeed = Math.min(desiredSpeed, MANUAL_DRIVE_SPEED_MPS * 0.5);
    }
    const traffic = getTrafficSpeedLimit(robot, desiredSpeed);
    desiredSpeed = Math.min(desiredSpeed, traffic.speedLimit);
    const desiredHeading = Math.atan2(vector.dy, vector.dx);
    applyKinematicMotion(robot, desiredHeading, desiredSpeed, dt);
    if (!manualDrive.driving) {
      setManualDriveDriving(robot.id, true);
    }
  };

  const setNavigationPaused = (robotId, paused) => {
    const runtime = getRobotRuntime(robotId);
    if (!runtime) return;
    runtime.paused = paused;
    if (runtime.mode !== "manual" && runtime.taskId) {
      updateTask(runtime.taskId, { status: paused ? "Paused" : "In progress" });
    }
    updateRobotState(robotId, { activity: getRuntimeActivity(runtime) });
    updateAllRobotMarkerStates();
  };

  const toggleNavigationPause = (robotId) => {
    const runtime = getRobotRuntime(robotId);
    if (!runtime) return;
    setNavigationPaused(robotId, !runtime.paused);
  };

  const stopNavigation = (robotId) => {
    const runtime = getRobotRuntime(robotId);
    if (!runtime) return;
    robotRuntime.delete(robotId);
    const robot = getRobotById(robotId);
    if (robot) {
      ensureRobotMotion(robot);
      robot.speed = 0;
    }
    if (runtime.mode !== "manual" && runtime.taskId) {
      updateTask(runtime.taskId, { status: "Cancelled", phase: "Stopped" });
      updateRobotState(robotId, {
        task: null,
        activity: getRobotById(robotId)?.manualMode ? "Manual idle" : "Idle"
      });
    } else {
      updateRobotState(robotId, {
        activity: getRobotById(robotId)?.manualMode ? "Manual idle" : "Idle"
      });
    }
    updateAllRobotMarkerStates();
  };

  const startManualNavigation = (robotId, pointId, manualAction) => {
    const robot = getRobotById(robotId);
    if (!robot || !robot.manualMode) return;
    if (!robot.online || robot.blocked) return;
    const targetPos = resolvePointPosition(pointId);
    if (!targetPos) return;
    robotRuntime.set(robotId, {
      mode: "manual",
      phase: "manual_move",
      target: { ...targetPos },
      targetPointId: pointId,
      manualAction,
      waitUntil: null,
      paused: false
    });
    updateRobotState(robotId, { activity: getRuntimeActivity(robotRuntime.get(robotId)) });
  };

  const issueManualCommand = (robotId, pointId, actionKey) => {
    const manualAction = MANUAL_ACTIONS[actionKey] ?? null;
    if (manualDrive.enabled && manualDrive.robotId === robotId) {
      manualDrive.enabled = false;
      manualDrive.keys.clear();
      manualDrive.driving = false;
      renderManualDrivePanel();
    }
    startManualNavigation(robotId, pointId, manualAction);
  };

  const showManualMenu = (event, pointId) => {
    if (!manualMenu || !manualMenuRobot) return;
    const robot = getManualCommandRobot();
    if (!robot) return;
    const containerRect = mapWrap.getBoundingClientRect();
    const offsetX = event.clientX - containerRect.left + 8;
    const offsetY = event.clientY - containerRect.top + 8;
    manualMenu.style.left = `${offsetX}px`;
    manualMenu.style.top = `${offsetY}px`;
    manualMenu.dataset.pointId = pointId;
    manualMenu.dataset.robotId = robot.id;
    manualMenuRobot.textContent = robot.name;
    manualMenu.classList.remove("hidden");
  };

  const updateRobotMarkers = () => {
    if (!robotMarkers.size) return;
    robotMarkers.forEach((marker, id) => {
      const robot = robots.find((item) => item.id === id);
      if (!robot?.pos) return;
      ensureRobotMotion(robot);
      const point = projectPoint(robot.pos);
      const headingDeg = (-robot.heading * 180) / Math.PI;
      marker.setAttribute("transform", `translate(${point.x} ${point.y}) rotate(${headingDeg})`);
      marker.setAttribute("class", buildRobotMarkerClass(robot));
    });
  };

  const createTask = ({ streamId, robotId, pickId, dropId, dropGroup, kind, meta }) => {
    const id = `TASK-${String(taskCounter).padStart(3, "0")}`;
    taskCounter += 1;
    const task = {
      id,
      streamId,
      robotId,
      pickId,
      dropId,
      dropGroup,
      kind: kind || "transfer",
      meta: meta || null,
      status: "In progress",
      phase: "To pick",
      createdAt: Date.now()
    };
    tasks = [task, ...tasks].slice(0, 50);
    renderTasks();
    return task;
  };

  const updateTask = (taskId, updates) => {
    tasks = tasks.map((task) => (task.id === taskId ? { ...task, ...updates } : task));
    renderTasks();
  };

  const canDispatchRobot = (robot) => {
    return (
      robot.online &&
      robot.dispatchable &&
      robot.controlled &&
      !robot.blocked &&
      !robot.task &&
      !robot.manualMode
    );
  };

  const getBufferById = (bufferId) =>
    packagingConfig?.buffers?.find((buffer) => buffer.id === bufferId);

  const getPlaceById = (placeId) => packagingConfig?.places?.[placeId] || null;

  const resolvePlacePos = (placeId) => {
    const place = getPlaceById(placeId);
    if (!place) return null;
    return resolvePointPosition(place.point) || place.pos || null;
  };

  const findAvailableBufferCell = (bufferId, goodsType) => {
    const cells = bufferState[bufferId] || [];
    const buffer = getBufferById(bufferId);
    if (buffer?.allowedGoods && !buffer.allowedGoods.includes(goodsType)) {
      return null;
    }
    return cells.find((cell) => cell.stack > 0 && cell.goodsType === goodsType);
  };

  const findFreeBufferCell = (bufferId, goodsType) => {
    const buffer = getBufferById(bufferId);
    const cells = bufferState[bufferId] || [];
    const maxStack = buffer?.maxStack || 1;
    if (buffer?.allowedGoods && !buffer.allowedGoods.includes(goodsType)) {
      return null;
    }
    return cells.find((cell) => {
      if (cell.stack >= maxStack) return false;
      if (cell.stack === 0) return true;
      return cell.goodsType === goodsType;
    });
  };

  const attemptStreamDispatch = () => {
    if (!packagingConfig?.streams?.length || !PackagingEngine) return;
    const robot = robots.find((item) => canDispatchRobot(item));
    if (!robot) return;
    const result = PackagingEngine.planStreamDispatch({
      config: packagingConfig,
      bufferState,
      lineRequests
    });
    if (!result || !result.action) return;
    const { action, nextBufferState, nextLineRequests } = result;

    bufferState = nextBufferState;
    lineRequests = nextLineRequests;
    persistBufferState();
    persistLineRequests();
    renderBufferGrid();
    renderLineRequests();
    renderStreams();

    const pickPos = resolvePointPosition(action.pickPoint);
    const dropPos = resolvePointPosition(action.dropPoint);
    if (!pickPos || !dropPos) return;

    const task = createTask({
      streamId: action.streamId,
      robotId: robot.id,
      pickId: action.pickId,
      dropId: action.dropId,
      kind: action.streamId,
      meta: {
        goodsType: action.goodsType,
        lineId: action.lineId,
        bufferCell: action.bufferCell,
        targetBufferCell: action.targetBufferCell
      }
    });
    assignTaskToRobot(robot, task, pickPos, dropPos);
  };

  const assignTaskToRobot = (robot, task, pickPos, dropPos) => {
    robotRuntime.set(robot.id, {
      mode: "auto",
      phase: "to_pick",
      taskId: task.id,
      streamId: task.streamId || null,
      pickId: task.pickId,
      dropId: task.dropId,
      dropGroup: task.dropGroup || null,
      target: { ...pickPos },
      dropPos: { ...dropPos },
      waitUntil: null,
      paused: false,
      avoidance: null,
      blockedReason: null
    });
    updateRobotState(robot.id, { task: task.id, activity: "To pick" });
  };

  const attemptDispatch = () => {
    if (packagingConfig?.streams?.length) return;
    if (!workflowData?.streams?.length) return;
    const stream = workflowData.streams[0];
    const dropOrder = getDropOrder(stream);
    const pickCandidate = getNextPickCandidate(stream.pick_group, ORDER_ASC);
    const dropCandidate = getNextDropCandidate(stream.drop_group_order || [], dropOrder);
    if (!pickCandidate || !dropCandidate) return;

    const robot = robots.find((item) => canDispatchRobot(item));
    if (!robot) return;

    const task = createTask({
      streamId: stream.id,
      robotId: robot.id,
      pickId: pickCandidate.id,
      dropId: dropCandidate.site.id,
      dropGroup: dropCandidate.groupId
    });
    assignTaskToRobot(robot, task, pickCandidate.pos, dropCandidate.site.pos);
  };

  const moveRobotToward = (robot, target, deltaMs, maxSpeed) => {
    if (!robot?.pos || !target) return { arrived: true, traffic: null };
    const dt = deltaMs / 1000;
    if (!Number.isFinite(dt) || dt <= 0) return { arrived: false, traffic: null };
    ensureRobotMotion(robot);
    const dx = target.x - robot.pos.x;
    const dy = target.y - robot.pos.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= ROBOT_ARRIVAL_DISTANCE) {
      robot.pos = { ...target };
      robot.speed = 0;
      return { arrived: true, traffic: null };
    }
    const desiredHeading = Math.atan2(dy, dx);
    const speedCap = Number.isFinite(maxSpeed) ? maxSpeed : ROBOT_SPEED_MPS;
    let desiredSpeed = Math.min(speedCap, computeStoppingSpeed(dist));
    const traffic = getTrafficSpeedLimit(robot, desiredSpeed);
    desiredSpeed = Math.min(desiredSpeed, traffic.speedLimit);
    applyKinematicMotion(robot, desiredHeading, desiredSpeed, dt);
    const remaining = Math.hypot(target.x - robot.pos.x, target.y - robot.pos.y);
    if (remaining <= ROBOT_ARRIVAL_DISTANCE && robot.speed <= ROBOT_ARRIVAL_SPEED) {
      robot.pos = { ...target };
      robot.speed = 0;
      return { arrived: true, traffic };
    }
    return { arrived: false, traffic };
  };

  const findObstacleOnPath = (from, to, ignoreId) => {
    if (!obstacles.length) return null;
    for (const obstacle of obstacles) {
      if (ignoreId && obstacle.id === ignoreId) continue;
      const dist = distancePointToSegment(obstacle, from, to);
      if (dist <= obstacle.radius + OBSTACLE_CLEARANCE) {
        return obstacle;
      }
    }
    return null;
  };

  const computeAvoidWaypoint = (from, to, obstacle) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dir = unitVector(dx, dy);
    if (dir.x === 0 && dir.y === 0) {
      return null;
    }
    const toCenter = { x: obstacle.x - from.x, y: obstacle.y - from.y };
    const proj = toCenter.x * dir.x + toCenter.y * dir.y;
    const perp = { x: -dir.y, y: dir.x };
    const cross = dir.x * toCenter.y - dir.y * toCenter.x;
    const side = cross >= 0 ? 1 : -1;
    const offset = obstacle.radius + OBSTACLE_AVOID_MARGIN;
    const forward = Math.max(proj + offset, offset);
    return {
      x: from.x + dir.x * forward + perp.x * offset * side,
      y: from.y + dir.y * forward + perp.y * offset * side
    };
  };

  const advanceRobotToward = (robot, runtime, deltaMs) => {
    const dt = deltaMs / 1000;
    ensureRobotMotion(robot);
    if (robot.blocked) {
      applyKinematicMotion(robot, robot.heading, 0, dt);
      return { arrived: false, blocked: true, diverted: false };
    }
    if (!runtime.target) {
      applyKinematicMotion(robot, robot.heading, 0, dt);
      return { arrived: true, blocked: false, diverted: false };
    }

    const ignoreId = runtime.avoidance ? runtime.avoidance.obstacleId : null;
    const obstacle = findObstacleOnPath(robot.pos, runtime.target, ignoreId);
    if (obstacle) {
      if (obstacle.mode === "avoid") {
        if (!runtime.avoidance || runtime.avoidance.obstacleId !== obstacle.id) {
          const waypoint = computeAvoidWaypoint(robot.pos, runtime.target, obstacle);
          if (waypoint) {
            runtime.avoidance = {
              obstacleId: obstacle.id,
              waypoint,
              finalTarget: runtime.target
            };
            runtime.target = waypoint;
            updateRobotState(robot.id, { activity: "Avoiding obstacle" });
            return { arrived: false, blocked: false, diverted: true };
          }
        }
      } else if (!robot.blocked) {
        runtime.paused = true;
        runtime.blockedReason = "obstacle";
        if (runtime.taskId) {
          updateTask(runtime.taskId, { status: "Paused", phase: "Blocked by obstacle" });
        }
        updateRobotState(robot.id, { blocked: true, activity: "Blocked" });
        applyKinematicMotion(robot, robot.heading, 0, dt);
        return { arrived: false, blocked: true, diverted: false };
      }
    }

    const result = moveRobotToward(robot, runtime.target, deltaMs, ROBOT_SPEED_MPS);
    if (result.arrived && runtime.avoidance && pointsEqual(runtime.target, runtime.avoidance.waypoint)) {
      runtime.target = runtime.avoidance.finalTarget;
      runtime.avoidance = null;
      updateRobotState(robot.id, { activity: getRuntimeActivity(runtime) });
      return { arrived: false, blocked: false, diverted: true };
    }
    return { arrived: result.arrived, blocked: false, diverted: false };
  };

  const tickSimulation = (deltaMs) => {
    attemptStreamDispatch();
    attemptDispatch();
    const dt = deltaMs / 1000;
    applyManualDrive(deltaMs);

    robotRuntime.forEach((runtime, robotId) => {
      const robot = robots.find((item) => item.id === robotId);
      if (!robot || !runtime) return;
      if (runtime.paused) {
        applyKinematicMotion(robot, robot.heading || 0, 0, dt);
        return;
      }

      if (runtime.mode === "manual") {
        if (runtime.phase === "manual_move") {
          const result = advanceRobotToward(robot, runtime, deltaMs);
          if (!result.arrived) {
            return;
          }
          if (runtime.manualAction) {
            runtime.phase = "manual_action";
            runtime.waitUntil = Date.now() + ACTION_WAIT_MS;
            updateRobotState(robotId, { activity: getRuntimeActivity(runtime) });
          } else {
            robotRuntime.delete(robotId);
            updateRobotState(robotId, {
              activity: robot.manualMode ? "Manual idle" : "Idle"
            });
          }
        } else if (runtime.phase === "manual_action") {
          if (Date.now() >= runtime.waitUntil) {
            robotRuntime.delete(robotId);
            updateRobotState(robotId, {
              activity: robot.manualMode ? "Manual idle" : "Idle"
            });
          }
        }
        return;
      }

      if (runtime.phase === "to_pick") {
        const result = advanceRobotToward(robot, runtime, deltaMs);
        if (!result.arrived) {
          return;
        }
        runtime.phase = "picking";
        runtime.waitUntil = Date.now() + ACTION_WAIT_MS;
        updateRobotState(robotId, { activity: "Picking" });
        updateTask(runtime.taskId, { phase: "Picking" });
      } else if (runtime.phase === "picking") {
        if (Date.now() >= runtime.waitUntil) {
          setWorksiteOccupancy(runtime.pickId, "empty");
          runtime.phase = "to_drop";
          runtime.target = { ...runtime.dropPos };
          updateRobotState(robotId, { activity: "To drop" });
          updateTask(runtime.taskId, { phase: "To drop" });
        }
      } else if (runtime.phase === "to_drop") {
        const result = advanceRobotToward(robot, runtime, deltaMs);
        if (!result.arrived) {
          return;
        }
        runtime.phase = "dropping";
        runtime.waitUntil = Date.now() + ACTION_WAIT_MS;
        updateRobotState(robotId, { activity: "Dropping" });
        updateTask(runtime.taskId, { phase: "Dropping" });
      } else if (runtime.phase === "dropping") {
        if (Date.now() >= runtime.waitUntil) {
          setWorksiteOccupancy(runtime.dropId, "filled");
          const park = parkingPoint || robot.pos;
          runtime.phase = "to_park";
          runtime.target = { ...park };
          updateRobotState(robotId, { activity: "Parking" });
          updateTask(runtime.taskId, { phase: "Parking" });
        }
      } else if (runtime.phase === "to_park") {
        const result = advanceRobotToward(robot, runtime, deltaMs);
        if (!result.arrived) {
          return;
        }
        robotRuntime.delete(robotId);
        updateRobotState(robotId, { activity: "Idle", task: null });
        updateTask(runtime.taskId, { status: "Completed", phase: "Done" });
      }
    });

    updateRobotMarkers();
    renderNavControls();
  };

  const startSimulation = () => {
    if (simTimer) return;
    parkingPoint = findParkingPoint();
    simLastTick = Date.now();
    simTimer = window.setInterval(() => {
      const now = Date.now();
      const deltaMs = simLastTick ? now - simLastTick : SIM_TICK_MS;
      simLastTick = now;
      tickSimulation(deltaMs);
    }, SIM_TICK_MS);
  };

  const renderMapError = (message) => {
    mapSvg.innerHTML = "";
    const text = document.createElementNS(svgNS, "text");
    text.textContent = message;
    text.setAttribute("x", "16");
    text.setAttribute("y", "24");
    text.setAttribute("fill", "#6b6055");
    text.setAttribute("font-size", "14");
    mapSvg.appendChild(text);
  };

  const getBounds = (graph) => {
    const bounds = graph?.meta?.bounds;
    if (bounds?.min && bounds?.max) {
      return {
        minX: bounds.min.x,
        maxX: bounds.max.x,
        minY: bounds.min.y,
        maxY: bounds.max.y
      };
    }

    const points = [];
    (graph?.nodes || []).forEach((node) => {
      if (node.pos) points.push(node.pos);
    });
    worksites.forEach((site) => {
      if (site.pos) points.push(site.pos);
    });

    if (!points.length) {
      return { minX: -10, maxX: 10, minY: -10, maxY: 10 };
    }

    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys)
    };
  };

  const renderMiniMap = () => {
    if (!miniMapSvg || !graphData || !mapState) return;
    miniMapSvg.innerHTML = "";
    miniMapSvg.setAttribute("viewBox", `0 0 ${mapState.baseWidth} ${mapState.baseHeight}`);
    miniMapSvg.setAttribute("preserveAspectRatio", "xMidYMid meet");

    const nodesIndex = new Map((graphData.nodes || []).map((node) => [node.id, node.pos]));

    const edgesGroup = document.createElementNS(svgNS, "g");
    edgesGroup.setAttribute("class", "mini-map-edges");

    (graphData.edges || []).forEach((edge) => {
      const start = edge.startPos || nodesIndex.get(edge.start);
      const end = edge.endPos || nodesIndex.get(edge.end);
      if (!start || !end) return;
      const startPos = projectPoint(start);
      const endPos = projectPoint(end);
      const path = document.createElementNS(svgNS, "path");
      if (edge.controlPos1 && edge.controlPos2) {
        const c1 = projectPoint(edge.controlPos1);
        const c2 = projectPoint(edge.controlPos2);
        path.setAttribute(
          "d",
          `M ${startPos.x} ${startPos.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${endPos.x} ${endPos.y}`
        );
      } else {
        path.setAttribute("d", `M ${startPos.x} ${startPos.y} L ${endPos.x} ${endPos.y}`);
      }
      path.setAttribute("class", "mini-map-edge");
      edgesGroup.appendChild(path);
    });

    const worksitesGroup = document.createElementNS(svgNS, "g");
    worksitesGroup.setAttribute("class", "mini-map-worksites");

    worksites.forEach((site) => {
      if (!site.pos) return;
      const point = projectPoint(site.pos);
      const circle = document.createElementNS(svgNS, "circle");
      circle.setAttribute("cx", point.x);
      circle.setAttribute("cy", point.y);
      circle.setAttribute("r", "1.1");
      circle.setAttribute("class", "mini-map-worksite");
      worksitesGroup.appendChild(circle);
    });

    miniMapViewport = document.createElementNS(svgNS, "rect");
    miniMapViewport.setAttribute("class", "mini-map-viewport");

    const fragment = document.createDocumentFragment();
    fragment.appendChild(edgesGroup);
    fragment.appendChild(worksitesGroup);
    if (obstacles.length) {
      const obstaclesGroup = document.createElementNS(svgNS, "g");
      obstaclesGroup.setAttribute("class", "mini-map-obstacles");
      obstacles.forEach((obstacle) => {
        const point = projectPoint(obstacle);
        const circle = document.createElementNS(svgNS, "circle");
        circle.setAttribute("cx", point.x);
        circle.setAttribute("cy", point.y);
        circle.setAttribute("r", Math.max(obstacle.radius * 0.5, 0.6));
        circle.setAttribute("class", "mini-map-obstacle");
        obstaclesGroup.appendChild(circle);
      });
      fragment.appendChild(obstaclesGroup);
    }
    fragment.appendChild(miniMapViewport);
    miniMapSvg.appendChild(fragment);
    updateMiniMapViewport();

    if (!miniMapBound) {
      const updateFromMiniMapEvent = (event) => {
        if (!mapState) return;
        const rect = miniMapSvg.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const x = ((event.clientX - rect.left) / rect.width) * mapState.baseWidth;
        const y = ((event.clientY - rect.top) / rect.height) * mapState.baseHeight;
        mapState.x = x - mapState.width / 2;
        mapState.y = y - mapState.height / 2;
        updateViewBox();
      };

      miniMapSvg.addEventListener("pointerdown", (event) => {
        if (!mapState) return;
        miniMapDrag = { pointerId: event.pointerId };
        updateFromMiniMapEvent(event);
        miniMapSvg.setPointerCapture(event.pointerId);
      });

      miniMapSvg.addEventListener("pointermove", (event) => {
        if (!miniMapDrag) return;
        updateFromMiniMapEvent(event);
      });

      const endMiniMapDrag = (event) => {
        if (!miniMapDrag) return;
        miniMapDrag = null;
        if (event?.pointerId !== undefined) {
          miniMapSvg.releasePointerCapture(event.pointerId);
        }
      };

      miniMapSvg.addEventListener("pointerup", endMiniMapDrag);
      miniMapSvg.addEventListener("pointercancel", endMiniMapDrag);
      miniMapBound = true;
    }
  };

  const renderObstacles = () => {
    if (!obstacleLayer || !mapState) return;
    obstacleLayer.innerHTML = "";
    obstacles.forEach((obstacle) => {
      const point = projectPoint(obstacle);
      const circle = document.createElementNS(svgNS, "circle");
      circle.setAttribute("cx", point.x);
      circle.setAttribute("cy", point.y);
      circle.setAttribute("r", obstacle.radius);
      circle.setAttribute("class", `obstacle-marker ${obstacle.mode}`);
      obstacleLayer.appendChild(circle);
    });
  };

  const addObstacle = (pos, options = {}) => {
    if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return null;
    const obstacle = {
      id: `obs-${obstacleIdSeq++}`,
      x: pos.x,
      y: pos.y,
      radius: Number.isFinite(options.radius) ? options.radius : OBSTACLE_RADIUS,
      mode: options.mode === "avoid" ? "avoid" : "block"
    };
    obstacles = [...obstacles, obstacle];
    renderObstacles();
    renderMiniMap();
    return obstacle;
  };

  const clearObstacles = () => {
    obstacles = [];
    renderObstacles();
    renderMiniMap();
  };

  const addObstacleForRobot = (robotId, mode) => {
    const robot = getRobotById(robotId);
    if (!robot || !robot.pos) return null;
    const runtime = getRobotRuntime(robotId);
    const target = runtime?.target || null;
    let pos = null;
    if (target) {
      const dx = target.x - robot.pos.x;
      const dy = target.y - robot.pos.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.01) {
        const step = Math.max(OBSTACLE_RADIUS * 1.8, Math.min(dist * 0.6, dist - OBSTACLE_RADIUS));
        const ratio = step / dist;
        pos = { x: robot.pos.x + dx * ratio, y: robot.pos.y + dy * ratio };
      }
    }
    if (!pos) {
      pos = { x: robot.pos.x + OBSTACLE_RADIUS * 1.5, y: robot.pos.y };
    }
    return addObstacle(pos, { mode });
  };

  const renderMap = () => {
    if (!graphData || !workflowData) return;
    mapSvg.innerHTML = "";
    worksiteElements = new Map();
    worksiteLabels = new Map();
    worksiteRings = new Map();
    robotMarkers = new Map();
    actionPointMarkers = new Map();

    const { minX, maxX, minY, maxY } = getBounds(graphData);
    const width = maxX - minX;
    const height = maxY - minY;
    mapState = {
      x: 0,
      y: 0,
      width,
      height,
      baseWidth: width,
      baseHeight: height,
      minWidth: Math.max(width * 0.03, 5),
      maxWidth: width,
      offsetX: minX,
      offsetY: maxY
    };
    updateViewBox();
    mapSvg.setAttribute("preserveAspectRatio", "xMidYMid meet");

    const edgesGroup = document.createElementNS(svgNS, "g");
    edgesGroup.setAttribute("class", "map-edges");

    const nodesIndex = new Map((graphData.nodes || []).map((node) => [node.id, node.pos]));

    (graphData.edges || []).forEach((edge) => {
      const start = edge.startPos || nodesIndex.get(edge.start);
      const end = edge.endPos || nodesIndex.get(edge.end);
      if (!start || !end) return;
      const startPos = projectPoint(start);
      const endPos = projectPoint(end);
      const path = document.createElementNS(svgNS, "path");
      if (edge.controlPos1 && edge.controlPos2) {
        const c1 = projectPoint(edge.controlPos1);
        const c2 = projectPoint(edge.controlPos2);
        path.setAttribute(
          "d",
          `M ${startPos.x} ${startPos.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${endPos.x} ${endPos.y}`
        );
      } else {
        path.setAttribute("d", `M ${startPos.x} ${startPos.y} L ${endPos.x} ${endPos.y}`);
      }
      path.setAttribute("class", "map-edge");
      edgesGroup.appendChild(path);
    });

    const worksitesGroup = document.createElementNS(svgNS, "g");
    worksitesGroup.setAttribute("class", "map-worksites");
    const ringsGroup = document.createElementNS(svgNS, "g");
    ringsGroup.setAttribute("class", "map-worksite-rings");
    const labelsGroup = document.createElementNS(svgNS, "g");
    labelsGroup.setAttribute("class", "map-labels");
    const linksGroup = document.createElementNS(svgNS, "g");
    linksGroup.setAttribute("class", "map-links");
    const obstaclesGroup = document.createElementNS(svgNS, "g");
    obstaclesGroup.setAttribute("class", "map-obstacles");
    const actionPointsGroup = document.createElementNS(svgNS, "g");
    actionPointsGroup.setAttribute("class", "map-action-points");
    obstacleLayer = obstaclesGroup;

    const actionPoints = (graphData.nodes || []).filter(
      (node) => node.className === "ActionPoint" && node.pos
    );
    const actionPointIndex = new Map(actionPoints.map((node) => [node.id, node.pos]));

    worksites.forEach((site) => {
      if (!site.pos) return;
      const point = projectPoint(site.pos);
      const actionPos = site.point ? actionPointIndex.get(site.point) : null;
      if (actionPos) {
        const actionPoint = projectPoint(actionPos);
        const link = document.createElementNS(svgNS, "line");
        link.setAttribute("x1", point.x);
        link.setAttribute("y1", point.y);
        link.setAttribute("x2", actionPoint.x);
        link.setAttribute("y2", actionPoint.y);
        link.setAttribute("class", "worksite-link");
        linksGroup.appendChild(link);
      }
      const state = worksiteState[site.id] || { occupancy: "empty", blocked: false };
      const occupancy = state.occupancy || "empty";
      const circle = document.createElementNS(svgNS, "circle");
      circle.setAttribute("cx", point.x);
      circle.setAttribute("cy", point.y);
      circle.setAttribute("r", "1");
      circle.setAttribute(
        "class",
        `worksite-marker ${site.kind} ${occupancy}${state.blocked ? " blocked" : ""}`
      );
      circle.dataset.sizePx = site.kind === "drop" ? "6" : "5";
      circle.dataset.id = site.id;
      circle.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleWorksiteOccupancy(site.id);
      });
      circle.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        event.stopPropagation();
        showWorksiteMenu(event, site.id);
      });
      worksitesGroup.appendChild(circle);
      worksiteElements.set(site.id, circle);

      const ring = document.createElementNS(svgNS, "circle");
      ring.setAttribute("cx", point.x);
      ring.setAttribute("cy", point.y);
      ring.setAttribute("r", "1");
      ring.setAttribute("class", `worksite-ring${state.blocked ? " blocked" : ""}`);
      ring.dataset.sizePx = site.kind === "drop" ? "9" : "8";
      ringsGroup.appendChild(ring);
      worksiteRings.set(site.id, ring);

      const label = document.createElementNS(svgNS, "text");
      label.textContent = site.id;
      label.setAttribute(
        "class",
        `worksite-label ${occupancy}${state.blocked ? " blocked" : ""}`
      );
      label.dataset.baseX = point.x;
      label.dataset.baseY = point.y;
      label.setAttribute("x", point.x);
      label.setAttribute("y", point.y);
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("dominant-baseline", "hanging");
      labelsGroup.appendChild(label);
      worksiteLabels.set(site.id, label);
    });

    actionPoints.forEach((point) => {
      const pos = projectPoint(point.pos);
      const marker = document.createElementNS(svgNS, "circle");
      marker.setAttribute("cx", pos.x);
      marker.setAttribute("cy", pos.y);
      marker.setAttribute("r", "1");
      marker.setAttribute("class", "action-point");
      marker.dataset.sizePx = "3";
      marker.dataset.id = point.id;
      marker.addEventListener("click", (event) => {
        event.stopPropagation();
        showManualMenu(event, point.id);
      });
      actionPointsGroup.appendChild(marker);
      actionPointMarkers.set(point.id, marker);
    });

    const robotsGroup = document.createElementNS(svgNS, "g");
    robotsGroup.setAttribute("class", "map-robots");

    robots.forEach((robot) => {
      if (!robot.pos) return;
      ensureRobotMotion(robot);
      const point = projectPoint(robot.pos);
      const group = document.createElementNS(svgNS, "g");
      group.setAttribute("class", buildRobotMarkerClass(robot));
      group.dataset.id = robot.id;
      const body = document.createElementNS(svgNS, "circle");
      body.setAttribute("cx", "0");
      body.setAttribute("cy", "0");
      body.setAttribute("r", "1.2");
      body.setAttribute("class", "robot-body");
      const heading = document.createElementNS(svgNS, "path");
      heading.setAttribute("class", "robot-heading");
      heading.setAttribute("d", "M 1.6 0 L -0.4 0.75 L -0.4 -0.75 Z");
      group.appendChild(body);
      group.appendChild(heading);
      const headingDeg = (-robot.heading * 180) / Math.PI;
      group.setAttribute("transform", `translate(${point.x} ${point.y}) rotate(${headingDeg})`);
      group.addEventListener("click", (event) => {
        event.stopPropagation();
        handleRobotMarkerClick(robot.id);
      });
      robotsGroup.appendChild(group);
      robotMarkers.set(robot.id, group);
    });

    const fragment = document.createDocumentFragment();
    fragment.appendChild(edgesGroup);
    fragment.appendChild(linksGroup);
    fragment.appendChild(obstaclesGroup);
    fragment.appendChild(actionPointsGroup);
    fragment.appendChild(worksitesGroup);
    fragment.appendChild(ringsGroup);
    fragment.appendChild(labelsGroup);
    fragment.appendChild(robotsGroup);
    mapSvg.appendChild(fragment);
    renderObstacles();
    renderMiniMap();

    if (!mapClickBound) {
      mapWrap.addEventListener("click", () => {
        worksiteMenu.classList.add("hidden");
        if (manualMenu) {
          manualMenu.classList.add("hidden");
          manualMenu.dataset.pointId = "";
          manualMenu.dataset.robotId = "";
        }
      });
      mapClickBound = true;
    }
    updateWorksiteScale();
  };

  const showWorksiteMenu = (event, id) => {
    if (!id) return;
    const containerRect = mapWrap.getBoundingClientRect();
    const offsetX = event.clientX - containerRect.left + 8;
    const offsetY = event.clientY - containerRect.top + 8;

    if (manualMenu) {
      manualMenu.classList.add("hidden");
      manualMenu.dataset.pointId = "";
      manualMenu.dataset.robotId = "";
    }

    worksiteMenu.style.left = `${offsetX}px`;
    worksiteMenu.style.top = `${offsetY}px`;
    worksiteMenu.dataset.id = id;
    syncWorksiteMenu(id);
    worksiteMenu.classList.remove("hidden");
  };

  const getWorksiteState = (id) => {
    return worksiteState[id] || { occupancy: "empty", blocked: false };
  };

  const persistWorksiteState = () => {
    localStorage.setItem(WORKSITE_STATE_KEY, JSON.stringify(worksiteState));
  };

  const applyWorksiteState = (id) => {
    const state = getWorksiteState(id);
    const marker = worksiteElements.get(id);
    if (marker) {
      marker.classList.remove("filled", "empty", "blocked");
      marker.classList.add(state.occupancy);
      if (state.blocked) marker.classList.add("blocked");
    }
    const ring = worksiteRings.get(id);
    if (ring) {
      ring.classList.toggle("blocked", state.blocked);
    }
    const label = worksiteLabels.get(id);
    if (label) {
      label.classList.remove("filled", "empty", "blocked");
      label.classList.add(state.occupancy);
      if (state.blocked) label.classList.add("blocked");
    }
    if (worksiteMenu.dataset.id === id) {
      syncWorksiteMenu(id);
    }
  };

  const syncWorksiteMenu = (id) => {
    const state = getWorksiteState(id);
    worksiteMenuButtons.forEach((button) => {
      const group = button.dataset.group;
      const value = button.dataset.value;
      let active = false;
      if (group === "occupancy") {
        active = value === state.occupancy;
      } else if (group === "blocked") {
        active = (value === "true") === state.blocked;
      }
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  };

  const setWorksiteOccupancy = (id, occupancy) => {
    const state = getWorksiteState(id);
    state.occupancy = WORKSITE_OCCUPANCY.includes(occupancy) ? occupancy : state.occupancy;
    worksiteState[id] = state;
    persistWorksiteState();
    applyWorksiteState(id);
    renderStreams();
    renderFields();
  };

  const setWorksiteBlocked = (id, blocked) => {
    const state = getWorksiteState(id);
    state.blocked = Boolean(blocked);
    worksiteState[id] = state;
    persistWorksiteState();
    applyWorksiteState(id);
    renderStreams();
    renderFields();
  };

  const toggleWorksiteOccupancy = (id) => {
    const current = getWorksiteState(id).occupancy;
    const next = current === "filled" ? "empty" : "filled";
    setWorksiteOccupancy(id, next);
  };

  const toggleRobotDispatchable = (id) => {
    const robot = robots.find((item) => item.id === id);
    if (!robot) return;
    const next = !robot.dispatchable;
    const dispatchable = robot.online ? next : false;
    updateRobotState(id, { dispatchable });
  };

  const toggleRobotControl = (id) => {
    const robot = robots.find((item) => item.id === id);
    if (!robot) return;
    updateRobotState(id, { controlled: !robot.controlled });
  };

  const renderRobots = () => {
    if (!robots.length) {
      robotsList.innerHTML = "<div class=\"card\">Brak robotow.</div>";
      return;
    }
    const rows = robots
      .map((robot) => {
        const runtime = getRobotRuntime(robot.id);
        const isNavigating = Boolean(runtime);
        const pauseLabel = runtime?.paused ? "Wznow" : "Pauzuj";
        const status = robot.dispatchable && robot.online
          ? "Dispatchable"
          : robot.online
            ? "Undispatchable (online)"
            : "Undispatchable (offline)";
        const controlLabel = robot.controlled ? "Release control" : "Seize control";
        const dispatchLabel = robot.dispatchable ? "Dispatchable" : "Undispatchable";
        const manualLabel = robot.manualMode ? "Manual on" : "Manual off";
        const battery = Number.isFinite(robot.battery) ? robot.battery : 0;
        const taskLabel = robot.task || "--";
        const activityLabel = formatRobotActivity(robot);
        return `
          <tr>
            <td>
              <div class="robot-name">${robot.name}</div>
              <div class="robot-meta">${robot.id}</div>
            </td>
            <td>
              <span class="status-badge ${robot.online ? "online" : "offline"}">${status}</span>
            </td>
            <td>
              <span class="activity-text">${activityLabel}</span>
            </td>
            <td>
              <button class="toggle-btn ${robot.dispatchable ? "on" : "off"}" data-action="toggle-dispatchable" data-id="${robot.id}" ${robot.online ? "" : "disabled"}>
                ${dispatchLabel}
              </button>
            </td>
            <td>
              <button class="control-btn ${robot.controlled ? "active" : ""}" data-action="toggle-control" data-id="${robot.id}">
                ${controlLabel}
              </button>
            </td>
            <td>
              <button class="toggle-btn ${robot.manualMode ? "on" : "off"}" data-action="toggle-manual" data-id="${robot.id}">
                ${manualLabel}
              </button>
            </td>
            <td>
              <div class="nav-actions">
                <button class="nav-btn" data-action="toggle-nav-pause" data-id="${robot.id}" ${isNavigating ? "" : "disabled"}>
                  ${pauseLabel}
                </button>
                <button class="nav-btn danger" data-action="stop-nav" data-id="${robot.id}" ${isNavigating ? "" : "disabled"}>
                  Zakoncz
                </button>
              </div>
            </td>
            <td>
              <div class="battery">
                <div class="battery-bar">
                  <div class="battery-fill" style="width: ${battery}%"></div>
                </div>
                <span>${battery}%</span>
              </div>
            </td>
            <td>
              <span class="robot-pill ${robot.blocked ? "blocked" : "clear"}">${robot.blocked ? "Blocked" : "Clear"}</span>
            </td>
            <td class="task-cell">${taskLabel}</td>
          </tr>
        `;
      })
      .join("");

    robotsList.innerHTML = `
      <div class="table-wrap">
        <table class="robot-table">
          <thead>
            <tr>
              <th>Robot</th>
              <th>Status</th>
              <th>Activity</th>
              <th>Dispatchable</th>
              <th>Control</th>
              <th>Manual</th>
              <th>Nav</th>
              <th>Battery</th>
              <th>Blocked</th>
              <th>Task</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
    syncFaultRobotSelect();

    if (!robotTableBound) {
      robotsList.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;
        const id = button.dataset.id;
        if (!id) return;
        const action = button.dataset.action;
        if (action === "toggle-dispatchable") {
          toggleRobotDispatchable(id);
        } else if (action === "toggle-control") {
          toggleRobotControl(id);
        } else if (action === "toggle-manual") {
          setRobotManualMode(id, !getRobotById(id)?.manualMode);
        } else if (action === "toggle-nav-pause") {
          toggleNavigationPause(id);
        } else if (action === "stop-nav") {
          stopNavigation(id);
        }
      });
      robotTableBound = true;
    }
  };

  const renderStreams = () => {
    if (packagingConfig?.streams?.length) {
      const streams = packagingConfig.streams;
      streamsList.innerHTML = "";
      streams.forEach((stream) => {
        const routeCount = stream.routes?.length || 0;
        const activeCount = lineRequests.filter((req) => req[stream.trigger]?.active).length;
        const card = document.createElement("div");
        card.className = "stream-card";
        card.innerHTML = `
          <div class="stream-header">
            <div>
              <div class="stream-title">${stream.id} - ${stream.name}</div>
              <div class="stream-meta">Trigger: ${stream.trigger}</div>
            </div>
            <span class="stream-pill">${routeCount} routes</span>
          </div>
          <div class="stream-section">
            <div class="stream-step-title">Stan</div>
            <div class="stream-grid">
              <div>
                <div class="stream-label">Aktywne zgloszenia</div>
                <div class="stream-value">${activeCount}</div>
              </div>
              <div>
                <div class="stream-label">Goods type</div>
                <div class="stream-value">${stream.goodsType || stream.goodsTypeMode || "--"}</div>
              </div>
            </div>
          </div>
        `;
        streamsList.appendChild(card);
      });
      return;
    }

    const streams = workflowData?.streams || [];
    if (!streams.length) {
      streamsList.innerHTML = "<div class=\"card\">Brak streamow.</div>";
      return;
    }
    streamsList.innerHTML = "";
    streams.forEach((stream) => {
      const dropGroups = stream.drop_group_order || [];
      const dropOrder = getDropOrder(stream);
      const orderLabel = dropOrder === ORDER_DESC ? "alphabetical descending" : "alphabetical ascending";
      const ruleRaw = stream.drop_policy?.access_rule || "preceding_empty";
      const ruleLabel = ruleRaw === "preceding_empty" ? "first_free_not_shadowed" : ruleRaw;
      const nextPick = getNextPickCandidate(stream.pick_group, ORDER_ASC);
      const nextDrop = getNextDropCandidate(dropGroups, dropOrder);
      const dropGroupLabel = dropGroups.join(", ") || "--";

      const card = document.createElement("div");
      card.className = "stream-card";
      card.innerHTML = `
        <div class="stream-header">
          <div>
            <div class="stream-title">${stream.id}</div>
            <div class="stream-meta">Transfer between groups</div>
          </div>
          <span class="stream-pill">1 step</span>
        </div>
        <div class="stream-section">
          <div class="stream-step-title">Step 1</div>
          <div class="stream-grid">
            <div>
              <div class="stream-label">Pick group</div>
              <div class="stream-value">${stream.pick_group || "--"}</div>
            </div>
            <div>
              <div class="stream-label">Drop groups</div>
              <div class="stream-value">${dropGroupLabel}</div>
            </div>
            <div>
              <div class="stream-label">Order</div>
              <div class="stream-value">${orderLabel}</div>
            </div>
            <div>
              <div class="stream-label">Rule</div>
              <div class="stream-value">${ruleLabel}</div>
            </div>
            <div>
              <div class="stream-label">Next pick candidate</div>
              <div class="stream-value">${nextPick ? nextPick.id : "--"}</div>
            </div>
            <div>
              <div class="stream-label">Next drop candidate</div>
              <div class="stream-value">${nextDrop ? `${nextDrop.site.id} (${nextDrop.groupId})` : "--"}</div>
            </div>
          </div>
        </div>
      `;
      streamsList.appendChild(card);
    });
  };

  const renderFields = () => {
    if (!worksites.length) {
      fieldsList.innerHTML = "<div class=\"card\">Brak worksite.</div>";
      return;
    }
    const rows = sortWorksites(worksites, ORDER_ASC)
      .map((site) => {
        const state = getWorksiteState(site.id);
        const occupancyLabel = state.occupancy === "filled" ? "Filled" : "Unfilled";
        const blockedLabel = state.blocked ? "Blocked" : "Unblocked";
        return `
          <tr>
            <td>${site.id}</td>
            <td>${site.group || "--"}</td>
            <td><span class="robot-pill ${state.occupancy === "filled" ? "clear" : "blocked"}">${occupancyLabel}</span></td>
            <td><span class="robot-pill ${state.blocked ? "blocked" : "clear"}">${blockedLabel}</span></td>
          </tr>
        `;
      })
      .join("");

    fieldsList.innerHTML = `
      <div class="table-wrap">
        <table class="robot-table">
          <thead>
            <tr>
              <th>Nazwa</th>
              <th>Grupa</th>
              <th>Filled</th>
              <th>Blocked</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  };

  const renderTasks = () => {
    if (!tasks.length) {
      tasksList.innerHTML = "<div class=\"card\">Brak aktywnych zadan.</div>";
      return;
    }
    tasksList.innerHTML = "";
    tasks.forEach((task) => {
      const card = document.createElement("div");
      card.className = "card";
      const statusClass =
        task.status === "Completed" ? "task-done" : task.status === "Failed" ? "task-failed" : "task-active";
      const phaseLabel = task.phase ? ` - ${task.phase}` : "";
      const goodsLabel = task.meta?.goodsType ? `Towar: ${task.meta.goodsType}` : "";
      const lineLabel = task.meta?.lineId ? `Linia: ${task.meta.lineId}` : "";
      const kindLabel = task.kind ? `Typ: ${task.kind}` : "";
      const extraLine = [kindLabel, goodsLabel, lineLabel].filter(Boolean).join(" | ");
      card.innerHTML = `
        <div class=\"card-title\">${task.id}</div>
        <div class=\"card-meta\">Stream: ${task.streamId || "--"} - Robot: ${task.robotId || "--"}</div>
        <div class=\"card-meta\">Pick: ${task.pickId || "--"} -> Drop: ${task.dropId || "--"}</div>
        ${extraLine ? `<div class=\"card-meta\">${extraLine}</div>` : ""}
        <div class=\"badge ${statusClass}\">${task.status}${phaseLabel}</div>
      `;
      tasksList.appendChild(card);
    });
  };

  const init = () => {
    initNavigation();
    initWorksiteMenu();
    initManualMenu();
    initFaultControls();
    initManualDriveControls();
    initLogin();
    bindPanZoom();
    bindKeyboardShortcuts();
    if (navControlsPause && navControlsStop) {
      navControlsPause.addEventListener("click", () => {
        const robotId = navControlsPause.dataset.id;
        if (robotId) toggleNavigationPause(robotId);
      });
      navControlsStop.addEventListener("click", () => {
        const robotId = navControlsStop.dataset.id;
        if (robotId) stopNavigation(robotId);
      });
    }
    if (resetViewBtn) {
      resetViewBtn.addEventListener("click", () => {
        resetViewBox();
      });
    }
    if (fitViewBtn) {
      fitViewBtn.addEventListener("click", () => {
        fitViewBox();
      });
    }

    const session = loadSession();
    if (session) {
      showApp(session);
    } else {
      showLogin();
    }
  };

  init();
})();

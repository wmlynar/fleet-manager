const fs = require("fs");
const path = require("path");

const engine = require("../public/packaging_engine");

const rootDir = path.resolve(__dirname, "..");
const configPath = path.join(rootDir, "public", "data", "packaging.json");
const graphPath = path.join(rootDir, "public", "data", "graph.json");

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const graph = JSON.parse(fs.readFileSync(graphPath, "utf8"));

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function buildNodeIndex(nodes) {
  return new Map((nodes || []).map((node) => [node.id, node.pos]));
}

function distance(a, b) {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function moveTowards(robot, target, step) {
  const dx = target.x - robot.pos.x;
  const dy = target.y - robot.pos.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= step) {
    robot.pos = { ...target };
    return true;
  }
  const ratio = step / dist;
  robot.pos = {
    x: robot.pos.x + dx * ratio,
    y: robot.pos.y + dy * ratio
  };
  return false;
}

function initBufferState() {
  return engine.loadBufferState(config, null, null).state;
}

function initLineRequests() {
  return engine.createLineRequests(config, null);
}

function setBufferCell(bufferState, bufferId, cellId, updates) {
  const cells = bufferState[bufferId] || [];
  bufferState[bufferId] = cells.map((cell) => (cell.id === cellId ? { ...cell, ...updates } : cell));
}

function setLineRequest(lineRequests, lineId, trigger, updates) {
  return lineRequests.map((req) => {
    if (req.id !== lineId) return req;
    return { ...req, [trigger]: { ...req[trigger], ...updates } };
  });
}

function selectNearestRobot(robots, targetPos) {
  let best = null;
  let bestDist = Number.POSITIVE_INFINITY;
  robots.forEach((robot) => {
    const dist = distance(robot.pos, targetPos);
    if (dist < bestDist) {
      bestDist = dist;
      best = robot;
    }
  });
  return best;
}

function run() {
  const nodeIndex = buildNodeIndex(graph.nodes || []);
  let bufferState = initBufferState();
  let lineRequests = initLineRequests();

  const bufferA1 = config.buffers.find((buffer) => buffer.id === "MAG_A1_SUP_TMP");
  const bufferA2 = config.buffers.find((buffer) => buffer.id === "MAG_A2_SUP_TMP");
  assert(bufferA1 && bufferA2, "Expected supply buffers in config");

  const cellA1 = bufferState[bufferA1.id]?.[0];
  const cellA2 = bufferState[bufferA2.id]?.[0];
  assert(cellA1 && cellA2, "Expected at least one cell per supply buffer");

  setBufferCell(bufferState, bufferA1.id, cellA1.id, { goodsType: "BOX", stack: 1 });
  setBufferCell(bufferState, bufferA2.id, cellA2.id, { goodsType: "BOX", stack: 1 });

  lineRequests = setLineRequest(lineRequests, "A1", "supply", { active: true, goodsType: "BOX" });
  lineRequests = setLineRequest(lineRequests, "A2", "supply", { active: true, goodsType: "BOX" });

  const startPosA1 = nodeIndex.get(cellA1.point);
  const startPosA2 = nodeIndex.get(cellA2.point);
  assert(startPosA1 && startPosA2, "Expected action point positions for robot starts");

  const robots = [
    { id: "RB-01", pos: { ...startPosA1 }, task: null },
    { id: "RB-02", pos: { ...startPosA2 }, task: null }
  ];

  const tasks = [];
  const runtimes = new Map();

  let available = [...robots];
  while (available.length) {
    const result = engine.planStreamDispatch({ config, bufferState, lineRequests });
    if (!result || !result.action) break;
    bufferState = result.nextBufferState;
    lineRequests = result.nextLineRequests;
    const pickPos = nodeIndex.get(result.action.pickPoint);
    const dropPos = nodeIndex.get(result.action.dropPoint);
    assert(pickPos && dropPos, "Expected pick/drop positions");

    const robot = selectNearestRobot(available, pickPos);
    assert(robot, "Expected a robot to assign");
    available = available.filter((item) => item.id !== robot.id);
    robot.task = result.action.streamId;
    const task = {
      id: `TASK-${tasks.length + 1}`,
      robotId: robot.id,
      status: "In progress",
      pickPos,
      dropPos
    };
    tasks.push(task);
    runtimes.set(robot.id, {
      phase: "to_pick",
      pickPos,
      dropPos,
      taskId: task.id
    });
  }

  assert(tasks.length === 2, "Expected two tasks for two robots");

  const speed = 0.9;
  const dt = 0.2;
  const step = speed * dt;
  const maxSteps = 2000;
  let steps = 0;

  while (runtimes.size && steps < maxSteps) {
    steps += 1;
    runtimes.forEach((runtime, robotId) => {
      const robot = robots.find((item) => item.id === robotId);
      if (!robot) return;
      if (runtime.phase === "to_pick") {
        const arrived = moveTowards(robot, runtime.pickPos, step);
        if (arrived) {
          runtime.phase = "to_drop";
        }
      } else if (runtime.phase === "to_drop") {
        const arrived = moveTowards(robot, runtime.dropPos, step);
        if (arrived) {
          const task = tasks.find((item) => item.id === runtime.taskId);
          if (task) {
            task.status = "Completed";
          }
          robot.task = null;
          runtimes.delete(robotId);
        }
      }
    });
  }

  assert(runtimes.size === 0, "Expected robots to finish their tasks");
  tasks.forEach((task) => {
    assert(task.status === "Completed", "Expected task to complete");
  });

  console.log("E2E two-robots ok: tasks assigned and completed.");
}

run();

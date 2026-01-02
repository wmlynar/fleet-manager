(() => {
  const root = (window.FleetDomain = window.FleetDomain || {});

  const distance = (a, b) => {
    if (!a || !b) return Number.POSITIVE_INFINITY;
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  class RobotAllocator {
    constructor(strategy) {
      this.strategy = strategy || "nearest";
    }

    setStrategy(strategy) {
      if (typeof strategy === "string" && strategy.trim()) {
        this.strategy = strategy.trim();
      }
    }

    select(robots, context) {
      if (!Array.isArray(robots) || !robots.length) return null;
      const strategy = this.strategy || "nearest";
      if (strategy === "first") {
        return robots[0];
      }
      const targetPos = context?.targetPos || context?.pickPos || context?.dropPos || null;
      if (!targetPos) {
        return robots[0];
      }
      let best = null;
      let bestDist = Number.POSITIVE_INFINITY;
      robots.forEach((robot) => {
        if (!robot?.pos) return;
        const dist = distance(robot.pos, targetPos);
        if (dist < bestDist) {
          bestDist = dist;
          best = robot;
        }
      });
      return best || robots[0];
    }
  }

  root.RobotAllocator = RobotAllocator;
})();

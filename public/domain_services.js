(() => {
  const root = (window.FleetDomain = window.FleetDomain || {});

  class RobotService {
    constructor(robotRepo) {
      this.robotRepo = robotRepo;
    }

    setDispatchable(robotId, dispatchable) {
      const robot = this.robotRepo.getById(robotId);
      if (!robot) return null;
      const next = robot.online ? Boolean(dispatchable) : false;
      return this.robotRepo.update(robotId, { dispatchable: next });
    }

    setControlled(robotId, controlled) {
      const robot = this.robotRepo.getById(robotId);
      if (!robot) return null;
      if (!robot.online) return this.robotRepo.update(robotId, { controlled: false });
      return this.robotRepo.update(robotId, { controlled: Boolean(controlled) });
    }

    setOnline(robotId, online) {
      const robot = this.robotRepo.getById(robotId);
      if (!robot) return null;
      const isOnline = Boolean(online);
      const updates = {
        online: isOnline,
        dispatchable: isOnline ? robot.dispatchable : false,
        controlled: isOnline ? robot.controlled : false
      };
      return this.robotRepo.update(robotId, updates);
    }

    setManualMode(robotId, manualMode) {
      return this.robotRepo.update(robotId, { manualMode: Boolean(manualMode) });
    }
  }

  root.RobotService = RobotService;
})();

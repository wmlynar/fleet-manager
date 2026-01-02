(() => {
  const root = (window.FleetDomain = window.FleetDomain || {});

  const clone = (value) => {
    if (!value || typeof value !== "object") return value;
    return Array.isArray(value) ? value.map((item) => ({ ...item })) : { ...value };
  };

  class RobotRepository {
    constructor(store) {
      this.store = store;
    }

    list() {
      const state = this.store.getState();
      return clone(state.robots || []);
    }

    getById(id) {
      return this.list().find((robot) => robot.id === id) || null;
    }

    setAll(robots) {
      this.store.update((state) => ({
        ...state,
        robots: clone(robots || [])
      }));
      return this.list();
    }

    update(id, updates) {
      let updated = null;
      this.store.update((state) => {
        const robots = (state.robots || []).map((robot) => {
          if (robot.id !== id) return robot;
          updated = { ...robot, ...updates };
          return updated;
        });
        return { ...state, robots };
      });
      return updated;
    }
  }

  class TaskRepository {
    constructor(store) {
      this.store = store;
    }

    list() {
      const state = this.store.getState();
      return clone(state.tasks || []);
    }

    setAll(tasks) {
      this.store.update((state) => ({
        ...state,
        tasks: clone(tasks || [])
      }));
      return this.list();
    }

    add(task) {
      if (!task) return null;
      this.store.update((state) => ({
        ...state,
        tasks: [task, ...(state.tasks || [])]
      }));
      return task;
    }

    update(id, updates) {
      let updated = null;
      this.store.update((state) => {
        const tasks = (state.tasks || []).map((task) => {
          if (task.id !== id) return task;
          updated = { ...task, ...updates };
          return updated;
        });
        return { ...state, tasks };
      });
      return updated;
    }
  }

  root.RobotRepository = RobotRepository;
  root.TaskRepository = TaskRepository;
})();

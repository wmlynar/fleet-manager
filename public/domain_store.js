(() => {
  const root = (window.FleetDomain = window.FleetDomain || {});

  class InMemoryStore {
    constructor(initialState) {
      this.state = initialState || {};
      this.listeners = new Set();
    }

    getState() {
      return this.state;
    }

    update(updater, meta) {
      const next = updater(this.state, meta);
      if (!next || typeof next !== "object") {
        return this.state;
      }
      this.state = next;
      this.listeners.forEach((listener) => listener(this.state, meta));
      return this.state;
    }

    subscribe(listener) {
      this.listeners.add(listener);
      return () => {
        this.listeners.delete(listener);
      };
    }
  }

  root.InMemoryStore = InMemoryStore;
})();

# Fleet Manager

MVP UI for visualizing graph, worksites, robots, and tasks.

## Light DDD layout

Domain logic is split into small, browser-friendly layers:

- `public/domain_store.js`: in-memory store with `update()` and `subscribe()`.
- `public/domain_repos.js`: repositories for robots/tasks.
- `public/domain_services.js`: small robot service for invariants (dispatchable/control/online/manual).

`public/app.js` uses these adapters but still renders UI directly.

## Robots config

You can define multiple robots and a selection strategy in:

`public/data/robots.json`

Example:

```json
{ "strategy": "nearest", "robots": [{ "id": "RB-01", "ref": "PICK-03" }] }
```

## E2E (spec streams)

Validates dispatch planning for S1-S5 from `pusta_kanwa_sanden.md` using
`public/data/packaging.json`.

```bash
npm --prefix /home/inovatica/seal/rds/fleet-manager run e2e-spec
```

## E2E (UI smoke)

Starts the local server, validates core endpoints/assets, and checks the
packaging + graph data files are available.

```bash
npm --prefix /home/inovatica/seal/rds/fleet-manager run e2e-ui
```

Run both suites:

```bash
npm --prefix /home/inovatica/seal/rds/fleet-manager run e2e
```

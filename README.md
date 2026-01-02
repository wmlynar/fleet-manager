# Fleet Manager

MVP UI for visualizing graph, worksites, robots, and tasks.

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

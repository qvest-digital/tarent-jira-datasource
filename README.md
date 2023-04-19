# Grafana Jira Datasource

A Grafana datasource plugin that pulls data from a Jira API to visualize in Grafana panels.

## Grafana data source plugin template

The project is based on the Grafana data source template, [see](./docs/grafana_plugin.md).

## Requirements

* A Jira instance
* A Jira token for that instance

## Development

### Option A: Partial Docker Setup with Grafana in a docker container + nodejs on the host

1. Install dependencies

   ```bash
   yarn install
   ```

2. Build plugin in development mode and run in watch mode

   ```bash
   yarn dev
   ```

3. Build plugin in production mode

   ```bash
   yarn build
   ```

4. Run the tests (using Jest)

   ```bash
   # Runs the tests and watches for changes, requires git init first
   yarn test
   
   # Exits after running all the tests
   yarn test:ci
   ```

5. Spin up a Grafana instance and run the plugin inside it (using Docker)

   ```bash
   yarn server
   ```

6. Run the E2E tests (using Cypress)

   ```bash
   # Spins up a Grafana instance first that we tests against 
   yarn server
   
   # Starts the tests
   yarn e2e
   ```

7. Run the linter

   ```bash
   yarn lint
   
   # or

   yarn lint:fix
   ```

### Option B: Full docker setup with Grafana + nodejs in docker containers

```bash
docker-compose -f docker-compose.yaml -f docker-compose-full.yaml
```

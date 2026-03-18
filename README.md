# viberail-ui

Interactive visual workbench for [viberail](https://www.npmjs.com/package/viberail) specifications.

Provides a browser-based dashboard to explore, analyze, and debug your behavioral specs — dependency graphs, decision tables, coverage matrices, pipeline views, test results, and git diffs — all in one place.

## Install

```bash
npm install -g viberail-ui
```

Or use it directly with `npx`:

```bash
npx viberail-ui
```

## Usage

Point it at a project that contains `.spec.ts` files:

```bash
viberail-ui --folder ./my-project
```

Then open `http://localhost:3700` in your browser.

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `--folder <path>` | Path to a project with `.spec.ts` files | current directory |
| `--port <port>` | Server port | `3700` |
| `--help` | Show help | |

## Views

- **Dependency Graph** — interactive network graph of spec dependencies (Cytoscape.js)
- **Spec Browser** — searchable, domain-grouped list of all specs
- **Decision Table** — detailed decision table for each spec
- **Pipelines** — step sequences and their relationships
- **Coverage Matrix** — test coverage across scenarios
- **Analysis** — statistics and health metrics
- **Test Results** — Jest test execution dashboard
- **Git Diff** — compare specs across branches and commits

## Development

```bash
# Run the dev server against a sample project
npm run dev

# Build for distribution
npm run build
```

## License

MIT

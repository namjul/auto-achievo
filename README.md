# Auto-Achievo

CLI tool to sync timewarrior entries to the Achievo time tracking system.

## Setup

```bash
npm install
npm run build
npx playwright install chromium
```

## Usage

```bash
# Dry run - preview what would be entered
timew summary :week | node dist/index.js --dry-run

# From a file
node dist/index.js --file timesheet.txt --dry-run

# Submit for real (opens browser for login)
timew summary :week | node dist/index.js --visible
```

**Important:** Always use `--visible` when submitting. The browser runs headless (invisible) by default, so you won't be able to log in without it.

### Options

| Flag | Description |
|------|-------------|
| `--dry-run`, `-d` | Show what would be entered, don't submit |
| `--visible`, `-v` | Show browser window (for debugging/login) |
| `--file <path>`, `-f` | Read from file instead of stdin |
| `--config <path>`, `-c` | Config file (default: `config.yaml`) |

### Shell Alias

Add to your shell profile for convenience:

```bash
alias achievo="node /path/to/auto-achievo/dist/index.js"

# Then use
timew summary :week | achievo --dry-run
```

## Configuration

Copy `config.example.yaml` to `config.yaml` and customize:

```yaml
url: "https://your-achievo-instance.com"

project:
  "+emt":
    name: "EEA: European Energy Award"
    phase:
      "+phase-help": "EMT Helpdesk"
      default: "EMT2 Core"
    activity:
      "@meeting": "Meeting"
      default: "Standard"

  default:
    name: "Int: Interne Aufgaben"
    phase:
      default: "Allgemein"
    activity:
      "@meeting": "Meeting"
      "@training": "Weiterbildung"
      default: "Sonstiges"
```

### Config Structure

- **project**: Map timewarrior tags to Achievo projects
  - Each project has a `name`, `phase` mappings, and `activity` mappings
  - Use `default` for fallback values
- Tags not used for mapping appear in the comments field

## Timewarrior Format

Expects output from `timew summary`:

```
Wk Date       Day ID  Tags                                   Annotation       Start      End    Time    Total
W3 2026-01-12 Mon @56 +emt, @wienfluss                                     12:55:14 13:10:10 0:14:56
                  @55 +773, +emt, @wienfluss                               13:10:10 13:21:41 0:11:31
```

## How It Works

1. **Parse** timewarrior output into structured entries
2. **Map** tags to Achievo projects/phases/activities using config
3. **Aggregate** entries by date + project + phase + activity
4. **Round** durations to nearest 15 minutes
5. **Display** summary for confirmation
6. **Automate** form filling via Playwright (manual login required)

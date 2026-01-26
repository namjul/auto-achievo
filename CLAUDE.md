# Auto-Achievo

CLI tool to sync timewarrior entries to the WIENFLUSS Achievo time tracking system.

## Setup

```bash
npm install
npm run build
```

## Configuration

Copy `config.example.yaml` to `config.yaml` and customize the mappings for your project codes.

## Usage

```bash
# Pipe timewarrior data directly
timew summary :week | npx auto-achievo

# From file
npx auto-achievo --file timesheet.txt

# Dry run (show what would be entered)
timew summary :week | npx auto-achievo --dry-run

# Show browser (not headless)
timew summary :week | npx auto-achievo --visible
```

## Architecture

- `src/parser.ts` - Parses timewarrior text output format
- `src/mapper.ts` - Maps tags to Achievo fields using config.yaml
- `src/aggregator.ts` - Aggregates entries by day/project, rounds to 15-min
- `src/automation/` - Playwright browser automation for Achievo

## Timewarrior Format

Expects output from `timew summary`:

```
Wk Date       Day ID  Tags                                   Annotation       Start      End    Time    Total
W3 2026-01-12 Mon @56 +emt, @wienfluss                                     12:55:14 13:10:10 0:14:56
```

## Notes

- Time is rounded to nearest 15 minutes
- Login is manual (wait for user to authenticate)
- Entries are aggregated by date + project + phase + activity

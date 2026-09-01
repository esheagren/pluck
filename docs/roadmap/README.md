# Pluckk Roadmap

This folder tracks feature development from idea to completion.

> For product overview and technical architecture, see [docs/README.md](../README.md)

## Structure

```
roadmap/
├── icebox.md       # All feature ideas with descriptions
├── planned/        # Features with complete plans, ready to start
│   └── <name>/
│       └── plan.md
├── active/         # Features currently being implemented
│   └── <name>/
│       ├── plan.md
│       └── documentation.md
└── completed/      # Finished features
    └── <name>/
        ├── plan.md
        └── documentation.md
```

## Workflow

| Command | Purpose |
|---------|---------|
| `/idea` | Capture idea → append to icebox.md |
| `/prioritize` | RICE analysis → pick next feature |
| `/plan <name>` | Explore & plan → creates `planned/<name>/plan.md` |
| `/execute <name>` | Implement → moves to `active/`, updates progress |
| `/review` | Code review recent changes |
| `/document <name>` | Update documentation.md |
| `/roadmap-groom` | Move completed to `completed/` |

## Feature Lifecycle

```
icebox.md → planned/<name>/ → active/<name>/ → completed/<name>/
   ↑            ↑                  ↑                 ↑
 ideas     has plan.md      being worked on      done + docs
```

## Other Commands

| Command | Purpose |
|---------|---------|
| `/peer-review` | Verify another model's review findings |
| `/learning-opportunity` | Teaching mode for concepts |
| `/card-problem` | Document problematic flashcard |

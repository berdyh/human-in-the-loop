# Internal HITL Git Spec

Human in the Loop must use its own local Git history for `.humanintheloop/content`.

Do not require a remote.

Do not create:

```txt
.humanintheloop/content/.git
```

Use:

```txt
.humanintheloop/history/git
```

as the Git database, with:

```txt
.humanintheloop/content
```

as the worktree.

All internal Git calls should conceptually use:

```bash
git --git-dir=.humanintheloop/history/git --work-tree=.humanintheloop/content <command>
```

## Init behavior

`hitl init` should:

1. Create `.humanintheloop/content`
2. Create `.humanintheloop/history/git`
3. Initialize the internal Git database
4. Configure:
   - `user.name = Human in the Loop`
   - `user.email = hitl@local`
5. Add initial content
6. Commit:

```txt
hitl init: initialize Human in the Loop workspace
```

## Commit policy

Make meaningful commits for:

- init
- session start
- note added
- cleanup recorded
- finalize
- review status change

Avoid committing every keystroke.

## History command

`hitl history` should show concise internal Git log.

`hitl history --page <relative-path>` should show history for one content page if possible.

## Project code state

When possible, session metadata should include:

- project Git HEAD if repo has Git
- changed files
- timestamp
- command source

If project repo has no Git, do not fail. Record `"project_git_head": null`.

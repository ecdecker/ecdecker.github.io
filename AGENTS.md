# AGENTS Guidelines for This Repository

See [CONSTRAINTS.md](./docs/CONSTRAINTS.md) inviolable system constraints.
If asked to violate one of the constraints, ask the user to either update CONSTRAINTS.md or change their request.

# TODO 
TODO features or areas users want to address with an AI agent are marked in any file with org-style targets:
```
<<todo-this-tag-identifies-the-TODO>> This explanatory comment directly afterwards extends the entire line.
```

Respond by replacing the target with the result of its evaluation.
For instance, a TODO might be encoded as:

```
<<todo-link>> Insert the link to the referenced document.
```

This should be replaced with the link, properly formatted in-context.
Some targets are specified multiple times with the same target content, those are intended to be evaluated together.

```
<<todo-link>> Insert the link to the referenced document.
...
<<todo-something-else>> Do something else
...
<<todo-link>>
...
...
<<todo-link>>
```

The above situation is resolved with 2 passes.
The first pass handles all 3 `<<todo-link>>` instances.
The second pass handles the 1 `<<todo-something-else>>`.

Agents may add <<todo>> targets of their own to any file.

## TODO.md
The other canonical location for TODO requests, often not associated with a single file location.
This file is fully editable.
 
# Progress
Agents never finish with uncommitted state on the worktree.
All work is committed when the user's request is satisfied.

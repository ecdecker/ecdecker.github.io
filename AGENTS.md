# AGENTS Guidelines for This Repository

See [CONSTRAINTS.md](./docs/CONSTRAINTS.md) inviolable system constraints.
If asked to violate one of the constraints, ask the user to either update CONSTRAINTS.md or change their request.

# TODO 
TODO features or areas users want to address with an AI agent are marked with org-style targets:
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

# Production pending

## quiet-routine-refusals

- [ ] After the deploy, `journalctl -u habre-cms --since "<deploy time>" | grep -c "No route matches"` prints 0, while the journal still shows real errors when they happen (no env, migration or host change)

# Capability: ai

- **ai.1** - with no `OPENROUTER_API_KEY` the app starts with AI off *Since:* features/18b1-the-run-with-openrouter
- **ai.2** - an unknown or repeated name in `AI_PROVIDERS`, or a malformed `AI_CREDITS_PER_MONTH`, stops the app at startup with a message naming the variable *Since:* features/18b1-the-run-with-openrouter
- **ai.3** - every page of a valid proposal expands to a document the editor's save accepts, its buttons linking only to the proposal's own pages *Since:* features/18b1-the-run-with-openrouter
- **ai.4** - a third run while two are running is refused as busy and records nothing *Since:* features/18b1-the-run-with-openrouter
- **ai.5** - a site with no credits left this month cannot start a run *Since:* features/18b1-the-run-with-openrouter
- **ai.6** - a site runs one generation at a time; a second while its first is running is refused as busy *Since:* features/18b1-the-run-with-openrouter
- **ai.7** - a run that fails - provider unavailable, refused, invalid output or over 5 minutes - records its reason and is charged only the cost the provider reported *Since:* features/18b1-the-run-with-openrouter
- **ai.8** - a run left `running` for over six minutes no longer stops its site starting another *Since:* features/18b1-the-run-with-openrouter
- **ai.9** - a succeeded run records its proposal, tokens, provider, the model that served it, the reported cost and the credits worked out from it *Since:* features/18b1-the-run-with-openrouter
- **ai.10** - a run left running by a restart is marked failed when the server starts *Since:* features/18b1-the-run-with-openrouter

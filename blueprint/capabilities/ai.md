# Capability: ai

- **ai.1** - with no key for the first provider in `AI_PROVIDERS` (`OPENROUTER_API_KEY` by default) the app starts with AI off; `fake`, which needs no key, turns it on *Since:* features/18b1-the-run-with-openrouter · *Changed:* features/18b3-onboarding-start
- **ai.2** - an unknown or repeated name in `AI_PROVIDERS`, `fake` listed with another provider or with a `PLATFORM_URL` that is not loopback or `*.localhost`, a malformed `AI_CREDITS_PER_MONTH` or price, or a listed provider missing its key, model or price while AI is on, stops the app at startup with a message naming the variable *Since:* features/18b1-the-run-with-openrouter · *Changed:* features/18b3-onboarding-start
- **ai.3** - every page of a valid proposal expands to a document the editor's save accepts, its buttons linking only to the proposal's own pages *Since:* features/18b1-the-run-with-openrouter
- **ai.4** - a third run while two are running is refused as busy and records nothing *Since:* features/18b1-the-run-with-openrouter
- **ai.5** - a site with no credits left this month cannot start a run *Since:* features/18b1-the-run-with-openrouter
- **ai.6** - a site runs one generation at a time; a second while its first is running is refused as already running for that site, not as busy *Since:* features/18b1-the-run-with-openrouter · *Changed:* fixes/v1-journey-polish
- **ai.7** - a run that fails - provider unavailable, refused, invalid output or over 5 minutes - records its reason and is charged only the cost the provider reported *Since:* features/18b1-the-run-with-openrouter
- **ai.8** - a run left `running` for over six minutes no longer stops its site starting another *Since:* features/18b1-the-run-with-openrouter
- **ai.9** - a succeeded run records its proposal, tokens, provider, the model that served it, the reported cost and the credits worked out from it *Since:* features/18b1-the-run-with-openrouter
- **ai.10** - a run left running by a restart is marked failed when the server starts *Since:* features/18b1-the-run-with-openrouter
- **ai.11** - a run whose provider is unavailable moves to the next provider in `AI_PROVIDERS`, and the run records the provider that answered *Since:* features/18b2-fallbacks
- **ai.12** - a refusal, or a request or key error, from a provider fails the run without trying the next provider *Since:* features/18b2-fallbacks
- **ai.13** - a run through OpenAI direct is charged credits from its reported tokens and the configured price *Since:* features/18b2-fallbacks
- **ai.14** - a run through Anthropic direct is charged credits from its reported tokens and the configured price *Since:* features/18b2-fallbacks

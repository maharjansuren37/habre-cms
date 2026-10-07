# Capability: onboarding

- **onboarding.1** - with AI on, pressing Confirm my email on signup's link lands the new admin on What do you want to create? *Since:* features/18b3-onboarding-start
- **onboarding.2** - `/start` and its steps send to the admin when AI is off, the site is suspended or anything is published, and are Not Found to a member who is not an admin *Since:* features/18b3-onboarding-start
- **onboarding.3** - Tell us about it refuses a description under 10 or over 2,000 characters, keeping the text and starting no run *Since:* features/18b3-onboarding-start
- **onboarding.4** - Build my site starts a run and opens its page, which shows the draft's page titles once it succeeds, without a reload *Since:* features/18b3-onboarding-start
- **onboarding.5** - a site out of this month's allowance is refused with the date it renews, and no run starts *Since:* features/18b3-onboarding-start
- **onboarding.6** - runs started from onboarding go to OpenRouter alone, never to a fallback provider, even when `AI_PROVIDERS` lists one *Since:* features/18b3-onboarding-start
- **onboarding.7** - an 11th run in 24 hours for one site is refused, and no run starts *Since:* features/18b3-onboarding-start
- **onboarding.8** - while a site's run is in progress, step 1 and step 2 open that run's page *Since:* features/18b3-onboarding-start
- **onboarding.9** - a failed run's page offers Try again with the same description, except a refused run, which offers only Change the description *Since:* features/18b3-onboarding-start
- **onboarding.10** - another site's run is Not Found *Since:* features/18b3-onboarding-start
- **onboarding.11** - signing in from a signed-out `/start` returns to `/start` *Since:* features/18b3-onboarding-start

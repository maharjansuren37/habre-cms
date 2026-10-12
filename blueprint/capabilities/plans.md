# Capability: plans

- **plans.1** - a site's plan is Free or Launch and starts as Free *Since:* features/21a-plans-and-limits
- **plans.2** - a Free site's public pages carry a "Made with Habre" link in the footer, a Launch site's do not *Since:* features/21a-plans-and-limits
- **plans.3** - an operator can set a site's plan with `npm run set-plan` *Since:* features/21a-plans-and-limits
- **plans.4** - an admin sees the plan, its limits and the use against them at `/admin/plan`; other roles get a 404 *Since:* features/21a-plans-and-limits
- **plans.5** - a site with a live Stripe subscription cannot start a second Checkout *Since:* features/21b-pay-for-launch
- **plans.6** - with billing on, a Free site's admin can pay for Launch monthly or yearly through Stripe Checkout from `/admin/plan` *Since:* features/21b-pay-for-launch
- **plans.7** - a site that has never had a subscription is offered a free trial of the configured length at Checkout *Since:* features/21b-pay-for-launch
- **plans.8** - a trialing subscription has Launch limits until its trial ends *Since:* features/21b-pay-for-launch
- **plans.9** - a site's plan changes from a payment only through a Stripe webhook whose signature checks *Since:* features/21b-pay-for-launch
- **plans.10** - each Stripe event is applied once, and an older event never undoes a newer one *Since:* features/21b-pay-for-launch
- **plans.11** - a site keeps Launch while Stripe retries a failed payment, and returns to Free limits, keeping its pages, posts and images, when the subscription is cancelled or unpaid *Since:* features/21b-pay-for-launch
- **plans.12** - an admin with a subscription can manage or cancel it in Stripe's Customer Portal from `/admin/plan` *Since:* features/21b-pay-for-launch
- **plans.13** - with Stripe not configured, `/admin/plan` offers no way to pay *Since:* features/21b-pay-for-launch
- **plans.14** - with Stripe not configured, `/webhooks/stripe` is Not Found *Since:* features/21b-pay-for-launch

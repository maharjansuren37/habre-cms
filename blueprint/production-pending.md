# Production pending

## security-hardening

- [ ] Install the updated `deploy/caddy/habre-cms.caddy` to `/etc/caddy/sites/habre-cms.caddy`, run `caddy validate`, then reload Caddy (as `deploy/setup-server.sh` does)
- [ ] `curl -sI` both hostnames and confirm the public policy on `surenmaharjan.fyi` and the admin policy on `cms.surenmaharjan.fyi/admin/login`
- [ ] Rerun F-22's two forged-header probes against production (`X-Forwarded-Host: evil.example`, `X-Forwarded-Proto: http`) - closes F-22
- [ ] In a real browser, load one public post with an image and the post editor, and check the console for CSP errors

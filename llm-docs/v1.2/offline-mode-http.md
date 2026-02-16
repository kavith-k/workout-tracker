# Offline Mode over HTTP

## Summary

The app uses two layers for offline support:

1. **Application-level offline queue** — IndexedDB (via `idb`) stores queued actions, and a JS-based sync loop (`setInterval` + `online`/`offline` events) replays them via `fetch()` when connectivity returns.
2. **Service worker (PWA)** — `@vite-pwa/sveltekit` with Workbox generates a service worker that caches static assets for offline page loads, and provides the PWA install prompt.

The first layer works entirely over plain HTTP. The second layer requires a secure context (HTTPS or `localhost`). This distinction matters for self-hosters accessing the app over a LAN IP address (e.g. `http://192.168.1.50:3000`).

## What works on plain HTTP

The following browser APIs used by the app do **not** require a secure context:

| Feature | Used in | Works on HTTP? |
|---|---|---|
| IndexedDB | `src/lib/offline/queue.ts` | Yes |
| `navigator.onLine` | `src/lib/offline/stores.svelte.ts` | Yes |
| `online`/`offline` events | `src/lib/offline/stores.svelte.ts` | Yes |
| `fetch()` | `src/lib/offline/sync.ts` | Yes |
| `setInterval` | `src/lib/offline/sync.ts` | Yes |

**Conclusion:** The core offline queue — saving actions to IndexedDB while offline, detecting connectivity changes, and syncing queued actions back to the server — works over plain HTTP in all major browsers.

## What does NOT work on plain HTTP

| Feature | Requires secure context? | Impact |
|---|---|---|
| Service worker registration | Yes | No asset caching; pages will not load offline |
| PWA install prompt | Yes | Users cannot "Add to Home Screen" |
| Web app manifest (install) | Yes | No standalone app experience |
| `navigator.storage.persist()` | Yes | Browser may evict IndexedDB data under storage pressure |

**Conclusion:** Without HTTPS, the app cannot cache pages for offline loading and cannot be installed as a PWA. However, if the user has an active browser tab already loaded, the IndexedDB queue and sync loop still function — actions are queued locally and replayed when the server becomes reachable again.

## Browser-specific notes

### Chrome / Edge (Chromium)
- Service workers require HTTPS, with an exception for `localhost` and `127.0.0.1` only.
- The `chrome://flags/#unsafely-treat-insecure-origin-as-secure` flag can whitelist specific HTTP origins as secure (e.g. `http://192.168.1.50:3000`). This enables service workers and the install prompt on that origin.
- On Android, setting this flag requires root access or developer mode.

### Firefox
- Service workers over HTTP can be enabled via `devtools.serviceWorkers.testing.enabled` in `about:config`, but only while DevTools are open.
- Firefox desktop has limited PWA install support regardless of protocol.

### Safari (iOS / macOS)
- No flag-based workaround exists. Service workers strictly require HTTPS.
- iOS is the most restrictive platform for HTTP-based PWA features.

## Workaround options for self-hosters

### 1. Access via `localhost` (no setup needed)

If accessing the app from the same machine running the server, `http://localhost` is treated as a secure context by all browsers. Service workers and PWA install work without any additional configuration.

**Pros:** Zero setup.
**Cons:** Only works on the host machine. Not useful for phones or other devices on the LAN.

### 2. Chrome flag: treat insecure origin as secure

Set `chrome://flags/#unsafely-treat-insecure-origin-as-secure` to the app's HTTP URL (e.g. `http://192.168.1.50:3000`).

**Pros:** No server changes needed. Works immediately.
**Cons:** Must be set per browser on each device. Not available on iOS Safari. Resets on browser updates. Not suitable for non-technical users.

### 3. Reverse proxy with `mkcert` (recommended)

Use [mkcert](https://github.com/FiloSottile/mkcert) to generate locally-trusted TLS certificates, then terminate TLS with a reverse proxy like [Caddy](https://caddyserver.com/).

Setup:
```bash
# Install mkcert and create local CA
mkcert -install

# Generate cert for your LAN IP
mkcert -key-file key.pem -cert-file cert.pem 192.168.1.50 localhost

# Caddyfile example
https://192.168.1.50 {
    tls /path/to/cert.pem /path/to/key.pem
    reverse_proxy localhost:3000
}
```

To trust the certificates on other devices, export the root CA (`mkcert -CAROOT`) and install it on each client:
- **iOS:** AirDrop or email the `rootCA.pem`, install via Settings > Profile Downloaded, then enable full trust.
- **Android:** Install the CA certificate under Settings > Security > Encryption & Credentials.
- **Other computers:** Import into the system trust store or browser certificate manager.

**Pros:** Full PWA support including install prompt and service worker. Works on all devices once the CA is trusted. Caddy configuration is minimal.
**Cons:** Initial setup required. Root CA must be distributed to each client device. If the LAN IP changes, certificates must be regenerated (use a local DNS name to avoid this).

### 4. Caddy with internal CA (alternative to mkcert)

Caddy can act as its own Certificate Authority for local domains. Configure a local DNS name (e.g. `workout.local`) pointing to the server, and Caddy will auto-generate and manage certificates.

**Pros:** No external tools needed beyond Caddy. Automatic certificate renewal.
**Cons:** Still requires distributing Caddy's root CA to client devices. Requires local DNS configuration.

### 5. Public domain with Let's Encrypt

If the server has a domain name (even via a free dynamic DNS service), Caddy or Certbot can obtain real Let's Encrypt certificates automatically. The server does not need to be publicly accessible if using DNS-01 challenge validation.

**Pros:** Certificates trusted by all devices without any manual CA distribution. Fully standard HTTPS.
**Cons:** Requires owning or configuring a domain name. DNS-01 requires API access to the DNS provider.

## Recommendation

For most self-hosters on a home network:

1. **The offline queue works without any changes** — IndexedDB, fetch, and online/offline detection all function over plain HTTP. Users who keep a browser tab open will get action queueing and sync without HTTPS.

2. **For full PWA support** (offline page loading, install to home screen), set up HTTPS using **option 3 (mkcert + Caddy)**. It is straightforward, works on all devices, and Caddy's configuration is minimal. This is the most practical approach for a home network.

3. **For quick testing** on a single Chromium-based browser, use **option 2 (Chrome flag)** as a temporary measure.

4. If the self-hoster already has a domain, **option 5 (Let's Encrypt)** is the cleanest long-term solution.

No code changes are needed in the app itself. The offline queue is protocol-agnostic, and the service worker is already configured via `@vite-pwa/sveltekit` and will activate automatically when served over HTTPS.

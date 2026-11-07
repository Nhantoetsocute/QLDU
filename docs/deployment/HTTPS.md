# HTTPS deployment

The repository does not install a public certificate or change your host firewall. Configure DNS and a valid certificate for your API domain, then review `nginx-https.conf.example` for your server. The example terminates TLS at nginx, replaces forwarded headers and proxies to a Node process bound to loopback.

Backend configuration:

```dotenv
NODE_ENV=production
HOST=127.0.0.1
PORT=3000
PUBLIC_BASE_URL=https://api.example.com
VNP_RETURN_URL=https://api.example.com/api/vnpay/return
TRUST_PROXY=loopback
CORS_ORIGINS=https://app.example.com
```

Permit only your actual proxy addresses in TRUST_PROXY. Never use `true`, hop counts or a public-wide subnet. The application rejects plaintext production requests; HTTPS reported by a forwarded header is accepted only from a configured trusted proxy. HSTS complements this check but does not encrypt a first HTTP request. Keep the internal HTTP listener inaccessible from public networks.

For MySQL on the same machine, DB_HOST=127.0.0.1 may use the local connection. A remote production database requires DB_TLS=true and a DNS hostname that matches the database certificate. Set DB_SSL_CA to the provider's CA PEM file when its certificate does not chain to system roots. Certificate chain and hostname verification stay enabled; TLS minimum is 1.2.

Set EXPO_PUBLIC_API_BASE_URL=https://api.example.com before building the mobile app. Store builds deny cleartext networking in their native configuration. For a local development build only, use APP_VARIANT=development with a local API URL. Expo Go has its own networking settings and does not inherit this app's native manifest. Rebuild native binaries after changing these settings.

The payment WebView must retain HTTPS for gateway/bank pages; a local HTTP return page is only for local development. Production VNP_RETURN_URL is restricted to the configured public API origin. VNPay IPN must be configured separately with the merchant service to reach https://api.example.com/api/vnpay/ipn.

References: [Express behind proxies](https://expressjs.com/en/guide/behind-proxies/), [Expo config plugins](https://docs.expo.dev/config-plugins/introduction/), [Android usesCleartextTraffic](https://developer.android.com/guide/topics/manifest/application-element#usesCleartextTraffic), [Apple App Transport Security](https://developer.apple.com/documentation/bundleresources/information-property-list/nsapptransportsecurity).

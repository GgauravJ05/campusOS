# CampusOS on the network

**Course:** B25IT403 Computer Network, Unit 3 (transport) and Unit 4 (application layer).
Every capture below was taken from the running system with `curl -v` (API on
`localhost:5050`, demo account, test database). The refresh token in the
`Set-Cookie` line and the access token in the body are not reproduced.

The project is **not deployed**, so DNS, hosting types and a public TLS certificate
are not covered here; the mapping document says so.

## 1. Ports and the TCP/IP layers

| Port | Process | Transport | Application protocol | Who connects |
| --- | --- | --- | --- | --- |
| 5173 | Vite dev server (web app + `/about/` page) | TCP | HTTP | the browser |
| 5050 | Node + Express API | TCP | HTTP (JSON) | the browser, via the 5173 proxy in development |
| 55432 | PostgreSQL 16 | TCP | PostgreSQL wire protocol | the API only |

| Layer | In CampusOS |
| --- | --- |
| Application | HTTP requests and JSON bodies, cookies, CORS headers, SMTP for OTP mail |
| Transport | TCP: the three ports above; connections are reused (`Connection: keep-alive`) |
| Internet | IP: loopback `::1` / `127.0.0.1` on a laptop; `ip_address INET` columns record client addresses for the audit trail |
| Link / physical | Not visible to the application |

`curl` tried IPv6 first (`Trying [::1]:5050...`) and connected, which is the
transport layer's TCP handshake completing before any HTTP is sent.

Why the browser talks to `5173` and not `5050`: the dev server proxies `/api` to the
API, so the browser sees one origin. The `SameSite=Strict` refresh cookie is then
first-party and no CORS negotiation is needed in development.

## 2. One login, on the wire

`curl -sv -X POST http://localhost:5050/api/auth/login -H 'Content-Type: application/json' -H 'Origin: http://localhost:5173' -d '{...}'`

```
* Connected to localhost (::1) port 5050            <- TCP connection established
> POST /api/auth/login HTTP/1.1                    <- request line: method, path, version
> Host: localhost:5050
> Content-Type: application/json                   <- the body is JSON
> Origin: http://localhost:5173
> Content-Length: 58

< HTTP/1.1 200 OK                                  <- status line
< Content-Security-Policy: default-src 'self';...
< Strict-Transport-Security: max-age=31536000; includeSubDomains
< X-Content-Type-Options: nosniff
< X-Frame-Options: SAMEORIGIN
< Access-Control-Allow-Origin: http://localhost:5173
< Access-Control-Allow-Credentials: true
< RateLimit-Policy: 10;w=900
< RateLimit: limit=10, remaining=9, reset=900
< Set-Cookie: campusos_rt=<redacted>; Path=/api/auth; Expires=...; HttpOnly; SameSite=Strict
< Cache-Control: no-store
< Content-Type: application/json; charset=utf-8
< Content-Length: 707

{"success":true,"data":{"accessToken":"<redacted>","accessTokenExpiresIn":900,"user":{...}}}
```

What each group is for:

- **Request line and headers:** `POST` creates a session; `Content-Type` tells the
  server how to parse the body; `Origin` is set by browsers and drives CORS.
- **Status `200`:** success. The API's other codes are below.
- **Security headers (helmet):** `Content-Security-Policy` restricts what a page may load,
  `X-Content-Type-Options: nosniff` stops MIME guessing, `X-Frame-Options` blocks
  clickjacking, `Strict-Transport-Security` asks browsers to use HTTPS. HSTS has no
  effect over plain `http://localhost`; it matters once served over TLS.
- **Cookie:** `HttpOnly` (JavaScript cannot read it), `SameSite=Strict` (not sent on
  cross-site requests), `Path=/api/auth` (only sent to the auth routes).
- **Rate limit headers:** the sign-in limit is 10 per 15 minutes (`w=900` seconds).
- **`Cache-Control: no-store`:** tokens must not be cached.

## 3. CORS and the preflight

A browser page on one origin calling an API on another sends a **preflight**
first, an `OPTIONS` request asking permission:

```
> OPTIONS /api/auth/login HTTP/1.1
> Origin: http://localhost:5173
> Access-Control-Request-Method: POST
> Access-Control-Request-Headers: content-type,authorization

< HTTP/1.1 204 No Content
< Access-Control-Allow-Origin: http://localhost:5173
< Access-Control-Allow-Credentials: true
< Access-Control-Allow-Methods: GET,POST,PATCH,PUT,DELETE,OPTIONS
< Access-Control-Allow-Headers: Content-Type,Authorization,X-Request-Id
< Access-Control-Max-Age: 86400
< Vary: Origin
```

The API answers with an explicit allow-list, not `*` (a wildcard cannot be combined
with cookies). `Max-Age: 86400` lets the browser cache the answer for a day. An origin
that is not on the list, `http://evil.example` in the same test, gets **`403 Forbidden`**
and no `Access-Control-Allow-*` headers, so the browser refuses to send the real request.
CORS is enforced by the browser; it does not protect the API from `curl`, which is
why every route also checks authentication itself.

## 4. Status codes the API really returns

Checked with `curl`:

| Request | Status | Meaning |
| --- | --- | --- |
| `POST /api/auth/login`, correct password | `200 OK` | success |
| `POST /api/auth/login`, wrong password | `401 Unauthorized` | `INVALID_CREDENTIALS` |
| `GET /api/users/me` with no token | `401 Unauthorized` | not authenticated |
| `POST /api/auth/login` with `{}` | `422 Unprocessable Entity` | validation failed, with per-field details |
| `GET /api/nothing` | `404 Not Found` | no such route |

Also used by the API and covered by tests: `201` (created), `204` (no body),
`403` (signed in but not allowed), `409` (conflict: slot taken, deadlock detected),
`429` (rate limited), `503` (database unreachable on `/api/health/ready`).

## 5. What to open in DevTools

1. Network tab, sign in, click the `login` request: Headers shows sections 2 and 3.
2. Application tab, Cookies: `campusos_rt` with the `HttpOnly` and `SameSite` flags ticked.
3. `/about/index.html`, Network tab: the `health` request is the `XMLHttpRequest`
   (its Type column reads `xhr`).

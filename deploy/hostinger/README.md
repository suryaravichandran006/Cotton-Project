# Analysis-only deployment on the shared Hostinger VPS

Target supplied by the owner: `187.127.142.201`, SSH user `root`. Emerging Alliance and DataChat already run there. The chosen no-purchase hostname is `cotton.187-127-142-201.sslip.io`; its DNS resolves to this VPS. Deployment uses the existing native Nginx and Docker installation, a dedicated SSH key, and the previously unused loopback port 3180. The HTTPS certificate has been issued and its renewal dry run passed.

## What this serves

Build and run with `ANALYSIS_ONLY=true`. `/` renders the cotton analysis page; `/analyze` redirects to `/`, preserving saved-result queries. The header has the Cotton Grade logo without the research navigation. Uploads, inline T-label results, lab values/CSV, the PDF, working explanation and actual model metrics remain available. A saved result reopens with `/?analysis=<id>`.

All other pages and unrelated API routes return 404 in this deployment. Public history listing and deletion are excluded; uploaded images and individual saved results are accessible through their unguessable URLs. These links are shareable, not authenticated private storage. The normal local/research build keeps its existing routes when the flag is absent.

The Next.js and Python services run in a separate `cotton-analysis` Compose project and network. Python has no published port. Only the frontend binds to `127.0.0.1:3180` (adjust if occupied). Persistent uploads and SQLite use this project's own named volume. No existing database or site's environment file is reused. The public origin must include HTTPS so saved photo URLs work correctly behind the shared reverse proxy.

## Prepare a release

For the shared 2-vCPU, 8-GB VPS, the cotton backend is capped at 1 CPU and 1536 MB; the frontend at 0.5 CPU and 512 MB. They also have process-count limits. Build the images sequentially to avoid simultaneous dependency/build memory peaks. These caps apply only to the new cotton containers.

The inspected server has Docker 29.1.3 without Buildx. Its existing legacy builder supports explicit build limits, so the deployment can use `DOCKER_BUILDKIT=0 docker build --memory=2g --memory-swap=2g --cpu-period=100000 --cpu-quota=100000` for each image rather than upgrading Docker. Tag images as `cotton-analysis-backend:<release>` and `cotton-analysis-frontend:<release>`, put that revision in `COTTON_RELEASE`, then start Compose with `up -d --no-build`.

Publish the latest source, the active pointer, its full frozen run and both restored checkpoints to GitHub using Git LFS before running these commands. The original `c9d541a` release predates the progressive model and this deployment mode; use a verified release containing these files. Clone into a NEW directory such as `/opt/cotton-analysis`, never an existing app checkout. Install Docker/Compose only if absent; do not reinstall the VPS or replace its web server.

In the release checkout:

```sh
git lfs install --local
git lfs pull
git lfs fsck
```

Create a private `.env.hostinger` (keep it outside Git):

```dotenv
COTTON_PUBLIC_ORIGIN=https://cotton.187-127-142-201.sslip.io
COTTON_LOCAL_PORT=3180
COTTON_RELEASE=<verified-release-tag>
```

The selected sslip.io hostname resolves automatically; no domain purchase or DNS-zone edit is needed. Do not add `/analyze`, `/api/backend` or a trailing slash to the origin. Confirm `3180` is unused and inspect free RAM/CPU/disk first because the VPS also serves two live apps. GitHub credentials for the private repository are configured on the VPS separately; never embed a token in the clone URL or deployment files.

```sh
docker compose --env-file .env.hostinger -f docker-compose.hostinger.yml config --quiet
# Build each image sequentially with the limits described above first.
docker compose --env-file .env.hostinger -f docker-compose.hostinger.yml up -d --no-build
docker compose --env-file .env.hostinger -f docker-compose.hostinger.yml ps
```

The backend healthcheck verifies the actual trained quality model, not the unrelated mock cultivar demo. Do not route public traffic unless both services are healthy. This stack performs CPU inference; no training runs on the VPS.

## Connect the chosen domain

The included Nginx configuration is for native Nginx and the selected free hostname. Initially enable `nginx.bootstrap.conf` to serve only the ACME challenge directory `/var/www/cotton-acme` (all other requests get 503). Obtain the certificate with the existing Certbot account using the webroot method. Only after certificate issuance and healthy containers, replace that one new site's configuration with `nginx.conf.example`, validate Nginx, and reload it. The HTTPS configuration redirects HTTP while preserving the challenge location for renewal. A certificate-specific renewal deploy hook must validate and reload Nginx after this certificate renews.

`cotton.187-127-142-201.sslip.io` already resolves to `187.127.142.201` through sslip.io. DNS resolution alone does not make the application live; the site route and TLS certificate still need to be installed. Add ONE new site to the web server already handling Emerging Alliance and DataChat. If it is native nginx, use `nginx.conf.example`, replacing the domain and port; validate the complete nginx configuration before reloading it. Add a certificate for only the new name using the existing certificate-management method. If the server uses Nginx Proxy Manager, Caddy, Apache or CloudPanel, adapt through that existing system instead of installing a competing service on ports 80/443.

Keep the upload size limit and inference timeout from the template; rate-limit the analyze endpoint in that existing proxy. Serve uploads over HTTPS. The current phone-camera control is a file input with camera capture; it does not use getUserMedia. Verify HTTP redirects, HTTPS, uploads, matched T labels, CSV, PDF, result-photo URLs and query-link reload. Confirm research URLs and public history/delete endpoints return 404, then check BOTH existing sites still work.

## Data and rollback

Back up the `cotton-analysis_cotton-storage` Docker volume before updating releases; it contains SQLite and uploaded images. Stop only this Compose project for a consistent file-level backup if using a volume archive. Never run `docker compose down -v` against this or another project. Keep the previous code commit and frozen model together for rollback. Service logs rotate automatically.

The frontend uses Next.js 16.4.2 and a committed lockfile; use `npm ci` to reproduce it. The production dependency audit passed with zero reported vulnerabilities after the October 16 security update. Development tooling has separate advisories and is excluded from the standalone runtime image. Record the exact pushed revision and successful Docker/HTTPS checks when deployment is completed; configuration alone does not prove a live deployment.

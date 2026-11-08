# Publish updates to ailt1001.standardcas.org

## Existing setup

| Setting | Value |
| --- | --- |
| GCP project | `gen-lang-client-0306587402` |
| Cloud Run service | `hollywood-poster` |
| Region | `asia-east1` |
| Runtime | Nginx, port 8080; 1 vCPU / 256 MiB |
| Scaling | Minimum 0, maximum 2 instances |
| Runtime identity | `hollywood-web-runtime@gen-lang-client-0306587402.iam.gserviceaccount.com` |
| Custom address | `https://ailt1001.standardcas.org/` |
| Direct address | `https://hollywood-poster-952161411784.asia-east1.run.app/` |

Cloud Run serves the public site. The private GitHub repository stores source only. No GitHub automatic deployment is configured.

## One-time Mac setup

Install the [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) and sign in with an account allowed to deploy to the existing project:

```sh
gcloud auth login
gcloud run services describe hollywood-poster \
  --project=gen-lang-client-0306587402 --region=asia-east1
```

The deployment script supplies the project explicitly, so it does not rely on or change your global default project. Your account needs permissions for Cloud Run source deployment, Cloud Build and use of the existing runtime service account. If Google reports a permission or billing error, resolve that project-specific issue before retrying. Do not commit credentials or service-account keys.

## Publish a change

From the repository folder:

```sh
git pull --ff-only
npm ci
npm run deploy
```

This runs interface tests, replaces `build/` from `dist/`, prepares `.deploy/cloud-run/`, then deploys a new revision to the existing service. Cloud Build builds the Nginx image remotely; Docker is not required on your Mac. Deployment can incur normal Google Cloud charges.

Only the Dockerfile, Nginx configuration and built static files enter the upload context. Neither your Git history nor local credentials are uploaded. To prepare that context without deploying:

```sh
npm run deploy:prepare
```

The helper is `scripts/deploy-cloud-run.sh`. It targets only the poster's Cloud Run service, never `www.standardcas.org`, the apex domain or Cyclone VM.

## Verify the release

```sh
curl -I https://ailt1001.standardcas.org/
curl -I https://ailt1001.standardcas.org/references.html
gcloud run services describe hollywood-poster \
  --project=gen-lang-client-0306587402 --region=asia-east1 \
  --format='value(status.latestReadyRevisionName,status.url)'
```

Then open the site on your phone, check the changed text, play the clip and try AR Preview. HTTP 200 alone does not prove camera tracking works.

## Custom domain and DNS

The `ailt1001` CNAME in Namecheap points to `ghs.googlehosted.com.` and the existing Google ownership-verification TXT record should be retained. Google Cloud Run has a domain mapping from `ailt1001.standardcas.org` to this service and manages its HTTPS certificate. The custom address passed an HTTPS check on 8 November 2026.

Do not change DNS for normal content updates. If the custom address fails while the direct Cloud Run address works, inspect the domain mapping and DNS first; do not replace the apex or `www` records.

## Roll back an unsuccessful deployment

List revisions, identify a previously working one, and send traffic back to it:

```sh
gcloud run revisions list --service=hollywood-poster \
  --project=gen-lang-client-0306587402 --region=asia-east1
# Replace WORKING_REVISION with the actual previous revision name:
gcloud run services update-traffic hollywood-poster \
  --project=gen-lang-client-0306587402 --region=asia-east1 \
  --to-revisions=WORKING_REVISION=100
```

Also revert the faulty source commit so the next deploy does not reintroduce it.

Official documentation: [source deployments](https://docs.cloud.google.com/run/docs/deploying-source-code), [custom domains](https://docs.cloud.google.com/run/docs/mapping-custom-domains).

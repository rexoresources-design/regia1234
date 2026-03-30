# Vercel Launch Setup

This workspace did not contain a standard app project, so the deployable site was prepared from the static Stitch export in `stitch-downloads/hivetutors2-project-11531668788779239283`.

## Included routes

- `/`
- `/about`
- `/services`
- `/service-detail`
- `/blog`
- `/faq`
- `/contact`

## Files prepared for deployment

- `site/` contains the static HTML pages
- `vercel.json` maps clean routes to those pages
- `.gitignore` keeps the large scratch files out of Git
- `.vercelignore` keeps the same scratch files out of Vercel uploads

## GitHub

Create an empty GitHub repository, then run:

```powershell
git add .
git commit -m "Prepare static site for Vercel launch"
git branch -M main
git remote add origin <YOUR_GITHUB_REPO_URL>
git push -u origin main
```

## Vercel

Use a workspace-local npm cache to avoid Windows permission issues:

```powershell
cmd /c "set npm_config_cache=%CD%\\.npm-cache&& npx.cmd vercel"
```

For production deploys:

```powershell
cmd /c "set npm_config_cache=%CD%\\.npm-cache&& npx.cmd vercel --prod"
```

If you connect the GitHub repo in the Vercel dashboard instead, select the repository and keep the project root as the repo root.

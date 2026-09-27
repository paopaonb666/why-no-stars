# Security Policy

## Reporting a vulnerability

Please use **GitHub's private vulnerability reporting** for this repository
(Repository → Security → Report a vulnerability), or open an issue titled
`security: <short summary>` **without details** and we will follow up privately.

Please do not open public issues with exploitable details.

## Scope and token handling

`why-no-stars` is a read-only diagnostic CLI. Regarding credentials:

- The optional `GITHUB_TOKEN` / `GH_TOKEN` environment variable (or `--token`)
  is sent **only** to `api.github.com` as a request header.
- The token is never logged, written to reports, cached to disk, or transmitted
  anywhere else.
- No repository code or report content is uploaded anywhere; all analysis is local.

If you believe tokens or data are handled otherwise, that is a security bug — please report it.

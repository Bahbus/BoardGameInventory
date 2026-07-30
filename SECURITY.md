# Security Policy

Please report vulnerabilities through this repository's enabled GitHub private vulnerability
reporting feature. Do not include secrets in a public issue.

The public catalog is a static GitHub Pages application and has no application-owned accounts or
database. The separate, stateless Setup service uses a repository-scoped GitHub App to verify
collaborators and prepare reviewable pull requests. Its GitHub App credentials and signing secret
must remain in the hosting provider's encrypted runtime configuration. Repository secrets remain
in trusted Actions builds, and the BGG token must never be exposed to browser code or Pages
artifacts.

Supported security fixes target the current `main` branch.

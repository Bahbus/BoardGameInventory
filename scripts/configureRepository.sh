#!/usr/bin/env bash
set -euo pipefail

repository="${1:-Bahbus/BoardGameInventory}"

for label in \
  "inventory:add|1d76db|Add an inventory item" \
  "inventory:update|5319e7|Update an inventory item" \
  "inventory:remove|b60205|Remove an inventory item" \
  "approved-inventory-change|0e8a16|Maintainer-approved public suggestion" \
  "suggestion|d4c5f9|Public suggestion awaiting review" \
  "needs-info|d876e3|Request needs correction"; do
  IFS='|' read -r name color description <<< "$label"
  gh label create "$name" --repo "$repository" --color "$color" --description "$description" --force
done

gh api --method POST "repos/$repository/pages" -f build_type=workflow >/dev/null 2>&1 || true
gh api --method PUT "repos/$repository/actions/permissions" \
  -F enabled=true \
  -f allowed_actions=all
gh api --method PUT "repos/$repository/actions/permissions/workflow" \
  -f default_workflow_permissions=read \
  -F can_approve_pull_request_reviews=true
gh api --method PUT "repos/$repository/vulnerability-alerts" \
  -H "Accept: application/vnd.github+json"
gh api --method PUT "repos/$repository/automated-security-fixes" \
  -H "Accept: application/vnd.github+json"
gh api --method PUT "repos/$repository/private-vulnerability-reporting" \
  -H "Accept: application/vnd.github+json"
gh api --method PATCH "repos/$repository" \
  -F has_issues=true \
  -F "security_and_analysis[secret_scanning][status]=enabled" \
  -F "security_and_analysis[secret_scanning_push_protection][status]=enabled"
gh api --method PUT "repos/$repository/branches/main/protection" \
  -H "Accept: application/vnd.github+json" \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["verify"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": true
}
JSON

echo "Configured labels, Pages, security alerts, secret scanning, workflow defaults, and main protection for $repository."

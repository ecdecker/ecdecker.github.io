#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Provision and publish this blog on Cloudflare Pages.

Environment variables (prompted for when missing):
  CLOUDFLARE_ACCOUNT_ID  Cloudflare account ID
  CLOUDFLARE_API_TOKEN   API token with Pages Write permission
  SITE_DOMAIN            Hostname to publish, for example blog.example.com

Optional environment variables:
  CF_PAGES_PROJECT       Pages project name (default: emily)
  CF_PAGES_BRANCH        Production branch (default: main)

Usage:
  npm run sync

The command is safe to rerun. It creates the project and domain association
when missing, then builds and deploys the current site. For external DNS,
create a CNAME from SITE_DOMAIN to CF_PAGES_PROJECT.pages.dev. Apex domains
must use Cloudflare nameservers.
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'error: required command not found: %s\n' "$1" >&2
    exit 1
  fi
}

prompt_variable() {
  local name="$1"
  local prompt="$2"
  local secret="${3:-false}"
  local value="${!name-}"

  if [[ -z "$value" ]]; then
    if [[ "$secret" == "true" ]]; then
      if ! read -r -s -p "$prompt: " value; then
        printf '\nerror: no value supplied for %s\n' "$name" >&2
        exit 1
      fi
      printf '\n'
    else
      if ! read -r -p "$prompt: " value; then
        printf 'error: no value supplied for %s\n' "$name" >&2
        exit 1
      fi
    fi
  fi

  if [[ -z "$value" ]]; then
    printf 'error: %s cannot be empty\n' "$name" >&2
    exit 1
  fi

  printf -v "$name" '%s' "$value"
  export "$name"
}

require_command curl
require_command hugo
require_command jq
require_command npx
prompt_variable CLOUDFLARE_ACCOUNT_ID "Cloudflare account ID"
prompt_variable CLOUDFLARE_API_TOKEN "Cloudflare API token" true
prompt_variable SITE_DOMAIN "Site domain (for example blog.example.com)"

project="${CF_PAGES_PROJECT:-emily}"
branch="${CF_PAGES_BRANCH:-main}"
domain="${SITE_DOMAIN,,}"

if [[ ! "$project" =~ ^[a-z0-9][a-z0-9-]*$ ]]; then
  printf 'error: CF_PAGES_PROJECT must contain lowercase letters, digits, and hyphens\n' >&2
  exit 1
fi

if [[ ! "$domain" =~ ^[a-z0-9.-]+$ || "$domain" != *.* ]]; then
  printf 'error: SITE_DOMAIN must be a hostname such as blog.example.com\n' >&2
  exit 1
fi

api_root="https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects"
api_status=""
api_body=""

api_request() {
  local method="$1"
  local url="$2"
  local payload="${3:-}"
  local response
  local args=(
    --silent
    --show-error
    --request "$method"
    --header "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}"
    --header "Content-Type: application/json"
    --write-out $'\n%{http_code}'
  )

  if [[ -n "$payload" ]]; then
    args+=(--data "$payload")
  fi

  if ! response="$(curl "${args[@]}" "$url")"; then
    printf 'error: Cloudflare API request failed\n' >&2
    exit 1
  fi

  api_status="${response##*$'\n'}"
  api_body="${response%$'\n'*}"
}

api_error() {
  local action="$1"
  printf 'error: could not %s (HTTP %s)\n' "$action" "$api_status" >&2
  jq -r '.errors[]? | "  \(.code): \(.message)"' <<<"$api_body" >&2 || true
  exit 1
}

api_request GET "${api_root}/${project}"
case "$api_status" in
  200)
    printf 'Pages project already exists: %s\n' "$project"
    ;;
  404)
    project_payload="$(jq -cn \
      --arg name "$project" \
      --arg branch "$branch" \
      '{name: $name, production_branch: $branch}')"
    api_request POST "$api_root" "$project_payload"
    [[ "$api_status" == "200" ]] || api_error "create Pages project"
    printf 'Created Pages project: %s\n' "$project"
    ;;
  *)
    api_error "look up Pages project"
    ;;
esac

api_request GET "${api_root}/${project}/domains/${domain}"
case "$api_status" in
  200)
    printf 'Custom domain already attached: %s\n' "$domain"
    ;;
  404)
    domain_payload="$(jq -cn --arg name "$domain" '{name: $name}')"
    api_request POST "${api_root}/${project}/domains" "$domain_payload"
    [[ "$api_status" == "200" ]] || api_error "attach custom domain"
    printf 'Attached custom domain: %s\n' "$domain"
    ;;
  *)
    api_error "look up custom domain"
    ;;
esac

printf '\nBuilding https://%s/ ...\n' "$domain"
hugo --gc --minify --cleanDestinationDir --baseURL "https://${domain}/"

printf '\nDeploying public/ to Cloudflare Pages project %s ...\n' "$project"
npx --yes wrangler@4 pages deploy public \
  --project-name "$project" \
  --branch "$branch"

printf '\nSync complete: https://%s/\n' "$domain"
printf 'If DNS is hosted elsewhere, point %s by CNAME to %s.pages.dev.\n' \
  "$domain" "$project"

#!/usr/bin/env bash
set -euo pipefail

# Upload the prepared Russian deployment to a VPS and start the stack.
# Secrets are never copied from this workstation. Fill .env on the server first.

: "${RUSSIA_HOST:?Set RUSSIA_HOST to the VPS hostname or IP}"
: "${RUSSIA_USER:?Set RUSSIA_USER to the SSH user}"
: "${SSH_KEY:?Set SSH_KEY to the private key path}"
: "${RUSSIA_PATH:?Set RUSSIA_PATH to the intended release directory on the VPS}"

if [[ ! -f "$SSH_KEY" ]]; then
  echo "SSH key not found: $SSH_KEY" >&2
  exit 1
fi

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
archive="$(mktemp -t black-and-white-russia.XXXXXX.tar.gz)"
trap 'rm -f "$archive"' EXIT

if [[ -n "$(git -C "$root_dir" status --porcelain)" ]]; then
  echo 'Commit the release first; deployment archives only tracked files from HEAD.' >&2
  exit 1
fi
release_sha="$(git -C "$root_dir" rev-parse HEAD)"
if [[ "$release_sha" != "$(git -C "$root_dir" rev-parse origin/main)" ]]; then
  echo 'HEAD must match published origin/main; fetch and verify GitHub before deploying.' >&2
  exit 1
fi
git -C "$root_dir" archive --format=tar HEAD | gzip -c > "$archive"

remote_path_quoted="$(printf '%q' "$RUSSIA_PATH")"
ssh -i "$SSH_KEY" "$RUSSIA_USER@$RUSSIA_HOST" "mkdir -p -- $remote_path_quoted"
scp -i "$SSH_KEY" "$archive" "$RUSSIA_USER@$RUSSIA_HOST:/tmp/black-and-white-russia.tar.gz"
ssh -i "$SSH_KEY" "$RUSSIA_USER@$RUSSIA_HOST" "bash -se -- $remote_path_quoted $release_sha" <<'REMOTE'
set -euo pipefail
cd "$1"
release_sha="$2"
umask 022
tar -xzf /tmp/black-and-white-russia.tar.gz -C .
rm -f /tmp/black-and-white-russia.tar.gz
if [[ ! -f .env ]]; then
  install -m 600 .env.example .env
  echo "Created $PWD/.env. Fill its secrets, then rerun this script."
  exit 2
fi

docker_cmd=(docker)
if ! docker info >/dev/null 2>&1; then docker_cmd=(sudo -n docker); fi
"${docker_cmd[@]}" info >/dev/null
compose=("${docker_cmd[@]}" compose -p black-and-white -f compose.russia.yml)
services=(app support-delivery npd-scheduler web)
vtb_enabled=false
if grep -Eq '^VTB_SANDBOX_ENABLED=true([[:space:]]|$)' .env; then
  vtb_enabled=true
  compose+=(-f compose.vtb-ca.yml)
  services+=(vtb-reconciler)
  ca_path="$(sed -n 's/^VTB_CA_BUNDLE_PATH=//p' .env | tail -n 1)"
  token="$(sed -n 's/^VTB_RECONCILE_TOKEN=//p' .env | tail -n 1)"
  if [[ -z "$ca_path" || ! -f "$ca_path" ]]; then
    echo 'VTB CA bundle is missing; set VTB_CA_BUNDLE_PATH to an existing PEM file.' >&2
    exit 1
  fi
  if [[ ! "$token" =~ ^[a-fA-F0-9]{64}$ ]]; then
    echo 'Set VTB_RECONCILE_TOKEN to 64 hex characters (openssl rand -hex 32).' >&2
    exit 1
  fi
  unset token
fi

"${compose[@]}" config -q
"${compose[@]}" up -d db
umask 077
mkdir -p private-backups
chmod 700 private-backups
backup="private-backups/pre-release-$(date -u +%Y%m%d-%H%M%S).dump"
"${compose[@]}" exec -T db pg_dump -U blwt -d blwt -Fc > "$backup"
test -s "$backup"
"${compose[@]}" exec -T db pg_restore -l < "$backup" >/dev/null
"${compose[@]}" build --build-arg "RELEASE_SHA=$release_sha" app
if [[ "$vtb_enabled" == true ]]; then
  "${compose[@]}" run --rm --no-deps app node -e "require('node:fs').accessSync('/app/private/vtb-ca-bundle.pem',require('node:fs').constants.R_OK)"
fi
"${compose[@]}" --profile ops run --rm --no-deps migrate
"${compose[@]}" up -d --no-deps "${services[@]}"
"${compose[@]}" ps
REMOTE

echo "Russian stack deployed to $RUSSIA_HOST:$RUSSIA_PATH"

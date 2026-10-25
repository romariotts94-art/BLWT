#!/usr/bin/env bash
set -euo pipefail

# Upload the prepared Russian deployment to a VPS and start the stack.
# Secrets are never copied from this workstation. Fill .env on the server first.

: "${RUSSIA_HOST:?Set RUSSIA_HOST to the VPS hostname or IP}"
: "${RUSSIA_USER:?Set RUSSIA_USER to the SSH user}"
: "${SSH_KEY:?Set SSH_KEY to the private key path}"
: "${RUSSIA_PATH:=/opt/black-and-white}"

if [[ ! -f "$SSH_KEY" ]]; then
  echo "SSH key not found: $SSH_KEY" >&2
  exit 1
fi

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
archive="$(mktemp -t black-and-white-russia.XXXXXX.tar.gz)"
trap 'rm -f "$archive"' EXIT

tar -czf "$archive" \
  --exclude=node_modules \
  --exclude=.output \
  --exclude=dist \
  --exclude=.next \
  --exclude=.wrangler \
  --exclude=.git \
  --exclude=.env \
  --exclude='*.log' \
  -C "$root_dir" .

ssh -i "$SSH_KEY" "$RUSSIA_USER@$RUSSIA_HOST" "mkdir -p '$RUSSIA_PATH'"
scp -i "$SSH_KEY" "$archive" "$RUSSIA_USER@$RUSSIA_HOST:/tmp/black-and-white-russia.tar.gz"
ssh -i "$SSH_KEY" "$RUSSIA_USER@$RUSSIA_HOST" "set -e; tar -xzf /tmp/black-and-white-russia.tar.gz -C '$RUSSIA_PATH'; rm -f /tmp/black-and-white-russia.tar.gz; cd '$RUSSIA_PATH'; if [ ! -f .env ]; then cp .env.example .env; echo 'Created $RUSSIA_PATH/.env. Fill its secrets, then rerun this script.'; exit 2; fi; docker compose -f compose.russia.yml up -d --build"

echo "Russian stack deployed to $RUSSIA_HOST:$RUSSIA_PATH"

#!/usr/bin/env bash
set -euo pipefail

# Secure GitHub Push Helper (uses Personal Access Token without saving it in .git/config)
# Usage:
#   bash scripts/github-push.sh
# Or with env vars:
#   GITHUB_USER=youruser GITHUB_REPO=football-ai GITHUB_TOKEN=ghp_xxx bash scripts/github-push.sh

if [ ! -f "package.json" ]; then
  echo "Error: Run this script from the project root directory."
  exit 1
fi

GITHUB_USER="${GITHUB_USER:-}"
GITHUB_REPO="${GITHUB_REPO:-}"
GITHUB_BRANCH="${GITHUB_BRANCH:-main}"
GITHUB_TOKEN="${GITHUB_TOKEN:-}"

if [ -z "$GITHUB_USER" ]; then
  read -r -p "GitHub Username: " GITHUB_USER
fi

if [ -z "$GITHUB_REPO" ]; then
  read -r -p "GitHub Repository Name (e.g. football-ai): " GITHUB_REPO
fi

if [ -z "$GITHUB_TOKEN" ]; then
  read -r -s -p "GitHub Personal Access Token (hidden): " GITHUB_TOKEN
  echo ""
fi

if [ -z "$GITHUB_USER" ] || [ -z "$GITHUB_REPO" ] || [ -z "$GITHUB_TOKEN" ]; then
  echo "Error: Username, repository name, and token are all required."
  echo "Create a token here: https://github.com/settings/tokens/new?scopes=repo&description=Football+AI+Deploy"
  exit 1
fi

if ! printf '%s' "$GITHUB_USER" | grep -Eq '^[A-Za-z0-9]([A-Za-z0-9-]{0,38})$'; then
  echo "Error: Invalid GitHub username format."
  exit 1
fi

if ! printf '%s' "$GITHUB_REPO" | grep -Eq '^[A-Za-z0-9._-]{1,100}$'; then
  echo "Error: Invalid GitHub repository name."
  exit 1
fi

if ! printf '%s' "$GITHUB_BRANCH" | grep -Eq '^[A-Za-z0-9._-]{1,64}$'; then
  echo "Error: Invalid Git branch name."
  exit 1
fi

# Verify GitHub token before building/pushing (token passed via stdin header file, never printed)
echo "0/4 Verifying GitHub token with GitHub API..."
AUTH_HEADER_FILE="$(mktemp)"
ASKPASS_SCRIPT="$(mktemp)"
trap 'rm -f "$AUTH_HEADER_FILE" "$ASKPASS_SCRIPT"' EXIT
chmod 600 "$AUTH_HEADER_FILE"
printf 'Authorization: Bearer %s\n' "$GITHUB_TOKEN" > "$AUTH_HEADER_FILE"

HTTP_CODE="$(curl -sS -o /dev/null -w '%{http_code}' \
  -H 'Accept: application/vnd.github+json' \
  -H 'X-GitHub-Api-Version: 2022-11-28' \
  -H "@${AUTH_HEADER_FILE}" \
  https://api.github.com/user || echo '000')"

if [ "$HTTP_CODE" != "200" ]; then
  echo "Error: GitHub token verification failed (HTTP ${HTTP_CODE})."
  echo "Generate a Classic token with 'repo' scope at:"
  echo "  https://github.com/settings/tokens/new?scopes=repo&description=Football+AI+Deploy"
  exit 1
fi

# Verify build & TypeScript before pushing
echo "1/4 Checking TypeScript & production build..."
npm run lint
npm run build

# Initialize git repository if needed
if [ ! -d ".git" ]; then
  echo "2/4 Initializing Git repository..."
  git init
fi

git branch -M "$GITHUB_BRANCH"

# Stage all clean files (respects .gitignore so .env / secrets are never staged)
echo "3/4 Staging files and committing..."
git add -A

# Safety guard: ensure no .env secrets file is ever staged
STAGED_SECRETS="$(git diff --cached --name-only | grep -E '(^|/)\.env($|\.)' | grep -v '\.env\.example$' || true)"
if [ -n "$STAGED_SECRETS" ]; then
  echo "Error: Refusing to push because secret env files were staged:"
  echo "$STAGED_SECRETS"
  git reset HEAD -- $STAGED_SECRETS >/dev/null 2>&1 || true
  exit 1
fi

if ! git diff --cached --quiet; then
  GIT_AUTHOR_ARGS=()
  if ! git config user.name >/dev/null 2>&1; then
    GIT_AUTHOR_ARGS+=(-c "user.name=${GITHUB_USER}")
  fi
  if ! git config user.email >/dev/null 2>&1; then
    GIT_AUTHOR_ARGS+=(-c "user.email=${GITHUB_USER}@users.noreply.github.com")
  fi
  git "${GIT_AUTHOR_ARGS[@]}" commit -m "Deploy Football AI (Live World & Iran Football + Cloudflare Pages)"
else
  echo "No new changes to commit."
fi

# Keep remote URL clean (NO token embedded in .git/config)
CLEAN_REMOTE="https://github.com/${GITHUB_USER}/${GITHUB_REPO}.git"
if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$CLEAN_REMOTE"
else
  git remote add origin "$CLEAN_REMOTE"
fi

# Use ephemeral GIT_ASKPASS script so token never touches disk permanently or git config
cat > "$ASKPASS_SCRIPT" <<'EOF'
#!/usr/bin/env sh
case "$1" in
  *Username*) printf '%s\n' "$GITHUB_USER" ;;
  *Password*) printf '%s\n' "$GITHUB_TOKEN" ;;
esac
EOF
chmod 700 "$ASKPASS_SCRIPT"

echo "4/4 Pushing cleanly to ${CLEAN_REMOTE} (${GITHUB_BRANCH})..."
GIT_TERMINAL_PROMPT=0 \
GIT_ASKPASS="$ASKPASS_SCRIPT" \
GITHUB_USER="$GITHUB_USER" \
GITHUB_TOKEN="$GITHUB_TOKEN" \
git push -u origin "$GITHUB_BRANCH"

echo "Done! Code pushed cleanly to https://github.com/${GITHUB_USER}/${GITHUB_REPO}"

#!/usr/bin/env bash
# Runs once when the Codespace is created. Installs deps, writes .env, and
# pre-creates the Neo4j schema for every extension so enabling them later is just
# `npm run ext -- enable <id>`.
set -euo pipefail
cd "$(dirname "$0")/../workshop"

npm install

[ -f .env ] || cp .env.example .env
set_var() {
  if grep -q "^$1=" .env; then sed -i "s|^$1=.*|$1=$2|" .env; else echo "$1=$2" >> .env; fi
}
set_var NEO4J_URI "${NEO4J_URI:-bolt://neo4j:7687}"
set_var NEO4J_USERNAME "${NEO4J_USERNAME:-neo4j}"
set_var NEO4J_PASSWORD "${NEO4J_PASSWORD:-workshop-password}"

echo "Waiting for Neo4j..."
for _ in $(seq 1 30); do
  npm run -s ext -- check >/dev/null 2>&1 && break
  sleep 2
done
npm run -s ext -- check

# Create constraints/indexes for all extensions (idempotent), without enabling them.
EXTENSIONS=neo4j-short-term,neo4j-long-term,neo4j-context-traces,neo4j-skills,neo4j-workflows \
  npm run -s ext -- setup

if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  echo
  echo "!! ANTHROPIC_API_KEY is not set. Add it as a Codespaces secret (or put it in workshop/.env)."
fi

cat <<'MSG'

Ready. From the workshop/ folder:
  npm run dev                       # Mastra Studio on port 4111
  npm run ext                       # see which extensions are on
  npm run ext -- enable short-term  # then long-term, context-traces, skills, workflows
  npm run ext -- enable all         # everything at once
Neo4j Browser: port 7474 (neo4j / workshop-password)
MSG

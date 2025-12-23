#!/bin/bash

# check-extraction-docs.sh
# Checks if DEAL_CREATION_FLOW.md needs to be updated based on source file changes
#
# Usage: ./scripts/check-extraction-docs.sh
# Run this after making changes to extraction-related files

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

DOC_FILE="docs/DEAL_CREATION_FLOW.md"

# Files that should trigger a doc update when changed
WATCHED_FILES=(
  "backend/services/extractionOrchestrator.js"
  "backend/services/parallelExtractor.js"
  "backend/services/extractionValidator.js"
  "backend/services/periodAnalyzer.js"
  "backend/services/facilityMatcher.js"
  "backend/controller/DealController.js"
  "backend/routes/deal.js"
  "frontend/src/pages/CombinedDealForm.jsx"
  "frontend/src/components/FacilityMatchModal.jsx"
)

# Get the last commit date of the doc file
DOC_LAST_COMMIT=$(git log -1 --format="%ci" -- "$DOC_FILE" 2>/dev/null || echo "never")
DOC_COMMIT_HASH=$(git log -1 --format="%h" -- "$DOC_FILE" 2>/dev/null || echo "none")

echo "=============================================="
echo "  Extraction Documentation Staleness Check"
echo "=============================================="
echo ""
echo "Doc file: $DOC_FILE"
echo "Last updated: $DOC_LAST_COMMIT (commit $DOC_COMMIT_HASH)"
echo ""

STALE_FILES=()
CHANGED_SUMMARIES=()

for file in "${WATCHED_FILES[@]}"; do
  if [ -f "$file" ]; then
    # Get commits to this file since the doc was last updated
    COMMITS_SINCE=$(git log --oneline "$DOC_COMMIT_HASH"..HEAD -- "$file" 2>/dev/null | head -5)

    if [ -n "$COMMITS_SINCE" ]; then
      STALE_FILES+=("$file")
      # Get the most recent commit message for this file
      LAST_CHANGE=$(git log -1 --format="%s" -- "$file" 2>/dev/null)
      CHANGED_SUMMARIES+=("  - $file: $LAST_CHANGE")
    fi
  fi
done

echo "Checking ${#WATCHED_FILES[@]} source files..."
echo ""

if [ ${#STALE_FILES[@]} -eq 0 ]; then
  echo -e "${GREEN}✓ Documentation is up to date!${NC}"
  echo ""
  echo "No extraction-related files have changed since the doc was last updated."
else
  echo -e "${YELLOW}⚠ Documentation may be stale!${NC}"
  echo ""
  echo "${#STALE_FILES[@]} file(s) changed since doc was last updated:"
  echo ""
  for summary in "${CHANGED_SUMMARIES[@]}"; do
    echo "$summary"
  done
  echo ""
  echo -e "${YELLOW}Action needed:${NC}"
  echo "  1. Review the changes above"
  echo "  2. Update docs/DEAL_CREATION_FLOW.md if the extraction flow changed"
  echo "  3. Update the 'Last Updated' date at the top of the doc"
  echo ""
  echo "To see full diff of changes:"
  echo "  git diff $DOC_COMMIT_HASH..HEAD -- ${STALE_FILES[*]}"
  exit 1
fi

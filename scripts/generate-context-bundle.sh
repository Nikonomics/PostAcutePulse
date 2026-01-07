#!/bin/bash
# Auto-generate CLAUDE_ONBOARDING.md from key project files
# This file is automatically updated before each git commit

BUNDLE_FILE="CLAUDE_ONBOARDING_postacutepulse.md"
TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")

echo "Generating $BUNDLE_FILE..."

cat > "$BUNDLE_FILE" << 'HEADER'
# PostAcutePulse - Claude Code Onboarding Bundle

> **Auto-generated** - Do not edit manually
> Last updated: TIMESTAMP_PLACEHOLDER
> Project: /Users/nikolashulewsky/Projects/pac-advocate

This bundle contains all essential project context for onboarding new Claude Code sessions.

---

HEADER

# Replace timestamp placeholder
sed -i.bak "s/TIMESTAMP_PLACEHOLDER/$TIMESTAMP/" "$BUNDLE_FILE" && rm "${BUNDLE_FILE}.bak"

# Add README
echo "## README.md" >> "$BUNDLE_FILE"
echo "" >> "$BUNDLE_FILE"
echo '```markdown' >> "$BUNDLE_FILE"
cat README.md >> "$BUNDLE_FILE"
echo '```' >> "$BUNDLE_FILE"
echo "" >> "$BUNDLE_FILE"
echo "---" >> "$BUNDLE_FILE"
echo "" >> "$BUNDLE_FILE"

# Add PROJECT_CONTEXT
echo "## PROJECT_CONTEXT.md" >> "$BUNDLE_FILE"
echo "" >> "$BUNDLE_FILE"
echo '```markdown' >> "$BUNDLE_FILE"
cat PROJECT_CONTEXT.md >> "$BUNDLE_FILE"
echo '```' >> "$BUNDLE_FILE"
echo "" >> "$BUNDLE_FILE"
echo "---" >> "$BUNDLE_FILE"
echo "" >> "$BUNDLE_FILE"

# Add PROJECT_STATUS
echo "## PROJECT_STATUS.md" >> "$BUNDLE_FILE"
echo "" >> "$BUNDLE_FILE"
echo '```markdown' >> "$BUNDLE_FILE"
cat PROJECT_STATUS.md >> "$BUNDLE_FILE"
echo '```' >> "$BUNDLE_FILE"
echo "" >> "$BUNDLE_FILE"
echo "---" >> "$BUNDLE_FILE"
echo "" >> "$BUNDLE_FILE"

# Add backend package.json (key info only)
echo "## Backend Dependencies (package.json)" >> "$BUNDLE_FILE"
echo "" >> "$BUNDLE_FILE"
echo '```json' >> "$BUNDLE_FILE"
cat backend/package.json >> "$BUNDLE_FILE"
echo '```' >> "$BUNDLE_FILE"
echo "" >> "$BUNDLE_FILE"
echo "---" >> "$BUNDLE_FILE"
echo "" >> "$BUNDLE_FILE"

# Add frontend package.json (key info only)
echo "## Frontend Dependencies (package.json)" >> "$BUNDLE_FILE"
echo "" >> "$BUNDLE_FILE"
echo '```json' >> "$BUNDLE_FILE"
cat frontend/package.json >> "$BUNDLE_FILE"
echo '```' >> "$BUNDLE_FILE"
echo "" >> "$BUNDLE_FILE"
echo "---" >> "$BUNDLE_FILE"
echo "" >> "$BUNDLE_FILE"

# Add TAM Methodology (critical business logic)
if [ -f "backend/docs/TAM_METHODOLOGY.md" ]; then
  echo "## TAM_METHODOLOGY.md" >> "$BUNDLE_FILE"
  echo "" >> "$BUNDLE_FILE"
  echo '```markdown' >> "$BUNDLE_FILE"
  cat backend/docs/TAM_METHODOLOGY.md >> "$BUNDLE_FILE"
  echo '```' >> "$BUNDLE_FILE"
  echo "" >> "$BUNDLE_FILE"
  echo "---" >> "$BUNDLE_FILE"
  echo "" >> "$BUNDLE_FILE"
fi

# Add Cost Report Calibration (critical business logic)
if [ -f "backend/docs/COST_REPORT_CALIBRATION.md" ]; then
  echo "## COST_REPORT_CALIBRATION.md" >> "$BUNDLE_FILE"
  echo "" >> "$BUNDLE_FILE"
  echo '```markdown' >> "$BUNDLE_FILE"
  cat backend/docs/COST_REPORT_CALIBRATION.md >> "$BUNDLE_FILE"
  echo '```' >> "$BUNDLE_FILE"
  echo "" >> "$BUNDLE_FILE"
  echo "---" >> "$BUNDLE_FILE"
  echo "" >> "$BUNDLE_FILE"
fi

# Add key file structure
echo "## Key File Structure" >> "$BUNDLE_FILE"
echo "" >> "$BUNDLE_FILE"
echo '```' >> "$BUNDLE_FILE"
echo "Backend:" >> "$BUNDLE_FILE"
ls -1 backend/*.js >> "$BUNDLE_FILE"
echo "" >> "$BUNDLE_FILE"
echo "Backend Routes:" >> "$BUNDLE_FILE"
ls -1 backend/routes/*.js 2>/dev/null >> "$BUNDLE_FILE"
echo "" >> "$BUNDLE_FILE"
echo "Backend Services:" >> "$BUNDLE_FILE"
ls -1 backend/services/*.js 2>/dev/null >> "$BUNDLE_FILE"
echo "" >> "$BUNDLE_FILE"
echo "Frontend Pages:" >> "$BUNDLE_FILE"
ls -1 frontend/src/pages/*.jsx 2>/dev/null >> "$BUNDLE_FILE"
echo '```' >> "$BUNDLE_FILE"
echo "" >> "$BUNDLE_FILE"

echo "✅ Generated $BUNDLE_FILE ($(wc -l < $BUNDLE_FILE) lines)"

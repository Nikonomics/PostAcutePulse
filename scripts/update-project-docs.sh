#!/bin/bash
# Auto-update PROJECT_STATUS.md and PROJECT_CONTEXT.md based on git activity
# Runs as part of pre-commit hook

set -e

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

TODAY=$(date "+%B %d, %Y")
TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")

echo "📝 Updating project documentation..."

# =============================================================================
# UPDATE PROJECT_STATUS.md
# =============================================================================

update_project_status() {
    local STATUS_FILE="PROJECT_STATUS.md"
    local TEMP_SECTION="/tmp/recent_changes_$$.md"
    local TEMP_OUTPUT="/tmp/status_output_$$.md"

    # Generate recent changes section
    cat > "$TEMP_SECTION" << 'EOF'
## 📅 Recent Changes (Auto-Generated)

> This section is automatically updated on each commit.

EOF

    echo "### Last 7 Days" >> "$TEMP_SECTION"
    echo "" >> "$TEMP_SECTION"

    # Get commits from last 7 days
    git log --since="7 days ago" --pretty=format:"- **%ad** - %s" --date=short 2>/dev/null | head -30 >> "$TEMP_SECTION" || echo "- No recent commits" >> "$TEMP_SECTION"

    echo "" >> "$TEMP_SECTION"
    echo "" >> "$TEMP_SECTION"

    # Add file change summary
    echo "### Areas Modified (Last 20 Commits)" >> "$TEMP_SECTION"
    echo "" >> "$TEMP_SECTION"
    echo '```' >> "$TEMP_SECTION"

    # Count changes by directory
    local BACKEND_CHANGES=$(git diff --name-only HEAD~20 2>/dev/null | grep -c "^backend/" || echo "0")
    local FRONTEND_CHANGES=$(git diff --name-only HEAD~20 2>/dev/null | grep -c "^frontend/" || echo "0")
    local ROUTE_CHANGES=$(git diff --name-only HEAD~20 2>/dev/null | grep -c "routes/" || echo "0")
    local SERVICE_CHANGES=$(git diff --name-only HEAD~20 2>/dev/null | grep -c "services/" || echo "0")
    local COMPONENT_CHANGES=$(git diff --name-only HEAD~20 2>/dev/null | grep -c "components/" || echo "0")
    local MIGRATION_CHANGES=$(git diff --name-only HEAD~20 2>/dev/null | grep -c "migrations/" || echo "0")

    echo "Backend:     $BACKEND_CHANGES files" >> "$TEMP_SECTION"
    echo "Frontend:    $FRONTEND_CHANGES files" >> "$TEMP_SECTION"
    echo "Routes:      $ROUTE_CHANGES files" >> "$TEMP_SECTION"
    echo "Services:    $SERVICE_CHANGES files" >> "$TEMP_SECTION"
    echo "Components:  $COMPONENT_CHANGES files" >> "$TEMP_SECTION"
    echo "Migrations:  $MIGRATION_CHANGES files" >> "$TEMP_SECTION"
    echo '```' >> "$TEMP_SECTION"
    echo "" >> "$TEMP_SECTION"

    # Add new files section
    local NEW_FILES=$(git diff --name-only --diff-filter=A HEAD~20 2>/dev/null | head -15)
    if [ -n "$NEW_FILES" ]; then
        echo "### New Files Added (Last 20 Commits)" >> "$TEMP_SECTION"
        echo "" >> "$TEMP_SECTION"
        echo '```' >> "$TEMP_SECTION"
        echo "$NEW_FILES" >> "$TEMP_SECTION"
        echo '```' >> "$TEMP_SECTION"
        echo "" >> "$TEMP_SECTION"
    fi

    echo "---" >> "$TEMP_SECTION"
    echo "" >> "$TEMP_SECTION"

    # Update the Last Updated date
    sed "s/\*\*Last Updated:\*\* .*/\*\*Last Updated:\*\* $TODAY/" "$STATUS_FILE" > "$TEMP_OUTPUT"
    mv "$TEMP_OUTPUT" "$STATUS_FILE"

    # Check if Recent Changes section exists and remove it
    if grep -q "## 📅 Recent Changes" "$STATUS_FILE"; then
        # Remove existing section using sed
        sed '/^## 📅 Recent Changes/,/^## [^📅]/{ /^## [^📅]/!d; }' "$STATUS_FILE" > "$TEMP_OUTPUT"
        mv "$TEMP_OUTPUT" "$STATUS_FILE"
    fi

    # Insert new section after first "---"
    local LINE_NUM=$(grep -n "^---$" "$STATUS_FILE" | head -1 | cut -d: -f1)
    if [ -n "$LINE_NUM" ]; then
        head -n "$LINE_NUM" "$STATUS_FILE" > "$TEMP_OUTPUT"
        echo "" >> "$TEMP_OUTPUT"
        cat "$TEMP_SECTION" >> "$TEMP_OUTPUT"
        tail -n +$((LINE_NUM + 1)) "$STATUS_FILE" >> "$TEMP_OUTPUT"
        mv "$TEMP_OUTPUT" "$STATUS_FILE"
    fi

    rm -f "$TEMP_SECTION" "$TEMP_OUTPUT"
    echo "  ✓ Updated PROJECT_STATUS.md"
}

# =============================================================================
# UPDATE PROJECT_CONTEXT.md
# =============================================================================

update_project_context() {
    local CONTEXT_FILE="PROJECT_CONTEXT.md"
    local TEMP_SECTION="/tmp/key_files_$$.md"
    local TEMP_OUTPUT="/tmp/context_output_$$.md"

    # Generate current file structure
    cat > "$TEMP_SECTION" << 'EOF'
## Key Files (Auto-Updated)

> This section is automatically updated on each commit.

### Backend Routes
```
EOF

    ls -1 backend/routes/*.js 2>/dev/null >> "$TEMP_SECTION" || echo "No routes found" >> "$TEMP_SECTION"

    echo '```' >> "$TEMP_SECTION"
    echo "" >> "$TEMP_SECTION"
    echo "### Backend Services" >> "$TEMP_SECTION"
    echo '```' >> "$TEMP_SECTION"

    ls -1 backend/services/*.js 2>/dev/null >> "$TEMP_SECTION" || echo "No services found" >> "$TEMP_SECTION"

    echo '```' >> "$TEMP_SECTION"
    echo "" >> "$TEMP_SECTION"
    echo "### Backend Controllers" >> "$TEMP_SECTION"
    echo '```' >> "$TEMP_SECTION"

    ls -1 backend/controller/*.js 2>/dev/null >> "$TEMP_SECTION" || echo "No controllers found" >> "$TEMP_SECTION"

    echo '```' >> "$TEMP_SECTION"
    echo "" >> "$TEMP_SECTION"
    echo "### Frontend Pages" >> "$TEMP_SECTION"
    echo '```' >> "$TEMP_SECTION"

    ls -1 frontend/src/pages/*.jsx frontend/src/pages/*.js 2>/dev/null >> "$TEMP_SECTION" || echo "No pages found" >> "$TEMP_SECTION"

    echo '```' >> "$TEMP_SECTION"
    echo "" >> "$TEMP_SECTION"
    echo "### Frontend Components (Top Level)" >> "$TEMP_SECTION"
    echo '```' >> "$TEMP_SECTION"

    ls -d frontend/src/components/*/ 2>/dev/null | xargs -I {} basename {} >> "$TEMP_SECTION" || echo "No components found" >> "$TEMP_SECTION"

    echo '```' >> "$TEMP_SECTION"
    echo "" >> "$TEMP_SECTION"
    echo "### Database Models" >> "$TEMP_SECTION"
    echo '```' >> "$TEMP_SECTION"

    ls -1 backend/models/*.js 2>/dev/null | xargs -I {} basename {} .js >> "$TEMP_SECTION" || echo "No models found" >> "$TEMP_SECTION"

    echo '```' >> "$TEMP_SECTION"
    echo "" >> "$TEMP_SECTION"
    echo "### Recent Migrations" >> "$TEMP_SECTION"
    echo '```' >> "$TEMP_SECTION"

    ls -1t backend/migrations/*.js 2>/dev/null | head -10 >> "$TEMP_SECTION" || echo "No migrations found" >> "$TEMP_SECTION"

    echo '```' >> "$TEMP_SECTION"
    echo "" >> "$TEMP_SECTION"
    echo "---" >> "$TEMP_SECTION"

    # Check if Key Files section exists and remove it
    if grep -q "## Key Files (Auto-Updated)" "$CONTEXT_FILE"; then
        # Remove existing section
        sed '/^## Key Files (Auto-Updated)/,/^## /{ /^## [^K]/!d; }' "$CONTEXT_FILE" > "$TEMP_OUTPUT"
        mv "$TEMP_OUTPUT" "$CONTEXT_FILE"
    fi

    # Append to end of file
    echo "" >> "$CONTEXT_FILE"
    cat "$TEMP_SECTION" >> "$CONTEXT_FILE"

    rm -f "$TEMP_SECTION" "$TEMP_OUTPUT"
    echo "  ✓ Updated PROJECT_CONTEXT.md"
}

# =============================================================================
# MAIN
# =============================================================================

# Only run if we have commits
if git rev-parse HEAD >/dev/null 2>&1; then
    update_project_status
    update_project_context

    # Stage the updated files
    git add PROJECT_STATUS.md PROJECT_CONTEXT.md 2>/dev/null || true

    echo "✅ Project documentation updated"
else
    echo "⚠️ No git history found, skipping documentation update"
fi

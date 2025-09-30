#!/bin/bash
# Sync environment variables from root .env to packages
# Uses comment tags to determine which variables go to which packages

# Get the project root directory (where this script is located)
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ROOT_ENV="$PROJECT_ROOT/.env"

# Package configurations
declare -A PACKAGES=(
    ["app"]="$PROJECT_ROOT/packages/app/.env"
    ["preprocessor"]="$PROJECT_ROOT/packages/preprocessor/.env"
)

# Check if root .env exists
if [ ! -f "$ROOT_ENV" ]; then
    echo "⚠️  Root .env file not found. Please copy .env.example to .env and configure it."
    exit 1
fi

# Function to sync variables for a specific package
sync_package() {
    local package_name="$1"
    local package_env="$2"
    
    echo "🔄 Syncing variables for package: $package_name"
    
    # Create directory if it doesn't exist
    mkdir -p "$(dirname "$package_env")"
    
    # Create header
    echo "# Auto-synced from root .env - DO NOT EDIT DIRECTLY" > "$package_env"
    echo "# Edit the root .env file instead" >> "$package_env"
    echo "# Package: $package_name" >> "$package_env"
    echo "" >> "$package_env"
    
    # Parse root .env and extract variables tagged for this package
    local count=0
    while IFS= read -r line; do
        # Skip empty lines and pure comments (not tagged variables)
        if [[ -z "$line" ]] || [[ "$line" =~ ^[[:space:]]*# ]]; then
            # If it's a comment, only continue if it doesn't contain an assignment
            if [[ "$line" =~ ^[[:space:]]*# ]] && [[ ! "$line" == *"="* ]]; then
                continue
            fi
        fi
        
        # Check if line contains a variable assignment and the package tag
        if [[ "$line" == *"="* ]] && [[ "$line" == *"@$package_name"* ]]; then
            # Verify it starts with a valid variable name pattern
            if echo "$line" | grep -qE "^[[:space:]]*[A-Za-z_][A-Za-z0-9_]*="; then
                # Extract just the variable assignment (remove the comment tag)
                var_assignment=$(echo "$line" | sed 's/[[:space:]]*#[[:space:]]*@.*$//')
                echo "$var_assignment" >> "$package_env"
                ((count++))
            fi
        fi
    done < "$ROOT_ENV"
    
    echo "   ✅ Synced $count variables to $package_name"
}

# Sync all packages
echo "🚀 Starting environment sync..."
for package in "${!PACKAGES[@]}"; do
    sync_package "$package" "${PACKAGES[$package]}"
done

echo ""
echo "✅ Environment variables synced from root to all packages"
echo ""


#!/bin/bash

echo "=== GitHub MCP Server Setup ==="
echo

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "GitHub CLI (gh) is not installed. Installing..."
    case "$OSTYPE" in
        darwin*)  brew install gh ;;
        linux*)   
            curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
            echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
            sudo apt update
            sudo apt install gh
            ;;
        *)        echo "Please install GitHub CLI manually from https://cli.github.com/" ;;
    esac
fi

# Authenticate with GitHub
echo "Authenticating with GitHub..."
gh auth login

# Create a Personal Access Token
echo
echo "Creating a GitHub Personal Access Token for MCP..."
echo "This token needs the following scopes:"
echo "  - repo (Full control of private repositories)"
echo "  - workflow (Update GitHub Action workflows)"
echo "  - read:org (Read org and team membership)"
echo

# Generate token
TOKEN=$(gh auth token)
echo "Your GitHub token has been generated."
echo

# Update the config file
CONFIG_FILE="../config/claude_desktop_config.json"
if [ -f "$CONFIG_FILE" ]; then
    echo "Updating configuration file with GitHub token..."
    # Use jq if available, otherwise use sed
    if command -v jq &> /dev/null; then
        jq --arg token "$TOKEN" '.mcpServers.github.env.GITHUB_PERSONAL_ACCESS_TOKEN = $token' "$CONFIG_FILE" > tmp.json && mv tmp.json "$CONFIG_FILE"
    else
        sed -i.bak "s/<YOUR_GITHUB_TOKEN>/$TOKEN/g" "$CONFIG_FILE"
    fi
    echo "Configuration updated successfully!"
else
    echo "Warning: Configuration file not found at $CONFIG_FILE"
fi

echo
echo "GitHub MCP Server setup complete!"
echo "Remember to restart Claude Desktop for changes to take effect."
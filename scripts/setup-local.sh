#!/bin/bash

set -e

echo "🚀 Setting up Companion Grader Functions locally..."

# Check prerequisites
echo "Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed."
    exit 1
fi

# Check Azure Functions Core Tools
if ! command -v func &> /dev/null; then
    echo "📦 Installing Azure Functions Core Tools..."
    npm install -g azure-functions-core-tools@4 --unsafe-perm true
fi

# Check Azure CLI
if ! command -v az &> /dev/null; then
    echo "❌ Azure CLI is required but not installed."
    echo "Please install it from: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

# Install function dependencies
echo "📦 Installing function dependencies..."
cd functions
npm install

# Copy environment file
if [ ! -f local.settings.json ]; then
    echo "📄 Creating local.settings.json..."
    cp local.settings.example.json local.settings.json
    echo "⚠️  Please update local.settings.json with your values"
fi

# Run tests
echo "🧪 Running tests..."
npm test

echo "✅ Setup complete!"
echo ""
echo "To start the functions locally:"
echo "  cd functions && npm start"
echo ""
echo "Available endpoints:"
echo "  Language Grader: http://localhost:7071/api/languageGrader"
echo "  Code Quality: http://localhost:7071/api/codeQualityGrader"
echo "  Component Grader: http://localhost:7071/api/componentGrader"

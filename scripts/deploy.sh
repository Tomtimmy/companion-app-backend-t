#!/bin/bash

set -e

# Configuration
RESOURCE_GROUP="companion-app-backends-rg"
LOCATION="eastus"
FUNCTION_APP_NAME="companion-app-backends-functions"

echo "🚀 Deploying companion-app-backends Functions to Azure..."

# Login to Azure (if not already logged in)
if ! az account show &> /dev/null; then
    echo "🔐 Please log in to Azure..."
    az login
fi

# Create resource group
echo "📦 Creating resource group..."
az group create --name $RESOURCE_GROUP --location $LOCATION

# Deploy ARM template
echo "🏗️  Deploying infrastructure..."
az deployment group create \
    --resource-group $RESOURCE_GROUP \
    --template-file infrastructure/arm-template.json \
    --parameters infrastructure/parameters.json

# Build and deploy functions
echo "📤 Deploying functions..."
cd functions
npm install --only=production
func azure functionapp publish $FUNCTION_APP_NAME

# Test deployment
echo "🧪 Testing deployment..."
sleep 30

FUNCTION_URL="https://$FUNCTION_APP_NAME.azurewebsites.net"

# Get function key
FUNCTION_KEY=$(az functionapp keys list \
    --name $FUNCTION_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --query "functionKeys.default" \
    --output tsv)

# Test language grader
echo "Testing Language Grader..."
curl -X POST "$FUNCTION_URL/api/languageGrader" \
    -H "Content-Type: application/json" \
    -H "x-functions-key: $FUNCTION_KEY" \
    -d '{"test": true}' \
    -f

echo ""
echo "✅ Deployment complete!"
echo "Function App URL: $FUNCTION_URL"
echo "Remember to add the function key to your GitHub secrets!"
echo "Function Key: $FUNCTION_KEY"

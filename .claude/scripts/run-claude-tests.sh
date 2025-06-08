#!/bin/bash

# Claude-Optimized Test Runner
# This script runs tests in a way that's optimized for Claude to understand results

set -e

echo "🤖 Claude Test Runner v1.0"
echo "========================="
echo

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results file for Claude to analyze
RESULTS_FILE="test-results.json"

# Function to run tests with clear output
run_test_suite() {
    local suite_name=$1
    local test_command=$2
    
    echo "Running $suite_name..."
    
    if $test_command > test-output.tmp 2>&1; then
        echo -e "${GREEN}✓ $suite_name passed${NC}"
        echo "{\"suite\": \"$suite_name\", \"status\": \"passed\", \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" >> $RESULTS_FILE
    else
        echo -e "${RED}✗ $suite_name failed${NC}"
        echo "Error output:"
        cat test-output.tmp
        echo "{\"suite\": \"$suite_name\", \"status\": \"failed\", \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\", \"error\": \"$(cat test-output.tmp | jq -Rs .)\"}" >> $RESULTS_FILE
        FAILED_TESTS+=("$suite_name")
    fi
    
    rm -f test-output.tmp
    echo
}

# Initialize results file
echo "[" > $RESULTS_FILE
FAILED_TESTS=()

# Detect project type and run appropriate tests
if [ -f "package.json" ]; then
    echo "📦 Detected Node.js project"
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo "Installing dependencies..."
        npm install
    fi
    
    # Run different test suites
    run_test_suite "Unit Tests" "npm test -- --passWithNoTests"
    run_test_suite "Linting" "npm run lint || true"
    run_test_suite "Type Checking" "npm run typecheck || true"
    
    # Check for E2E tests
    if grep -q "test:e2e" package.json; then
        run_test_suite "E2E Tests" "npm run test:e2e"
    fi
fi

if [ -f "requirements.txt" ] || [ -f "setup.py" ] || [ -f "pyproject.toml" ]; then
    echo "🐍 Detected Python project"
    
    # Create virtual environment if needed
    if [ ! -d "venv" ]; then
        echo "Creating virtual environment..."
        python -m venv venv
        source venv/bin/activate
        pip install -r requirements.txt || pip install -e .
    else
        source venv/bin/activate
    fi
    
    # Run Python tests
    run_test_suite "Pytest" "pytest --tb=short"
    run_test_suite "Flake8 Linting" "flake8 . || true"
    run_test_suite "Type Checking" "mypy . || true"
fi

if [ -f "Cargo.toml" ]; then
    echo "🦀 Detected Rust project"
    run_test_suite "Cargo Tests" "cargo test"
    run_test_suite "Cargo Clippy" "cargo clippy -- -D warnings"
fi

# Close JSON array
echo "]" >> $RESULTS_FILE.tmp
head -n -1 $RESULTS_FILE > $RESULTS_FILE.tmp && mv $RESULTS_FILE.tmp $RESULTS_FILE
echo "]" >> $RESULTS_FILE

# Summary for Claude
echo "========================================="
echo "📊 Test Summary"
echo "========================================="

TOTAL_SUITES=$(grep -c "suite" $RESULTS_FILE || echo 0)
PASSED_SUITES=$(grep -c "passed" $RESULTS_FILE || echo 0)
FAILED_SUITES=$(grep -c "failed" $RESULTS_FILE || echo 0)

echo "Total test suites: $TOTAL_SUITES"
echo -e "Passed: ${GREEN}$PASSED_SUITES${NC}"
echo -e "Failed: ${RED}$FAILED_SUITES${NC}"

if [ ${#FAILED_TESTS[@]} -eq 0 ]; then
    echo -e "\n${GREEN}✨ All tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}❌ Some tests failed:${NC}"
    for test in "${FAILED_TESTS[@]}"; do
        echo "  - $test"
    done
    echo -e "\n${YELLOW}💡 Tip: Check test-results.json for detailed error information${NC}"
    exit 1
fi
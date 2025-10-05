#!/bin/bash

# Card Redesign Test Runner
# Convenience script for running card redesign visual tests with various options

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_info() {
    echo -e "${BLUE}ℹ ${1}${NC}"
}

print_success() {
    echo -e "${GREEN}✓ ${1}${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ ${1}${NC}"
}

print_error() {
    echo -e "${RED}✗ ${1}${NC}"
}

# Print header
print_header() {
    echo ""
    echo "=========================================="
    echo "  Card Redesign Visual Test Suite"
    echo "=========================================="
    echo ""
}

# Check if dev server is running
check_server() {
    print_info "Checking if dev server is running..."
    if curl -s http://localhost:3005 > /dev/null 2>&1; then
        print_success "Dev server is running"
        return 0
    else
        print_error "Dev server is not running!"
        print_info "Please start the dev server: npm run dev"
        return 1
    fi
}

# Check if Playwright is installed
check_playwright() {
    print_info "Checking Playwright installation..."
    if command -v npx playwright &> /dev/null; then
        print_success "Playwright is installed"
        return 0
    else
        print_error "Playwright is not installed!"
        print_info "Installing Playwright browsers..."
        npm run playwright:install
    fi
}

# Create screenshot directory
setup_directories() {
    print_info "Setting up directories..."
    mkdir -p tests/visual/card-redesign-screenshots
    chmod 755 tests/visual/card-redesign-screenshots
    print_success "Directories ready"
}

# Run tests based on mode
run_tests() {
    local mode=$1
    local filter=$2

    case $mode in
        "all")
            print_info "Running all redesign tests..."
            npx playwright test tests/visual/card-redesign-validation.spec.ts \
                --config playwright.redesign.config.ts \
                --reporter=html
            ;;
        "ui")
            print_info "Running tests in UI mode..."
            npx playwright test tests/visual/card-redesign-validation.spec.ts \
                --config playwright.redesign.config.ts \
                --ui
            ;;
        "debug")
            print_info "Running tests in debug mode..."
            npx playwright test tests/visual/card-redesign-validation.spec.ts \
                --config playwright.redesign.config.ts \
                --debug
            ;;
        "single")
            print_info "Running test: ${filter}..."
            npx playwright test tests/visual/card-redesign-validation.spec.ts \
                --config playwright.redesign.config.ts \
                --reporter=html \
                -g "${filter}"
            ;;
        "browser")
            print_info "Running tests on ${filter} only..."
            npx playwright test tests/visual/card-redesign-validation.spec.ts \
                --config playwright.redesign.config.ts \
                --reporter=html \
                --project="${filter}"
            ;;
        *)
            print_error "Unknown mode: ${mode}"
            return 1
            ;;
    esac
}

# Display results
show_results() {
    echo ""
    print_info "Test Results:"
    echo ""

    if [ -f "playwright-report/redesign/index.html" ]; then
        print_success "HTML Report generated: playwright-report/redesign/index.html"

        # Ask to open report
        read -p "Open HTML report? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            if [[ "$OSTYPE" == "darwin"* ]]; then
                open playwright-report/redesign/index.html
            elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
                xdg-open playwright-report/redesign/index.html
            fi
        fi
    fi

    if [ -f "test-results/redesign-results.json" ]; then
        print_success "JSON Results: test-results/redesign-results.json"
    fi

    if [ -d "tests/visual/card-redesign-screenshots" ]; then
        local screenshot_count=$(ls -1 tests/visual/card-redesign-screenshots/*.png 2>/dev/null | wc -l)
        print_success "Screenshots captured: ${screenshot_count}"
        print_info "Location: tests/visual/card-redesign-screenshots/"
    fi
}

# Show usage
show_usage() {
    echo "Usage: $0 [mode] [options]"
    echo ""
    echo "Modes:"
    echo "  all              Run all tests (default)"
    echo "  ui               Run tests in UI mode"
    echo "  debug            Run tests in debug mode"
    echo "  single <name>    Run single test by name"
    echo "  browser <name>   Run on specific browser (chromium, firefox, webkit)"
    echo ""
    echo "Examples:"
    echo "  $0                                  # Run all tests"
    echo "  $0 ui                               # Run with UI"
    echo "  $0 debug                            # Run in debug mode"
    echo "  $0 single \"Card Dimensions\"        # Run dimension tests only"
    echo "  $0 browser chromium                 # Run on Chromium only"
    echo ""
}

# Main execution
main() {
    print_header

    # Parse arguments
    local mode="${1:-all}"
    local filter="${2:-}"

    # Show help
    if [[ "$mode" == "help" ]] || [[ "$mode" == "-h" ]] || [[ "$mode" == "--help" ]]; then
        show_usage
        exit 0
    fi

    # Pre-flight checks
    check_playwright || exit 1
    check_server || exit 1
    setup_directories

    echo ""
    print_info "Starting test execution..."
    echo ""

    # Run tests
    if run_tests "$mode" "$filter"; then
        echo ""
        print_success "Tests completed successfully!"
        show_results
    else
        echo ""
        print_error "Tests failed!"
        print_info "Check the HTML report for details: playwright-report/redesign/index.html"
        exit 1
    fi
}

# Run main
main "$@"
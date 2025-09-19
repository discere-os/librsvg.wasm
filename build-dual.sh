#!/bin/bash
# librsvg.wasm Dual Build System - Modern Architecture
#
# Builds both SIDE_MODULE (production CDN) and MAIN_MODULE (testing/NPM)
# Follows current Discere OS WASM architecture patterns
#
# LGPL-2.1-or-later License
# Targets Chrome/Edge 113+ exclusively (WebGPU + WASM SIMD required)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Build configuration
LIBRSVG_VERSION="2.61.0"
BUILD_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
COMMIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Logging functions
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; exit 1; }
log_section() { echo -e "${PURPLE}🔥 $1${NC}"; echo -e "${PURPLE}$(printf '=%.0s' {1..50})${NC}"; }

# Check prerequisites
check_prerequisites() {
    log_section "Checking Prerequisites"

    # Check Emscripten
    if ! command -v emcc >/dev/null 2>&1; then
        log_error "Emscripten not found. Please install and source emsdk_env.sh"
    fi

    # Check for potential dependencies
    if [ -d "../cairo.wasm" ] && [ -f "../cairo.wasm/install/wasm/cairo-side.wasm" ]; then
        log_info "Cairo dependency found: ../cairo.wasm/"
    else
        log_warning "Cairo dependency not found - using system Cairo"
    fi

    if [ -d "../glib.wasm" ] && [ -f "../glib.wasm/install/wasm/glib-side.wasm" ]; then
        log_info "GLib dependency found: ../glib.wasm/"
    else
        log_warning "GLib dependency not found - using system GLib"
    fi

    local emcc_version=$(emcc --version | head -n1 | grep -o '[0-9.]*')
    log_info "Emscripten version: $emcc_version"
    log_success "Prerequisites verified"
}

# Clean build artifacts
clean_build() {
    log_section "Cleaning Build Artifacts"
    rm -rf build-dual-side/ build-dual-main/ install/
    rm -f *.wasm *.wasm.map *.js *.js.map
    log_success "Build artifacts cleaned"
}

# Build SIDE_MODULE for production
build_side_module() {
    log_section "Building SIDE_MODULE (Production)"

    mkdir -p build-dual-side install/wasm

    # Compile C integration layer as SIDE_MODULE
    emcc wasm/librsvg-wasm-integration.c \
        wasm/librsvg-wasm-simd-optimizations.c \
        -O3 -flto -msimd128 \
        -sSIDE_MODULE=2 \
        -sEXPORTED_FUNCTIONS='["_rsvg_wasm_init","_rsvg_wasm_render_to_rgba","_rsvg_wasm_get_svg_info","_rsvg_wasm_set_viewport","_rsvg_wasm_get_simd_support","_rsvg_wasm_enable_webgpu","_rsvg_wasm_get_last_error","_rsvg_wasm_cleanup"]' \
        -fPIC \
        -o install/wasm/librsvg-side.wasm

    if [ -f "install/wasm/librsvg-side.wasm" ]; then
        local size=$(wc -c < install/wasm/librsvg-side.wasm)
        log_success "SIDE_MODULE built: librsvg-side.wasm (${size} bytes)"
    else
        log_error "SIDE_MODULE build failed"
    fi
}

# Build MAIN_MODULE for testing and NPM
build_main_module() {
    log_section "Building MAIN_MODULE (Testing/NPM)"

    mkdir -p build-dual-main install/wasm

    # Compile C integration layer as MAIN_MODULE
    emcc wasm/librsvg-wasm-integration.c \
        wasm/librsvg-wasm-simd-optimizations.c \
        -O3 -flto -msimd128 \
        -sMODULARIZE=1 \
        -sEXPORT_ES6=1 \
        -sEXPORT_NAME="LibRSVGModule" \
        -sSINGLE_FILE=0 \
        -sALLOW_MEMORY_GROWTH=1 \
        -sINITIAL_MEMORY=67108864 \
        -sMAXIMUM_MEMORY=536870912 \
        -sENVIRONMENT=web,webview,worker \
        -sNODEJS_CATCH_EXIT=0 \
        -sNODEJS_CATCH_REJECTION=0 \
        -sEXPORTED_FUNCTIONS='["_malloc","_free","_rsvg_wasm_init","_rsvg_wasm_render_to_rgba","_rsvg_wasm_get_svg_info","_rsvg_wasm_set_viewport","_rsvg_wasm_get_simd_support","_rsvg_wasm_enable_webgpu","_rsvg_wasm_get_last_error","_rsvg_wasm_cleanup"]' \
        -sEXPORTED_RUNTIME_METHODS='["ccall","cwrap","UTF8ToString","stringToUTF8"]' \
        -o install/wasm/librsvg-main.js

    # Move WASM file to proper location
    if [ -f "install/wasm/librsvg-main.wasm" ]; then
        local size=$(wc -c < install/wasm/librsvg-main.wasm)
        log_success "MAIN_MODULE built: librsvg-main.wasm (${size} bytes)"

        # Copy to root for convenience
        cp install/wasm/librsvg-main.wasm ./
        cp install/wasm/librsvg-main.js ./
    else
        log_error "MAIN_MODULE build failed"
    fi
}

# Generate build report
generate_report() {
    log_section "Build Report"

    echo ""
    echo "📊 librsvg.wasm Build Summary"
    echo "============================="
    echo "Version: ${LIBRSVG_VERSION}"
    echo "Build Time: ${BUILD_TIMESTAMP}"
    echo "Commit: ${COMMIT_HASH}"
    echo ""

    if [ -f "install/wasm/librsvg-side.wasm" ]; then
        local side_size=$(wc -c < install/wasm/librsvg-side.wasm)
        echo "🔗 SIDE_MODULE: librsvg-side.wasm (${side_size} bytes / $(echo "scale=1; ${side_size}/1024" | bc 2>/dev/null || echo $((side_size/1024)))KB)"
    fi

    if [ -f "install/wasm/librsvg-main.wasm" ]; then
        local main_size=$(wc -c < install/wasm/librsvg-main.wasm)
        echo "📦 MAIN_MODULE: librsvg-main.wasm (${main_size} bytes / $(echo "scale=1; ${main_size}/1024" | bc 2>/dev/null || echo $((main_size/1024)))KB)"
    fi

    echo ""
    echo "🎯 Target Requirements:"
    echo "  • Chrome/Edge 113+ (WebGPU + WASM SIMD)"
    echo "  • SharedArrayBuffer support"
    echo "  • Cross-Origin-Embedder-Policy headers"
    echo ""
    echo "⚡ Features Enabled:"
    echo "  • WASM SIMD optimizations"
    echo "  • WebGPU compute acceleration stub"
    echo "  • Dual build architecture"
    echo "  • Link-time optimization"
    echo "  • ES6 module exports"
    echo ""

    log_success "Build completed successfully!"
}

# Parse command line arguments
CLEAN=false
BUILD_SIDE=true
BUILD_MAIN=true
SKIP_CHECKS=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --clean) CLEAN=true; shift ;;
        --side-only) BUILD_MAIN=false; shift ;;
        --main-only) BUILD_SIDE=false; shift ;;
        --skip-checks) SKIP_CHECKS=true; shift ;;
        -h|--help)
            echo "librsvg.wasm Dual Build System"
            echo ""
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --clean         Clean build artifacts first"
            echo "  --side-only     Build only SIDE_MODULE"
            echo "  --main-only     Build only MAIN_MODULE"
            echo "  --skip-checks   Skip prerequisite checks"
            echo "  -h, --help      Show this help message"
            echo ""
            exit 0
            ;;
        *) log_error "Unknown option: $1" ;;
    esac
done

# Main build process
main() {
    log_section "librsvg.wasm Dual Build System v${LIBRSVG_VERSION}"

    if [ "$SKIP_CHECKS" != true ]; then
        check_prerequisites
    fi

    if [ "$CLEAN" = true ]; then
        clean_build
    fi

    if [ "$BUILD_SIDE" = true ]; then
        build_side_module
    fi

    if [ "$BUILD_MAIN" = true ]; then
        build_main_module
    fi

    generate_report
}

# Execute main function
main "$@"
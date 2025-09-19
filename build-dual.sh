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

# Check prerequisites and build dependencies if needed
check_prerequisites() {
    log_section "Checking Prerequisites"

    # Check Emscripten
    if ! command -v emcc >/dev/null 2>&1; then
        log_error "Emscripten not found. Please install and source emsdk_env.sh"
    fi

    local emcc_version=$(emcc --version | head -n1 | grep -o '[0-9.]*')
    log_info "Emscripten version: $emcc_version"

    # Check and build required dependencies
    check_and_build_dependency "cairo.wasm" "Cairo graphics library"
    check_and_build_dependency "glib.wasm" "GLib utility library"
    check_and_build_dependency "pango.wasm" "Pango text rendering"
    check_and_build_dependency "gdk-pixbuf.wasm" "GdkPixbuf image loading"
    check_and_build_dependency "librsvg" "LibRSVG Rust core" "optional"

    log_success "Prerequisites verified"
}

# Check and build individual dependency
check_and_build_dependency() {
    local dep_name="$1"
    local description="$2"
    local optional="${3:-required}"
    local dep_dir="../${dep_name}"

    if [ -d "$dep_dir" ]; then
        # Check if dependency is built
        if [ -f "${dep_dir}/install/wasm/${dep_name%-*}-side.wasm" ] &&
           [ -f "${dep_dir}/install/lib/lib${dep_name%-*}.a" ]; then
            log_info "${description} found: ${dep_dir}/"
        else
            log_info "Building ${description}..."
            cd "$dep_dir"
            if [ -f "build-dual.sh" ]; then
                ./build-dual.sh --skip-checks || {
                    if [ "$optional" = "required" ]; then
                        log_error "Failed to build required dependency: ${dep_name}"
                    else
                        log_warning "Failed to build optional dependency: ${dep_name}"
                    fi
                }
            else
                log_warning "No build script found for ${dep_name}"
            fi
            cd "$SCRIPT_DIR"
        fi
    else
        if [ "$optional" = "required" ]; then
            log_error "Required dependency not found: ${dep_dir}/"
        else
            log_warning "Optional dependency not found: ${dep_dir}/"
        fi
    fi
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

    # Compile C integration layer as SIDE_MODULE with dynamic loading
    emcc wasm/librsvg-wasm-integration.c \
        wasm/librsvg-wasm-simd-optimizations.c \
        -O3 -flto -msimd128 \
        -DLIBRSVG_SIDE_MODULE=1 \
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

# Build MAIN_MODULE for testing and NPM (with static dependencies)
build_main_module() {
    log_section "Building MAIN_MODULE (Testing/NPM)"

    mkdir -p build-dual-main install/wasm

    # Collect static libraries from our dependency forks
    local static_libs=""
    local include_dirs=""

    # Add dependency static libraries in correct linking order
    for dep in cairo glib gdk-pixbuf pango; do
        local dep_dir="../${dep}.wasm"
        if [ -f "${dep_dir}/install/lib/lib${dep}.a" ]; then
            static_libs="${static_libs} ${dep_dir}/install/lib/lib${dep}.a"
            include_dirs="${include_dirs} -I${dep_dir}/install/include"
            log_info "Static linking: lib${dep}.a"
        else
            log_warning "Static library not found: lib${dep}.a (will use system version)"
        fi
    done

    # Additional system libraries required by Cairo/Pango (commented out for stub testing)
    # local system_libs="-lpixman-1 -lfreetype -lharfbuzz -lfribidi -lxml2 -lz -lm"
    local system_libs=""

    # Compile C integration layer as MAIN_MODULE with static dependencies
    emcc wasm/librsvg-wasm-integration.c \
        wasm/librsvg-wasm-simd-optimizations.c \
        ${static_libs} \
        ${include_dirs} \
        ${system_libs} \
        -O3 -flto -msimd128 \
        -sMODULARIZE=1 \
        -sEXPORT_ES6=1 \
        -sEXPORT_NAME="LibRSVGModule" \
        -sSINGLE_FILE=0 \
        -sALLOW_MEMORY_GROWTH=1 \
        -sINITIAL_MEMORY=134217728 \
        -sMAXIMUM_MEMORY=1073741824 \
        -sENVIRONMENT=web,webview,worker \
        -sNODEJS_CATCH_EXIT=0 \
        -sNODEJS_CATCH_REJECTION=0 \
        -sFORCE_FILESYSTEM=1 \
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
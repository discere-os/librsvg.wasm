#!/bin/bash
# librsvg.wasm Production Build System
# Production build system for SVG rendering compilation
#
# Copyright 2025 Superstruct Ltd, New Zealand
# Licensed under LGPL-2.1-or-later (same as original project)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

# Version and metadata
LIBRSVG_VERSION="2.61.0"
BUILD_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
COMMIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

# Build configuration
TARGETS=("foundation" "ecosystem" "gpu-accelerated")
CONFIGS=("Debug" "Release")
SIMD_VARIANTS=("OFF" "ON")

# Default configuration
DEFAULT_TARGET="foundation"
DEFAULT_CONFIG="Release"
DEFAULT_SIMD="ON"

# Colors and formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_step() {
    echo -e "${PURPLE}🔧 $1${NC}"
}

show_help() {
    cat << EOF
librsvg.wasm Production Build System

USAGE:
    $0 [OPTIONS]

OPTIONS:
    --target TARGET         Build target (foundation, ecosystem, gpu-accelerated)
                           Default: $DEFAULT_TARGET
    --config CONFIG         Build configuration (Debug, Release)
                           Default: $DEFAULT_CONFIG
    --simd SIMD            Enable SIMD optimizations (ON, OFF)
                           Default: $DEFAULT_SIMD
    --all                  Build all targets and configurations
    --clean                Clean build artifacts
    --test                 Run tests after building
    --benchmark            Run benchmarks after building
    --help                 Show this help message

EXAMPLES:
    $0 --target foundation --config Release --simd ON
    $0 --target ecosystem --test
    $0 --all
    $0 --clean

ENVIRONMENT VARIABLES:
    RUST_TARGET           Override Rust target (default: wasm32-unknown-unknown)
    EMSCRIPTEN_VERSION    Emscripten version to use
    ECOSYSTEM_PREFIX      Path to ecosystem shared libraries
    
Build targets:
    foundation           Minimal dependencies, core SVG rendering
    ecosystem           Ecosystem shared libraries integration  
    gpu-accelerated     WebGPU acceleration support
EOF
}

validate_environment() {
    log_step "Validating build environment"
    
    # Check required tools
    local required_tools=("cargo" "rustc" "wasm-bindgen" "wasm-pack")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "Required tool not found: $tool"
            exit 1
        fi
    done
    
    # Verify Rust target is installed
    local rust_target="${RUST_TARGET:-wasm32-unknown-unknown}"
    if ! rustup target list --installed | grep -q "$rust_target"; then
        log_step "Installing Rust target: $rust_target"
        rustup target add "$rust_target"
    fi
    
    # Check Rust version
    local rust_version=$(rustc --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
    log_info "Using Rust version: $rust_version"
    
    # Verify wasm-bindgen version compatibility
    local bindgen_version=$(wasm-bindgen --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
    log_info "Using wasm-bindgen version: $bindgen_version"
    
    log_success "Environment validation complete"
}

setup_build_environment() {
    local target="$1"
    local config="$2"
    local simd="$3"
    
    log_step "Setting up build environment for $target ($config, SIMD: $simd)"
    
    # Setup Rust environment
    export RUST_TARGET="${RUST_TARGET:-wasm32-unknown-unknown}"
    export CARGO_BUILD_TARGET="$RUST_TARGET"
    
    # Base RUSTFLAGS
    export RUSTFLAGS="--cfg=wasm --cfg=librsvg_wasm"
    
    # SIMD configuration
    if [[ "$simd" == "ON" ]]; then
        export RUSTFLAGS="$RUSTFLAGS -C target-feature=+simd128"
        log_info "SIMD optimizations enabled"
    else
        log_info "SIMD optimizations disabled"
    fi
    
    # Configuration-specific flags
    case "$config" in
        "Release")
            export RUSTFLAGS="$RUSTFLAGS -C opt-level=3 -C lto=fat"
            export CARGO_PROFILE="release"
            ;;
        "Debug")
            export RUSTFLAGS="$RUSTFLAGS -C opt-level=1"
            export CARGO_PROFILE="dev"
            ;;
    esac
    
    # Target-specific environment
    case "$target" in
        "ecosystem")
            setup_ecosystem_environment
            ;;
        "gpu-accelerated")
            setup_gpu_environment
            ;;
    esac
    
    log_success "Build environment configured"
}

setup_ecosystem_environment() {
    log_step "Configuring ecosystem shared library environment"
    
    local ecosystem_prefix="${ECOSYSTEM_PREFIX:-../}"
    
    # Setup PKG_CONFIG_PATH for ecosystem libraries
    local pkg_config_paths=(
        "$ecosystem_prefix/cairo.wasm/dist/lib/pkgconfig"
        "$ecosystem_prefix/pango.wasm/dist/lib/pkgconfig"
        "$ecosystem_prefix/harfbuzz.wasm/dist/lib/pkgconfig"
        "$ecosystem_prefix/fontconfig.wasm/dist/lib/pkgconfig"
        "$ecosystem_prefix/freetype.wasm/dist/lib/pkgconfig"
        "$ecosystem_prefix/libxml2.wasm/dist/lib/pkgconfig"
        "$ecosystem_prefix/libpng.wasm/dist/lib/pkgconfig"
        "$ecosystem_prefix/libjpeg-turbo.wasm/dist/lib/pkgconfig"
        "$ecosystem_prefix/libwebp.wasm/dist/lib/pkgconfig"
    )
    
    export PKG_CONFIG_PATH=""
    for path in "${pkg_config_paths[@]}"; do
        if [[ -d "$path" ]]; then
            export PKG_CONFIG_PATH="$path:$PKG_CONFIG_PATH"
            log_info "Added to PKG_CONFIG_PATH: $path"
        else
            log_warning "Ecosystem library path not found: $path"
        fi
    done
    
    # Remove trailing colon
    export PKG_CONFIG_PATH="${PKG_CONFIG_PATH%:}"
    
    if [[ -n "$PKG_CONFIG_PATH" ]]; then
        log_success "Ecosystem PKG_CONFIG_PATH configured"
    else
        log_warning "No ecosystem libraries found, building with bundled dependencies"
    fi
}

setup_gpu_environment() {
    log_step "Configuring GPU acceleration environment"
    
    export RUSTFLAGS="$RUSTFLAGS --cfg=webgpu_acceleration"
    
    # Check WebGPU feature availability
    if cargo metadata --format-version 1 | jq -r '.packages[] | select(.name=="librsvg") | .features | keys[]' | grep -q "webgpu"; then
        log_success "WebGPU features detected"
    else
        log_warning "WebGPU features not available, building without GPU acceleration"
    fi
}

build_foundation_target() {
    local config="$1"
    
    log_step "Building foundation target with minimal dependencies"
    
    # Core SVG rendering only - minimal feature set
    local features="cairo-backend"
    
    log_info "Building with features: $features"
    
    cargo build \
        --target "$RUST_TARGET" \
        --profile "$CARGO_PROFILE" \
        --no-default-features \
        --features "$features" \
        --package librsvg
        
    # Generate WASM bindings
    generate_wasm_bindings "foundation" "$config"
    
    log_success "Foundation target build complete"
}

build_ecosystem_target() {
    local config="$1"
    
    log_step "Building ecosystem target with shared libraries"
    
    # Full feature build optimized for ecosystem integration
    local features="avif,test-utils,ecosystem-deps"
    
    # Add conditional features based on available ecosystem libs
    if [[ -n "${PKG_CONFIG_PATH:-}" ]]; then
        if pkg-config --exists cairo; then
            features="$features,shared-cairo"
            log_info "Using shared cairo.wasm"
        fi
        
        if pkg-config --exists pango; then
            features="$features,shared-pango,full-text-support"
            log_info "Using shared pango.wasm"
        fi
        
        if pkg-config --exists harfbuzz; then
            features="$features,shared-harfbuzz"
            log_info "Using shared harfbuzz.wasm"
        fi
    fi
    
    log_info "Building with features: $features"
    
    cargo build \
        --target "$RUST_TARGET" \
        --profile "$CARGO_PROFILE" \
        --features "$features" \
        --package librsvg
        
    generate_wasm_bindings "ecosystem" "$config"
    
    log_success "Ecosystem target build complete"
}

build_gpu_target() {
    local config="$1"
    
    log_step "Building GPU-accelerated target"
    
    # GPU acceleration with full features
    local features="avif,test-utils,full-text-support,webgpu,simd-optimizations"
    
    log_info "Building with features: $features"
    
    cargo build \
        --target "$RUST_TARGET" \
        --profile "$CARGO_PROFILE" \
        --features "$features" \
        --package librsvg
        
    generate_wasm_bindings "gpu-accelerated" "$config"
    
    log_success "GPU-accelerated target build complete"
}

generate_wasm_bindings() {
    local target="$1"
    local config="$2"
    
    log_step "Generating WASM bindings for $target target"
    
    local wasm_file="target/$RUST_TARGET/$CARGO_PROFILE/librsvg.wasm"
    local output_dir="dist/$target"
    
    # Create output directory
    mkdir -p "$output_dir"
    
    # Generate TypeScript bindings
    wasm-bindgen \
        --target web \
        --typescript \
        --omit-imports \
        --out-dir "$output_dir" \
        --out-name "librsvg-$target" \
        "$wasm_file"
        
    # Optimize WASM file
    if command -v wasm-opt &> /dev/null; then
        log_step "Optimizing WASM binary with wasm-opt"
        
        local opt_level
        case "$config" in
            "Release")
                opt_level="-O3"
                ;;
            "Debug")
                opt_level="-O1"
                ;;
        esac
        
        wasm-opt "$opt_level" \
            --enable-simd \
            --enable-bulk-memory \
            "$output_dir/librsvg-${target}.wasm" \
            -o "$output_dir/librsvg-${target}.wasm"
            
        log_success "WASM binary optimized"
    fi
    
    # Generate package manifest
    generate_package_manifest "$target" "$config" "$output_dir"
    
    # Calculate and log file sizes
    log_file_sizes "$output_dir" "$target"
    
    log_success "WASM bindings generated for $target target"
}

generate_package_manifest() {
    local target="$1"
    local config="$2"
    local output_dir="$3"
    
    log_step "Generating package manifest"
    
    cat > "$output_dir/package.json" << EOF
{
  "name": "@superstruct/librsvg-$target",
  "version": "$LIBRSVG_VERSION",
  "description": "librsvg.wasm - SVG rendering library ($target build)",
  "main": "librsvg-$target.js",
  "types": "librsvg-$target.d.ts",
  "files": [
    "librsvg-$target.js",
    "librsvg-$target.d.ts",
    "librsvg-$target.wasm"
  ],
  "keywords": ["svg", "graphics", "wasm", "rendering", "vector"],
  "author": "superstruct",
  "license": "LGPL-2.1-or-later",
  "repository": {
    "type": "git",
    "url": "https://github.com/superstruct/librsvg.wasm"
  },
  "build": {
    "target": "$target",
    "config": "$config", 
    "simd": "${DEFAULT_SIMD}",
    "timestamp": "$BUILD_TIMESTAMP",
    "commit": "$COMMIT_HASH"
  }
}
EOF

    log_success "Package manifest generated"
}

log_file_sizes() {
    local output_dir="$1"
    local target="$2"
    
    log_step "Build artifact sizes:"
    
    if [[ -f "$output_dir/librsvg-$target.wasm" ]]; then
        local wasm_size=$(stat -f%z "$output_dir/librsvg-$target.wasm" 2>/dev/null || stat -c%s "$output_dir/librsvg-$target.wasm" 2>/dev/null || echo "unknown")
        local wasm_size_kb=$((wasm_size / 1024))
        log_info "  WASM: ${wasm_size_kb}KB"
    fi
    
    if [[ -f "$output_dir/librsvg-$target.js" ]]; then
        local js_size=$(stat -f%z "$output_dir/librsvg-$target.js" 2>/dev/null || stat -c%s "$output_dir/librsvg-$target.js" 2>/dev/null || echo "unknown")
        local js_size_kb=$((js_size / 1024))
        log_info "  JS:   ${js_size_kb}KB"
    fi
}

build_librsvg_wasm() {
    local target="$1"
    local config="$2"
    local simd="$3"
    
    log_info "🏗️ Building librsvg.wasm target: $target (${config}, SIMD: $simd)"
    
    # Setup build environment
    setup_build_environment "$target" "$config" "$simd"
    
    # Build specific target
    case "$target" in
        "foundation")
            build_foundation_target "$config"
            ;;
        "ecosystem")
            build_ecosystem_target "$config"
            ;;
        "gpu-accelerated")
            build_gpu_target "$config"
            ;;
        *)
            log_error "Unknown target: $target"
            exit 1
            ;;
    esac
    
    log_success "Build completed successfully: $target ($config, SIMD: $simd)"
}

run_tests() {
    local target="$1"
    local config="$2"
    
    log_step "Running tests for $target target"
    
    # Run Rust tests
    cargo test \
        --target "$RUST_TARGET" \
        --profile "$CARGO_PROFILE" \
        --package librsvg
        
    # Run WASM-specific tests if available
    if [[ -f "test/librsvg-wasm-tests.mjs" ]]; then
        node test/librsvg-wasm-tests.mjs --target "$target" --config "$config"
    fi
    
    log_success "Tests completed for $target target"
}

run_benchmarks() {
    local target="$1"
    local config="$2"
    
    log_step "Running benchmarks for $target target"
    
    # Run Rust benchmarks
    cargo bench \
        --target "$RUST_TARGET" \
        --package librsvg
        
    # Run WASM-specific benchmarks if available
    if [[ -f "benchmark/librsvg-wasm-benchmark.mjs" ]]; then
        node benchmark/librsvg-wasm-benchmark.mjs --target "$target" --config "$config"
    fi
    
    log_success "Benchmarks completed for $target target"
}

clean_build_artifacts() {
    log_step "Cleaning build artifacts"
    
    # Clean Cargo artifacts
    cargo clean
    
    # Clean WASM output directories
    rm -rf dist/
    rm -rf target/
    
    # Clean temporary files
    find . -name "*.tmp" -delete
    find . -name ".DS_Store" -delete
    
    log_success "Build artifacts cleaned"
}

build_all_targets() {
    log_step "Building all targets and configurations"
    
    local build_count=0
    local total_builds=$((${#TARGETS[@]} * ${#CONFIGS[@]} * ${#SIMD_VARIANTS[@]}))
    
    for target in "${TARGETS[@]}"; do
        for config in "${CONFIGS[@]}"; do
            for simd in "${SIMD_VARIANTS[@]}"; do
                # Skip certain combinations
                if [[ "$target" == "foundation" && "$config" == "Debug" ]]; then
                    continue
                fi
                if [[ "$target" == "gpu-accelerated" && "$simd" == "OFF" ]]; then
                    continue
                fi
                
                build_count=$((build_count + 1))
                log_info "Building $build_count/$total_builds: $target ($config, SIMD: $simd)"
                
                build_librsvg_wasm "$target" "$config" "$simd"
            done
        done
    done
    
    log_success "All targets built successfully"
}

main() {
    local target="$DEFAULT_TARGET"
    local config="$DEFAULT_CONFIG"
    local simd="$DEFAULT_SIMD"
    local run_all=false
    local run_clean=false
    local run_tests=false
    local run_benchmarks=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --target)
                target="$2"
                shift 2
                ;;
            --config)
                config="$2"
                shift 2
                ;;
            --simd)
                simd="$2"
                shift 2
                ;;
            --all)
                run_all=true
                shift
                ;;
            --clean)
                run_clean=true
                shift
                ;;
            --test)
                run_tests=true
                shift
                ;;
            --benchmark)
                run_benchmarks=true
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Validate arguments
    if [[ ! " ${TARGETS[@]} " =~ " ${target} " ]]; then
        log_error "Invalid target: $target. Valid targets: ${TARGETS[*]}"
        exit 1
    fi
    
    if [[ ! " ${CONFIGS[@]} " =~ " ${config} " ]]; then
        log_error "Invalid config: $config. Valid configs: ${CONFIGS[*]}"
        exit 1
    fi
    
    if [[ ! " ${SIMD_VARIANTS[@]} " =~ " ${simd} " ]]; then
        log_error "Invalid SIMD setting: $simd. Valid settings: ${SIMD_VARIANTS[*]}"
        exit 1
    fi
    
    # Execute requested actions
    if [[ "$run_clean" == true ]]; then
        clean_build_artifacts
        exit 0
    fi
    
    # Validate environment
    validate_environment
    
    # Build targets
    if [[ "$run_all" == true ]]; then
        build_all_targets
    else
        build_librsvg_wasm "$target" "$config" "$simd"
    fi
    
    # Run tests if requested
    if [[ "$run_tests" == true ]]; then
        run_tests "$target" "$config"
    fi
    
    # Run benchmarks if requested
    if [[ "$run_benchmarks" == true ]]; then
        run_benchmarks "$target" "$config"
    fi
    
    log_success "librsvg.wasm build system completed successfully!"
}

# Run main function with all arguments
main "$@"
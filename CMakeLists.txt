# Simplified CMakeLists.txt for testing the build system
# This version focuses on the WASM integration layer without full Rust librsvg

cmake_minimum_required(VERSION 3.22)
project(LibRSVG_WASM_Test VERSION 2.61.0)

# Include the main WASM configuration
include(CMakeLists.wasm.txt)

# Override the Rust build dependency for testing
# Remove the Rust library dependency temporarily
set(LIBRSVG_SOURCES
    wasm/librsvg-wasm-integration.c
)

# Remove Rust-specific build steps for testing
# We'll re-add this when the Rust core is properly integrated

# The rest of the configuration comes from CMakeLists.wasm.txt
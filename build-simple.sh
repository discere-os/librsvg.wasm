#!/bin/bash
# Simple librsvg.wasm build for testing
# Direct Emscripten compilation without complex CMake setup

set -euo pipefail

echo "🔥 Testing librsvg.wasm Build System"
echo "===================================="

# Build with emcc directly
emcc wasm/librsvg-wasm-integration.c wasm/librsvg-wasm-simd-optimizations.c \
    -o librsvg-main.js \
    -O3 \
    -s WASM=1 \
    -s MODULARIZE=1 \
    -s EXPORT_ES6=1 \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s INITIAL_MEMORY=134217728 \
    -s MAXIMUM_MEMORY=2147483648 \
    -s EXPORTED_FUNCTIONS='["_malloc","_free","_webp_wasm_init","_rsvg_wasm_render_to_rgba","_rsvg_wasm_get_svg_info","_rsvg_wasm_get_simd_support","_rsvg_wasm_get_last_error","_rsvg_wasm_cleanup"]' \
    -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap","UTF8ToString","stringToUTF8"]' \
    -s MAIN_MODULE=1 \
    -s EXPORT_ALL=1 \
    -s INVOKE_RUN=0 \
    -s EXIT_RUNTIME=0

if [ -f "librsvg-main.js" ] && [ -f "librsvg-main.wasm" ]; then
    echo "✅ Build successful!"
    echo "📦 Files created:"
    ls -lh librsvg-main.*
    echo ""
    echo "📊 WASM size: $(wc -c < librsvg-main.wasm) bytes"
else
    echo "❌ Build failed!"
    exit 1
fi
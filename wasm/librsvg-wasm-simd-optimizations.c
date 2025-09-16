/**
 * librsvg.wasm SIMD Optimizations
 *
 * WASM SIMD acceleration for SVG processing operations
 * Targets Chrome 91+ with WASM SIMD support
 *
 * Copyright (C) 2025 Superstruct Ltd, New Zealand
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301  USA
 */

#include <emscripten.h>
#include <stdint.h>

#ifdef LIBRSVG_SIMD_ENABLED
#include <wasm_simd128.h>

EMSCRIPTEN_KEEPALIVE
void rsvg_simd_premultiply_alpha(uint8_t* pixels, int width, int height) {
    // SIMD-accelerated alpha premultiplication for SVG rendering
    // Stub implementation - proper SIMD code will be added later
    (void)pixels; (void)width; (void)height;
}

EMSCRIPTEN_KEEPALIVE
void rsvg_simd_apply_color_matrix(uint8_t* pixels, int width, int height, float* matrix) {
    // SIMD-accelerated color matrix operations
    // Stub implementation - proper SIMD code will be added later
    (void)pixels; (void)width; (void)height; (void)matrix;
}

#else

// Non-SIMD fallback implementations
EMSCRIPTEN_KEEPALIVE
void rsvg_simd_premultiply_alpha(uint8_t* pixels, int width, int height) {
    (void)pixels; (void)width; (void)height;
}

EMSCRIPTEN_KEEPALIVE
void rsvg_simd_apply_color_matrix(uint8_t* pixels, int width, int height, float* matrix) {
    (void)pixels; (void)width; (void)height; (void)matrix;
}

#endif
/**
 * librsvg.wasm Integration Layer
 *
 * Minimal C bridge between TypeScript and Rust librsvg core
 * All SVG processing logic implemented in Rust - C provides only WASM bindings
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
#include <emscripten/html5.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>

// Global state for testing
static int g_simd_enabled = 0;
static int g_webgpu_enabled = 0;
static char g_last_error[256] = "No error";

// Test/stub implementations for build validation

EMSCRIPTEN_KEEPALIVE
void* rsvg_wasm_render_to_rgba(const char* svg_data, int svg_len, int* width, int* height) {
    // Stub implementation - just allocate test RGBA data
    if (!svg_data || svg_len <= 0) {
        strncpy(g_last_error, "Invalid SVG data", sizeof(g_last_error) - 1);
        return NULL;
    }

    // For testing: create a simple 100x100 red rectangle
    int test_width = 100;
    int test_height = 100;
    int pixel_count = test_width * test_height;

    uint8_t* rgba_data = (uint8_t*)malloc(pixel_count * 4);
    if (!rgba_data) {
        strncpy(g_last_error, "Memory allocation failed", sizeof(g_last_error) - 1);
        return NULL;
    }

    // Fill with red color for testing
    for (int i = 0; i < pixel_count; i++) {
        rgba_data[i * 4 + 0] = 255; // R
        rgba_data[i * 4 + 1] = 0;   // G
        rgba_data[i * 4 + 2] = 0;   // B
        rgba_data[i * 4 + 3] = 255; // A
    }

    if (width) *width = test_width;
    if (height) *height = test_height;

    return rgba_data;
}

EMSCRIPTEN_KEEPALIVE
int rsvg_wasm_get_svg_info(const char* svg_data, int svg_len, int* width, int* height) {
    if (!svg_data || svg_len <= 0) {
        strncpy(g_last_error, "Invalid SVG data for info", sizeof(g_last_error) - 1);
        return 0;
    }

    // For testing: return fixed dimensions
    if (width) *width = 200;
    if (height) *height = 150;

    return 1; // Success
}

EMSCRIPTEN_KEEPALIVE
void rsvg_wasm_set_viewport(int width, int height) {
    // Stub implementation - just log the viewport
    printf("Setting viewport: %dx%d\n", width, height);
}

EMSCRIPTEN_KEEPALIVE
int rsvg_wasm_get_simd_support(void) {
    // Check if SIMD is enabled at compile time
    #ifdef __wasm_simd128__
    return 1;
    #else
    return 0;
    #endif
}

EMSCRIPTEN_KEEPALIVE
void rsvg_wasm_enable_webgpu(int enable) {
    g_webgpu_enabled = enable ? 1 : 0;
    printf("WebGPU %s\n", g_webgpu_enabled ? "enabled" : "disabled");
}

EMSCRIPTEN_KEEPALIVE
const char* rsvg_wasm_get_last_error(void) {
    return g_last_error;
}

EMSCRIPTEN_KEEPALIVE
void rsvg_wasm_cleanup(void) {
    printf("Cleaning up librsvg.wasm resources\n");
    // Reset global state
    g_simd_enabled = 0;
    g_webgpu_enabled = 0;
    strncpy(g_last_error, "No error", sizeof(g_last_error) - 1);
}

// Initialize WASM module - required for TypeScript integration
EMSCRIPTEN_KEEPALIVE
int rsvg_wasm_init(void) {
    printf("Initializing librsvg.wasm (stub implementation)\n");

    // Check SIMD support
    g_simd_enabled = rsvg_wasm_get_simd_support();
    printf("SIMD support: %s\n", g_simd_enabled ? "enabled" : "disabled");

    return 0; // Success
}

// Stub implementations for core librsvg functions (until Rust integration is complete)
EMSCRIPTEN_KEEPALIVE
void* rsvg_handle_new(void) {
    return malloc(32); // Dummy handle for testing
}

EMSCRIPTEN_KEEPALIVE
void* rsvg_handle_new_from_data(const char* data, size_t data_len, void** error) {
    if (!data || data_len == 0) {
        if (error) *error = (void*)1; // Error indicator
        return NULL;
    }
    return malloc(32); // Dummy handle
}

EMSCRIPTEN_KEEPALIVE
void rsvg_handle_set_dpi(void* handle, double dpi) {
    printf("Setting DPI: %.2f\n", dpi);
}

EMSCRIPTEN_KEEPALIVE
int rsvg_handle_get_dimensions(void* handle, void* dimensions) {
    // Stub implementation - return test dimensions
    if (!handle || !dimensions) return 0;

    // Assume dimensions is a struct with width/height as first two ints
    int* dims = (int*)dimensions;
    dims[0] = 300; // width
    dims[1] = 200; // height

    return 1;
}

EMSCRIPTEN_KEEPALIVE
int rsvg_handle_render_cairo(void* handle, void* cr) {
    printf("Rendering with Cairo (stub)\n");
    return handle && cr ? 1 : 0;
}

EMSCRIPTEN_KEEPALIVE
void rsvg_handle_close(void* handle, void** error) {
    if (handle) {
        free(handle);
    }
}

// Cairo stub functions for testing
EMSCRIPTEN_KEEPALIVE
void* cairo_image_surface_create(int format, int width, int height) {
    printf("Creating Cairo surface: %dx%d\n", width, height);
    return malloc(width * height * 4); // RGBA surface
}

EMSCRIPTEN_KEEPALIVE
void* cairo_image_surface_get_data(void* surface) {
    return surface; // Surface data is the surface itself in our stub
}

EMSCRIPTEN_KEEPALIVE
int cairo_image_surface_get_width(void* surface) {
    return 100; // Test width
}

EMSCRIPTEN_KEEPALIVE
int cairo_image_surface_get_height(void* surface) {
    return 100; // Test height
}

EMSCRIPTEN_KEEPALIVE
int cairo_image_surface_get_stride(void* surface) {
    return 100 * 4; // width * 4 bytes per pixel
}

EMSCRIPTEN_KEEPALIVE
void* cairo_create(void* surface) {
    return malloc(64); // Dummy Cairo context
}

EMSCRIPTEN_KEEPALIVE
void cairo_destroy(void* cr) {
    if (cr) free(cr);
}

EMSCRIPTEN_KEEPALIVE
void cairo_surface_destroy(void* surface) {
    if (surface) free(surface);
}
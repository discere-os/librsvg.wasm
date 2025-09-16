/**
 * librsvg.wasm WebGPU Compute Shaders
 * GPU-accelerated SVG rendering operations using WebGPU compute shaders
 * 
 * WASM Integration Copyright (c) 2025 Superstruct Ltd, New Zealand
 * Licensed under the same license as the underlying librsvg project (LGPL 2.1)
 */

// ============================================================================
// Path Tessellation and Processing
// ============================================================================

struct BezierCurve {
    control_points: array<vec2f, 4>,
    line_width: f32,
    color: vec4f,
}

struct TessellationParams {
    tolerance: f32,
    max_subdivisions: u32,
    curve_count: u32,
    output_offset: u32,
}

@group(0) @binding(0) var<storage, read> bezier_curves: array<BezierCurve>;
@group(0) @binding(1) var<uniform> params: TessellationParams;
@group(0) @binding(2) var<storage, read_write> vertex_output: array<vec2f>;
@group(0) @binding(3) var<storage, read_write> index_output: array<u32>;

// Compute Bézier curve tessellation in parallel
@compute @workgroup_size(64)
fn tessellate_bezier_curves(@builtin(global_invocation_id) id: vec3u) {
    let curve_index = id.x;
    
    if (curve_index >= params.curve_count) {
        return;
    }
    
    let curve = bezier_curves[curve_index];
    
    // Adaptive tessellation based on curvature
    let curvature = estimate_curvature(curve.control_points);
    let subdivision_level = min(
        u32(curvature / params.tolerance),
        params.max_subdivisions
    );
    
    let segments = 1u << subdivision_level; // 2^subdivision_level
    let vertex_base = curve_index * (segments + 1u) * 2u; // Each segment needs 2 vertices for stroke
    
    // Generate tessellated points
    for (var i = 0u; i <= segments; i++) {
        let t = f32(i) / f32(segments);
        
        // Evaluate Bézier curve at parameter t
        let point = evaluate_bezier_cubic(curve.control_points, t);
        
        // Calculate tangent for stroke width
        let tangent = evaluate_bezier_tangent(curve.control_points, t);
        let normal = normalize(vec2f(-tangent.y, tangent.x));
        
        // Generate stroke vertices (both sides of the path)
        let half_width = curve.line_width * 0.5;
        vertex_output[vertex_base + i * 2u] = point + normal * half_width;
        vertex_output[vertex_base + i * 2u + 1u] = point - normal * half_width;
    }
    
    // Generate triangle indices for stroke
    let index_base = curve_index * segments * 6u; // 2 triangles per segment = 6 indices
    
    for (var i = 0u; i < segments; i++) {
        let v0 = vertex_base + i * 2u;
        let v1 = v0 + 1u;
        let v2 = v0 + 2u;
        let v3 = v0 + 3u;
        
        // First triangle
        index_output[index_base + i * 6u] = v0;
        index_output[index_base + i * 6u + 1u] = v1;
        index_output[index_base + i * 6u + 2u] = v2;
        
        // Second triangle
        index_output[index_base + i * 6u + 3u] = v1;
        index_output[index_base + i * 6u + 4u] = v2;
        index_output[index_base + i * 6u + 5u] = v3;
    }
}

fn evaluate_bezier_cubic(control_points: array<vec2f, 4>, t: f32) -> vec2f {
    let omt = 1.0 - t;
    let omt2 = omt * omt;
    let omt3 = omt2 * omt;
    let t2 = t * t;
    let t3 = t2 * t;
    
    return control_points[0] * omt3 +
           control_points[1] * 3.0 * omt2 * t +
           control_points[2] * 3.0 * omt * t2 +
           control_points[3] * t3;
}

fn evaluate_bezier_tangent(control_points: array<vec2f, 4>, t: f32) -> vec2f {
    let omt = 1.0 - t;
    let omt2 = omt * omt;
    let t2 = t * t;
    
    return (control_points[1] - control_points[0]) * 3.0 * omt2 +
           (control_points[2] - control_points[1]) * 6.0 * omt * t +
           (control_points[3] - control_points[2]) * 3.0 * t2;
}

fn estimate_curvature(control_points: array<vec2f, 4>) -> f32 {
    // Simplified curvature estimation for adaptive tessellation
    let d1 = distance(control_points[1], control_points[0]);
    let d2 = distance(control_points[2], control_points[1]);
    let d3 = distance(control_points[3], control_points[2]);
    let total_length = d1 + d2 + d3;
    let chord_length = distance(control_points[3], control_points[0]);
    
    // Higher ratio indicates more curvature
    return total_length / max(chord_length, 1e-6);
}

// ============================================================================
// Gradient and Pattern Computation
// ============================================================================

struct GradientStop {
    position: f32,
    color: vec4f,
}

struct LinearGradientParams {
    start_point: vec2f,
    end_point: vec2f,
    stop_count: u32,
    transform_matrix: mat3x3f,
}

struct RadialGradientParams {
    center: vec2f,
    radius: f32,
    focal_point: vec2f,
    stop_count: u32,
    transform_matrix: mat3x3f,
}

@group(1) @binding(0) var<uniform> linear_gradient: LinearGradientParams;
@group(1) @binding(1) var<uniform> radial_gradient: RadialGradientParams;
@group(1) @binding(2) var<storage, read> gradient_stops: array<GradientStop>;
@group(1) @binding(3) var<storage, read_write> gradient_output: array<vec4f>;

// Compute linear gradient colors for a grid of positions
@compute @workgroup_size(16, 16)
fn compute_linear_gradient(@builtin(global_invocation_id) id: vec3u) {
    let coord = vec2f(f32(id.x), f32(id.y));
    let output_index = id.y * 1024u + id.x; // Assuming 1024x1024 output texture
    
    if (id.x >= 1024u || id.y >= 1024u) {
        return;
    }
    
    // Apply transformation matrix to coordinate
    let transformed_coord = (linear_gradient.transform_matrix * vec3f(coord, 1.0)).xy;
    
    // Calculate position along gradient line
    let gradient_vec = linear_gradient.end_point - linear_gradient.start_point;
    let to_point = transformed_coord - linear_gradient.start_point;
    
    let gradient_length_sq = dot(gradient_vec, gradient_vec);
    let position = dot(to_point, gradient_vec) / gradient_length_sq;
    
    // Clamp position to [0, 1] range
    let clamped_position = clamp(position, 0.0, 1.0);
    
    // Interpolate color from gradient stops
    gradient_output[output_index] = interpolate_gradient_color(clamped_position);
}

// Compute radial gradient colors for a grid of positions
@compute @workgroup_size(16, 16)
fn compute_radial_gradient(@builtin(global_invocation_id) id: vec3u) {
    let coord = vec2f(f32(id.x), f32(id.y));
    let output_index = id.y * 1024u + id.x;
    
    if (id.x >= 1024u || id.y >= 1024u) {
        return;
    }
    
    // Apply transformation matrix to coordinate
    let transformed_coord = (radial_gradient.transform_matrix * vec3f(coord, 1.0)).xy;
    
    // Calculate distance from center
    let to_point = transformed_coord - radial_gradient.center;
    let distance_from_center = length(to_point);
    
    // Calculate position along radius (0.0 at center, 1.0 at edge)
    let position = distance_from_center / radial_gradient.radius;
    let clamped_position = clamp(position, 0.0, 1.0);
    
    // Interpolate color from gradient stops
    gradient_output[output_index] = interpolate_gradient_color(clamped_position);
}

fn interpolate_gradient_color(position: f32) -> vec4f {
    // Find the appropriate gradient segment
    var lower_index = 0u;
    var upper_index = 0u;
    
    for (var i = 0u; i < linear_gradient.stop_count - 1u; i++) {
        if (position >= gradient_stops[i].position && position <= gradient_stops[i + 1u].position) {
            lower_index = i;
            upper_index = i + 1u;
            break;
        }
    }
    
    // Handle edge cases
    if (position <= gradient_stops[0].position) {
        return gradient_stops[0].color;
    }
    if (position >= gradient_stops[linear_gradient.stop_count - 1u].position) {
        return gradient_stops[linear_gradient.stop_count - 1u].color;
    }
    
    // Interpolate between the two stops
    let lower_stop = gradient_stops[lower_index];
    let upper_stop = gradient_stops[upper_index];
    
    let segment_length = upper_stop.position - lower_stop.position;
    let local_position = (position - lower_stop.position) / segment_length;
    
    return mix(lower_stop.color, upper_stop.color, local_position);
}

// ============================================================================
// Filter Effects (Blur, Drop Shadow, etc.)
// ============================================================================

struct BlurParams {
    radius: f32,
    sigma: f32,
    kernel_size: u32,
    image_width: u32,
    image_height: u32,
}

@group(2) @binding(0) var input_texture: texture_2d<f32>;
@group(2) @binding(1) var<storage, read_write> output_image: array<vec4f>;
@group(2) @binding(2) var<uniform> blur_params: BlurParams;

// Gaussian blur implementation using separable filter
@compute @workgroup_size(16, 16)
fn gaussian_blur_horizontal(@builtin(global_invocation_id) id: vec3u) {
    let coord = vec2i(i32(id.x), i32(id.y));
    
    if (id.x >= blur_params.image_width || id.y >= blur_params.image_height) {
        return;
    }
    
    var color_sum = vec4f(0.0);
    var weight_sum = 0.0;
    
    // Apply horizontal blur kernel
    for (var offset = -i32(blur_params.kernel_size); offset <= i32(blur_params.kernel_size); offset++) {
        let sample_x = clamp(coord.x + offset, 0, i32(blur_params.image_width) - 1);
        let sample_coord = vec2i(sample_x, coord.y);
        
        let sample_color = textureLoad(input_texture, sample_coord, 0);
        let weight = gaussian_weight(f32(offset), blur_params.sigma);
        
        color_sum += sample_color * weight;
        weight_sum += weight;
    }
    
    let output_index = id.y * blur_params.image_width + id.x;
    output_image[output_index] = color_sum / weight_sum;
}

@compute @workgroup_size(16, 16)
fn gaussian_blur_vertical(@builtin(global_invocation_id) id: vec3u) {
    let coord = vec2i(i32(id.x), i32(id.y));
    
    if (id.x >= blur_params.image_width || id.y >= blur_params.image_height) {
        return;
    }
    
    var color_sum = vec4f(0.0);
    var weight_sum = 0.0;
    
    // Apply vertical blur kernel (reading from the horizontally blurred data)
    for (var offset = -i32(blur_params.kernel_size); offset <= i32(blur_params.kernel_size); offset++) {
        let sample_y = clamp(coord.y + offset, 0, i32(blur_params.image_height) - 1);
        let sample_index = u32(sample_y) * blur_params.image_width + id.x;
        
        let sample_color = output_image[sample_index];
        let weight = gaussian_weight(f32(offset), blur_params.sigma);
        
        color_sum += sample_color * weight;
        weight_sum += weight;
    }
    
    let output_index = id.y * blur_params.image_width + id.x;
    output_image[output_index] = color_sum / weight_sum;
}

fn gaussian_weight(offset: f32, sigma: f32) -> f32 {
    let sigma_sq = sigma * sigma;
    return exp(-(offset * offset) / (2.0 * sigma_sq)) / sqrt(2.0 * 3.14159 * sigma_sq);
}

// ============================================================================
// Color Matrix and Channel Operations
// ============================================================================

struct ColorMatrixParams {
    matrix: mat4x4f,
    offset: vec4f,
    pixel_count: u32,
}

@group(3) @binding(0) var<storage, read> input_pixels: array<vec4f>;
@group(3) @binding(1) var<storage, read_write> output_pixels: array<vec4f>;
@group(3) @binding(2) var<uniform> color_params: ColorMatrixParams;

// Apply color matrix transformation to pixels
@compute @workgroup_size(256)
fn apply_color_matrix(@builtin(global_invocation_id) id: vec3u) {
    let pixel_index = id.x;
    
    if (pixel_index >= color_params.pixel_count) {
        return;
    }
    
    let input_color = input_pixels[pixel_index];
    
    // Apply color matrix transformation
    let transformed_color = color_params.matrix * input_color + color_params.offset;
    
    // Clamp values to valid range
    output_pixels[pixel_index] = clamp(transformed_color, vec4f(0.0), vec4f(1.0));
}

// Desaturate/grayscale conversion
@compute @workgroup_size(256)
fn desaturate_pixels(@builtin(global_invocation_id) id: vec3u) {
    let pixel_index = id.x;
    
    if (pixel_index >= color_params.pixel_count) {
        return;
    }
    
    let input_color = input_pixels[pixel_index];
    
    // Luminance calculation (ITU-R BT.709)
    let luminance = 0.2126 * input_color.r + 0.7152 * input_color.g + 0.0722 * input_color.b;
    
    output_pixels[pixel_index] = vec4f(luminance, luminance, luminance, input_color.a);
}

// ============================================================================
// Lighting Effects
// ============================================================================

struct LightingParams {
    light_position: vec3f,
    light_color: vec3f,
    ambient_color: vec3f,
    surface_scale: f32,
    diffuse_constant: f32,
    specular_constant: f32,
    specular_exponent: f32,
}

@group(4) @binding(0) var height_map: texture_2d<f32>;
@group(4) @binding(1) var<storage, read_write> lighting_output: array<vec4f>;
@group(4) @binding(2) var<uniform> lighting_params: LightingParams;

// Compute lighting effects based on height map
@compute @workgroup_size(16, 16)
fn compute_lighting(@builtin(global_invocation_id) id: vec3u) {
    let coord = vec2i(i32(id.x), i32(id.y));
    let image_size = textureDimensions(height_map, 0);
    
    if (id.x >= u32(image_size.x) || id.y >= u32(image_size.y)) {
        return;
    }
    
    // Sample height map to compute surface normal
    let center_height = textureLoad(height_map, coord, 0).r;
    let left_height = textureLoad(height_map, vec2i(max(coord.x - 1, 0), coord.y), 0).r;
    let right_height = textureLoad(height_map, vec2i(min(coord.x + 1, image_size.x - 1), coord.y), 0).r;
    let top_height = textureLoad(height_map, vec2i(coord.x, max(coord.y - 1, 0)), 0).r;
    let bottom_height = textureLoad(height_map, vec2i(coord.x, min(coord.y + 1, image_size.y - 1)), 0).r;
    
    // Calculate surface normal using finite differences
    let dx = (right_height - left_height) * lighting_params.surface_scale;
    let dy = (bottom_height - top_height) * lighting_params.surface_scale;
    let normal = normalize(vec3f(-dx, -dy, 1.0));
    
    // Calculate surface position
    let surface_pos = vec3f(f32(coord.x), f32(coord.y), center_height * lighting_params.surface_scale);
    
    // Calculate lighting
    let light_dir = normalize(lighting_params.light_position - surface_pos);
    let view_dir = vec3f(0.0, 0.0, 1.0); // Assume viewer is directly above
    
    // Diffuse lighting
    let diffuse_factor = max(dot(normal, light_dir), 0.0);
    let diffuse_color = lighting_params.light_color * lighting_params.diffuse_constant * diffuse_factor;
    
    // Specular lighting (Blinn-Phong)
    let half_dir = normalize(light_dir + view_dir);
    let specular_factor = pow(max(dot(normal, half_dir), 0.0), lighting_params.specular_exponent);
    let specular_color = lighting_params.light_color * lighting_params.specular_constant * specular_factor;
    
    // Combine lighting components
    let final_color = lighting_params.ambient_color + diffuse_color + specular_color;
    
    let output_index = id.y * u32(image_size.x) + id.x;
    lighting_output[output_index] = vec4f(final_color, 1.0);
}

// ============================================================================
// Morphological Operations (Dilate/Erode)
// ============================================================================

struct MorphologyParams {
    kernel_radius: u32,
    image_width: u32,
    image_height: u32,
    operation: u32, // 0 = erode, 1 = dilate
}

@group(5) @binding(0) var morph_input: texture_2d<f32>;
@group(5) @binding(1) var<storage, read_write> morph_output: array<f32>;
@group(5) @binding(2) var<uniform> morph_params: MorphologyParams;

@compute @workgroup_size(16, 16)
fn morphological_operation(@builtin(global_invocation_id) id: vec3u) {
    let coord = vec2i(i32(id.x), i32(id.y));
    
    if (id.x >= morph_params.image_width || id.y >= morph_params.image_height) {
        return;
    }
    
    var result_value: f32;
    
    if (morph_params.operation == 0u) {
        // Erosion - find minimum in kernel
        result_value = 1.0;
        
        for (var dy = -i32(morph_params.kernel_radius); dy <= i32(morph_params.kernel_radius); dy++) {
            for (var dx = -i32(morph_params.kernel_radius); dx <= i32(morph_params.kernel_radius); dx++) {
                let sample_coord = vec2i(
                    clamp(coord.x + dx, 0, i32(morph_params.image_width) - 1),
                    clamp(coord.y + dy, 0, i32(morph_params.image_height) - 1)
                );
                
                let sample_value = textureLoad(morph_input, sample_coord, 0).r;
                result_value = min(result_value, sample_value);
            }
        }
    } else {
        // Dilation - find maximum in kernel
        result_value = 0.0;
        
        for (var dy = -i32(morph_params.kernel_radius); dy <= i32(morph_params.kernel_radius); dy++) {
            for (var dx = -i32(morph_params.kernel_radius); dx <= i32(morph_params.kernel_radius); dx++) {
                let sample_coord = vec2i(
                    clamp(coord.x + dx, 0, i32(morph_params.image_width) - 1),
                    clamp(coord.y + dy, 0, i32(morph_params.image_height) - 1)
                );
                
                let sample_value = textureLoad(morph_input, sample_coord, 0).r;
                result_value = max(result_value, sample_value);
            }
        }
    }
    
    let output_index = id.y * morph_params.image_width + id.x;
    morph_output[output_index] = result_value;
}
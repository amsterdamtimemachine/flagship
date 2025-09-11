import { isEqual } from '@qntm-code/utils';
import earcut, { flatten } from 'earcut';
import type { Feature, Polygon } from 'geojson';
import maplibregl from 'maplibre-gl';

export class MaskLayer implements maplibregl.CustomLayerInterface {
  public type = 'custom' as const;

  private readonly shaderMap = new Map();

  private buffers: WebGLBuffer[] = [];
  private vertexCounts: number[] = [];
  private aPos: GLint;

  private fullScreenQuadBuffer: WebGLBuffer;

  private map?: maplibregl.Map;

  constructor(public readonly id: string) {}

  private polygons: Feature<Polygon>[] = [];

  public setPolygons(polygons: Feature<Polygon>[]) {
    if (isEqual(polygons, this.polygons)) {
      return;
    }

    this.polygons = polygons;
    this.map?.triggerRepaint();
  }

  // Helper method for creating a shader based on current map projection - globe will automatically switch to mercator when some condition is fulfilled.
  private getShader(gl: WebGLRenderingContext, shaderDescription: maplibregl.CustomRenderMethodInput['shaderData']): WebGLProgram {
    // Pick a shader based on the current projection, defined by `variantName`.
    if (this.shaderMap.has(shaderDescription.variantName)) {
      return this.shaderMap.get(shaderDescription.variantName);
    }

    const vertexSource = `#version 300 es
      // Inject MapLibre projection code
      ${shaderDescription.vertexShaderPrelude}
      ${shaderDescription.define}

      in vec2 a_pos;

      void main() {
          gl_Position = projectTile(a_pos);
      }`;

    // create GLSL source for fragment shader
    const fragmentSource = `#version 300 es

      precision highp float;
      out highp vec4 fragColor;
      uniform vec4 color;

      void main() {
          fragColor = color;
      }`;

    // create a vertex shader
    const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vertexShader, vertexSource);
    gl.compileShader(vertexShader);

    // create a fragment shader
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fragmentShader, fragmentSource);
    gl.compileShader(fragmentShader);

    // link the two shaders into a WebGL program
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    this.aPos = gl.getAttribLocation(program, 'a_pos');

    this.shaderMap.set(shaderDescription.variantName, program);

    return program;
  }

  public onAdd(map: maplibregl.Map, gl: WebGLRenderingContext): void {
    this.map = map;

    this.fullScreenQuadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.fullScreenQuadBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1,
        -1, // bottom left
        1,
        -1, // bottom right
        -1,
        1, // top left
        1,
        1, // top right
      ]),
      gl.STATIC_DRAW,
    );
  }

  public render(gl: WebGLRenderingContext, args: maplibregl.CustomRenderMethodInput): void {
    this.createBuffers(gl);

    const program = this.getShader(gl, args.shaderData);
    gl.useProgram(program);
    gl.uniformMatrix4fv(
      gl.getUniformLocation(program, 'u_projection_fallback_matrix'),
      false,
      args.defaultProjectionData.fallbackMatrix, // convert mat4 from gl-matrix to a plain array
    );
    gl.uniformMatrix4fv(
      gl.getUniformLocation(program, 'u_projection_matrix'),
      false,
      args.defaultProjectionData.mainMatrix, // convert mat4 from gl-matrix to a plain array
    );
    gl.uniform4f(gl.getUniformLocation(program, 'u_projection_tile_mercator_coords'), ...args.defaultProjectionData.tileMercatorCoords);
    gl.uniform4f(gl.getUniformLocation(program, 'u_projection_clipping_plane'), ...args.defaultProjectionData.clippingPlane);
    gl.uniform1f(gl.getUniformLocation(program, 'u_projection_transition'), args.defaultProjectionData.projectionTransition);

    // Enable stencil testing
    gl.enable(gl.STENCIL_TEST);
    gl.stencilFunc(gl.ALWAYS, 1, 0xff);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
    gl.stencilMask(0xff);
    gl.clear(gl.STENCIL_BUFFER_BIT);

    // First pass: Draw polygons into stencil buffer
    gl.colorMask(false, false, false, false);
    // Draw each polygon separately
    this.buffers.forEach((buffer, index) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(this.aPos);
      gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, this.vertexCounts[index]);
    });

    // Second pass: Draw fullscreen quad with stencil test
    gl.colorMask(true, true, true, true);
    gl.stencilFunc(gl.NOTEQUAL, 1, 0xff);
    gl.stencilMask(0x00);
    
    // Enable blending for transparency
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Draw full screen quad  
    const colorLoc = gl.getUniformLocation(program, 'color');
    gl.uniform4f(colorLoc, 1, 1, 1, 1); // White overlay to mask areas
    gl.bindBuffer(gl.ARRAY_BUFFER, this.fullScreenQuadBuffer);
    gl.enableVertexAttribArray(this.aPos);
    gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Clean up - reset MapLibre's stencil buffer
    this.map?.painter?.clearStencil();
    gl.disable(gl.STENCIL_TEST);
    gl.disable(gl.BLEND);
  }

  private createBuffers(gl: WebGLRenderingContext): void {
    this.buffers = [];
    this.vertexCounts = [];

    this.polygons.forEach(({ geometry }) =>
      geometry.coordinates.forEach((coordinates) => {
        const { buffer, vertexCount } = this.processPolygon(coordinates as [number, number][], gl);

        this.buffers.push(buffer);
        this.vertexCounts.push(vertexCount);
      }),
    );
  }

  private processPolygon(coordinates: [number, number][], gl: WebGLRenderingContext): { buffer: WebGLBuffer; vertexCount: number } {
    const flatCoords: number[] = [];
    const resultVertices: number[] = [];

    coordinates.forEach(([lng, lat]: [number, number]) => {
      const mercatorCoord = maplibregl.MercatorCoordinate.fromLngLat({ lng, lat });
      flatCoords.push(mercatorCoord.x, mercatorCoord.y);
    });

    const { vertices, holes, dimensions } = flatten([coordinates]);
    const triangles = earcut(vertices, holes, dimensions);

    triangles.forEach((index) => resultVertices.push(flatCoords[index * 2], flatCoords[index * 2 + 1]));

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(resultVertices), gl.STATIC_DRAW);

    return { buffer, vertexCount: resultVertices.length / 2 };
  }
}

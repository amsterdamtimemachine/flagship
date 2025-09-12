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

  constructor(public readonly id: string, private readonly squareSize = 8.0) {}

  private polygons: Feature<Polygon>[] = [];

  public setPolygons(polygons: Feature<Polygon>[]) {
    if (isEqual(polygons, this.polygons)) {
      return;
    }

    this.polygons = polygons;
    this.map?.triggerRepaint();
  }

  // Helper method for creating a shader
  private getShader(gl: WebGLRenderingContext, shaderDescription: maplibregl.CustomRenderMethodInput['shaderData']): WebGLProgram {
    if (this.shaderMap.has(shaderDescription.variantName)) {
      return this.shaderMap.get(shaderDescription.variantName);
    }

    const vertexSource = `#version 300 es
      ${shaderDescription.vertexShaderPrelude}
      ${shaderDescription.define}

      in vec2 a_pos;

      void main() {
          gl_Position = projectTile(a_pos);
      }`;

    const fragmentSource = `#version 300 es
      precision highp float;
      out highp vec4 fragColor;

      uniform vec2 uResolution;
      uniform float uSquareSize;

      void main() {
          // pixel coordinate in checker units
          vec2 coord = gl_FragCoord.xy / uSquareSize;

          // checker toggle
          float checker = mod(floor(coord.x) + floor(coord.y), 2.0);

          // alternate between light gray and white
          vec3 color = mix(vec3(0.85), vec3(1.0), checker);

          fragColor = vec4(color, 1.0);
      }`;

    const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vertexShader, vertexSource);
    gl.compileShader(vertexShader);

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fragmentShader, fragmentSource);
    gl.compileShader(fragmentShader);

    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    this.aPos = gl.getAttribLocation(program, 'a_pos');
    this.shaderMap.set(shaderDescription.variantName, program);

    return program;
  }

  public onAdd(map: maplibregl.Map, gl: WebGLRenderingContext): void {
    this.map = map;

    this.fullScreenQuadBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.fullScreenQuadBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1, -1, // bottom left
         1, -1, // bottom right
        -1,  1, // top left
         1,  1, // top right
      ]),
      gl.STATIC_DRAW,
    );
  }

  public render(gl: WebGLRenderingContext, args: maplibregl.CustomRenderMethodInput): void {
    this.createBuffers(gl);

    const program = this.getShader(gl, args.shaderData);
    gl.useProgram(program);

    // Projection uniforms
    gl.uniformMatrix4fv(
      gl.getUniformLocation(program, 'u_projection_fallback_matrix'),
      false,
      args.defaultProjectionData.fallbackMatrix,
    );
    gl.uniformMatrix4fv(
      gl.getUniformLocation(program, 'u_projection_matrix'),
      false,
      args.defaultProjectionData.mainMatrix,
    );
    gl.uniform4f(
      gl.getUniformLocation(program, 'u_projection_tile_mercator_coords'),
      ...args.defaultProjectionData.tileMercatorCoords,
    );
    gl.uniform4f(
      gl.getUniformLocation(program, 'u_projection_clipping_plane'),
      ...args.defaultProjectionData.clippingPlane,
    );
    gl.uniform1f(
      gl.getUniformLocation(program, 'u_projection_transition'),
      args.defaultProjectionData.projectionTransition,
    );

    // Checkerboard uniforms
    const resLoc = gl.getUniformLocation(program, 'uResolution');
    gl.uniform2f(resLoc, gl.drawingBufferWidth, gl.drawingBufferHeight);
    const sizeLoc = gl.getUniformLocation(program, 'uSquareSize');
    gl.uniform1f(sizeLoc, this.squareSize);

    // Enable stencil testing
    gl.enable(gl.STENCIL_TEST);
    gl.stencilFunc(gl.ALWAYS, 1, 0xff);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
    gl.stencilMask(0xff);
    gl.clear(gl.STENCIL_BUFFER_BIT);

    // First pass: polygons into stencil buffer
    gl.colorMask(false, false, false, false);
    this.buffers.forEach((buffer, index) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(this.aPos);
      gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, this.vertexCounts[index]);
    });

    // Second pass: fullscreen quad with checkerboard
    gl.colorMask(true, true, true, true);
    gl.stencilFunc(gl.NOTEQUAL, 1, 0xff);
    gl.stencilMask(0x00);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.fullScreenQuadBuffer);
    gl.enableVertexAttribArray(this.aPos);
    gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Clean up
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

    triangles.forEach((index) => {
      resultVertices.push(flatCoords[index * 2], flatCoords[index * 2 + 1]);
    });

    const buffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(resultVertices), gl.STATIC_DRAW);

    return { buffer, vertexCount: resultVertices.length / 2 };
  }
}

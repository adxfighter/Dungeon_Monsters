import {
  BackSide,
  type BufferGeometry,
  Color,
  type ColorRepresentation,
  InstancedMesh,
  Mesh,
  ShaderMaterial,
} from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export const OUTLINE_DEFAULT_COLOR = 0x1a1414;
/** Default outline thickness, world units. */
export const OUTLINE_DEFAULT_THICKNESS = 0.035;

export interface OutlineOptions {
  color?: ColorRepresentation;
  /** Hull extrusion in world units (independent of the mesh scale). */
  thickness?: number;
  /**
   * Weld vertices and recompute smooth normals for the hull. Needed for flat-shaded
   * geometry (boxes), otherwise the hull splits open at hard edges. Creates an extra geometry.
   */
  smoothNormals?: boolean;
}

const vertexShader = /* glsl */ `
  uniform float uThickness;
  void main() {
    #ifdef USE_INSTANCING
      mat4 toWorld = modelMatrix * instanceMatrix;
    #else
      mat4 toWorld = modelMatrix;
    #endif
    vec4 worldPosition = toWorld * vec4( position, 1.0 );
    vec3 worldNormal = normalize( mat3( toWorld ) * normal );
    worldPosition.xyz += worldNormal * uThickness;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  void main() {
    gl_FragColor = vec4( uColor, 1.0 );
    #include <colorspace_fragment>
  }
`;

export function createOutlineMaterial(options: OutlineOptions = {}): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uColor: { value: new Color(options.color ?? OUTLINE_DEFAULT_COLOR) },
      uThickness: { value: options.thickness ?? OUTLINE_DEFAULT_THICKNESS },
    },
    vertexShader,
    fragmentShader,
    side: BackSide,
  });
}

/** Geometry for the hull: shared with the source mesh, or a welded smooth-normal copy. */
function hullGeometry(source: BufferGeometry, smooth: boolean): BufferGeometry {
  if (!smooth) return source;
  const welded = source.clone();
  welded.deleteAttribute('normal');
  welded.deleteAttribute('uv');
  const merged = mergeVertices(welded);
  welded.dispose();
  merged.computeVertexNormals();
  return merged;
}

/**
 * Adds an inverted-hull outline as a child of `mesh` (so it follows its transform).
 * For an `InstancedMesh` the hull is instanced too and shares the instance matrices
 * (set them before calling, or flag `instanceMatrix.needsUpdate` later — it is the same attribute).
 * The hull mesh is marked `userData.outline = true`; dispose it with `disposeObject`.
 */
export function addOutline(mesh: Mesh, options: OutlineOptions = {}): Mesh {
  const geometry = hullGeometry(mesh.geometry, options.smoothNormals ?? false);
  const material = createOutlineMaterial(options);
  let outline: Mesh;
  if (mesh instanceof InstancedMesh) {
    const instanced = new InstancedMesh(geometry, material, mesh.count);
    instanced.instanceMatrix = mesh.instanceMatrix;
    instanced.frustumCulled = mesh.frustumCulled;
    outline = instanced;
  } else {
    outline = new Mesh(geometry, material);
  }
  outline.name = `${mesh.name || 'mesh'}:outline`;
  outline.userData['outline'] = true;
  outline.castShadow = false;
  outline.receiveShadow = false;
  mesh.add(outline);
  return outline;
}

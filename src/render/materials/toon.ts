import {
  Color,
  type ColorRepresentation,
  DataTexture,
  MeshToonMaterial,
  NearestFilter,
  RedFormat,
  UnsignedByteType,
} from 'three';

/** Brightness of the 3 cel-shading bands (shadow, mid, lit), 0..255. */
const TOON_BANDS = [70, 160, 255];

let gradientMap: DataTexture | undefined;

/**
 * Shared 3-step gradient ramp. NearestFilter keeps band edges hard (anime look).
 * Shared by every toon material; three re-uploads it if it was disposed.
 */
export function getToonGradientMap(): DataTexture {
  if (!gradientMap) {
    gradientMap = new DataTexture(
      new Uint8Array(TOON_BANDS),
      TOON_BANDS.length,
      1,
      RedFormat,
      UnsignedByteType,
    );
    gradientMap.minFilter = NearestFilter;
    gradientMap.magFilter = NearestFilter;
    gradientMap.generateMipmaps = false;
    gradientMap.needsUpdate = true;
  }
  return gradientMap;
}

export interface ToonMaterialOptions {
  color: ColorRepresentation;
  /** Rim light color. Default white. */
  rimColor?: ColorRepresentation;
  /** Rim intensity, 0 disables (use 0 for flat-shaded meshes: rim is N·V based). Default 0.5. */
  rimStrength?: number;
  /** Rim width: fraction of the silhouette (0..1) that gets the rim. Default 0.3. */
  rimWidth?: number;
}

/**
 * MeshToonMaterial with a 3-band gradient map and a hard-edged view-space rim light,
 * injected via onBeforeCompile. All toon materials share one shader program.
 */
export function createToonMaterial(options: ToonMaterialOptions): MeshToonMaterial {
  const material = new MeshToonMaterial({ color: options.color, gradientMap: getToonGradientMap() });
  const uniforms = {
    uRimColor: { value: new Color(options.rimColor ?? 0xffffff) },
    uRimStrength: { value: options.rimStrength ?? 0.5 },
    uRimWidth: { value: options.rimWidth ?? 0.3 },
  };
  material.userData['rim'] = uniforms;

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        'uniform vec3 uRimColor;\nuniform float uRimStrength;\nuniform float uRimWidth;\nvoid main() {',
      )
      .replace(
        '#include <opaque_fragment>',
        [
          '{',
          '  float rimNdotV = 1.0 - saturate( dot( normal, normalize( vViewPosition ) ) );',
          '  float rim = smoothstep( 1.0 - uRimWidth, 1.0 - uRimWidth + 0.04, rimNdotV );',
          '  outgoingLight += uRimColor * rim * uRimStrength;',
          '}',
          '#include <opaque_fragment>',
        ].join('\n'),
      );
  };
  material.customProgramCacheKey = () => 'dm-toon-rim';
  return material;
}

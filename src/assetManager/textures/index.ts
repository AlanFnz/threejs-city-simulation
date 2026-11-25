import * as THREE from 'three';
import BASE from './base.png';
import GRASS from './grass.png';
import GRID from './grid.png';
import RESIDENTIAL1 from './residential1.png';
import RESIDENTIAL2 from './residential2.png';
import RESIDENTIAL3 from './residential3.png';
import COMMERCIAL1 from './commercial1.png';
import COMMERCIAL2 from './commercial2.png';
import COMMERCIAL3 from './commercial3.png';
import INDUSTRIAL1 from './industrial1.png';
import INDUSTRIAL2 from './industrial2.png';
import INDUSTRIAL3 from './industrial3.png';
import LIGHTRAYS from './lightrays-LPEC.png';
import SPECULAR from './specular.png';

const loader = new THREE.TextureLoader();
type TextureKey =
  | 'BASE'
  | 'GRASS'
  | 'GRID'
  | 'RESIDENTIAL1'
  | 'RESIDENTIAL2'
  | 'RESIDENTIAL3'
  | 'COMMERCIAL1'
  | 'COMMERCIAL2'
  | 'COMMERCIAL3'
  | 'INDUSTRIAL1'
  | 'INDUSTRIAL2'
  | 'INDUSTRIAL3'
  | 'LIGHTRAYS'
  | 'SPECULAR';

const textures: Record<TextureKey, THREE.Texture> = {
  BASE: loadTexture(BASE),
  GRASS: loadTexture(GRASS),
  GRID: loadTexture(GRID),
  RESIDENTIAL1: loadTexture(RESIDENTIAL1),
  RESIDENTIAL2: loadTexture(RESIDENTIAL2),
  RESIDENTIAL3: loadTexture(RESIDENTIAL3),
  COMMERCIAL1: loadTexture(COMMERCIAL1),
  COMMERCIAL2: loadTexture(COMMERCIAL2),
  COMMERCIAL3: loadTexture(COMMERCIAL3),
  INDUSTRIAL1: loadTexture(INDUSTRIAL1),
  INDUSTRIAL2: loadTexture(INDUSTRIAL2),
  INDUSTRIAL3: loadTexture(INDUSTRIAL3),
  LIGHTRAYS: loadTexture(LIGHTRAYS),
  SPECULAR: loadTexture(SPECULAR),
};

// GLB UVs use the top-left texture origin. Both atlas maps share those UVs.
textures.BASE.flipY = false;
textures.SPECULAR.flipY = false;
textures.BASE.colorSpace = THREE.SRGBColorSpace;

function isValidTextureKey(key: string): key is TextureKey {
  return key in textures;
}

function loadTexture(url: string) {
  const tex = loader.load(url);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 1);
  return tex;
}

function getSideMaterial(textureName: TextureKey) {
  return new THREE.MeshLambertMaterial({ map: textures[textureName].clone() });
}

export { textures, TextureKey, isValidTextureKey, getSideMaterial };


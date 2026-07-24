import * as THREE from 'three';

export const DEG2RAD = Math.PI / 180;

export const LEFT_MOUSE_BUTTON = 0;
export const MIDDLE_MOUSE_BUTTON = 1;
export const RIGHT_MOUSE_BUTTON = 2;

export const CAMERA_SIZE = 10;
/** Zoom-out limit tuned for a 16-tile map; CameraManager scales this by 16/citySize. */
export const MIN_CAMERA_RADIUS_AT_SIZE_16 = 0.1;
/** Zoom-in limit: tile detail doesn't change with map size, so this stays fixed. */
export const MAX_CAMERA_RADIUS = 1.5;
export const INIT_CAMERA_ELEVATION = 45;
export const MIN_CAMERA_ELEVATION = 10;
export const MAX_CAMERA_ELEVATION = 90;
export const INIT_CAMERA_AZIMUTH = 225;

export const AZIMUTH_SENSITIVITY = 0.2;
export const ELEVATION_SENSITIVITY = 0.02;
export const ZOOM_SENSITIVITY = 0.002;
export const PAN_SENSITIVITY = -0.03;

export const Y_AXIS = new THREE.Vector3(0, 1, 0);


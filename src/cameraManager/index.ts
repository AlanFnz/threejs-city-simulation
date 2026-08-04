import * as THREE from 'three';
import CONFIG from '../config';
import {
  DEG2RAD,
  RIGHT_MOUSE_BUTTON,
  CAMERA_SIZE,
  MIN_CAMERA_RADIUS_AT_SIZE_16,
  MAX_CAMERA_RADIUS,
  MIN_CAMERA_ELEVATION,
  MAX_CAMERA_ELEVATION,
  AZIMUTH_SENSITIVITY,
  ELEVATION_SENSITIVITY,
  ZOOM_SENSITIVITY,
  PAN_SENSITIVITY,
  Y_AXIS,
} from './constants';

export interface CameraFocus {
  x: number;
  y: number;
}

export interface ICameraManager {
  camera: THREE.OrthographicCamera;
  getFocus(): CameraFocus;
  focusOnTile(x: number, y: number): void;
  update(deltaSeconds: number): void;
  onKeyDown(event: KeyboardEvent): void;
  onKeyUp(event: KeyboardEvent): void;
  clearKeyboardState(): void;
  onMouseMove(event: MouseEvent): void;
  onMouseScroll(event: WheelEvent): void;
  onWindowResize(gameWindow: HTMLElement): void;
  onTouchStart(event: TouchEvent): void;
  onTouchMove(event: TouchEvent): void;
  onTouchEnd(event: TouchEvent): void;
}

export class CameraManager implements ICameraManager {
  public camera: THREE.OrthographicCamera;
  private cameraOrigin: THREE.Vector3;
  private cameraRadius: number;
  private targetCameraRadius: number;
  private cameraAzimuth: number;
  private cameraElevation: number;
  private startTouches: { x: number; y: number };
  private isPanning: boolean;
  private onFocusChanged: (focus: CameraFocus) => void;
  /** Scaled by 16/citySize so every map size keeps the same relative zoomed-out coverage. */
  private minCameraRadius: number;
  private pressedKeys: Set<string>;
  private panVelocity: THREE.Vector3;
  private rotationVelocity: number;

  constructor(
    gameWindow: HTMLElement,
    citySize: number,
    onFocusChanged: (focus: CameraFocus) => void = () => undefined
  ) {
    const aspect = gameWindow.clientWidth / gameWindow.clientHeight;

    this.camera = new THREE.OrthographicCamera(
      (CAMERA_SIZE * aspect) / -2,
      (CAMERA_SIZE * aspect) / 2,
      CAMERA_SIZE / 2,
      CAMERA_SIZE / -2,
      1,
      1000
    );

    const center = citySize / 2 - 0.5;
    this.cameraOrigin = new THREE.Vector3(center, 0, center);
    this.minCameraRadius = MIN_CAMERA_RADIUS_AT_SIZE_16 * (16 / citySize);
    // Starting zoom shows the whole map plus a small margin, same as the
    // original tuning (size 16, zoom 0.5, visible extent 20).
    this.cameraRadius = Math.min(
      MAX_CAMERA_RADIUS,
      Math.max(this.minCameraRadius, CAMERA_SIZE / (citySize + 4))
    );
    this.targetCameraRadius = this.cameraRadius;
    this.cameraAzimuth = 135;
    this.cameraElevation = 45;
    this.startTouches = { x: 0, y: 0 };
    this.isPanning = false;
    this.pressedKeys = new Set();
    this.panVelocity = new THREE.Vector3();
    this.rotationVelocity = 0;
    this.onFocusChanged = onFocusChanged;

    this.updateCameraPosition();
  }

  private updateCameraPosition(): void {
    if (this.camera.zoom !== this.cameraRadius) {
      this.camera.zoom = this.cameraRadius;
      this.camera.updateProjectionMatrix();
    }
    this.camera.position.x =
      100 *
      Math.sin(this.cameraAzimuth * DEG2RAD) *
      Math.cos(this.cameraElevation * DEG2RAD);
    this.camera.position.y = 100 * Math.sin(this.cameraElevation * DEG2RAD);
    this.camera.position.z =
      100 *
      Math.cos(this.cameraAzimuth * DEG2RAD) *
      Math.cos(this.cameraElevation * DEG2RAD);
    this.camera.position.add(this.cameraOrigin);
    this.camera.lookAt(this.cameraOrigin);
  }

  public focusOnTile(x: number, y: number): void {
    this.panVelocity.set(0, 0, 0);
    this.rotationVelocity = 0;
    this.cameraOrigin.set(x, 0, y);
    this.updateCameraPosition();
    this.onFocusChanged(this.getFocus());
  }

  public getFocus(): CameraFocus {
    return { x: this.cameraOrigin.x, y: this.cameraOrigin.z };
  }

  public onKeyDown(event: KeyboardEvent): void {
    if (!['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE'].includes(event.code)) {
      return;
    }
    const target = event.target as {
      closest?: (selector: string) => unknown;
    } | null;
    if (
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      target?.closest?.('input, textarea, select, [contenteditable="true"]')
    ) {
      return;
    }
    event.preventDefault();
    this.pressedKeys.add(event.code);
  }

  public onKeyUp(event: KeyboardEvent): void {
    this.pressedKeys.delete(event.code);
  }

  public clearKeyboardState(): void {
    this.pressedKeys.clear();
    this.panVelocity.set(0, 0, 0);
    this.rotationVelocity = 0;
  }

  public update(deltaSeconds: number): void {
    const forwardInput =
      Number(this.pressedKeys.has('KeyW')) -
      Number(this.pressedKeys.has('KeyS'));
    const leftInput =
      Number(this.pressedKeys.has('KeyA')) -
      Number(this.pressedKeys.has('KeyD'));
    const rotationInput =
      Number(this.pressedKeys.has('KeyE')) -
      Number(this.pressedKeys.has('KeyQ'));
    const clampedDeltaSeconds = Math.min(Math.max(deltaSeconds, 0), 0.1);
    if (clampedDeltaSeconds === 0) return;
    const hasZoomMotion = this.cameraRadius !== this.targetCameraRadius;
    if (
      forwardInput === 0 &&
      leftInput === 0 &&
      rotationInput === 0 &&
      this.panVelocity.lengthSq() === 0 &&
      this.rotationVelocity === 0 &&
      !hasZoomMotion
    ) {
      return;
    }

    const response = CONFIG.CAMERA.KEYBOARD_RESPONSE;
    const decay = Math.exp(-response * clampedDeltaSeconds);
    const targetRotationVelocity =
      rotationInput * CONFIG.CAMERA.KEYBOARD_ROTATION_SPEED;
    const rotationDelta =
      targetRotationVelocity * clampedDeltaSeconds +
      ((this.rotationVelocity - targetRotationVelocity) * (1 - decay)) /
        response;
    this.cameraAzimuth += rotationDelta;
    this.rotationVelocity =
      targetRotationVelocity +
      (this.rotationVelocity - targetRotationVelocity) * decay;
    if (rotationInput === 0 && Math.abs(this.rotationVelocity) < 0.01) {
      this.rotationVelocity = 0;
    }

    const targetPanVelocity = new THREE.Vector3();
    if (forwardInput !== 0 || leftInput !== 0) {
      const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(
        Y_AXIS,
        this.cameraAzimuth * DEG2RAD
      );
      const left = new THREE.Vector3(1, 0, 0).applyAxisAngle(
        Y_AXIS,
        this.cameraAzimuth * DEG2RAD
      );
      targetPanVelocity
        .copy(forward)
        .multiplyScalar(forwardInput)
        .add(left.multiplyScalar(leftInput))
        .normalize()
        .multiplyScalar(CONFIG.CAMERA.KEYBOARD_PAN_SPEED / this.cameraRadius);
    }

    const movement = targetPanVelocity
      .clone()
      .multiplyScalar(clampedDeltaSeconds)
      .add(
        this.panVelocity
          .clone()
          .sub(targetPanVelocity)
          .multiplyScalar((1 - decay) / response)
      );
    this.cameraOrigin.add(movement);
    this.panVelocity
      .multiplyScalar(decay)
      .add(targetPanVelocity.multiplyScalar(1 - decay));
    if (forwardInput === 0 && leftInput === 0 && this.panVelocity.lengthSq() < 1e-6) {
      this.panVelocity.set(0, 0, 0);
    }

    if (hasZoomMotion) {
      const zoomDecay = Math.exp(
        -CONFIG.CAMERA.SCROLL_ZOOM_RESPONSE * clampedDeltaSeconds
      );
      this.cameraRadius =
        this.targetCameraRadius +
        (this.cameraRadius - this.targetCameraRadius) * zoomDecay;
      if (Math.abs(this.cameraRadius - this.targetCameraRadius) < 1e-4) {
        this.cameraRadius = this.targetCameraRadius;
      }
    }

    this.updateCameraPosition();
    if (movement.lengthSq() > 0) this.onFocusChanged(this.getFocus());
  }

  public onMouseMove(event: MouseEvent): void {
    if (event.buttons & RIGHT_MOUSE_BUTTON && !event.ctrlKey) {
      this.cameraAzimuth += -(event.movementX * AZIMUTH_SENSITIVITY);
      this.cameraElevation += event.movementY * ELEVATION_SENSITIVITY;
      this.cameraElevation = Math.min(
        MAX_CAMERA_ELEVATION,
        Math.max(MIN_CAMERA_ELEVATION, this.cameraElevation)
      );
    }

    if (event.buttons & RIGHT_MOUSE_BUTTON && event.ctrlKey) {
      const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(
        Y_AXIS,
        this.cameraAzimuth * DEG2RAD
      );
      const left = new THREE.Vector3(1, 0, 0).applyAxisAngle(
        Y_AXIS,
        this.cameraAzimuth * DEG2RAD
      );
      this.cameraOrigin.add(
        forward.multiplyScalar(PAN_SENSITIVITY * event.movementY)
      );
      this.cameraOrigin.add(
        left.multiplyScalar(PAN_SENSITIVITY * event.movementX)
      );
      this.onFocusChanged(this.getFocus());
    }

    this.updateCameraPosition();
  }

  public onMouseScroll(event: WheelEvent): void {
    event.preventDefault();
    this.targetCameraRadius *= Math.exp(-event.deltaY * ZOOM_SENSITIVITY);
    this.targetCameraRadius = Math.min(
      MAX_CAMERA_RADIUS,
      Math.max(this.minCameraRadius, this.targetCameraRadius)
    );
  }

  public onTouchStart(event: TouchEvent): void {
    if (event.touches.length === 2) {
      this.isPanning = true;
      this.startTouches = this.getAverageTouchPosition(event.touches);
      event.preventDefault();
    }
  }

  public onTouchMove(event: TouchEvent): void {
    if (this.isPanning && event.touches.length === 2) {
      const currentTouches = this.getAverageTouchPosition(event.touches);
      const deltaX: number = currentTouches.x - this.startTouches.x;
      const deltaY: number = currentTouches.y - this.startTouches.y;

      const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(
        Y_AXIS,
        this.cameraAzimuth * DEG2RAD
      );
      const left = new THREE.Vector3(1, 0, 0).applyAxisAngle(
        Y_AXIS,
        this.cameraAzimuth * DEG2RAD
      );

      this.cameraOrigin.add(forward.multiplyScalar(-PAN_SENSITIVITY * deltaY));
      this.cameraOrigin.add(left.multiplyScalar(-PAN_SENSITIVITY * deltaX));
      this.updateCameraPosition();
      this.onFocusChanged(this.getFocus());

      this.startTouches = currentTouches; // Update the start position for the next move
      event.preventDefault();
    }
  }

  public onTouchEnd(event: TouchEvent): void {
    if (event.touches.length < 2) {
      this.isPanning = false;
    }
  }

  public onWindowResize(gameWindow: HTMLElement): void {
    const aspect = gameWindow.clientWidth / gameWindow.clientHeight;
    this.camera.left = (CAMERA_SIZE * aspect) / -2;
    this.camera.right = (CAMERA_SIZE * aspect) / 2;
    this.camera.updateProjectionMatrix();
  }

  private getAverageTouchPosition(touches: TouchList): {
    x: number;
    y: number;
  } {
    let avgX: number = 0;
    let avgY: number = 0;
    for (let i = 0; i < touches.length; i++) {
      avgX += touches[i].clientX;
      avgY += touches[i].clientY;
    }
    avgX /= touches.length;
    avgY /= touches.length;
    return { x: avgX, y: avgY };
  }
}

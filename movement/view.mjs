import { Euler } from 'three';

// View pitch steers forward travel; yaw defines the upright body's right axis.
// No roll state exists, so mouse and keyboard cannot accumulate camera tilt.
export function updateUprightView(yaw, pitch, quaternion, basis) {
  const bounded = Math.max(-1.42, Math.min(1.42, pitch));
  quaternion.setFromEuler(new Euler(bounded, yaw, 0, 'YXZ'));
  basis.forward.set(0, 0, -1).applyQuaternion(quaternion);
  basis.right.set(Math.cos(yaw), 0, -Math.sin(yaw));
  basis.up.set(0, 1, 0);
  return bounded;
}

import { VRM } from "@pixiv/three-vrm";
import {
  AnimationClip,
  KeyframeTrack,
  Quaternion,
  QuaternionKeyframeTrack,
  Vector3,
  VectorKeyframeTrack,
} from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";

import { mixamoRigMap } from "./mixamoRigMap";

/*
 * Loads a Mixamo animation, converts for vrm use, and returns it.
 * Heavily based on {@link https://github.com/pixiv/three-vrm/blob/dev/packages/three-vrm-core/examples/humanoidAnimation/loadMixamoAnimation.js}
 */
export async function loadMixamoAnimation(
  animationsPath: string,
  vrm: VRM
): Promise<AnimationClip[]> {
  const loader = new FBXLoader();

  const restRotationInverse = new Quaternion();
  const parentRestWorldRotation = new Quaternion();
  const quat = new Quaternion();
  const vec3 = new Vector3();

  const fbx = await loader.loadAsync(animationsPath);

  const animationHips = fbx.getObjectByName("mixamorigHips");
  if (!animationHips) throw new Error("No animation hips");

  const vrmHips = vrm.humanoid.getNormalizedBoneNode("hips");
  if (!vrmHips) throw new Error("No VRM hips");

  // Adjust with reference to hips height
  const vrmHipsY = vrmHips.getWorldPosition(vec3).y;
  const vrmRootY = vrm.scene.getWorldPosition(vec3).y;
  const vrmHipsHeight = Math.abs(vrmHipsY - vrmRootY);
  const animationHipsHeight = animationHips.position.y;
  const hipsPositionScale = vrmHipsHeight / animationHipsHeight;

  const clips = fbx.animations.map((clip) => {
    const tracks: KeyframeTrack[] = [];

    clip.tracks.forEach((track) => {
      const splitTrack = track.name.split(".");

      const mixamoRigName = splitTrack[0] as keyof typeof mixamoRigMap;
      const vrmBoneName = mixamoRigMap[mixamoRigName];
      if (!vrmBoneName) return;

      const vrmBone = vrm.humanoid.getNormalizedBoneNode(vrmBoneName);
      if (!vrmBone) throw new Error("No VRM bone");

      const mixamoRigNode = fbx.getObjectByName(mixamoRigName);
      if (!mixamoRigNode) throw new Error("No mixamo rig node");
      if (!mixamoRigNode.parent) throw new Error("No mixamo rig parent");

      const propertyName = splitTrack[1];
      if (!propertyName) throw new Error("No property name");

      // Store rotations of rest-pose.
      mixamoRigNode.getWorldQuaternion(restRotationInverse).invert();
      mixamoRigNode.parent.getWorldQuaternion(parentRestWorldRotation);

      if (track instanceof QuaternionKeyframeTrack) {
        // Retarget rotation of mixamoRig to NormalizedBone.
        for (let i = 0; i < track.values.length; i += 4) {
          const flatQuaternion = track.values.slice(i, i + 4);

          quat.fromArray(flatQuaternion);

          quat
            .premultiply(parentRestWorldRotation)
            .multiply(restRotationInverse);

          quat.toArray(flatQuaternion);

          flatQuaternion.forEach((v, index) => {
            track.values[index + i] = v;
          });
        }

        tracks.push(
          new QuaternionKeyframeTrack(
            `${vrmBone.name}.${propertyName}`,
            track.times as any,
            track.values.map((v, i) =>
              vrm.meta?.metaVersion === "0" && i % 2 === 0 ? -v : v
            ) as any
          )
        );
      } else if (track instanceof VectorKeyframeTrack) {
        const value = track.values.map(
          (v, i) =>
            (vrm.meta?.metaVersion === "0" && i % 3 !== 1 ? -v : v) *
            hipsPositionScale
        );
        tracks.push(
          new VectorKeyframeTrack(
            `${vrmBone.name}.${propertyName}`,
            track.times as any,
            value as any
          )
        );
      }
    });

    return new AnimationClip(clip.name, clip.duration, tracks);
  });

  return clips;
}

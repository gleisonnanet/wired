import { VRM, VRMLoaderPlugin } from "@pixiv/three-vrm";
import {
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  BoxGeometry,
  Group,
  LoopPingPong,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Quaternion,
  Vector3,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

import { PLAYER_HEIGHT, PLAYER_RADIUS } from "../../../constants";
import { toHex } from "../../../utils/toHex";
import { disposeObject } from "../../utils/disposeObject";
import { loadMixamoAnimation } from "./loadMixamoAnimation";
import { AnimationName } from "./types";

const LERP_FACTOR = 0.000001;
const CAMERA_OFFSET = new Vector3(0, 0.1, -0.03);

export class PlayerAvatar {
  readonly playerId: number;
  readonly group = new Group();

  isFalling = false;
  #isUser = false;

  #vrm: VRM | null = null;
  #camera?: PerspectiveCamera;

  #defaultAvatarPath?: string;
  #avatarAnimationsPath?: string;
  #mixer: AnimationMixer | null = null;
  #actions = new Map<AnimationName, AnimationAction>();

  #fallWeight = 0;
  #leftWeight = 0;
  #rightWeight = 0;
  #forwardWeight = 0;
  #sprintWeight = 0;

  #velocity = new Vector3();
  #averageVelocity = new Vector3();

  #tempQuat = new Quaternion();
  #prevPosition = new Vector3();
  #targetPosition = new Vector3();
  #targetRotation = new Quaternion();

  #loader = new GLTFLoader();

  constructor(
    playerId: number,
    avatar: string | null,
    defaultAvatarPath?: string,
    avatarAnimationsPath?: string,
    camera?: PerspectiveCamera
  ) {
    this.playerId = playerId;
    this.#defaultAvatarPath = defaultAvatarPath;
    this.#avatarAnimationsPath = avatarAnimationsPath;
    this.#camera = camera;
    this.#isUser = Boolean(camera);

    this.#loader.register((parser) => new VRMLoaderPlugin(parser));

    // Load VRM model
    try {
      this.#loadModel(avatar ?? defaultAvatarPath, avatarAnimationsPath);
    } catch (error) {
      console.error(error);
      console.error(`🚨 Failed to load ${this.playerId}'s avatar`);
    }
  }

  async #loadModel(avatarPath?: string, avatarAnimationsPath?: string) {
    if (!avatarPath) {
      const geometry = new BoxGeometry(
        PLAYER_RADIUS * 2,
        PLAYER_HEIGHT,
        PLAYER_RADIUS * 2
      );
      const material = new MeshStandardMaterial({ color: 0xff3333 });
      const mesh = new Mesh(geometry, material);
      mesh.position.y = PLAYER_HEIGHT / 2;
      this.group.add(mesh);
      return;
    }

    const gltf = await this.#loader.loadAsync(avatarPath);
    const vrm = gltf.userData.vrm as VRM;

    // Remove previous VRM model
    if (this.#vrm) {
      disposeObject(this.#vrm.scene);
      this.#vrm = null;
    }

    // Remove previous mixer
    if (this.#mixer) {
      this.#mixer.stopAllAction();
      this.#actions.clear();
      this.#mixer = null;
    }

    // Enable first-person view if it's the user
    if (this.#camera && vrm.firstPerson) {
      vrm.firstPerson.setup();
      this.#camera.layers.enable(vrm.firstPerson.firstPersonOnlyLayer);
      this.#camera.layers.disable(vrm.firstPerson.thirdPersonOnlyLayer);
    }

    // Set VRM model
    this.#vrm = vrm;

    // Add model to the scene
    this.group.add(vrm.scene);

    // Process vrm scene
    vrm.scene.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = true;
      }
    });

    if (avatarAnimationsPath) {
      // Create mixer
      this.#mixer = new AnimationMixer(vrm.scene);

      // Load animations
      const animations = new Map<AnimationName, AnimationClip>();

      const clipPromises = Object.values(AnimationName).map(async (name) => {
        if (!this.#vrm) throw new Error("VRM not loaded");
        if (!this.#mixer) throw new Error("Mixer not created");

        const path = `${avatarAnimationsPath}${name}.fbx`;

        try {
          const clips = await loadMixamoAnimation(path, this.#vrm);
          const clip = clips[0];
          if (!clip) throw new Error(`No clip found for ${name}`);

          animations.set(name, clip);
        } catch (error) {
          console.error(`🚨 Failed to load ${name} animation`);
          console.error(error);
        }
      });

      await Promise.all(clipPromises);

      // Create actions
      animations.forEach((clip, name) => {
        if (!this.#mixer) throw new Error("Mixer not created");
        const action = this.#mixer.clipAction(clip);
        action.setEffectiveWeight(0);
        this.#actions.set(name, action);
      });

      this.#actions.get(AnimationName.Idle)?.play();
      this.#actions.get(AnimationName.Walk)?.play();
      this.#actions.get(AnimationName.LeftWalk)?.play();
      this.#actions.get(AnimationName.RightWalk)?.play();
      this.#actions.get(AnimationName.Sprint)?.play();

      this.#actions
        .get(AnimationName.Falling)
        ?.play()
        .setLoop(LoopPingPong, Infinity);
    }

    if (this.playerId === -1) console.info(`💃 Loaded your avatar`);
    else console.info(`💃 Loaded ${toHex(this.playerId)}'s avatar`);
  }

  setAvatar(avatarPath: string | null) {
    this.#loadModel(
      avatarPath ?? this.#defaultAvatarPath,
      this.#avatarAnimationsPath
    );
  }

  setLocation(
    location: [number, number, number, number, number, number, number]
  ) {
    this.#targetPosition.set(location[0], location[1], location[2]);
    this.#targetRotation.set(
      location[3],
      location[4],
      location[5],
      location[6]
    );
  }

  animate(delta: number) {
    const K = 1 - Math.pow(LERP_FACTOR, delta);

    if (!this.#isUser) {
      this.group.position.lerp(this.#targetPosition, K);
      this.group.quaternion.slerp(this.#targetRotation, K);
    }

    if (this.#camera && this.#vrm) {
      this.group.quaternion.copy(this.#camera.quaternion);
    }

    // Only rotate on Y axis
    this.group.quaternion.x = 0;
    this.group.quaternion.z = 0;
    this.group.quaternion.normalize();

    // Copy head position to camera
    if (this.#vrm && this.#camera) {
      const head = this.#vrm.humanoid.humanBones.head.node;
      head.position.add(CAMERA_OFFSET);
      head.getWorldPosition(this.#camera.position);
      head.position.sub(CAMERA_OFFSET);
    }

    // Calculate velocity relative to player rotation
    this.#velocity
      .copy(this.#prevPosition)
      .sub(this.group.position)
      .divideScalar(delta)
      .applyQuaternion(this.#tempQuat.copy(this.group.quaternion).invert());

    this.#prevPosition.copy(this.group.position);

    const velocity = this.#averageVelocity.lerp(this.#velocity, K);

    // Falling
    this.#fallWeight = clamp(
      this.isFalling
        ? this.#fallWeight + delta * 4
        : this.#fallWeight - delta * 4
    );

    this.#actions
      .get(AnimationName.Falling)
      ?.setEffectiveWeight(this.#fallWeight);

    // Walking
    const leftVelocity = velocity.x > 0 ? velocity.x : 0;
    const rightVelocity = velocity.x < 0 ? -velocity.x : 0;
    const forwardVelocity = Math.abs(velocity.z);
    const isBackwards = velocity.z > 0;

    this.#leftWeight = clamp(
      leftVelocity > 1 && !this.isFalling
        ? this.#leftWeight + delta * 3
        : this.#leftWeight - delta * 6
    );

    this.#rightWeight = clamp(
      rightVelocity > 1 && !this.isFalling
        ? this.#rightWeight + delta * 3
        : this.#rightWeight - delta * 6
    );

    this.#sprintWeight = clamp(
      forwardVelocity > 4 && !this.isFalling
        ? this.#sprintWeight + delta * 6
        : this.#sprintWeight - delta * 4
    );

    this.#forwardWeight = clamp(
      forwardVelocity > 1 && !this.isFalling
        ? this.#forwardWeight + delta * 6
        : this.#forwardWeight - delta * 8
    );

    this.#actions
      .get(AnimationName.LeftWalk)
      ?.setEffectiveWeight(this.#leftWeight);

    this.#actions
      .get(AnimationName.RightWalk)
      ?.setEffectiveWeight(this.#rightWeight);

    this.#actions
      .get(AnimationName.Walk)
      ?.setEffectiveWeight(this.#forwardWeight - this.#sprintWeight)
      .setEffectiveTimeScale(isBackwards ? -1 : 1);

    this.#actions
      .get(AnimationName.Sprint)
      ?.setEffectiveWeight(this.#sprintWeight)
      .setEffectiveTimeScale(isBackwards ? -1 : 1);

    // Idle
    const idleWeight =
      1 -
      this.#leftWeight -
      this.#rightWeight -
      this.#forwardWeight -
      this.#fallWeight;

    this.#actions.get(AnimationName.Idle)?.setEffectiveWeight(idleWeight);

    // Update animations
    if (this.#mixer) this.#mixer.update(delta);

    // Update VRM
    if (this.#vrm) this.#vrm.update(delta);
  }

  destroy() {
    disposeObject(this.group);
  }
}

function clamp(value: number, min = 0, max = 1) {
  return Math.max(Math.min(value, max), min);
}

import { Group, Scene } from "three";

import { ToRenderMessage } from "../../types";
import { PlayerAvatar } from "./PlayerAvatar";

export class OtherPlayersPlugin {
  #scene: Scene;
  #avatarPath?: string;
  #avatarAnimationsPath?: string;

  #players = new Map<number, PlayerAvatar>();
  #playerGroup = new Group();

  constructor(
    scene: Scene,
    avatarPath?: string,
    avatarAnimationsPath?: string
  ) {
    this.#scene = scene;
    this.#avatarPath = avatarPath;
    this.#avatarAnimationsPath = avatarAnimationsPath;

    this.#scene.add(this.#playerGroup);
  }

  animate(delta: number) {
    this.#players.forEach((player) => player.animate(delta));
  }

  onmessage(event: MessageEvent<ToRenderMessage>) {
    const { subject, data } = event.data;

    switch (subject) {
      case "player_joined": {
        this.addPlayer(data.playerId, data.avatar);
        break;
      }

      case "player_left": {
        this.removePlayer(data);
        break;
      }

      case "player_location": {
        this.setPlayerLocation(data);
        break;
      }

      case "set_player_falling_state": {
        const player = this.#players.get(data.playerId);
        if (player) player.isFalling = data.isFalling;
        break;
      }

      case "set_player_avatar": {
        const player = this.#players.get(data.playerId);
        if (player) player.setAvatar(data.avatar);
        break;
      }

      case "clear_players": {
        this.#players.forEach((player) => this.removePlayer(player.playerId));
        break;
      }
    }
  }

  addPlayer(playerId: number, avatar: string | null) {
    const player = new PlayerAvatar(
      playerId,
      avatar,
      this.#avatarPath,
      this.#avatarAnimationsPath
    );

    this.#players.set(playerId, player);
    this.#playerGroup.add(player.group);
  }

  removePlayer(playerId: number) {
    const player = this.#players.get(playerId);
    if (player) {
      this.#playerGroup.remove(player.group);
      player.destroy();
      this.#players.delete(playerId);
    }
  }

  setPlayerLocation(buffer: ArrayBuffer) {
    const view = new DataView(buffer);

    const playerId = view.getUint8(0);

    const location: [number, number, number, number, number, number, number] = [
      0, 0, 0, 0, 0, 0, 0,
    ];

    location[0] = view.getInt32(1, true) / 1000;
    location[1] = view.getInt32(5, true) / 1000;
    location[2] = view.getInt32(9, true) / 1000;

    location[3] = view.getInt16(13, true) / 1000;
    location[4] = view.getInt16(15, true) / 1000;
    location[5] = view.getInt16(17, true) / 1000;
    location[6] = view.getInt16(19, true) / 1000;

    const player = this.#players.get(playerId);
    if (player) player.setLocation(location);
  }

  destroy() {
    this.#players.forEach((player) => player.destroy());
  }
}

import { Transferable } from "../types";

/*
 * Wrap code in a fake worker to mimic a web worker interface.
 * This allows us to run code in either a web worker or the main thread, while keeping the same API.
 */
export class FakeWorker<To = any, From = any> {
  #channel = new MessageChannel();

  workerPort = this.#channel.port1;
  outsidePort = this.#channel.port2;

  constructor() {
    this.outsidePort.onmessage = this.#onmessage.bind(this);
  }

  #onmessage(event: MessageEvent<From>) {
    if (this.onmessage) this.onmessage(event);
  }

  // Send a message to the worker
  postMessage(message: To, transfer?: Transferable[]) {
    this.outsidePort.postMessage(message, transfer);
  }

  // Receive a message from the worker
  onmessage: ((event: MessageEvent<From>) => void) | null = null;

  // Terminate the worker
  terminate() {
    this.outsidePort.close();
    this.workerPort.close();
  }
}

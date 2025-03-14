// Import web-streams-polyfill
import {
  ReadableStream,
  WritableStream,
  TransformStream,
} from "web-streams-polyfill";

// Add polyfills to global scope if they don't exist
if (typeof globalThis.ReadableStream === "undefined") {
  (globalThis as any).ReadableStream = ReadableStream;
}

if (typeof globalThis.WritableStream === "undefined") {
  (globalThis as any).WritableStream = WritableStream;
}

if (typeof globalThis.TransformStream === "undefined") {
  (globalThis as any).TransformStream = TransformStream;
}

// Add TextDecoderStream if it doesn't exist
if (typeof globalThis.TextDecoderStream === "undefined") {
  class TextDecoderStreamPolyfill extends TransformStream {
    constructor(encoding = "utf-8", options = {}) {
      const textDecoder = new TextDecoder(encoding, options);

      super({
        transform(chunk, controller) {
          const text = textDecoder.decode(chunk, { stream: true });
          if (text) controller.enqueue(text);
        },
        flush(controller) {
          const text = textDecoder.decode();
          if (text) controller.enqueue(text);
        },
      });
    }
  }

  (globalThis as any).TextDecoderStream = TextDecoderStreamPolyfill;
}

console.log("Web Streams polyfills loaded successfully");

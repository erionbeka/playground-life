import "@testing-library/jest-dom";

if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });

  // jsdom 20 ships no PointerEvent, so `fireEvent.pointerMove` falls back to a
  // plain Event and silently drops clientX/clientY. MouseEvent carries the
  // same coordinates, so it is enough to stand in.
  if (typeof window.PointerEvent === "undefined") {
    class PointerEventPolyfill extends MouseEvent {
      readonly pointerId: number;
      readonly pointerType: string;
      readonly isPrimary: boolean;

      constructor(type: string, params: PointerEventInit = {}) {
        super(type, params);
        this.pointerId = params.pointerId ?? 1;
        this.pointerType = params.pointerType ?? "mouse";
        this.isPrimary = params.isPrimary ?? true;
      }
    }

    Object.defineProperty(window, "PointerEvent", {
      writable: true,
      configurable: true,
      value: PointerEventPolyfill,
    });
    Object.defineProperty(globalThis, "PointerEvent", {
      writable: true,
      configurable: true,
      value: PointerEventPolyfill,
    });
  }
}

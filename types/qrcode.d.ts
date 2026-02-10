declare module "qrcode" {
  export function toDataURL(text: string, options?: unknown): Promise<string>;
  export function toCanvas(canvas: HTMLCanvasElement, text: string, options?: unknown): Promise<void>;
}

/** 뷰포트 카메라: 줌 + 팬 */
export class Camera {
  zoom = 3;
  panX = 0;
  panY = 0;

  private minZoom = 1;
  private maxZoom = 5;

  /** Canvas 2D 컨텍스트에 변환 적용 */
  apply(ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number, mapW: number, mapH: number): void {
    const scaledW = mapW * this.zoom;
    const scaledH = mapH * this.zoom;
    const offsetX = Math.floor((canvasW - scaledW) / 2 + this.panX);
    const offsetY = Math.floor((canvasH - scaledH) / 2 + this.panY);
    ctx.setTransform(this.zoom, 0, 0, this.zoom, offsetX, offsetY);
  }

  /** 화면 좌표 → 월드(타일) 좌표 */
  screenToWorld(
    screenX: number,
    screenY: number,
    canvasW: number,
    canvasH: number,
    mapW: number,
    mapH: number,
    tileSize: number,
  ): { col: number; row: number } {
    const scaledW = mapW * this.zoom;
    const scaledH = mapH * this.zoom;
    const offsetX = (canvasW - scaledW) / 2 + this.panX;
    const offsetY = (canvasH - scaledH) / 2 + this.panY;
    const worldX = (screenX - offsetX) / this.zoom;
    const worldY = (screenY - offsetY) / this.zoom;
    return {
      col: Math.floor(worldX / tileSize),
      row: Math.floor(worldY / tileSize),
    };
  }

  setZoom(z: number): void {
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, Math.round(z)));
  }

  adjustZoom(delta: number): void {
    this.setZoom(this.zoom + delta);
  }

  pan(dx: number, dy: number): void {
    this.panX += dx;
    this.panY += dy;
  }

  /** 맵 전체가 보이도록 줌/팬 리셋 */
  fitToCanvas(canvasW: number, canvasH: number, mapW: number, mapH: number): void {
    const zx = canvasW / mapW;
    const zy = canvasH / mapH;
    this.setZoom(Math.floor(Math.min(zx, zy)));
    this.panX = 0;
    this.panY = 0;
  }
}

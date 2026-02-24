import type { OfficeLayout } from "../types/office";

const COLS = 20;
const ROWS = 14;
const TILE_SIZE = 16;

// 0=void, 1=floor, 2=wall
function buildTiles(): number[] {
  const tiles: number[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1) {
        tiles.push(2); // wall
      } else {
        tiles.push(1); // floor
      }
    }
  }
  return tiles;
}

export const DEFAULT_LAYOUT: OfficeLayout = {
  cols: COLS,
  rows: ROWS,
  tileSize: TILE_SIZE,
  desks: [
    // Row 1: 4 desks
    { col: 3, row: 2, seatCol: 3, seatRow: 4 },
    { col: 7, row: 2, seatCol: 7, seatRow: 4 },
    { col: 11, row: 2, seatCol: 11, seatRow: 4 },
    { col: 15, row: 2, seatCol: 15, seatRow: 4 },
    // Row 2: 4 desks
    { col: 3, row: 7, seatCol: 3, seatRow: 9 },
    { col: 7, row: 7, seatCol: 7, seatRow: 9 },
    { col: 11, row: 7, seatCol: 11, seatRow: 9 },
    { col: 15, row: 7, seatCol: 15, seatRow: 9 },
  ],
  decorations: [
    { type: "plant", col: 18, row: 3 },
    { type: "plant", col: 18, row: 8 },
    { type: "coffee", col: 2, row: 11 },
    { type: "door", col: 17, row: 11 },
  ],
  tiles: buildTiles(),
};

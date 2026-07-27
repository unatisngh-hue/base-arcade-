import { COLS, ROWS, BEZEL } from './constants';

export interface CanvasContext {
  ctx: CanvasRenderingContext2D;
  CELL: number;
  W: number;
  H: number;
  COL: Record<string, string>;
}

export function getColors(css: CSSStyleDeclaration) {
  const c = (n: string) => css.getPropertyValue(n).trim();
  return {
    board: c('--board-bg'),
    grid: c('--grid'),
    block: c('--block'),
    hi: c('--block-hi'),
    white: c('--white'),
    orange: c('--orange'),
    yellow: c('--yellow'),
    dim: c('--dim'),
    stat: c('--stat'),
    btnFace: c('--btn-face'),
    btnText: c('--btn-text'),
  };
}

export function fitCanvas(
  canvas: HTMLCanvasElement,
  wrap: HTMLElement,
  ctx: CanvasRenderingContext2D,
  cols: number = COLS,
  rows: number = ROWS,
  bezel: number = BEZEL
): { CELL: number; W: number; H: number } {
  const bw = wrap.clientWidth;
  if (!bw) return { CELL: 0, W: 0, H: 0 };

  const W = bw - bezel * 2;
  const CELL = W / cols;
  const H = Math.round(rows * CELL);

  wrap.style.height = H + bezel * 2 + 2 + 'px';
  canvas.style.left = bezel + 'px';
  canvas.style.top = bezel + 'px';
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';

  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  return { CELL, W, H };
}

export function clearBoard(ctx: CanvasRenderingContext2D, W: number, H: number, boardColor: string) {
  ctx.fillStyle = boardColor;
  ctx.fillRect(0, 0, W, H);
}

export function drawGrid(ctx: CanvasRenderingContext2D, W: number, H: number, CELL: number, gridColor: string) {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  ctx.beginPath();

  for (let i = 1; i < COLS; i++) {
    const x = Math.round(i * CELL) + 0.5;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
  }

  for (let j = 1; j <= ROWS; j++) {
    const y = Math.min(Math.round(j * CELL) + 0.5, H - 0.5);
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
  }

  ctx.stroke();
}

export function cellBlock(
  ctx: CanvasRenderingContext2D,
  col: number,
  row: number,
  CELL: number,
  fill?: string,
  edge?: string,
  COL?: Record<string, string>
) {
  const x = Math.round(col * CELL);
  const y = Math.round(row * CELL);
  const s = Math.round(CELL);

  ctx.fillStyle = fill || COL?.block || '#244B8B';
  ctx.fillRect(x, y, s, s);
  ctx.strokeStyle = edge || COL?.hi || '#60A5FA';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
}

export function pxRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  edge?: string
) {
  ctx.fillStyle = fill;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  if (edge) {
    ctx.strokeStyle = edge;
    ctx.lineWidth = 2;
    ctx.strokeRect(Math.round(x) + 1, Math.round(y) + 1, Math.round(w) - 2, Math.round(h) - 2);
  }
}

export function dot(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

export function stepArrow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  len: number,
  spread: number,
  dir: number,
  fill: string
) {
  const n = 4;
  const stepX = spread / (2 * n);
  const stepY = len / n;
  const pts: number[][] = [[stepX, 0]];

  for (let i = 0; i < n; i++) {
    pts.push([(i + 1) * stepX, i * stepY]);
    pts.push([(i + 1) * stepX, (i + 1) * stepY]);
  }
  pts.push([-n * stepX, n * stepY]);
  for (let i = n - 1; i >= 0; i--) {
    pts.push([-(i + 1) * stepX, (i + 1) * stepY]);
    pts.push([-(i + 1) * stepX, i * stepY]);
  }
  pts.push([-stepX, 0]);

  const yShift = (n * stepY) / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(dir > 0 ? Math.PI / 2 : -Math.PI / 2);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1] - yShift);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i][0], pts[i][1] - yShift);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  col: string,
  align?: CanvasTextAlign
) {
  ctx.font = `${Math.max(6, Math.round(size))}px "LomoWebPixelLTStd-5", "Press Start 2P", monospace`;
  ctx.fillStyle = col;
  ctx.textAlign = align || 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

export function buildPixFrame(svg: SVGSVGElement, fw: number, fh: number, bezel: number = BEZEL) {
  if (!fw || !fh) return;

  const W = fw;
  const H = fh;
  const t = BEZEL;
  const inset = 0.5;
  const c = 16;

  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('preserveAspectRatio', 'none');

  const strips = [
    `M${c} ${inset}H${W - c}V${inset + t}H${c}Z`,
    `M${c} ${H - inset - t}H${W - c}V${H - inset}H${c}Z`,
    `M${inset} ${c}V${H - c}H${inset + t}V${c}Z`,
    `M${W - inset - t} ${c}V${H - c}H${W - inset}V${c}Z`,
    `M${c - 7} ${inset + 3}h7v7h-7Z`,
    `M${inset + 3} ${c - 7}h7v7h-7Z`,
    `M${W - c} ${inset + 3}h7v7h-7Z`,
    `M${W - inset - 10} ${c - 7}h7v7h-7Z`,
    `M${c - 7} ${H - inset - 10}h7v7h-7Z`,
    `M${inset + 3} ${H - c}h7v7h-7Z`,
    `M${W - c} ${H - inset - 10}h7v7h-7Z`,
    `M${W - inset - 10} ${H - c}h7v7h-7Z`,
  ];

  svg.innerHTML = strips.map((d) => `<path d="${d}" fill="var(--pix-frame)"/>`).join('');
}

export function pillSVG(w: number = 132, h: number = 29): string {
  const u = 2.6;
  const face = `M${u * 3 + 2.6} ${u}L${w - u * 3 - 2.6} ${u}L${w - u - 2.6} ${u * 2}L${w - 2.6} ${u * 3 + 1.4}L${w - 2.6} ${h - u * 3 - 1.4}L${w - u - 2.6} ${h - u * 2}L${w - u * 3 - 2.6} ${h - u}L${u * 3 + 2.6} ${h - u}L${u + 2.6} ${h - u * 2}L${2.6} ${h - u * 3 - 1.4}L${2.6} ${u * 3 + 1.4}L${u + 2.6} ${u * 2}Z`;
  const outline = `M${u * 3 + 2.6} 0L${w - u * 3 - 2.6} 0L${w - u} ${u * 1.2}L${w} ${u * 3}L${w} ${h - u * 3}L${w - u} ${h - u * 1.2}L${w - u * 3 - 2.6} ${h}L${u * 3 + 2.6} ${h}L${u} ${h - u * 1.2}L0 ${h - u * 3}L0 ${u * 3}L${u} ${u * 1.2}Z`;

  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
    <path d="${outline}" fill="var(--pill-outline)"/>
    <path d="${face}" fill="var(--pill-face)"/>
    <rect x="${u * 4}" y="${u}" width="${w - u * 8}" height="${u}" fill="#ffffff" opacity="0.29"/>
    <rect x="${u * 4}" y="${u * 2}" width="${u * 5}" height="${u}" fill="#ffffff"/>
    <rect x="${u * 3}" y="${u * 2}" width="${u}" height="${u * 2}" fill="#ffffff"/>
    <rect x="${u * 4}" y="${h - u * 2}" width="${w - u * 8}" height="${u}" fill="var(--pill-shade)"/>
    <rect x="${w - u * 4}" y="${h - u * 3}" width="${u}" height="${u}" fill="var(--pill-shade)"/>
  </svg>`;
}

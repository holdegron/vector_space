import { prepareCanvas } from './dom.js';

/** Whole-mission line chart with a time cursor; hover shows a value, click seeks. */
export function createSparkline(canvas, { values, duration, color, fill, format, onSeek }) {
  let min = Math.min(...values);
  let max = Math.max(...values);
  const pad = (max - min) * 0.1 || 1;
  min -= pad;
  max += pad;
  let hoverX = null;
  let cursorT = 0;

  function draw() {
    const { ctx, width, height } = prepareCanvas(canvas);
    const x = (i) => (i / (values.length - 1)) * width;
    const y = (v) => height - 2 - ((v - min) / (max - min)) * (height - 4);

    ctx.beginPath();
    values.forEach((v, i) => (i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v))));
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round';
    ctx.stroke();
    if (fill) {
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, fill);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    const cx = (cursorT / duration) * width;
    ctx.strokeStyle = 'rgba(235,245,255,0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, height);
    ctx.stroke();
    const ci = Math.round((cursorT / duration) * (values.length - 1));
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, y(values[ci]), 2.6, 0, Math.PI * 2);
    ctx.fill();

    if (hoverX !== null) {
      const i = Math.round((hoverX / width) * (values.length - 1));
      ctx.strokeStyle = 'rgba(125,211,252,0.35)';
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(hoverX, 0);
      ctx.lineTo(hoverX, height);
      ctx.stroke();
      ctx.setLineDash([]);
      const text = format(values[i]);
      ctx.font = '500 10px "IBM Plex Mono", monospace';
      const boxWidth = ctx.measureText(text).width + 10;
      const left = Math.min(width - boxWidth, Math.max(0, hoverX - boxWidth / 2));
      ctx.fillStyle = 'rgba(4,10,20,0.9)';
      ctx.fillRect(left, 0, boxWidth, 15);
      ctx.fillStyle = '#e3ecf8';
      ctx.fillText(text, left + 5, 11);
    }
  }

  canvas.addEventListener('pointermove', (e) => {
    hoverX = e.offsetX;
    draw();
  });
  canvas.addEventListener('pointerleave', () => {
    hoverX = null;
    draw();
  });
  canvas.addEventListener('click', (e) => onSeek((e.offsetX / canvas.clientWidth) * duration));

  return {
    draw,
    setTime(t) {
      cursorT = t;
      draw();
    },
  };
}

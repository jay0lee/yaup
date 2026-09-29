/**
 * YAUP - Image Utilities for Initials Signature Pad
 * Converts canvas strokes to low-resolution 1-bit monochrome (B/W) image
 */

/**
 * Check if the user has drawn sufficient strokes on the canvas
 * @param {HTMLCanvasElement} canvas
 * @param {number} minPixels - minimum number of marked pixels required
 * @returns {boolean}
 */
export function hasDrawnContent(canvas, minPixels = 25) {
  const ctx = canvas.getContext("2d");
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  let count = 0;

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    // If not transparent and not pure white
    if (alpha > 40) {
      const avgBrightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (avgBrightness < 220) {
        count++;
        if (count >= minPixels) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Downscale and threshold the drawing canvas to a crisp, low-resolution black & white PNG
 *
 * @param {HTMLCanvasElement} sourceCanvas - Original drawing canvas
 * @param {number} targetWidth - Target width (default 160px)
 * @param {number} targetHeight - Target height (default 80px)
 * @param {number} threshold - Luminance cutoff 0-255 (default 180)
 * @returns {{ dataUrl: string, width: number, height: number, approxBytes: number }}
 */
export function exportMonochromeImage(sourceCanvas, targetWidth = 160, targetHeight = 80, threshold = 180) {
  // Create offscreen thumbnail canvas
  const thumbCanvas = document.createElement("canvas");
  thumbCanvas.width = targetWidth;
  thumbCanvas.height = targetHeight;
  const ctx = thumbCanvas.getContext("2d");

  // Fill white background first
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, targetWidth, targetHeight);

  // Draw scaled source canvas
  ctx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);

  // Extract pixel buffer and threshold to 1-bit B/W
  const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
  const pixels = imgData.data;

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const a = pixels[i + 3];

    // Calculate perceived brightness
    const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

    // If it was drawn (dark enough and opaque enough) -> make pure black, else pure white
    if (a > 50 && brightness < threshold) {
      pixels[i] = 0;       // R
      pixels[i + 1] = 0;   // G
      pixels[i + 2] = 0;   // B
      pixels[i + 3] = 255; // Alpha full
    } else {
      pixels[i] = 255;     // R
      pixels[i + 1] = 255; // G
      pixels[i + 2] = 255; // B
      pixels[i + 3] = 255; // Alpha full
    }
  }

  ctx.putImageData(imgData, 0, 0);

  const dataUrl = thumbCanvas.toDataURL("image/png");
  // Calculate approximate base64 payload size
  const base64Content = dataUrl.split(",")[1] || "";
  const approxBytes = Math.round((base64Content.length * 3) / 4);

  return {
    dataUrl,
    width: targetWidth,
    height: targetHeight,
    approxBytes
  };
}

/**
 * Setup drawing pad interactions for touch and mouse
 */
export function initSignaturePad(canvas, onStrokeCallback) {
  const ctx = canvas.getContext("2d");
  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;

  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  function getCanvasCoords(event) {
    const rect = canvas.getBoundingClientRect();
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  function start(e) {
    e.preventDefault();
    isDrawing = true;
    const { x, y } = getCanvasCoords(e);
    lastX = x;
    lastY = y;
    // Draw initial dot
    ctx.beginPath();
    ctx.arc(x, y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
    if (onStrokeCallback) onStrokeCallback();
  }

  function draw(e) {
    if (!isDrawing) return;
    e.preventDefault();
    const { x, y } = getCanvasCoords(e);
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
    lastX = x;
    lastY = y;
    if (onStrokeCallback) onStrokeCallback();
  }

  function stop(e) {
    if (isDrawing) {
      isDrawing = false;
      if (onStrokeCallback) onStrokeCallback();
    }
  }

  canvas.addEventListener("mousedown", start);
  canvas.addEventListener("mousemove", draw);
  window.addEventListener("mouseup", stop);

  canvas.addEventListener("touchstart", start, { passive: false });
  canvas.addEventListener("touchmove", draw, { passive: false });
  window.addEventListener("touchend", stop);

  return {
    clear: () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (onStrokeCallback) onStrokeCallback();
    }
  };
}

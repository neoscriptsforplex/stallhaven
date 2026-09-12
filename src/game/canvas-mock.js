/** Minimal canvas/document stub so Three.js textures can build in Node tests. */

class FakeGradient {
  addColorStop() {}
}

class FakeCtx {
  constructor() {
    this.font = '';
    this.fillStyle = '';
    this.strokeStyle = '';
    this.lineWidth = 1;
    this.textAlign = '';
    this.textBaseline = '';
    this.globalAlpha = 1;
  }

  measureText() {
    return { width: 40 };
  }

  createLinearGradient() {
    return new FakeGradient();
  }

  createRadialGradient() {
    return new FakeGradient();
  }

  clearRect() {}
  fillRect() {}
  strokeRect() {}
  beginPath() {}
  closePath() {}
  moveTo() {}
  lineTo() {}
  bezierCurveTo() {}
  quadraticCurveTo() {}
  arc() {}
  ellipse() {}
  fill() {}
  stroke() {}
  fillText() {}
  strokeText() {}
  save() {}
  restore() {}
  translate() {}
  rotate() {}
  scale() {}
  clip() {}
  drawImage() {}
}

class FakeCanvas {
  constructor() {
    this.width = 64;
    this.height = 64;
    this.style = {};
  }

  getContext() {
    return new FakeCtx();
  }
}

if (!globalThis.document?.createElement) {
  globalThis.document = {
    createElement(tag) {
      if (tag === 'canvas') return new FakeCanvas();
      return { style: {} };
    },
  };
}

import * as PIXI from 'pixi.js';

import { SYMBOL_SIZE, VISIBLE_SYMBOLS } from '../utils';

export class Reel {
  constructor(app, x, y, createSumbol, strip, speed = 2) {
    this.container = new PIXI.Container();
    this.container.x = x;
    this.container.y = y;
    this.sprites = [];
    this.strip = [...strip];
    this.position = 0;
    this.speed = speed; // скорость вращения (пикселей за кадр)
    this.baseSpeed = speed;
    this.spinning = false;
    this.stripSize = strip.length;

    this.onStopped = null; //колбак остановки

    // Создаём ленту из символов
    for (let i = 0; i < this.stripSize; i++) {
      const sym = this.strip[i];
      const sprite = createSumbol(sym);
      sprite.width = SYMBOL_SIZE;
      sprite.height = SYMBOL_SIZE;
      sprite.y = i * SYMBOL_SIZE;
      this.container.addChild(sprite);
      this.sprites.push(sprite);
    }
    this.targetPosition = null;
    // console.log("maxY", this.sprites.length);
    // Маска
    const mask = new PIXI.Graphics();
    mask.beginFill(0xffffff);
    mask.drawRect(0, 0, SYMBOL_SIZE, SYMBOL_SIZE * VISIBLE_SYMBOLS);
    mask.endFill();
    this.container.mask = mask;
    this.container.addChild(mask);

    app.stage.addChild(this.container);
    this._syncPositions();
  }

  stopAtSymbol(symbolName) {
    if (!this.spinning) return;
    
    // this.position это самый верх нужно сделать смещение до центра
    // 5 => 2, 3 => 1 и тд
    const centerIndex = Math.floor(VISIBLE_SYMBOLS / 2);
    const offset = centerIndex * SYMBOL_SIZE;
    const maxPos = this.stripSize * SYMBOL_SIZE;
    const pos = this.position;

    // this.strip.indexOf(symbolName) не учитывает цикличности
    // let target = index * SYMBOL_SIZE - offset; так не будет подкручивать к первому
    // все что ниже это тоже самое тока находит первый по кругу

    // Находим все индексы символа
    let indices = [];
    for (let i = 0; i < this.stripSize; i++) {
      if (this.strip[i] === symbolName) indices.push(i);
    }
    if (indices.length === 0) return;

    let bestDelta = Infinity;
    let bestTarget = null;
    for (let idx of indices) {
      let targetPx = idx * SYMBOL_SIZE - offset;
      let delta = targetPx - pos;
      // Приводим дельту к положительному значению в диапазоне [0, maxPos)
      delta = ((delta % maxPos) + maxPos) % maxPos;
      if (delta < bestDelta) {
        bestDelta = delta;
        bestTarget = pos + delta;
      }
    }
    /// -----

    if (bestTarget !== null) {
      this.targetPosition = bestTarget;
    }
  }

  startSpin() {
    this.spinning = true;
    this.targetPosition = null;
    this.speed = this.baseSpeed;
  }

  stopSpin() {
    this.spinning = false;
  }

  update(delta) {
    if (!this.spinning) return;

    if (this.targetPosition !== null) {
      let diff = this.targetPosition + this.position;
      // let diff = this.targetPosition - this.position;

      // Если diff стал отрицательным – перешагнули, подправляем
      if (diff < 0 || Math.abs(diff) < 0.5) {
        this.position = this.targetPosition;
        this.spinning = false;
        this.targetPosition = null;
        this._syncPositions();
        // Вызываем колбэк остановки, если он задан
        if (this.onStopped) this.onStopped();
        return;
      }
      // Замедление: чем меньше diff, тем сильнее снижаем скорость
      // Но скорость не падает ниже 0.5 (чтобы не застревать)
      // если мы близко замедляемся (половина символа) инеаче скорость обычная
      let minSpeed = 0.5;
      let targetSpeed = Math.min(this.baseSpeed, diff / SYMBOL_SIZE + 0.5);
      this.speed = Math.max(minSpeed, targetSpeed, this.speed * 0.98);
      let step = this.speed * delta;
      if (step > diff) step = diff;
      this.position -= step;
      // this.position += step;
    } else {
      this.position -= this.speed * delta;
      // this.position += this.speed * delta;
      // Нормализация для обычного вращения
      const maxPos = this.stripSize * SYMBOL_SIZE;
      if (this.position >= maxPos) this.position -= maxPos;
      if (this.position < 0) this.position += maxPos;
    }

    this._syncPositions();
  }

  getCenterSymbolIndex() {
    const centerIndex = Math.floor(VISIBLE_SYMBOLS / 2);        // номер видимого слота (0,1,2)
    const totalHeight = this.stripSize * SYMBOL_SIZE;
    const rawPos = (this.position + centerIndex * SYMBOL_SIZE) % totalHeight;
    return Math.floor(rawPos / SYMBOL_SIZE) % this.stripSize;   // индекс в ленте
  }

  playWinOnCenter(animationName) {
    const centerIndex = this.getCenterSymbolIndex();
    if (centerIndex >= this.sprites.length) return;
    const centerSprite = this.sprites[centerIndex];
    if (centerSprite && centerSprite.state) {
      centerSprite.state.setAnimation(0, animationName, false);
    }
  }

  _syncPositions() {
    const maxY = this.stripSize * SYMBOL_SIZE;
    for (let i = 0; i < this.sprites.length; i++) {
      let y = (i * SYMBOL_SIZE - this.position) % maxY;
      if (y < -SYMBOL_SIZE) y += maxY;
      this.sprites[i].y = y;
    }
  }
}

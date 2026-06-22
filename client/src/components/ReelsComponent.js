// components/ReelsComponent.js
import * as PIXI from 'pixi.js';
import { Reel } from './Reel.js';
import {
  generateVisualStripFromWeights,
  REEL_WIDTH,
  SYMBOL_SIZE,
  VISIBLE_SYMBOLS,
} from '../utils.js';
import { onState, onField } from '../xstate-subscribers.js';
import { createSpineSymbol } from '../spineLoader.js';

export function createReelsComponent(actor, app) {
  let reels = [];
  let unsubscribers = [];

  function repositionReels(count) {
    const startX = (app.screen.width - count * REEL_WIDTH) / 2;
    const startY = (app.screen.height - VISIBLE_SYMBOLS * SYMBOL_SIZE) / 2;
    reels.forEach((reel, i) => {
      reel.container.x = startX + i * REEL_WIDTH;
      reel.container.y = startY;
    });
  }

  function createReels(config) {
    const { symbolWeights, reelsCount = 5 } = config;

    const createSumbol = (sym) => {
      return createSpineSymbol(sym);
      // return new PIXI.Sprite(PIXI.Assets.get(sym));
    };

    for (let i = 0; i < reelsCount; i++) {
      const visualStrip = generateVisualStripFromWeights(symbolWeights);
      const reel = new Reel(app, 0, 0, createSumbol, visualStrip, 4);
      reel.onStopped = () => {
        actor.send({ type: 'REEL_STOPPED' });
      };
      reels.push(reel);
    }

    repositionReels(reelsCount);
    app.ticker.add((delta) => {
      for (let r of reels) r.update(delta);
    });
  }

  function setupSubscriptions() {
    unsubscribers.push(
      onField(actor, 'config', (ctx) => {
        if (ctx.config && reels.length === 0) {
          createReels(ctx.config);
        }
      })
    );

    unsubscribers.push(
      onState(actor, 'spinning', () => {
        reels.forEach((reel) => reel.startSpin());
      })
    );

    unsubscribers.push(
      onState(actor, 'stoppingReels', (ctx) => {
        
        
        if (ctx.spinResult?.reels) {
          reels.forEach((reel, idx) => {
            reel.stopAtSymbol(ctx.spinResult.reels[idx]);
          });
        }
      })
    );

    unsubscribers.push(
      onState(actor, 'idle', (ctx) => {
        if (ctx.spinResult?.reels) {

          const symbolToSpine = {
            cherry: 'h1',
            lemon: 'h2',
            orange: 'h3',
            bell: 'h4',
            seven: 'h5',
          };
          reels.forEach((reel, idx) => {
            const symbol = ctx.spinResult.reels[idx];
            const animName = symbolToSpine[symbol];
            if (animName) {
              reel.playWinOnCenter(animName);
            }
          });
        }
      })
    );
  }

  function init() {
    setupSubscriptions();
  }

  function destroy() {
    unsubscribers.forEach((unsub) => unsub.unsubscribe?.());
    // Дополнительная очистка: убрать тикер, удалить спрайты
    reels.forEach((reel) => {
      reel.container.destroy({ children: true });
    });
    reels = [];
  }

  return { init, destroy };
}

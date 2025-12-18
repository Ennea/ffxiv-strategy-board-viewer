import { decodeStrategyBoardShareString } from './decoder';
import { drawStrategyBoard } from './draw';


document.getElementById('form')?.addEventListener('submit', async (event: Event) => {
    event.preventDefault();
    const input = document.getElementById('input') as HTMLInputElement;
    const strategyBoardData = decodeStrategyBoardShareString(input.value);
    if (strategyBoardData) {
        drawStrategyBoard(strategyBoardData);
    }
});

const DEMO_BOARD = '[stgy:aLcnpxPulnsNdEvWZVSOgAvmgt4MN3i9kxbOQjW9HfobttiBlZ8KfzMlzhcEk98N2r7y-2D5Z3nZrh195ZnRNWORCB4XMwidyV2CX5k0S+ow+VNeEzhWhhfseFIH5ekbMGLBlcsD+2iKQBv1qbQyJ9TRRogiQHDlGXdycaI0qJwN7Ue3Ypz6bfC31Y4pBudPZ8Q7Rw8W1XL0Gfk6+Tavla1gPyvrs]';
drawStrategyBoard(decodeStrategyBoardShareString(DEMO_BOARD)!);

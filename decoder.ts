import pako from 'pako';
import { mapIn, forwardTranslate, mapOut, toBase64, error } from './util';


const STRATEGY_BOARD_PREFIX = '[stgy:a';
const STRATEGY_BOARD_SUFFIX = ']';

export function decodeStrategyBoardShareString(shareString: string, suppressErrors: boolean = false) {
    if (
        !shareString.startsWith(STRATEGY_BOARD_PREFIX) ||
        !shareString.endsWith(STRATEGY_BOARD_SUFFIX) ||
        shareString.length < STRATEGY_BOARD_PREFIX.length + STRATEGY_BOARD_SUFFIX.length + 1
    ) {
        error('Invalid strategy board.', suppressErrors);
        return null;
    }

    const buffer = shareString.substring(STRATEGY_BOARD_PREFIX.length, shareString.length - STRATEGY_BOARD_SUFFIX.length);
    const seed = mapIn(forwardTranslate(buffer[0]));
    const out = new ArrayBuffer(buffer.length - 1);
    const u8View = new Uint8Array(out);

    for (let i = 0; i < buffer.length - 1; i++) {
        const c = buffer[i + 1];
        const t = forwardTranslate(c);
        const x = mapIn(t);
        const y = (x - seed - i) & 0x3f;
        u8View[i] = mapOut(y).charCodeAt(0);
    }

    const base64 = new TextDecoder('windows-1252').decode(out);
    try {
        // @ts-expect-error
        const decoded = Uint8Array.fromBase64(toBase64(base64));
        const decompressed = pako.inflate(decoded.slice(6));
        if (!decompressed) {
            throw null;
        }

        return decompressed;
    } catch (e) {
        error('Invalid strategy board.', suppressErrors);
        return null;
    }
}

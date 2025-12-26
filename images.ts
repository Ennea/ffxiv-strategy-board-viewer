import { SpriteParameters } from './objects';


export function loadCachedImage(url: string): Promise<HTMLImageElement>;
export function loadCachedImage(spriteParams: SpriteParameters): Promise<HTMLImageElement>;
export function loadCachedImage(urlOrSpriteParams: string | SpriteParameters): Promise<HTMLImageElement> {
    if (!window.stgyImageCache) {
        window.stgyImageCache = {};
    }

    return new Promise<HTMLImageElement>((resolve, reject) => {
        let url: string;
        if (typeof urlOrSpriteParams === 'string') {
            url = urlOrSpriteParams;
        } else {
            if (urlOrSpriteParams.special || !urlOrSpriteParams.image) {
                reject();
                return;
            }
            url = urlOrSpriteParams.image;
        }

        if (url in window.stgyImageCache) {
            resolve(window.stgyImageCache[url]);
            return;
        }

        const image = new Image();
        image.onload = () => {
            window.stgyImageCache[url!] = image;
            resolve(image);
        }
        image.onerror = reject;
        image.src = url + '.webp';
    });
}

type ImageCache = { [key: string]: HTMLImageElement };

declare global {
    interface Window {
        stgyImageCache: ImageCache;
    }
}

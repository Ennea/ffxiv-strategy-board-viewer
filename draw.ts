import { knownObjects, objectScaleFactor } from './objects';
import { parseStrategyBoardData, SBObject } from './parser';


function loadImage(url: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = url;
    });
}

function getCanvasContext() {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    return canvas.getContext('2d')!;
}

function duplicateImage(image: HTMLImageElement, horizontalCount: number = 1, verticalCount: number = 1): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = image.width * horizontalCount;
    canvas.height = image.height * verticalCount;

    const ctx = canvas.getContext('2d')!;
    for (let y = 0; y < verticalCount; y++) {
        for (let x = 0; x < horizontalCount; x++) {
            ctx.drawImage(image, x * image.width, y * image.height);
        }
    }

    return canvas;
}

function makeAnnulusSector(innerRadius: number, outerRadius: number, arcAngle: number) {
    const x = outerRadius;
    const y = outerRadius;
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + arcAngle;

    const canvas = document.createElement('canvas');
    canvas.width = outerRadius * 2;
    canvas.height = outerRadius * 2;

    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgb(255 144 0 / 0.75)';

    // outside arc
    ctx.arc(x, y, outerRadius, startAngle, endAngle, false);
    // line to inside
    ctx.lineTo(x + innerRadius * Math.cos(endAngle), y + innerRadius * Math.sin(endAngle));
    // inside arc
    ctx.arc(x, y, innerRadius, endAngle, startAngle, true);
    // line to outside
    ctx.lineTo(x + outerRadius * Math.cos(startAngle), y + outerRadius * Math.sin(startAngle));
    ctx.closePath();
    ctx.fill();

    // below we calculate the edge of the ring to crop the canvas to remove any transparent pixels,
    // because SE does this and we need to recreate it so we have a (close to) matching bounding box
    let leftEdge = 0;
    let rightEdge = 0;
    let bottomEdge = 0;

    // left edge
    if (arcAngle < Math.PI * 1.5 && arcAngle >= Math.PI) {
        leftEdge = (1 + Math.sin(arcAngle)) * outerRadius;
    } else if (arcAngle < Math.PI) {
        leftEdge = outerRadius;
    }

    // bottom edge
    if (arcAngle < Math.PI) {
        if (arcAngle >= Math.PI * 0.5) {
            bottomEdge = (1 + Math.cos(arcAngle)) * outerRadius;
        } else {
            bottomEdge = outerRadius + Math.cos(arcAngle) * innerRadius;
        }
    }

    // right edge
    if (arcAngle < Math.PI * 0.5) {
        rightEdge = (1 - Math.sin(arcAngle)) * outerRadius;
    }

    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = outerRadius * 2 - leftEdge - rightEdge;
    croppedCanvas.height = outerRadius * 2 - bottomEdge;

    const croppedCtx = croppedCanvas.getContext('2d')!;
    croppedCtx.drawImage(canvas, -leftEdge, 0);

    return croppedCanvas;
}

function drawImage(
    image: HTMLImageElement | HTMLCanvasElement,
    x: number,
    y: number,
    angle: number = 0,
    scale: number = 1,
    alpha: number = 1,
    flipHorizontal: boolean = false,
    flipVertical: boolean = false
) {
    const ctx = getCanvasContext();
    ctx.save();

    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale * (flipHorizontal ? -1 : 1), scale * (flipVertical ? -1 : 1));
    ctx.globalAlpha = alpha;
    ctx.drawImage(image, -image.width / 2, -image.height / 2);

    ctx.restore();
}

function drawLine(obj: SBObject) {
    const x2 = Math.round(obj.param1 / 5120 * 1024);
    const y2 = Math.round(obj.param2 / 3840 * 768);

    const ctx = getCanvasContext();
    ctx.save();

    ctx.lineCap = 'round';
    ctx.lineWidth = obj.param3 * 2;
    ctx.strokeStyle = `rgb(${obj.color.red} ${obj.color.green} ${obj.color.blue} / ${obj.color.alpha})`;

    ctx.beginPath();
    ctx.moveTo(obj.coordinates.x, obj.coordinates.y);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.restore();
}

function drawRectangle(obj: SBObject) {
    const width = obj.param1 * 2;
    const height = obj.param2 * 2;

    const ctx = getCanvasContext();
    ctx.save();

    ctx.fillStyle = `rgb(${obj.color.red} ${obj.color.green} ${obj.color.blue} / ${obj.color.alpha})`;

    ctx.translate(obj.coordinates.x, obj.coordinates.y);
    ctx.rotate(obj.angle);
    ctx.fillRect(-width / 2, -height / 2, width, height);

    ctx.restore();
}

function drawDonut(obj: SBObject) {
    const arcAngle = obj.param1 / 180 * Math.PI;
    // always 0 for fan AoE
    const innerRadius = obj.id === 10 ? 0 : obj.param2;
    const outerRadius = 250;

    drawImage(
        makeAnnulusSector(innerRadius, outerRadius, arcAngle),
        obj.coordinates.x,
        obj.coordinates.y,
        obj.angle,
        obj.scale / 50,
        1,
        obj.flags.flipHorizontal,
        obj.flags.flipVertical
    );
}

function drawText(obj: SBObject) {
    const text = obj.string;
    if (!text) {
        console.error('Text object has no string.');
        return;
    }

    const ctx = getCanvasContext();
    ctx.save();

    ctx.font = '30px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 3;
    ctx.shadowColor = 'black';
    ctx.fillStyle = `rgb(${obj.color.red} ${obj.color.green} ${obj.color.blue})`;
    ctx.strokeStyle = `rgb(0 0 0)`;

    ctx.strokeText(text, obj.coordinates.x, obj.coordinates.y);
    ctx.fillText(text, obj.coordinates.x, obj.coordinates.y);

    ctx.restore();
}

async function drawObject(obj: SBObject) {
    if (!knownObjects.includes(obj.id)) {
        console.error(`Unknown object ID ${obj.id}.`);
        return;
    }

    const scale = obj.scale * (objectScaleFactor[obj.id] ?? 1);
    let image: HTMLImageElement;

    // special handling for specific objects
    switch (obj.id) {
        // line AoE
        case 11:
            drawRectangle(obj);
            break;

        // line
        case 12:
            drawLine(obj);
            break;

        // line stack
        case 15:
            image = await loadImage(`assets/objects/${obj.id}.webp`);
            drawImage(
                duplicateImage(image, 1, obj.param2),
                obj.coordinates.x,
                obj.coordinates.y,
                obj.angle,
                scale,
                obj.color.alpha,
                obj.flags.flipHorizontal,
                obj.flags.flipVertical
            );
            break;

        // fan AoE & donut
        case 10:
        case 17:
            drawDonut(obj);
            break;

        // text
        case 100:
            drawText(obj);
            break;

        // linear knockback
        case 110:
            image = await loadImage(`assets/objects/${obj.id}.webp`);
            drawImage(
                duplicateImage(image, obj.param1, obj.param2),
                obj.coordinates.x,
                obj.coordinates.y,
                obj.angle,
                scale,
                obj.color.alpha,
                obj.flags.flipHorizontal,
                obj.flags.flipVertical
            );
            break;

        default:
            image = await loadImage(`assets/objects/${obj.id}.webp`);
            drawImage(image, obj.coordinates.x, obj.coordinates.y, obj.angle, scale, obj.color.alpha);
            break;
    }
}

export async function drawStrategyBoard(strategyBoardData: Uint8Array) {
    const strategyBoard = parseStrategyBoardData(strategyBoardData);

    const ctx = getCanvasContext();
    const background = await loadImage(`assets/background/${strategyBoard.background}.webp`);
    ctx.clearRect(0, 0, 1024, 768);
    ctx.drawImage(background, 0, 0);

    for (const obj of strategyBoard.objects) {
        await drawObject(obj);
    }
}

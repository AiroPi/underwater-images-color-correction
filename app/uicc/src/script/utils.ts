import * as PIXI from "pixi.js";

export async function exportLargeImage(
    app: PIXI.Application,
    sprite: PIXI.Sprite,
    originalWidth: number,
    originalHeight: number
) {
    // This function is used to export the final image chunk by chunk.
    // We are doing this because on mobile devices, exporting the whole image at once could crash the device.
    // So we generate small chunks that are placed into a larger canvas (that fit the original image size).
    // TODO: some devices have a maximum canvas size (4096*4096 on iPhone X, 8192*8192 on iPhone 15), so we could set some maximum values to downscale the image...

    const chunkSize = 2048; // Adjust based on device capabilities, chunks are chunkSize*chunkSize big.

    const canvas = document.createElement("canvas");
    canvas.width = originalWidth;
    canvas.height = originalHeight;

    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

    for (let y = 0; y < originalHeight; y += chunkSize) {
        for (let x = 0; x < originalWidth; x += chunkSize) {
            const chunkWidth = Math.min(chunkSize, originalWidth - x);
            const chunkHeight = Math.min(chunkSize, originalHeight - y);

            const chunkSprite = new PIXI.Sprite(sprite.texture);
            chunkSprite.filters = sprite.filters;
            chunkSprite.x = -x;
            chunkSprite.y = -y;

            const renderTexture = PIXI.RenderTexture.create({
                width: chunkWidth,
                height: chunkHeight,
            });

            app.renderer.render({
                container: chunkSprite,
                target: renderTexture,
            });
            const chunkCanvas = app.renderer.extract.canvas(
                renderTexture
            ) as HTMLCanvasElement;
            ctx.drawImage(chunkCanvas, x, y);

            renderTexture.destroy();
        }
    }

    return canvas;
}

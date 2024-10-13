// These are "magic" matrix used later to tweak the filter matrix.
const magicLessBlue = [
    0, 0, 0, 0, 0, 0, 0.3, 0, 0, 0, 0, 0, 1, 0, -1.3, 0, 0, 0, 0, 0,
];
const magicLessGreen = [
    0, 0, 0, 0, 0, 0, 1, 0, 0, -1.3, 0, 0, 0.3, 0, 0, 0, 0, 0, 0, 0,
];
const magicMoreRed = [
    0.8, 0.7, 0.5, 0, -1.3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
];
const magicLessRed = [
    -0.8, -0.7, -0.5, 0, 1.3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
];

const identity = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];

const videoMatrixInterval = 0.1;
// The maximum x or y dimension of the image that will be displayed.
const previewMaxDimension = 2048;

// UI elements
const imageZone = document.getElementById("image-zone");
const exportButtonElement = document.getElementById("export-button");
const gainCursorElement = document.getElementById("gain");
const greenBlueCursorElement = document.getElementById("greenblue");
const redCursorElement = document.getElementById("red");

class UnderwaterCorrector {
    constructor(fileData, fileType, fileName) {
        console.log(fileType);
        this.originalFileData = fileData;
        this.originalFileName = fileName;
        this.fileType = fileType;

        // An array of matrix filter. When the target is an image, this is a single-element matrix.
        // When the target is a video, there is one matrix generated for every 2 seconds of video.
        this.filterMatrixes = new Array();

        this.init();
        this.bindDomElements();
    }

    // One-time call methods (initialisation)

    async init() {
        this.pixiApp = new PIXI.Application();
        await this.pixiApp.init();

        this.previewFilter = new PIXI.ColorMatrixFilter();

        this.texture = await PIXI.Assets.load(this.originalFileData);
        this.sprite = new PIXI.Sprite(this.texture);
        this.sprite.filters = [this.previewFilter];
        this.pixiApp.stage.addChild(this.sprite);

        this.domElement = this.texture.source.resource;
        if (this.fileType.startsWith("video")) {
            this.domElement.pause();
        }

        this.scalePreview();
        this.pixiApp.renderer.render(this.pixiApp.stage);

        if (this.fileType.startsWith("video")) {
            await this.generateVideoFilterMatrixes();
            this.updatePreviewFilterBg();
        } else {
            this.filterMatrixes.push(this.getMatrixFromCurrentStage());
        }
        this.previewFilter.matrix = this.filterMatrixes[0];

        // TODO: set css to the css file
        this.pixiApp.canvas.style.width = "100%";
        this.pixiApp.canvas.style.height = "100%";
        this.pixiApp.canvas.style.objectFit = "contain";
        // Add the canvas to the DOM
        imageZone.appendChild(this.pixiApp.canvas);
    }

    bindDomElements() {
        [gainCursorElement, greenBlueCursorElement, redCursorElement].forEach(
            (e) => {
                e.addEventListener("input", () => this.updatePreviewFilter());
            }
        );

        exportButtonElement.addEventListener("click", () => this.download());
    }

    scalePreview() {
        const imageWidth = this.sprite.texture.width;
        const imageHeight = this.sprite.texture.height;

        // Scale the image to match the maximum dimension
        const scaleX = previewMaxDimension / imageWidth;
        const scaleY = previewMaxDimension / imageHeight;

        const scale = Math.min(scaleX, scaleY, 1); // Ensure we don't scale up the image

        this.previewWidth = Math.round(imageWidth * scale);
        this.previewHeight = Math.round(imageHeight * scale);

        this.sprite.width = this.previewWidth;
        this.sprite.height = this.previewHeight;

        this.pixiApp.renderer.resize(this.previewWidth, this.previewHeight);
    }

    async generateVideoFilterMatrixes() {
        const video = this.domElement;
        for (
            let currentTime = 0;
            currentTime < video.duration;
            currentTime += videoMatrixInterval
        ) {
            const seekPromise = new Promise((resolve) => {
                video.addEventListener("seeked", resolve, {
                    once: true,
                });
            });
            video.currentTime = currentTime;
            await seekPromise;

            this.filterMatrixes.push(this.getMatrixFromCurrentStage());
        }
        video.currentTime = 0;
        video.play();
    }

    // Static methods

    static async exportLargeImage(app, sprite, originalWidth, originalHeight) {
        // This function is used to export the final image chunk by chunk.
        // We are doing this because on mobile devices, exporting the whole image at once could crash the device.
        // So we generate small chunks that are placed into a larger canvas (that fit the original image size).
        // TODO: some devices have a maximum canvas size (4096*4096 on iPhone X, 8192*8192 on iPhone 15), so we could set some maximum values to downscale the image...

        const chunkSize = 2048; // Adjust based on device capabilities, chunks are chunkSize*chunkSize big.

        const canvas = document.createElement("canvas");
        canvas.width = originalWidth;
        canvas.height = originalHeight;

        const ctx = canvas.getContext("2d");

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
                const chunkCanvas = app.renderer.extract.canvas(renderTexture);
                ctx.drawImage(chunkCanvas, x, y);

                renderTexture.destroy();
            }
        }

        return canvas;
    }

    static getTweakedMatrix(matrix) {
        // Function the get the positions from the cursors, and change the matrix value using the magic matrixes
        let lessBlue, lessGreen, lessRed, moreRed;
        lessBlue = lessGreen = lessRed = moreRed = 0;

        // Cursors go from negative to positive value. Depending of their position, we want to remove green or to remove green.
        if (greenBlueCursorElement.value < 0) {
            lessBlue = Math.abs(greenBlueCursorElement.value);
        } else {
            lessGreen = greenBlueCursorElement.value;
        }
        if (redCursorElement.value < 0) {
            lessRed = Math.abs(redCursorElement.value);
        } else {
            moreRed = redCursorElement.value;
        }

        // We calculate a new matrix based on the original matrix generated from the algorithm.
        const tweakedMatrix = matrix.map(
            (value, i) =>
                identity[i] +
                gainCursorElement.value * (value - identity[i]) +
                lessBlue * magicLessBlue[i] +
                lessGreen * magicLessGreen[i] +
                moreRed * magicMoreRed[i] +
                lessRed * magicLessRed[i]
        );

        return tweakedMatrix;
    }

    // Utility methods

    getMatrixFromCurrentStage() {
        const pixels = this.pixiApp.renderer.extract.pixels(this.pixiApp.stage);

        const filterMatrix = getColorFilterMatrix(
            pixels.pixels,
            pixels.width,
            pixels.height
        );

        return filterMatrix;
    }

    updatePreviewFilter() {
        let index;
        if (this.fileType.startsWith("video")) {
            index = Math.floor(
                this.domElement.currentTime / videoMatrixInterval
            );
        } else {
            // For images, the filter is always at index 0.
            index = 0;
        }
        this.previewFilter.matrix = UnderwaterCorrector.getTweakedMatrix(
            this.filterMatrixes[index]
        );
    }

    // Other methods

    updatePreviewFilterBg() {
        /*
        We use different matrix for video files.
        This "background function" will constantly update the filter matrix while viewing video files.
        requestAnimationFrame will call the function passed in argument at the next time the screen is refreshed.
        */
        let previousIndex = 0;
        const self = this;
        function update() {
            const index = Math.floor(
                self.domElement.currentTime / videoMatrixInterval
            );
            if (previousIndex != index) {
                previousIndex = index;
                self.updatePreviewFilter();
            }
            requestAnimationFrame(update);
        }
        requestAnimationFrame(update);
    }

    async download() {
        const a = document.createElement("a");

        const dotI = this.originalFileName.lastIndexOf(".");
        const name = this.originalFileName.substring(0, dotI);
        a.download = `${name}-edited.jpg`;

        // We create a new sprite with the original dimensions (no downscale)
        const texture = await PIXI.Assets.load(this.originalFileData);
        const originalWidth = texture.width;
        const originalHeight = texture.height;
        const sprite = new PIXI.Sprite(texture);
        const filter = new PIXI.ColorMatrixFilter();
        filter.matrix = this.filterMatrixes[0];
        sprite.filters = [filter];

        const canvas = await UnderwaterCorrector.exportLargeImage(
            this.pixiApp,
            sprite,
            originalWidth,
            originalHeight
        );
        const jpegData = canvas.toDataURL("image/jpeg", 0.9);

        // TODO: add the original metadata to the generated media
        a.href = jpegData;
        a.click();
    }
}

document.querySelectorAll(".drop-zone__input").forEach((inputElement) => {
    // Handle file drop
    const dropZoneElement = inputElement.closest(".drop-zone");

    dropZoneElement.addEventListener("click", () => {
        inputElement.click();
    });

    dropZoneElement.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZoneElement.classList.add("drop-zone--over");
    });

    ["dragleave", "dragend"].forEach((type) => {
        dropZoneElement.addEventListener(type, () => {
            dropZoneElement.classList.remove("drop-zone--over");
        });
    });

    function fileUploadEventHandler(file) {
        if (file) {
            handleFile(file);
            dropZoneElement.classList.add("hidden");
        }
    }
    dropZoneElement.addEventListener("drop", (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        fileUploadEventHandler(file);
    });
    dropZoneElement.addEventListener("change", (e) => {
        const file = e.target.files[0];
        fileUploadEventHandler(file);
    });
});

async function handleFile(file) {
    // Handle dropped file
    imageZone.classList.remove("hidden");
    const fileType = file.type;

    const reader = new FileReader();
    reader.onload = () =>
        new UnderwaterCorrector(reader.result, fileType, file.name);
    reader.readAsDataURL(file);
}

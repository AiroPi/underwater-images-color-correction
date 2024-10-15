import * as ExifReader from "exifreader";
import * as piexif from "piexifjs";
import * as PIXI from "pixi.js";
import { exifReaderToPiexif } from "./exif";
import { getColorFilterMatrix } from "./image-correction";

// These are "magic" matrix used later to tweak the filter matrix.
const magicLessBlue: PIXI.ColorMatrix = [
    0, 0, 0, 0, 0, 0, 0.3, 0, 0, 0, 0, 0, 1, 0, -1.3, 0, 0, 0, 0, 0,
];
const magicLessGreen: PIXI.ColorMatrix = [
    0, 0, 0, 0, 0, 0, 1, 0, 0, -1.3, 0, 0, 0.3, 0, 0, 0, 0, 0, 0, 0,
];
const magicMoreRed: PIXI.ColorMatrix = [
    0.8, 0.7, 0.5, 0, -1.3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
];
const magicLessRed: PIXI.ColorMatrix = [
    -0.8, -0.7, -0.5, 0, 1.3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
];

const identity: PIXI.ColorMatrix = [
    1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0,
];

const videoMatrixInterval = 0.2;
// The maximum x or y dimension of the image that will be displayed.
const previewMaxDimension = 1024;

// UI elements
const imageZone = document.getElementById("image-zone") as HTMLImageElement;
const exportButtonElement = document.getElementById(
    "export-button"
) as HTMLInputElement;
const playPauseButtonElement = document.getElementById(
    "play-pause"
) as HTMLInputElement;
const gainCursorElement = document.getElementById("gain") as HTMLInputElement;
const greenBlueCursorElement = document.getElementById(
    "greenblue"
) as HTMLInputElement;
const redCursorElement = document.getElementById("red") as HTMLInputElement;
const videoSeekCursorElement = document.getElementById(
    "video-seek"
) as HTMLInputElement;

class UnderwaterCorrector {
    originalFileData: any;
    originalFileName: string;
    fileType: string;
    metadatas: any;

    filterMatrixes: PIXI.ColorMatrix[];
    pixiApp!: PIXI.Application;
    previewFilter!: PIXI.ColorMatrixFilter;
    texture!: PIXI.Texture;
    sprite!: PIXI.Sprite;
    domElement!: HTMLVideoElement | HTMLImageElement;
    previewWidth!: number;
    previewHeight!: number;

    constructor(
        fileData: any,
        fileType: string,
        fileName: string,
        metadatas?: any
    ) {
        console.log(fileType);
        this.originalFileData = fileData;
        this.originalFileName = fileName;
        this.fileType = fileType;
        this.metadatas = metadatas;

        // An array of matrix filter. When the target is an image, this is a single-element matrix.
        // When the target is a video, there is one matrix generated for every 2 seconds of video.
        this.filterMatrixes = new Array();

        this.init();
    }

    // One-time call methods (initialisation)

    async init() {
        this.pixiApp = new PIXI.Application();
        await this.pixiApp.init();

        this.previewFilter = new PIXI.ColorMatrixFilter();

        this.texture = await PIXI.Assets.load({
            src: this.originalFileData,
            loadParser: this.fileType.startsWith("video")
                ? "loadVideo"
                : "loadTextures",
        });
        this.sprite = new PIXI.Sprite(this.texture);
        this.sprite.filters = [this.previewFilter];
        this.pixiApp.stage.addChild(this.sprite);

        this.domElement = this.texture.source.resource;
        if (this.fileType.startsWith("video")) {
            (this.domElement as HTMLVideoElement).pause();
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
        this.bindDomElements();
    }

    bindDomElements() {
        [gainCursorElement, greenBlueCursorElement, redCursorElement].forEach(
            (e) => {
                e.addEventListener("input", () => this.updatePreviewFilter());
            }
        );

        if (this.fileType.startsWith("video")) {
            const video = this.domElement as HTMLVideoElement;
            videoSeekCursorElement.max = video.duration.toString();
            videoSeekCursorElement.addEventListener("input", () =>
                this.videoSeekCursorInputListener()
            );
            this.domElement.addEventListener("timeupdate", () =>
                this.videoTimeupdateListener()
            );
            playPauseButtonElement.addEventListener("click", () =>
                this.videoTogglePlay()
            );
        }
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
        const video = this.domElement as HTMLVideoElement;
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

    static async exportLargeImage(
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

    static getTweakedMatrix(matrix: PIXI.ColorMatrix): PIXI.ColorMatrix {
        // Function the get the positions from the cursors, and change the matrix value using the magic matrixes
        let lessBlue: number,
            lessGreen: number,
            lessRed: number,
            moreRed: number;
        lessBlue = lessGreen = lessRed = moreRed = 0;

        // Cursors go from negative to positive value. Depending of their position, we want to remove green or to remove green.
        if (Number(greenBlueCursorElement.value) < 0) {
            lessBlue = Math.abs(Number(greenBlueCursorElement.value));
        } else {
            lessGreen = Number(greenBlueCursorElement.value);
        }
        if (Number(redCursorElement.value) < 0) {
            lessRed = Math.abs(Number(redCursorElement.value));
        } else {
            moreRed = Number(redCursorElement.value);
        }

        // We calculate a new matrix based on the original matrix generated from the algorithm.
        const tweakedMatrix = matrix.map(
            (value, i) =>
                identity[i] +
                Number(gainCursorElement.value) * (value - identity[i]) +
                lessBlue * magicLessBlue[i] +
                lessGreen * magicLessGreen[i] +
                moreRed * magicMoreRed[i] +
                lessRed * magicLessRed[i]
        );

        return tweakedMatrix as PIXI.ColorMatrix;
    }

    // Utility methods

    getMatrixFromCurrentStage(): PIXI.ColorMatrix {
        const pixels = this.pixiApp.renderer.extract.pixels(this.pixiApp.stage);

        const filterMatrix = getColorFilterMatrix(
            pixels.pixels,
            pixels.width,
            pixels.height
        );

        return filterMatrix as PIXI.ColorMatrix;
    }

    updatePreviewFilter() {
        let index;
        if (this.fileType.startsWith("video")) {
            const video = this.domElement as HTMLVideoElement;
            index = Math.floor(video.currentTime / videoMatrixInterval);
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
        const video = this.domElement as HTMLVideoElement;
        let previousIndex = 0;
        const self = this;
        function update() {
            const index = Math.floor(video.currentTime / videoMatrixInterval);
            if (previousIndex != index) {
                previousIndex = index;
                self.updatePreviewFilter();
            }
            requestAnimationFrame(update);
        }
        requestAnimationFrame(update);
    }

    videoTimeupdateListener() {
        const video = this.domElement as HTMLVideoElement;
        videoSeekCursorElement.value = video.currentTime.toString();
    }

    videoSeekCursorInputListener() {
        const video = this.domElement as HTMLVideoElement;
        video.currentTime = Number(videoSeekCursorElement.value);
    }

    videoTogglePlay() {
        const video = this.domElement as HTMLVideoElement;
        const videoIsPlaying =
            video.currentTime > 0 &&
            !video.paused &&
            !video.ended &&
            video.readyState > 2;

        if (videoIsPlaying) {
            video.pause();
        } else {
            video.play();
        }
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
        filter.matrix = UnderwaterCorrector.getTweakedMatrix(
            this.filterMatrixes[0]
        );
        sprite.filters = [filter];

        const canvas = await UnderwaterCorrector.exportLargeImage(
            this.pixiApp,
            sprite,
            originalWidth,
            originalHeight
        );
        let jpegData = canvas.toDataURL("image/jpeg", 0.9);
        jpegData = piexif.insert(this.metadatas, jpegData);

        // TODO: add the original metadata to the generated media
        a.href = jpegData;
        a.click();
    }
}

document.querySelectorAll(".drop-zone__input").forEach((element) => {
    const inputElement = element as HTMLInputElement;

    // Handle file drop
    const dropZoneElement = inputElement.closest(
        ".drop-zone"
    ) as HTMLDivElement;

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

    function fileUploadEventHandler(file: any) {
        if (file) {
            handleFile(file);
            dropZoneElement.classList.add("hidden");
        }
    }
    dropZoneElement.addEventListener("drop", (e) => {
        e.preventDefault();
        const file = e.dataTransfer?.files[0];
        fileUploadEventHandler(file);
    });
    dropZoneElement.addEventListener("change", (e) => {
        // @ts-ignore
        const file = e.target.files[0];
        fileUploadEventHandler(file);
    });
});

async function handleFile(file: any) {
    // Handle dropped file
    imageZone.classList.remove("hidden");
    const fileType: string = file.type;

    let metadatas = null;
    if (fileType === "image/jpeg") {
        // console.log("using piexif");
        const newReader = new FileReader();
        const loadPromise = new Promise((resolve) => {
            newReader.onload = resolve;
        });
        newReader.readAsDataURL(file);
        await loadPromise;
        // console.log(piexif.load(newReader.result));
        metadatas = piexif.dump(piexif.load(newReader.result));
    }
    const reader = new FileReader();
    const loadPromise = new Promise((resolve) => {
        reader.onload = resolve;
    });
    reader.readAsArrayBuffer(file);
    await loadPromise;

    if (fileType.startsWith("image") && fileType !== "image/jpeg") {
        const tags = await ExifReader.load(reader.result);
        // console.log(exifReaderToPiexif(tags));
        metadatas = piexif.dump(exifReaderToPiexif(tags));
    }
    // @ts-ignore (flemme)
    const blob = new Blob([reader.result], { type: file.type });
    const url = URL.createObjectURL(blob);
    // console.log(metadatas);
    new UnderwaterCorrector(url, fileType, file.name, metadatas);
}

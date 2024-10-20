import * as ExifReader from "exifreader";
import * as piexif from "piexifjs";
import * as PIXI from "pixi.js";

import { exifReaderToPiexif } from "./exif";
import { getColorFilterMatrix, getTweakedMatrix } from "./image-correction";
import { type UnderwaterCorrectorApp } from "./main";
import { exportLargeImage } from "./utils";

const videoMatrixInterval = 0.2;
// The maximum x or y dimension of the image that will be displayed.
const previewMaxDimension = 1024;

const SUPPORTED_PHOTO_TYPES = ["image/jpeg", "image/png"];
const SUPPORTED_VIDEO_TYPES = ["video/mp4"];

export class UnloadedPreview {
    file: File;
    type: string;

    constructor(file: File) {
        this.file = file;

        if (SUPPORTED_PHOTO_TYPES.includes(file.type)) {
            this.type = "photo";
        } else if (SUPPORTED_VIDEO_TYPES.includes(file.type)) {
            this.type = "video";
        } else {
            throw "Unsupported file type.";
        }
    }

    async load(app: UnderwaterCorrectorApp) {
        let metadatas = null;
        const reader = new FileReader();
        const loadPromise = new Promise((resolve) => {
            reader.onload = resolve;
        });
        reader.readAsArrayBuffer(this.file);
        await loadPromise;

        // TODO: use the same filereader ?
        if (this.file.type === "image/jpeg") {
            // For JPEG, with use piecif to read the metadata
            const newReader = new FileReader();
            const loadPromise = new Promise((resolve) => {
                newReader.onload = resolve;
            });
            newReader.readAsDataURL(this.file);
            await loadPromise;
            metadatas = piexif.dump(piexif.load(newReader.result));
        } else if (this.file.type.startsWith("image")) {
            const tags = ExifReader.load(reader.result);
            metadatas = piexif.dump(exifReaderToPiexif(tags));
        }

        // @ts-ignore (flemme)
        const blob = new Blob([reader.result], { type: this.file.type });
        const url = URL.createObjectURL(blob);

        let preview;
        if (this.type === "video") {
            preview = new VideoPreview(app, url, this.file.type, this.file.name, metadatas);
        } else {
            preview = new PhotoPreview(app, url, this.file.type, this.file.name, metadatas);
        }
        await preview.init();
        URL.revokeObjectURL(url);
        return preview;
    }
}

export class Preview {
    originalFileData: any;
    originalFileName: string;
    fileType: string;
    metadatas: any;
    app: UnderwaterCorrectorApp;

    filterMatrixes: PIXI.ColorMatrix[];
    previewFilter!: PIXI.ColorMatrixFilter;
    texture!: PIXI.Texture;
    sprite!: PIXI.Sprite;
    declare domElement: HTMLVideoElement | HTMLImageElement;
    previewWidth!: number;
    previewHeight!: number;

    onload?: () => any;

    constructor(app: UnderwaterCorrectorApp, fileData: any, fileType: string, fileName: string, metadatas?: any) {
        this.app = app;
        this.originalFileData = fileData;
        this.originalFileName = fileName;
        this.fileType = fileType;
        this.metadatas = metadatas;

        // An array of matrix filter. When the target is an image, this is a single-element matrix.
        // When the target is a video, there is one matrix generated for every 2 seconds of video.
        this.filterMatrixes = new Array();
    }

    // One-time call methods (initialisation)

    async init() {
        await this.loadTexture();
        this.sprite = new PIXI.Sprite(this.texture);

        this.previewFilter = new PIXI.ColorMatrixFilter();
        this.sprite.filters = [this.previewFilter];

        this.scalePreview();
        await this.generateMatrixes();
        this.previewFilter.matrix = this.filterMatrixes[0];

        this.bindDomEvents();
    }

    async loadTexture() {
        // Should init this.texture and this.domElement.
        throw "Not implements !";
    }
    async generateMatrixes() {
        throw "Not implemented !";
    }
    updateFilter() {
        throw "Not implemented !";
    }
    bindDomEvents() {}

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
    }

    attach() {
        this.app.pixiApp.renderer.resize(this.previewWidth, this.previewHeight);
        this.app.pixiApp.stage.addChild(this.sprite);
    }
    detach() {
        this.app.pixiApp.stage.removeChild(this.sprite);
        PIXI.Assets.unload(this.originalFileData);
        // this.texture.destroy(true);
        // this.sprite.destroy({ texture: true, textureSource: true });
        // this.texture.destroy();
        // this.previewFilter.destroy();
    }

    // Utility methods

    getInitialMatrix(): PIXI.ColorMatrix {
        const container = new PIXI.Container();
        container.addChild(this.sprite);
        const pixels = this.app.pixiApp.renderer.extract.pixels(container);
        console.log(pixels.height);
        console.log(pixels.width);

        const filterMatrix = getColorFilterMatrix(pixels.pixels, pixels.width, pixels.height);

        return filterMatrix as PIXI.ColorMatrix;
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
        filter.matrix = getTweakedMatrix(this.filterMatrixes[0], this.app.tweakParameters);
        sprite.filters = [filter];

        const canvas = await exportLargeImage(this.app.pixiApp, sprite, originalWidth, originalHeight);
        let jpegData = canvas.toDataURL("image/jpeg", 0.9);
        jpegData = piexif.insert(this.metadatas, jpegData);

        a.href = jpegData;
        a.click();
    }
}

export class PhotoPreview extends Preview {
    declare domElement: HTMLVideoElement;

    async loadTexture() {
        // this.texture = PIXI.Texture.from(this.originalFileData);
        this.texture = await PIXI.Assets.load({
            src: this.originalFileData,
            loadParser: "loadTextures",
        });
        this.domElement = this.texture.source.resource;
    }

    updateFilter() {
        this.previewFilter.matrix = getTweakedMatrix(this.filterMatrixes[0], this.app.tweakParameters);
    }

    async generateMatrixes() {
        this.filterMatrixes.push(this.getInitialMatrix());
    }
}

export class VideoPreview extends Preview {
    backgroundUpdaterEnabled: boolean;
    multipleFiltersEnabled: boolean;
    declare domElement: HTMLVideoElement;

    constructor(
        app: UnderwaterCorrectorApp,
        fileData: any,
        fileType: string,
        fileName: string,
        metadatas?: any,
        multipleFilters: boolean = false
    ) {
        super(app, fileData, fileType, fileName, metadatas);
        this.multipleFiltersEnabled = multipleFilters;
        this.backgroundUpdaterEnabled = false;
    }

    async loadTexture() {
        this.texture = await PIXI.Assets.load({
            src: this.originalFileData,
            loadParser: "loadVideo",
        });
        this.domElement = this.texture.source.resource;
        this.domElement.pause();
    }

    async generateMatrixes() {
        if (this.multipleFiltersEnabled) {
            for (let currentTime = 0; currentTime < this.domElement.duration; currentTime += videoMatrixInterval) {
                const seekPromise = new Promise((resolve) => {
                    this.domElement.addEventListener("seeked", resolve, {
                        once: true,
                    });
                });
                this.domElement.currentTime = currentTime;
                await seekPromise;
                this.filterMatrixes.push(this.getInitialMatrix());
            }
            this.domElement.currentTime = 0;
        } else {
            this.filterMatrixes.push(this.getInitialMatrix());
        }
        await this.domElement.play();
    }

    attach(): void {
        if (this.multipleFiltersEnabled) {
            this.backgroundUpdaterEnabled = true;
            this.updatePreviewFilterBg();
        }
        super.attach();
    }

    detach() {
        this.backgroundUpdaterEnabled = false;
        super.detach();
    }

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
                self.updateFilter();
            }
            if (self.backgroundUpdaterEnabled) {
                requestAnimationFrame(update);
            }
        }
        requestAnimationFrame(update);
    }

    updateFilter() {
        let index;
        if (this.multipleFiltersEnabled) {
            index = Math.floor(this.domElement.currentTime / videoMatrixInterval);
        } else {
            index = 0;
        }
        this.previewFilter.matrix = getTweakedMatrix(this.filterMatrixes[index], this.app.tweakParameters);
    }

    seek(value: number) {
        this.domElement.currentTime = value;
    }

    togglePlayPause() {
        const video = this.domElement;
        const videoIsPlaying = video.currentTime > 0 && !video.paused && !video.ended && video.readyState > 2;

        if (videoIsPlaying) {
            video.pause();
        } else {
            video.play();
        }
    }

    bindDomEvents() {
        this.domElement.addEventListener("timeupdate", () => {
            this.app.updateVideoSlider(this.domElement.currentTime, this.domElement.duration);
        });
    }
}

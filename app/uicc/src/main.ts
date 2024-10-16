import * as PIXI from "pixi.js";
import { Preview, UnloadedPreview, VideoPreview } from "./previews";

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

export class UnderwaterCorrectorApp {
    pixiApp!: PIXI.Application;
    tweakParameters: TweakParametersT;
    previews: UnloadedPreview[];
    currentPreview: Preview | null;
    currentPreviewIndex: number | null;

    constructor() {
        this.tweakParameters = { gain: 1, greenBlue: 0, red: 0 };
        this.previews = [];
        this.currentPreview = null;
        this.currentPreviewIndex = null;
    }

    async init() {
        this.pixiApp = new PIXI.Application();
        await this.pixiApp.init();

        // TODO: set css to the css file
        this.pixiApp.canvas.style.width = "100%";
        this.pixiApp.canvas.style.height = "100%";
        this.pixiApp.canvas.style.objectFit = "contain";
        // Add the canvas to the DOM
        imageZone.appendChild(this.pixiApp.canvas);
        this.bindDomElements();
    }

    extendPreviews(previews: UnloadedPreview[]) {
        this.previews.push(...previews);
    }

    async loadFirstPreview() {
        this.currentPreviewIndex = 0;
        await this.loadPreview(0);
    }

    async loadPreview(index: number) {
        // TODO: add loaders
        this.currentPreview = await this.previews[index].load(this);
    }

    setVideoControls(value: false): void;
    setVideoControls(value: true, max: number): void;
    setVideoControls(value: Boolean, max?: number): void {
        // TODO: show/hide
        if (value) {
            videoSeekCursorElement.max = (max as number).toString();
            videoSeekCursorElement.value = "0";
        }
    }

    updateVideoSlider(value: number) {
        videoSeekCursorElement.value = value.toString();
    }

    seekVideo(value: number) {
        if (
            !this.currentPreview ||
            !(this.currentPreview instanceof VideoPreview)
        ) {
            throw "Video seeking unsupported in the context";
        }
        this.currentPreview.seek(value);
    }
    togglePlayPauseVideo() {
        if (
            !this.currentPreview ||
            !(this.currentPreview instanceof VideoPreview)
        ) {
            throw "Video seeking unsupported in the context";
        }
        this.currentPreview.togglePlayPause();
    }

    async download() {
        if (!this.currentPreview) {
            throw "Download shouldn't be clickable before loading any media.";
        }
        await this.currentPreview.download();
    }

    updateMatrix() {
        if (!this.currentPreview) {
            throw "Matrix tweak shouldn't be usable before loading any media.";
        }
        this.tweakParameters.gain = Number(gainCursorElement.value);
        this.tweakParameters.greenBlue = Number(greenBlueCursorElement.value);
        this.tweakParameters.red = Number(redCursorElement.value);
        this.currentPreview.updateFilter();
    }

    bindDomElements() {
        [gainCursorElement, greenBlueCursorElement, redCursorElement].forEach(
            (e) => {
                e.addEventListener("input", () => this.updateMatrix());
            }
        );
        videoSeekCursorElement.addEventListener("input", (e) => {
            // @ts-ignore // TODO
            this.seekVideo(e.target.value);
        });
        playPauseButtonElement.addEventListener("click", () =>
            this.togglePlayPauseVideo()
        );
        exportButtonElement.addEventListener("click", () => this.download());
    }
    // TODO
    // this.pixiApp.renderer.render(this.pixiApp.stage);
    // this.pixiApp.stage.addChild(this.sprite);
}

const app = new UnderwaterCorrectorApp();

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

    function fileUploadEventHandler(files: FileList | null) {
        if (files) {
            handleFile(files);
            dropZoneElement.classList.add("hidden");
        }
    }
    dropZoneElement.addEventListener("drop", (_e) => {
        const e = _e as DragEvent;
        e.preventDefault();
        if (!e.dataTransfer) {
            return;
        }
        fileUploadEventHandler(e.dataTransfer?.files);
    });
    dropZoneElement.addEventListener("change", (_e) => {
        const e = _e as DropzoneChangeEvent;
        fileUploadEventHandler(e.target.files);
    });
});

async function handleFile(files: FileList) {
    // Handle dropped file
    imageZone.classList.remove("hidden");

    const previews = Array.from(files).map((f) => new UnloadedPreview(f));
    app.extendPreviews(previews);
    if (!app.currentPreview) {
        await app.loadFirstPreview();
    }

    // new UnderwaterCorrector(url, fileType, file.name, metadatas);
}

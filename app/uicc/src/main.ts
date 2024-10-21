import * as PIXI from "pixi.js";
import { Preview, UnloadedPreview, VideoPreview } from "./previews";

// UI elements
const imageZone = document.getElementById("image-zone") as HTMLImageElement;
const exportButtonElement = document.getElementById("export-button") as HTMLInputElement;
const nextButtonElement = document.getElementById("next-media") as HTMLInputElement;
const previousButtonElement = document.getElementById("previous-media") as HTMLInputElement;
const playPauseButtonElement = document.getElementById("play-pause") as HTMLInputElement;
const gainCursorElement = document.getElementById("gain") as HTMLInputElement;
const greenBlueCursorElement = document.getElementById("greenblue") as HTMLInputElement;
const redCursorElement = document.getElementById("red") as HTMLInputElement;
const videoSeekCursorElement = document.getElementById("video-seek") as HTMLInputElement;
const previewNumberLabel = document.getElementById("preview-number-label") as HTMLDivElement;

const videoControls = document.getElementsByClassName("video-control");
const multipleMediaControls = document.getElementsByClassName("multiple-media-controls");

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
        if (this.previews.length > 0) {
            [gainCursorElement, greenBlueCursorElement, redCursorElement, exportButtonElement].forEach(
                (e) => (e.disabled = false)
            );
        }
        if (this.previews.length > 1) {
            for (let e of multipleMediaControls) {
                e.classList.remove("hidden");
            }
            const nb = this.currentPreviewIndex ? this.currentPreviewIndex + 1 : 1;
            previewNumberLabel.textContent = `Media ${nb}/${this.previews.length}`;
        }
    }

    async loadFirstPreview() {
        this.currentPreviewIndex = 0;
        await this.loadPreview();
    }

    async loadPreview() {
        if (this.currentPreviewIndex === null) {
            throw "This is impossible !";
        }
        previewNumberLabel.textContent = `Media ${this.currentPreviewIndex + 1}/${this.previews.length}`;
        this.currentPreview?.detach();
        const previewLoader = this.previews[this.currentPreviewIndex];
        this.setVideoControls(previewLoader.type === "video");
        this.currentPreview = await previewLoader.load(this);
        this.currentPreview.attach();
    }

    async nextPreview() {
        if (this.currentPreviewIndex === null) {
            throw "Don't click next until you loaded some images !";
        }
        const newIndex = this.currentPreviewIndex + 1;
        if (newIndex >= this.previews.length) {
            this.currentPreviewIndex = 0;
        } else {
            this.currentPreviewIndex = newIndex;
        }
        await this.loadPreview();
    }
    async previousPreview() {
        console.log(PIXI.Assets);
        if (this.currentPreviewIndex === null) {
            throw "Don't click next until you loaded some images !";
        }
        const newIndex = this.currentPreviewIndex - 1;
        if (newIndex < 0) {
            this.currentPreviewIndex = this.previews.length - 1;
        } else {
            this.currentPreviewIndex = newIndex;
        }
        await this.loadPreview();
    }

    setVideoControls(value: Boolean): void {
        if (value) {
            for (let element of videoControls) {
                element.classList.remove("hidden");
            }
            videoSeekCursorElement.value = "0";
        } else {
            for (let element of videoControls) {
                element.classList.add("hidden");
                console.log(element);
            }
        }
    }

    updateVideoSlider(value: number, max: number) {
        videoSeekCursorElement.value = value.toString();
        videoSeekCursorElement.max = max.toString();
    }

    seekVideo(value: number) {
        if (this.currentPreview === null || !(this.currentPreview instanceof VideoPreview)) {
            throw "Video seeking unsupported in the context";
        }
        this.currentPreview.seek(value);
    }
    togglePlayPauseVideo() {
        if (this.currentPreview === null || !(this.currentPreview instanceof VideoPreview)) {
            throw "Video seeking unsupported in the context";
        }
        this.currentPreview.togglePlayPause();
    }

    resetCursor(element: HTMLInputElement) {
        element.value = element.defaultValue;
        this.updateMatrix();
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
        [gainCursorElement, greenBlueCursorElement, redCursorElement].forEach((e) => {
            e.addEventListener("input", () => this.updateMatrix());
            e.addEventListener("dblclick", () => this.resetCursor(e));
        });
        videoSeekCursorElement.addEventListener("input", (e) => {
            // @ts-ignore // TODO
            this.seekVideo(e.target.value);
        });
        playPauseButtonElement.addEventListener("click", () => this.togglePlayPauseVideo());
        exportButtonElement.addEventListener("click", () => this.download());
        nextButtonElement.addEventListener("click", () => app.nextPreview());
        previousButtonElement.addEventListener("click", () => app.previousPreview());
    }
    // TODO
    // this.pixiApp.renderer.render(this.pixiApp.stage);
    // this.pixiApp.stage.addChild(this.sprite);
}

const app = new UnderwaterCorrectorApp();
await app.init();

document.querySelectorAll(".drop-zone__input").forEach((element) => {
    const inputElement = element as HTMLInputElement;

    // Handle file drop
    const dropZoneElement = inputElement.closest(".drop-zone") as HTMLDivElement;

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

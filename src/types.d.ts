/// <reference types="vite/client" />

declare module "piexifjs";

interface DropzoneChangeEvent extends Event {
    target: HTMLInputElement;
}

interface TweakParametersT {
    gain: number;
    greenBlue: number;
    red: number;
}

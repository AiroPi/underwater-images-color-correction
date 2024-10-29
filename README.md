<img src="https://bannermd.airopi.dev/banner?title=UICC&desc=Fix%20the%20color%20of%20your%20best%20photographies!&repo=AiroPi/underwater-images-color-correction" width="100%" alt="banner"/>

# Underwater Images Color Correction

A web application that lets you magically correct the colour of photos you've taken underwater!

## ⚠️ This project is under construction. It is not currently available nor finished.

## TODO

- [x] support mobile devices
- [x] support video load / preview
    - [ ] conditional UI
- [ ] allow to reupload a new photo easily (without reloading the page)
- [x] allow double click to reset sliders
- [ ] re-implement the matrix generation algorithm in rust
- [ ] use the rust version of the algorithm with WASM
- [ ] add loading status bar
    - [ ] for file reading
    - [ ] for matrixes generation
    - [ ] for download / export
- [ ] support video export
- [x] support multiple file uploads
- [ ] add metadata to generated files
    - [x] metadata support for JPG files
        - [ ] drop the thumbnail in metadata
    - [x] partial metadata support for other files
    - [ ] use exiv2 wasm ?
    - [ ] support video metadata 
- [ ] add option for unique / multiple matrix in videos
- [ ] support video audio
- [ ] support unsupported file format (ffmpeg.wasm transcoding for video, HEIC convert for images)
- [ ] setup PWA
- [ ] support scrolling / zooming in the image

## Why ?

When you take photos underwater, colours disappear quickly because the water absorbs certain wavelengths of light (depending on your depth). So colours like red will quickly disappear.
This programme will try to restore the original colours.

Warning: the result will not be the same as if you had used a flash. It's more like cheating, but it can give very good results.

<img src="https://upload.wikimedia.org/wikipedia/commons/2/22/Absorption_des_couleurs_sous_l%27eau.svg">
Sources: [wikipedia](https://fr.m.wikipedia.org/wiki/Fichier:Absorption_des_couleurs_sous_l%27eau.svg)

## How to use ?

Online versions available at:
- https://underwater-images-color-correction.vercel.app
- https://underwater-images-color-correction.pages.dev

## How it works ?

Using javascript, webgl (PIXI.js), ~~rust and webassembly~~ (all transformations are done in your browser, nothing is uploaded to any server).

This repo was inspired by the algorithm at https://github.com/nikolajbech/underwater-image-color-correction.

## Examples :
src: https://github.com/nikolajbech/underwater-image-color-correction

![image](https://github.com/user-attachments/assets/86897f27-2762-4d14-9895-8af3e609b0a5)

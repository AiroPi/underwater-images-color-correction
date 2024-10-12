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

// UI elements
const imageZone = document.getElementById("image-zone");
const exportButtonElement = document.getElementById("export-button");
const gainCursorElement = document.getElementById("gain");
const greenBlueCursorElement = document.getElementById("greenblue");
const redCursorElement = document.getElementById("red");

let originalMatrix = identity.map((e) => e);
let originalExifData = null;
let originalImage = null;
let originalFileName = null;

const app = new PIXI.Application();
await app.init();

const filter = new PIXI.ColorMatrixFilter();

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

// handle cursors tweaks
gainCursorElement.addEventListener("input", () => getTweakedMatrix());
greenBlueCursorElement.addEventListener("input", () => getTweakedMatrix());
redCursorElement.addEventListener("input", () => getTweakedMatrix());

exportButtonElement.addEventListener("click", download);

async function handleFile(file) {
  // Handle dropped file
  imageZone.classList.remove("hidden");

  originalFileName = file.name;
  const reader = new FileReader();
  reader.onload = () => processFile(reader);
  reader.readAsDataURL(file);
}

async function processFile(reader) {
  // Process dropped file
  originalImage = reader.result;

  const texture = await PIXI.Assets.load(reader.result);
  const sprite = new PIXI.Sprite(texture);
  sprite.filters = [filter];

  const imageWidth = sprite.texture.width;
  const imageHeight = sprite.texture.height;

  // The maximum x or y dimension of the image that will be displayed.
  const maxDimension = 2048;

  // Scale the image to match the maximum dimension
  const scaleX = maxDimension / imageWidth;
  const scaleY = maxDimension / imageHeight;

  const scale = Math.min(scaleX, scaleY, 1); // Ensure we don't scale up the image

  const newCanvasWidth = Math.round(imageWidth * scale);
  const newCanvasHeight = Math.round(imageHeight * scale);

  sprite.width = newCanvasWidth;
  sprite.height = newCanvasHeight;

  app.stage.addChild(sprite);
  app.renderer.resize(newCanvasWidth, newCanvasHeight);
  app.renderer.render(app.stage);

  // Extract the resized image into a pixels array, the generate the initial filter matrix
  const pixels = app.renderer.extract.pixels(app.stage);

  originalMatrix = getColorFilterMatrix(
    pixels.pixels,
    pixels.width,
    pixels.height
  );

  // Set the filter matrix to the displayed image
  setMatrix(originalMatrix);

  // Add the canvas to the DOM
  // TODO: set css to the css file
  app.canvas.style.width = "100%";
  app.canvas.style.height = "100%";
  app.canvas.style.objectFit = "contain";
  imageZone.appendChild(app.canvas);
}

function getTweakedMatrix() {
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
  const matrix = originalMatrix.map(
    (value, i) =>
      identity[i] +
      gainCursorElement.value * (value - identity[i]) +
      lessBlue * magicLessBlue[i] +
      lessGreen * magicLessGreen[i] +
      moreRed * magicMoreRed[i] +
      lessRed * magicLessRed[i]
  );

  // Instead of returning the matrix, we change the filter matrix attribute to the new generated matrix.
  setMatrix(matrix);
}

function setMatrix(matrix) {
  filter.matrix = matrix;
}

async function exportLargeImage(sprite, originalWidth, originalHeight) {
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

async function download() {
  const a = document.createElement("a");

  const dotI = originalFileName.lastIndexOf(".");
  const name = originalFileName.substring(0, dotI);
  a.download = `${name}-edited.jpg`;

  // We create a new sprite with the original dimensions (no downscale)
  const texture = await PIXI.Assets.load(originalImage);
  const originalWidth = texture.width;
  const originalHeight = texture.height;
  const sprite = new PIXI.Sprite(texture);
  sprite.filters = [filter];

  const canvas = await exportLargeImage(sprite, originalWidth, originalHeight);
  const jpegData = canvas.toDataURL("image/jpeg", 0.9);

  // TODO: add the original metadata to the generated photo

  a.href = jpegData;
  a.click();
}

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
let originalMatrix = identity.map((e) => e);
let originalExifData = null;

const app = new PIXI.Application();
await app.init();

const filter = new PIXI.ColorMatrixFilter();

document.querySelectorAll(".drop-zone__input").forEach((inputElement) => {
  const dropZoneElement = inputElement.closest(".drop-zone");
  const sidebarElement = document.querySelector(".sidebar");

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

  function handleFile(file) {
    if (file) {
      addImage(file);
      dropZoneElement.classList.add("hidden");
    }
  }
  dropZoneElement.addEventListener("drop", (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    handleFile(file);
  });
  dropZoneElement.addEventListener("change", (e) => {
    const file = e.target.files[0];
    handleFile(file);
  });
});

const imageZone = document.getElementById("image-zone");

const exportButtonElement = document.getElementById("export-button");

const gainCursorElement = document.getElementById("gain");
const greenBlueCursorElement = document.getElementById("greenblue");
const redCursorElement = document.getElementById("red");

gainCursorElement.addEventListener("input", () => getTweakedMatrix());
greenBlueCursorElement.addEventListener("input", () => getTweakedMatrix());
redCursorElement.addEventListener("input", () => getTweakedMatrix());

exportButtonElement.addEventListener("click", download);

function addImage(file) {
  const reader = new FileReader();

  reader.onload = () => {
    imageZone.classList.remove("hidden");

    originalExifData = piexif.load(reader.result);

    PIXI.Assets.load(reader.result).then((texture) => {
      const sprite = new PIXI.Sprite(texture);

      const pixels = app.renderer.extract.pixels(texture);
      originalMatrix = getColorFilterMatrix(
        pixels.pixels,
        pixels.width,
        pixels.height
      );
      setMatrix(originalMatrix);

      filter.matrix = originalMatrix;
      sprite.filters = [filter];
      app.stage.addChild(sprite);
      imageZone.appendChild(app.canvas);

      app.canvas.style.width = "100%";
      app.canvas.style.height = "100%";
      app.canvas.style.objectFit = "contain";

      app.renderer.resize(sprite.texture.width, sprite.texture.height);
      app.canvas.width = sprite.texture.width;
      app.canvas.height = sprite.texture.height;
    });
  };
  reader.readAsDataURL(file);
}

function getTweakedMatrix() {
  let lessBlue, lessGreen, lessRed, moreRed;
  lessBlue = lessGreen = lessRed = moreRed = 0;

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

  const matrix = originalMatrix.map(
    (value, i) =>
      identity[i] +
      gainCursorElement.value * (value - identity[i]) +
      lessBlue * magicLessBlue[i] +
      lessGreen * magicLessGreen[i] +
      moreRed * magicMoreRed[i] +
      lessRed * magicLessRed[i]
  );

  setMatrix(matrix);
}

function setMatrix(matrix) {
  filter.matrix = matrix;
}

function download() {
  const a = document.createElement("a");
  a.download = "corrected.jpg";

  app.renderer.extract
    .base64({ target: app.stage, format: "jpg", quality: 0.9 })
    .then((jpegData) => {
      const withExif = piexif.insert(piexif.dump(originalExifData), jpegData);

      a.href = withExif;
      a.click();
    });
}

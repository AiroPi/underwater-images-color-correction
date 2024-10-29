const ExifConverter = {
    "0th": {
        "271": "Make",
        "272": "Model",
        "274": "Orientation",
        "282": "XResolution",
        "283": "YResolution",
        "296": "ResolutionUnit",
        "305": "Software",
        "306": "DateTime",
        // "531": "YCbCrPositioning",
        // "34665": "Exif IFD Pointer",
        // "34853": "GPS Info IFD Pointer",
    },
    Exif: {
        "33434": "ExposureTime",
        "33437": "FNumber",
        "34850": "ExposureProgram",
        "34855": "ISOSpeedRatings",
        "36864": "ExifVersion",
        "36867": "DateTimeOriginal",
        "36868": "DateTimeDigitized",
        // "37121": "ComponentsConfiguration",
        "37122": "CompressedBitsPerPixel",
        "37380": "ExposureBiasValue",
        "37381": "MaxApertureValue",
        "37383": "MeteringMode",
        "37384": "LightSource",
        "37385": "Flash",
        "37386": "FocalLength",
        // "37500": "MakerNote",
        "37510": "UserComment",
        "37520": "SubSecTime",
        "37521": "SubSecTimeOriginal",
        "37522": "SubSecTimeDigitized",
        "40960": "FlashpixVersion",
        "40961": "ColorSpace",
        "40962": "PixelXDimension",
        "40963": "PixelYDimension",
        "40965": "Interoperability IFD Pointer",
        "41495": "SensingMethod",
        "41728": "FileSource",
        "41729": "SceneType",
        "41730": "CFAPattern",
        "41985": "CustomRendered",
        "41986": "ExposureMode",
        "41987": "WhiteBalance",
        "41988": "DigitalZoomRatio",
        "41989": "FocalLengthIn35mmFilm",
        "41990": "SceneCaptureType",
        "41991": "GainControl",
        "41992": "Contrast",
        "41993": "Saturation",
        "41994": "Sharpness",
        "41996": "SubjectDistanceRange",
        "34864": "SensitivityType",
        "37377": "ShutterSpeedValue",
        "37378": "ApertureValue",
        "42033": "BodySerialNumber",
    },
    GPS: {
        "0": "GPSVersionID",
        "16": "GPSImgDirectionRef",
        "17": "GPSImgDirection",
    },
    Interop: {
        "1": "InteroperabilityIndex",
    },
    "1st": {
        "282": "XResolution",
        "283": "YResolution",
        "296": "ResolutionUnit",
        // "531": "YCbCrPositioning",
    },
};

const UseDescription: string[] = [
    "1",
    "271",
    "272",
    "305",
    "306",
    "36864",
    "36867",
    "36868",
    "40960",
    "42033",
];

export function exifReaderToPiexif(data: any) {
    const newExif: any = {
        "0th": {},
        Exif: {},
        GPS: {},
        Interop: {},
        "1st": {},
    };
    for (let [container, metadatas] of Object.entries(ExifConverter)) {
        for (let [id, name] of Object.entries(metadatas)) {
            if (
                name in data &&
                "id" in data[name] &&
                data[name]["id"].toString() === id
            ) {
                if (UseDescription.includes(id)) {
                    newExif[container][id] = data[name].description;
                } else {
                    newExif[container][id] = data[name].value;
                }
            }
        }
    }
    return newExif;
}

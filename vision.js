/// <reference path="vendor/jquery.d.ts" />
"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
// An 8-bit image
var GreyscaleImage = (function () {
    function GreyscaleImage() {
        this.data = new Uint8ClampedArray(0);
        this.width = 0;
        this.height = 0;
    }
    GreyscaleImage.prototype._setSize = function (width, height) {
        if (width != this.width || height != this.height) {
            this.width = width;
            this.height = height;
            this.data = new Uint8ClampedArray(width * height);
        }
    };
    GreyscaleImage.prototype.read = function (context) {
        this._setSize(context.canvas.width, context.canvas.height);
        var imageData = context.getImageData(0, 0, this.width, this.height);
        var colorPixels = imageData.data; // R,G,B,A,R,G,B,A, etc...
        for (var i = 0; i < this.data.length; i++) {
            this.data[i] = (colorPixels[i * 4] + colorPixels[i * 4 + 1] + colorPixels[i * 4 + 2]) / 3;
        }
    };
    GreyscaleImage.prototype.updateFrom = function (source) {
        this._setSize(source.width, source.height);
        for (var i = 0; i < this.data.length; i++) {
            this.data[i] = source.data[i];
        }
    };
    GreyscaleImage.prototype.subtract = function (other) {
        for (var i = 0; i < this.data.length; i++) {
            this.data[i] = (this.data[i] - other.data[i]) + 128;
        }
    };
    // copy data from another image, setting pixels to 0, 128 or 255 depending on which side of two thresholds they fall on
    GreyscaleImage.prototype.increaseContrast = function (factor) {
        for (var i = 0; i < this.data.length; i++) {
            this.data[i] += (this.data[i] - 128) * factor;
        }
    };
    GreyscaleImage.prototype.toBinary = function (whiteThreshold) {
        if (whiteThreshold === void 0) { whiteThreshold = 128; }
        for (var i = 0; i < this.data.length; i++) {
            this.data[i] += (this.data[i] - whiteThreshold + 1) * 255;
        }
    };
    GreyscaleImage.prototype.pixelSum = function () {
        return this.data.reduce(function (a, b) { return a + b; }, 0);
    };
    GreyscaleImage.prototype.discardOutliers = function (outlierThreshold) {
        var w = this.width;
        for (var i = 0; i < this.data.length; i++) {
            var neighbourSum = (this.data[i - w - 1] + this.data[i - w] + this.data[i - w + 1] +
                this.data[i - 1] + this.data[i] + this.data[i + 1] +
                this.data[i + w - 1] + this.data[i + w] + this.data[i + w + 1]);
            this.data[i] = neighbourSum >= outlierThreshold * 255 ? 255 : 0;
        }
    };
    GreyscaleImage.prototype.debugDraw = function (canvasId, levelMap, defaultLevel) {
        if (levelMap === void 0) { levelMap = null; }
        if (defaultLevel === void 0) { defaultLevel = null; }
        var canvas = document.getElementById(canvasId);
        canvas.width = this.width;
        canvas.height = this.height;
        var ctx = canvas.getContext("2d");
        var targetRGBA = ctx.createImageData(this.width, this.height);
        if (levelMap) {
            for (var i = 0; i < this.data.length; i++) {
                var pixel = levelMap[this.data[i]] || defaultLevel;
                targetRGBA.data[i * 4] = pixel[0];
                targetRGBA.data[i * 4 + 1] = pixel[1];
                targetRGBA.data[i * 4 + 2] = pixel[2];
                targetRGBA.data[i * 4 + 3] = 255;
            }
        }
        else {
            for (var i = 0; i < this.data.length; i++) {
                targetRGBA.data[i * 4] = targetRGBA.data[i * 4 + 1] = targetRGBA.data[i * 4 + 2] = this.data[i];
                targetRGBA.data[i * 4 + 3] = 255;
            }
        }
        ctx.putImageData(targetRGBA, 0, 0);
    };
    return GreyscaleImage;
})();
// Implements the wave-detecting state machine.
//   1. The main image channel stores a count of transitions
//   2. When the input first turns full white or black the count goes to 1
//   3. When the input transitions to the opposite extreme, the counter increments
//   4. If more than `maxInterval` frames elapse between transitions, the counter is reset
// state transitions.
var TransitionCountingImage = (function (_super) {
    __extends(TransitionCountingImage, _super);
    function TransitionCountingImage() {
        _super.apply(this, arguments);
        // the next state that will cause the count to increment (always either 0 or 255)
        this.nextExpected = new Uint8ClampedArray(0);
        // the number of frames elapsed since the last transition
        this.txTimer = new Uint8ClampedArray(0);
    }
    TransitionCountingImage.prototype.update = function (source, maxInterval) {
        if (maxInterval === void 0) { maxInterval = 10; }
        if (source.width != this.width || source.height != this.height) {
            _super.prototype._setSize.call(this, source.width, source.height);
            this.nextExpected = new Uint8ClampedArray(this.data.length);
            this.txTimer = new Uint8ClampedArray(this.data.length);
        }
        for (var i = 0; i < this.data.length; i++) {
            var srcPixel = source.data[i];
            var count = this.data[i];
            if (count == 0) {
                if (srcPixel == 0) {
                    this.data[i] = 1;
                    this.nextExpected[i] = 255;
                    this.txTimer[i] = 0;
                }
                else if (srcPixel == 255) {
                    this.data[i] = 1;
                    this.nextExpected[i] = 0;
                    this.txTimer[i] = 0;
                }
            }
            else {
                this.txTimer[i] += 1;
                if (this.txTimer[i] > maxInterval) {
                    this.data[i] = 0;
                }
                else if (srcPixel == this.nextExpected[i]) {
                    this.data[i] += 1;
                    this.nextExpected[i] = 255 - this.nextExpected[i];
                    this.txTimer[i] = 0;
                }
            }
        }
    };
    return TransitionCountingImage;
})(GreyscaleImage);
var CameraInput = (function () {
    function CameraInput(width, height) {
        var _this = this;
        this.width = width;
        this.height = height;
        this.video = document.createElement("video");
        this.video.width = width;
        this.video.height = height;
        this.canvas = document.createElement("canvas");
        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx = this.canvas.getContext("2d");
        if (!navigator.getUserMedia) {
            navigator.getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
            if (!navigator.getUserMedia) {
                alert("Unsupported browser - use a recent Chrome or Firefox");
            }
        }
        navigator.getUserMedia({ video: true }, function (localMediaStream) {
            _this.video.src = window.URL.createObjectURL(localMediaStream);
            _this.video.play();
        }, function (err) {
            if (err.name == "DevicesNotFoundError") {
                alert("No camera devices found!");
            }
            if (err.name == "PermissionDeniedError") {
                alert("Permission denied to use camera");
            }
        });
    }
    CameraInput.prototype.getGreyscaleImage = function () {
        this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        var image = new GreyscaleImage();
        image.read(this.ctx);
        return image;
    };
    return CameraInput;
})();
// TODO subclass GreyscaleImage to add arrays of invertTimer and nextState
// TODO slider / stepper for threshold, invertSteps and maxInvertWait
onload = function () {
    // create a CameraInput
    // draw CameraInput to DebugCanvas
    // create a diff image
    // draw diff image to DebugCanvas
    var cameraInput = new CameraInput(40, 30);
    var cameraImage;
    var prevCameraImage;
    var diffImage = new GreyscaleImage();
    var highContrastDiffImage = new GreyscaleImage();
    var stateImage = new TransitionCountingImage();
    var waveMap = new GreyscaleImage();
    var filteredWaveMap = new GreyscaleImage();
    var rainbowColorMap = {
        0: [0, 0, 0],
        1: [0, 0, 255],
        2: [0, 255, 0],
        3: [0, 255, 255],
        4: [255, 0, 0],
        5: [255, 0, 255],
        6: [255, 255, 0],
        7: [255, 255, 255]
    };
    setInterval(function () {
        var contrastFactor = document.getElementById("contrastFactor").valueAsNumber;
        var maxInterval = document.getElementById("maxInterval").valueAsNumber;
        var transitionCount = document.getElementById("transitionCount").valueAsNumber;
        var outlierThreshold = document.getElementById("outlierThreshold").valueAsNumber;
        prevCameraImage = cameraImage;
        cameraImage = cameraInput.getGreyscaleImage();
        if (cameraImage && prevCameraImage) {
            cameraImage.debugDraw("camera");
            diffImage.updateFrom(cameraImage);
            diffImage.subtract(prevCameraImage);
            diffImage.debugDraw("diff");
            highContrastDiffImage.updateFrom(diffImage);
            highContrastDiffImage.increaseContrast(contrastFactor);
            highContrastDiffImage.debugDraw("contrast-diff");
            highContrastDiffImage.debugDraw("contrast-diff-annotated", { 0: [0, 0, 0], 255: [255, 255, 255] }, [128, 128, 128]);
            stateImage.update(highContrastDiffImage, maxInterval);
            stateImage.debugDraw("state", rainbowColorMap, [255, 255, 255]);
            waveMap.updateFrom(stateImage);
            waveMap.toBinary(transitionCount);
            waveMap.debugDraw("countPasses");
            filteredWaveMap.updateFrom(waveMap);
            waveMap.discardOutliers(outlierThreshold);
            waveMap.debugDraw("filteredWaveMap");
            document.getElementById("is-waving").innerHTML = waveMap.pixelSum() > 0 ? "YES!" : "Nope";
        }
    }, 1000 / 20);
};
//onload = () => {
//    var videoCanvas = <HTMLCanvasElement> $("#video-canvas")[0];
//    var videoCtx : CanvasRenderingContext2D = videoCanvas.getContext("2d");
//    var diffCanvas = <HTMLCanvasElement> $("#diff-canvas")[0];
//    var diffCtx : CanvasRenderingContext2D = diffCanvas.getContext("2d");
//    var width = videoCanvas.width;
//    var height = diffCanvas.height;
//    var video = document.createElement("video");
//    video.width = width;
//    video.height = height;
//
//    navigator.webkitGetUserMedia({video: true}, function(localMediaStream) {
//        video.src = window.URL.createObjectURL(localMediaStream);
//        video.play();
//    }, console.log);
//
//    setInterval(() => {
//        var prevFrame = videoCtx.getImageData(0, 0, width, height);
//        var prevData = prevFrame.data;
//        videoCtx.drawImage(video, 0, 0, width, height);
//        var thisFrame = videoCtx.getImageData(0, 0, width, height);
//        var thisData = thisFrame.data;
//        for (var i = 0; i<prevData.length; i += 4) {
//            var thisPixel = thisData[i] + thisData[i+1] + thisData[i+2];
//            var prevPixel = prevData[i] + prevData[i+1] + prevData[i+2];
//            thisData[i] = thisData[i+1] = thisData[i+2] = thisPixel - prevPixel + 128;
//        }
//        diffCtx.putImageData(thisFrame, 0, 0);
//    }, 1000 / 20);
//}; 
//# sourceMappingURL=vision.js.map
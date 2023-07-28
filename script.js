"use strict";
// Get the canvas element from the HTML file
var viewportdom = document.getElementById('viewport');
// Variables to store the mouse state
var isDrawing = false;
var lastX = 0;
var lastY = 0;
var canvasLastX = 0;
var canvasLastY = 0;
// Variable to store key states
var spaceDown = false;
var Viewport = /** @class */ (function () {
    function Viewport(div, sizeX, sizeY) {
        if (sizeX === void 0) { sizeX = 400; }
        if (sizeY === void 0) { sizeY = 400; }
        this._transform = { x: 0, y: 0 };
        this._scale = 1;
        this._canvasSize = { x: 0, y: 0 };
        this.domself = div;
        this.domtranslate = document.createElement('div');
        this.domtranslate.id = "translate";
        this.domzoom = document.createElement('div');
        this.domzoom.id = "zoom";
        this.canvas = document.createElement('canvas');
        this.canvas.id = "canvas";
        // Assuming you want to append the created elements as children of _domself
        this.domself.appendChild(this.domtranslate);
        this.domtranslate.appendChild(this.domzoom);
        this.domzoom.appendChild(this.canvas);
        // Set the canvas properties
        this.setCanvasSize(sizeX, sizeY);
    }
    Object.defineProperty(Viewport.prototype, "transform", {
        get: function () {
            return this._transform;
        },
        enumerable: true,
        configurable: true
    });
    Viewport.prototype.setTransform = function (x, y) {
        this._transform.x = x;
        this._transform.y = y;
        this.domtranslate.style.transform = "translate(" + x + "px, " + y + "px)";
    };
    Viewport.prototype.translate = function (x, y) {
        this.setTransform(this._transform.x + x, this._transform.y + y);
    };
    Object.defineProperty(Viewport.prototype, "scale", {
        get: function () {
            return this._scale;
        },
        set: function (n) {
            this._scale = n;
            this.domzoom.style.transform = "scale(" + n + ")";
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Viewport.prototype, "canvasSize", {
        get: function () {
            return this._canvasSize;
        },
        enumerable: true,
        configurable: true
    });
    Viewport.prototype.setCanvasSize = function (x, y) {
        this.canvasSize.x = x;
        this.canvasSize.y = y;
        this.canvas.width = x;
        this.canvas.height = y;
    };
    Viewport.prototype.center = function () {
        var x = this.domself.getBoundingClientRect().width;
        var y = this.domself.getBoundingClientRect().height;
        this.setTransform(x / 2 - this.canvas.width / 2, y / 2 - this.canvas.height / 2);
    };
    return Viewport;
}());
// Initiate the canvas thingy
var viewport = new Viewport(viewportdom);
viewport.center();
var ctx = viewport.canvas.getContext('2d');
ctx.translate(0.5, 0.5);
ctx.imageSmoothingEnabled = false;
ctx.filter = "none";
// Function to draw a line
function drawLine(x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.closePath();
    console.log(x1, x2, y1, y2);
}
// Event listeners for mouse events
document.addEventListener('mousedown', function () {
    isDrawing = true;
});
document.addEventListener('mouseup', function () {
    isDrawing = false;
});
document.addEventListener('keydown', function (event) {
    // Check if the pressed key is the spacebar (keyCode 32 or key " ")
    if (event.key === " ") {
        spaceDown = true;
    }
});
document.addEventListener('keyup', function (event) {
    // Check if the pressed key is the spacebar (keyCode 32 or key " ")
    if (event.key === " ") {
        spaceDown = false;
    }
});
viewport.domself.addEventListener('mousemove', function (e) {
    var currentX = e.clientX;
    var currentY = e.clientY;
    if (spaceDown) {
        if (lastX && lastY)
            viewport.translate(currentX - lastX, currentY - lastY);
    }
    lastX = currentX;
    lastY = currentY;
});
viewport.canvas.addEventListener('mousemove', function (e) {
    var currentX = e.offsetX;
    var currentY = e.offsetY;
    if (isDrawing) {
        if (canvasLastX && canvasLastY)
            drawLine(canvasLastX, canvasLastY, currentX, currentY);
    }
    canvasLastX = currentX;
    canvasLastY = currentY;
});

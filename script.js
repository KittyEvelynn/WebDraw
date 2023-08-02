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
var Layer = /** @class */ (function () {
    function Layer(gl) {
        this.blendMode = "normal";
        this.gl = gl;
        this.framebuffer = gl.createFramebuffer();
        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        // Setup layer params TODO
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 400, 400, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); // Change this to reflect the resolution
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        //Creanup
        gl.bindTexture(gl.TEXTURE_2D, null);
    }
    Layer.prototype.bindToFramebuffer = function (gl) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        // Assign the texture to the frame buffer
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
    };
    return Layer;
}());
var Viewport = /** @class */ (function () {
    function Viewport(div, sizeX, sizeY) {
        if (sizeX === void 0) { sizeX = 400; }
        if (sizeY === void 0) { sizeY = 400; }
        this.fragmentShaderSource = "#version 300 es\n  precision mediump float;\n  in vec2 frag_uv;\n  uniform vec2 size;\n  uniform sampler2D layerTexture;\n\n  out vec4 FragColor;\n  \n  void main() {\n    FragColor = texture(layerTexture, frag_uv);\n  }";
        this.normalBlendShaderSource = "#version 300 es\n  precision mediump float;\n  in vec2 frag_uv;\n  uniform vec2 size;\n  uniform sampler2D topLayerTexture;\n  uniform sampler2D bottomLayerTexture;\n\n  out vec4 FragColor;\n\n  void main() {\n    // Sample colors from both textures at the same UV coordinate.\n    vec4 topColor = texture(topLayerTexture, frag_uv);\n    vec4 bottomColor = texture(bottomLayerTexture, frag_uv);\n\n    // Mix the colors based on their alpha values.\n    FragColor = mix(bottomColor, topColor, topColor.a);\n  }";
        this.brushShaderSource = "#version 300 es\n  precision mediump float;\n  in vec2 frag_uv;\n  uniform vec2 size;\n  uniform sampler2D layerTexture;\n\n  out vec4 FragColor;\n\n  void main() {\n    FragColor = vec4(frag_uv, 0.0, 1.0);\n  }";
        this.vertexShaderSource = "#version 300 es\n  precision mediump float;\n  in vec2 position;\n  in vec2 uv;\n  out vec2 frag_uv;\n  \n  void main() {\n    gl_Position = vec4(position, 0, 1);\n    frag_uv = uv;\n  }";
        this.layers = [];
        this.strokeLayer = null;
        this.selectedLayers = [];
        this._transform = { x: 0, y: 0 };
        this._scale = 1;
        this._canvasSize = { x: 0, y: 0 };
        // Create the dom stuff
        this.domself = div;
        this.domtranslate = document.createElement('div');
        this.domtranslate.id = "translate";
        this.domzoom = document.createElement('div');
        this.domzoom.id = "zoom";
        this.domcanvas = document.createElement('canvas');
        this.domcanvas.id = "canvas";
        // Assuming you want to append the created elements as children of _domself
        this.domself.appendChild(this.domtranslate);
        this.domtranslate.appendChild(this.domzoom);
        this.domzoom.appendChild(this.domcanvas);
        // Set the canvas properties
        this.setCanvasSize(sizeX, sizeY);
        // Setup webgl stuff
        this.gl = this.domcanvas.getContext("webgl2");
        this.initGLCanvas();
        // Setup initial layer
        this.layers.push(new Layer(this.gl));
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
        this.domcanvas.width = x;
        this.domcanvas.height = y;
    };
    Viewport.prototype.center = function () {
        var x = this.domself.getBoundingClientRect().width;
        var y = this.domself.getBoundingClientRect().height;
        this.setTransform(x / 2 - this.domcanvas.width / 2, y / 2 - this.domcanvas.height / 2);
    };
    Viewport.prototype.initGLCanvas = function () {
        var gl = this.gl;
        // Compile shaders
        this.vertexShader = createShader(gl, gl.VERTEX_SHADER, this.vertexShaderSource);
        this.fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, this.fragmentShaderSource);
        this.brushShader = createShader(gl, gl.FRAGMENT_SHADER, this.brushShaderSource);
        this.normalBlendShader = createShader(gl, gl.FRAGMENT_SHADER, this.normalBlendShaderSource);
        // Initialize the empty canvas
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
    };
    Viewport.prototype.drawOn = function () {
        var gl = this.gl;
        if (!this.strokeLayer) {
            this.strokeLayer = new Layer(gl);
        }
        // Create the program
        var program = createProgram(gl, this.vertexShader, this.brushShader); // TODO make sure this doesnt get made every time
        gl.useProgram(program);
        // Set the layer's texture sampler
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.layers[0].texture);
        var textureUniformLoc = gl.getUniformLocation(program, "layerTexture");
        gl.uniform1i(textureUniformLoc, 0);
        // Bind the output to the stroke layer
        this.strokeLayer.bindToFramebuffer(gl);
        // Render
        this.render(program);
        // Cleanup
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, null);
    };
    Viewport.prototype.stopDrawing = function () {
        if (this.strokeLayer) {
            this.mergeLayers(this.strokeLayer, this.selectedLayers[0]);
            this.strokeLayer = null;
        }
    };
    Viewport.prototype.updateCanvas = function () {
    };
    Viewport.prototype.drawToCanvas = function (layer) {
        var gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        // Step 2: Set the viewport to match the canvas size.
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        // Draw to full screen quad
        var program = createProgram(gl, this.vertexShader, this.fragmentShader);
        gl.useProgram(program);
        // Set the layer's texture sampler
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, layer.texture);
        var textureUniformLoc = gl.getUniformLocation(program, "layerTexture");
        gl.uniform1i(textureUniformLoc, 0);
        this.render(program);
        // Cleanup
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, null);
    };
    /**
    * Merges 2 layers onto a target or into the bottom layer
    * @param {Layer} topLayer - Top layer
    * @param {Layer} bottomLayer - Bottom layer that will be merged on
    * @param {WebGLRenderbuffer | null} target - optional target output (defaults to removing the top layer and outputing into the bottom one)
    */
    Viewport.prototype.mergeLayers = function (topLayer, bottomLayer, target) {
        if (target === void 0) { target = null; }
        var gl = this.gl;
        // Create the program
        var program = createProgram(gl, this.vertexShader, this.normalBlendShader); // TODO make sure this doesnt get made every time
        gl.useProgram(program);
        // Set the layer's texture sampler
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, topLayer.texture);
        var topTextureUniformLoc = gl.getUniformLocation(program, "topLayerTexuture");
        gl.uniform1i(topTextureUniformLoc, 0);
        // Set the layer's texture sampler
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, bottomLayer.texture);
        var bottomTextureUniformLoc = gl.getUniformLocation(program, "bottomLayerTexuture");
        gl.uniform1i(bottomTextureUniformLoc, 1);
        // Bind the output to either the target or the bottom layer
        if (target)
            gl.bindFramebuffer(gl.FRAMEBUFFER, target);
        else
            bottomLayer.bindToFramebuffer(gl);
        // Render
        this.render(program);
        // Cleanup
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, null);
        // Remove the top layer if we dont have a target
        if (!target)
            this.layers.splice(this.layers.indexOf(topLayer));
    };
    Viewport.prototype.render = function (program) {
        var gl = this.gl;
        var vertices = [
            -1, -1,
            1, -1,
            -1, 1,
            -1, 1,
            1, -1,
            1, 1,
        ];
        var vertexBuffer = gl.createBuffer(); // TODO make sure this doesnt get recreated every time
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
        var positionLocation = gl.getAttribLocation(program, "position");
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
        // Setup uvs
        var uvs = [
            0.0, 0.0,
            1.0, 0.0,
            0.0, 1.0,
            0.0, 1.0,
            1.0, 0.0,
            1.0, 1.0,
        ];
        var uvBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvs), gl.STATIC_DRAW);
        var uvLocation = gl.getAttribLocation(program, "uv");
        gl.enableVertexAttribArray(uvLocation);
        gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 0, 0);
        // Setup width and height
        var sizeLocation = gl.getUniformLocation(program, "size");
        gl.uniform2fv(sizeLocation, [this.domcanvas.width, this.domcanvas.height]);
        // // Clear the canvas
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        // Render
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    };
    Viewport.prototype.debug = function (program) {
        var gl = this.gl;
        var numAttribs = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
        for (var ii = 0; ii < numAttribs; ++ii) {
            var attribInfo = gl.getActiveAttrib(program, ii);
            var index = gl.getAttribLocation(program, attribInfo.name);
            console.log(index, attribInfo.name);
        }
        var numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
        for (var ii = 0; ii < numUniforms; ++ii) {
            var uniformInfo = gl.getActiveUniform(program, ii);
            var index = gl.getUniformLocation(program, uniformInfo.name);
            console.log("Uniform - index: " + index + ", name: " + uniformInfo.name + ", size: " + uniformInfo.size + ", type: " + uniformInfo.type);
        }
    };
    return Viewport;
}());
// Initiate the canvas thingy
var viewport = new Viewport(viewportdom);
viewport.center();
viewport.drawOn();
viewport.selectedLayers.push(viewport.layers[0]);
viewport.stopDrawing();
viewport.drawToCanvas(viewport.selectedLayers[0]);
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
/*
viewport.domcanvas.addEventListener('mousemove', (e) => {
  const currentX = e.offsetX
  const currentY = e.offsetY
  if (isDrawing) {
    if (canvasLastX && canvasLastY)
      drawLine(canvasLastX, canvasLastY, currentX, currentY)
  }
  canvasLastX = currentX
  canvasLastY = currentY
})
*/
// Helper function to compile shaders
function createShader(gl, type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}
// Helper function to create a program and link shaders
function createProgram(gl, vertexShader, fragmentShader) {
    var program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program linking error:', gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }
    return program;
}

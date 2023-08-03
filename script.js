"use strict";
// Get the canvas element from the HTML file
var viewportdom = document.getElementById('viewport');
// Variables to store the mouse state
var isDrawing = false;
var lastX = 0;
var lastY = 0;
var lastCanvasX = 0;
var lastCanvasY = 0;
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
        this.width = 400;
        this.height = 400;
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        // Setup layer params TODO
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); // Change this to reflect the resolution
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        // Cleanup
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.getError();
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
        this.layers = [];
        this.strokeLayer = null;
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
        this.swapLayer = new Layer(this.gl);
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
        this.vertexShader = createShader(gl, gl.VERTEX_SHADER, Viewport.vertexShaderSource);
        this.fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, Viewport.fragmentShaderSource);
        this.brushShader = createShader(gl, gl.FRAGMENT_SHADER, Viewport.brushShaderSource);
        this.normalBlendShader = createShader(gl, gl.FRAGMENT_SHADER, Viewport.normalBlendShaderSource);
    };
    Viewport.prototype.drawOn = function (x, y) {
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
        var layerTextureUniformLoc = gl.getUniformLocation(program, "u_layerTexture");
        gl.uniform1i(layerTextureUniformLoc, 0);
        // Set the brush layer's texture sampler
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.strokeLayer.texture);
        var brushLayerTexture = gl.getUniformLocation(program, "u_strokeLayerTexture");
        gl.uniform1i(brushLayerTexture, 1);
        // Set the brush position
        var uniformLocation = gl.getUniformLocation(program, "u_brushOrigin");
        gl.uniform2f(uniformLocation, x, y);
        // Bind the output to the swap layer
        this.swapLayer.bindToFramebuffer(gl);
        // Render
        this.render(program);
        // Swap the swap swap swap
        var tempLayer = this.strokeLayer;
        this.strokeLayer = this.swapLayer;
        this.swapLayer = tempLayer;
        // Cleanup
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.getError();
        // Update canvas
        this.updateCanvas();
    };
    Viewport.prototype.stopDrawing = function () {
        if (this.strokeLayer) {
            this.mergeLayers(this.strokeLayer, this.layers[0], this.swapLayer);
            // Swap the swapwapwap
            var tempLayer = this.layers[0];
            this.layers[0] = this.swapLayer;
            this.swapLayer = tempLayer;
            this.strokeLayer = null; //FIX memory leak TODO probably just clear it instead of setting it to null
            // Update canvas
            this.updateCanvas();
        }
    };
    Viewport.prototype.updateCanvas = function () {
        var gl = this.gl;
        var accumulationLayer = new Layer(gl);
        if (this.layers.length === 1) {
            if (this.strokeLayer) {
                this.mergeLayers(this.strokeLayer, this.layers[0], accumulationLayer);
            }
            else {
                accumulationLayer = this.layers[0];
            }
        }
        else {
            for (var i = 0; i < this.layers.length - 1; i++) {
                this.mergeLayers(this.layers[i + 1], this.layers[i], accumulationLayer);
            }
            if (this.strokeLayer) {
                this.mergeLayers(this.strokeLayer, accumulationLayer, accumulationLayer); // TODO fix this
            }
        }
        this.drawToCanvas(accumulationLayer.texture);
    };
    /**
    * Draws a texture to the canvas
    * @param {WebGLTexture} texture Texture to draw
    */
    Viewport.prototype.drawToCanvas = function (texture) {
        var gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        // Step 2: Set the viewport to match the canvas size.
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        // Draw to full screen quad
        var program = createProgram(gl, this.vertexShader, this.fragmentShader);
        gl.useProgram(program);
        // Set the layer's texture sampler
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        var textureUniformLoc = gl.getUniformLocation(program, "u_layerTexture");
        gl.uniform1i(textureUniformLoc, 0);
        this.render(program);
        // Cleanup
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.getError();
    };
    /**
    * Merges 2 layers onto a target or into the bottom layer
    * @param {Layer} topLayer - Top layer
    * @param {Layer} bottomLayer - Bottom layer that will be merged on
    * @param {Layer} target - The layer it will be outputted onto
    */
    Viewport.prototype.mergeLayers = function (topLayer, bottomLayer, target) {
        var gl = this.gl;
        // Create the program
        var program = createProgram(gl, this.vertexShader, this.normalBlendShader); // TODO make sure this doesnt get made every time
        gl.useProgram(program);
        // Set the layer's texture sampler
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, topLayer.texture);
        var topTextureUniformLoc = gl.getUniformLocation(program, "u_topLayerTexture");
        gl.uniform1i(topTextureUniformLoc, 0);
        // Set the layer's texture sampler
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, bottomLayer.texture);
        var bottomTextureUniformLoc = gl.getUniformLocation(program, "u_bottomLayerTexture");
        gl.uniform1i(bottomTextureUniformLoc, 1);
        // Bind the output to either the target or the bottom layer
        target.bindToFramebuffer(gl);
        // Render
        this.render(program);
        // Cleanup
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.getError();
    };
    /**
    * Setsup the canvas model and uvs then renders
    * @param {WebGLProgram} program The program to use
    */
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
        var sizeLocation = gl.getUniformLocation(program, "u_size");
        gl.uniform2fv(sizeLocation, [this.domcanvas.width, this.domcanvas.height]);
        // Render
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        // Cleanup 
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.getError();
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
    Viewport.fragmentShaderSource = "#version 300 es\n  precision mediump float;\n  in vec2 frag_uv;\n  uniform vec2 u_size;\n  uniform sampler2D u_layerTexture;\n\n  out vec4 FragColor;\n  \n  void main() {\n    FragColor = texture(u_layerTexture, frag_uv);\n  }";
    Viewport.normalBlendShaderSource = "#version 300 es\n  precision mediump float;\n  in vec2 frag_uv;\n  uniform vec2 u_size;\n  uniform sampler2D u_topLayerTexture;\n  uniform sampler2D u_bottomLayerTexture;\n\n  out vec4 FragColor;\n\n  void main() {\n    // Sample colors from both textures at the same UV coordinate.\n    vec4 topColor = texture(u_topLayerTexture, frag_uv);\n    vec4 bottomColor = texture(u_bottomLayerTexture, frag_uv);\n\n    // Mix the colors based on their alpha values.\n    FragColor = mix(bottomColor, topColor, topColor.a);\n  }";
    Viewport.brushShaderSource = "#version 300 es\n  precision mediump float;\n  in vec2 frag_uv;\n  uniform vec2 u_size;\n  uniform sampler2D u_layerTexture;\n  uniform sampler2D u_strokeLayerTexture;\n  uniform vec2 u_brushOrigin;\n\n  out vec4 FragColor;\n\n  void main() {\n    // Calculate the distance between the current pixel and the brush origin\n    float distance = length(frag_uv - u_brushOrigin);\n\n    // Check if the distance is within the specified radius\n    if (distance <= 0.01) {\n      FragColor = vec4(0.0, 0.5, 0.0, 1.0);\n    } else{\n      FragColor = texture(u_strokeLayerTexture, frag_uv);\n    }\n    \n  }";
    Viewport.vertexShaderSource = "#version 300 es\n  precision mediump float;\n  in vec2 position;\n  in vec2 uv;\n  out vec2 frag_uv;\n  \n  void main() {\n    gl_Position = vec4(position, 0, 1);\n    frag_uv = uv;\n  }";
    return Viewport;
}());
// Initiate the canvas thingy
var viewport = new Viewport(viewportdom);
viewport.center();
// Event listeners for mouse events
document.addEventListener('mousedown', function () {
    isDrawing = true;
});
document.addEventListener('mouseup', function () {
    isDrawing = false;
    viewport.stopDrawing();
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
    requestAnimationFrame(function () {
        var currentX = e.clientX;
        var currentY = e.clientY;
        if (spaceDown) {
            viewport.translate(currentX - lastX, currentY - lastY);
        }
        lastX = currentX;
        lastY = currentY;
    });
});
viewport.domcanvas.addEventListener('mousemove', function (e) {
    requestAnimationFrame(function () {
        var canvasRect = viewport.domcanvas.getBoundingClientRect();
        var currentX = (e.clientX - canvasRect.left) / canvasRect.width;
        var currentY = (e.clientY - canvasRect.top) / canvasRect.height;
        if (isDrawing) {
            viewport.drawOn(currentX, 1 - currentY);
        }
        lastCanvasX = currentX;
        lastCanvasY = currentY;
    });
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
//# sourceMappingURL=script.js.map
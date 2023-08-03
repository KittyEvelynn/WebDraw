// Get the canvas element from the HTML file
const viewportdom = document.getElementById('viewport') as HTMLDivElement

// Variables to store the mouse state
let isDrawing = false
let lastX = 0
let lastY = 0
let lastCanvasX = 0
let lastCanvasY = 0
let canvasLastX: number | null = 0
let canvasLastY: number | null = 0
// Variable to store key states
let spaceDown = false

class Layer {

  public blendMode = "normal"
  private framebuffer: WebGLFramebuffer
  public texture: WebGLTexture
  private gl: WebGL2RenderingContext | WebGLRenderingContext
  public width: number
  public height: number

  constructor(gl: WebGL2RenderingContext | WebGLRenderingContext) {
    this.gl = gl
    this.framebuffer = gl.createFramebuffer()!
    this.texture = gl.createTexture()!
    this.width = 400
    this.height = 400

    gl.bindTexture(gl.TEXTURE_2D, this.texture)

    // Setup layer params TODO
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null) // Change this to reflect the resolution
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    // Cleanup
    gl.bindTexture(gl.TEXTURE_2D, null)
    gl.getError()
  }

  bindToFramebuffer(gl: WebGL2RenderingContext | WebGLRenderingContext) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer)

    // Assign the texture to the frame buffer
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0)
  }
}

class Viewport {
  // Shaders
  private fragmentShader: any
  private static fragmentShaderSource = `#version 300 es
  precision mediump float;
  in vec2 frag_uv;
  uniform vec2 u_size;
  uniform sampler2D u_layerTexture;

  out vec4 FragColor;
  
  void main() {
    FragColor = texture(u_layerTexture, frag_uv);
  }`

  private normalBlendShader: any
  private static normalBlendShaderSource = `#version 300 es
  precision mediump float;
  in vec2 frag_uv;
  uniform vec2 u_size;
  uniform sampler2D u_topLayerTexture;
  uniform sampler2D u_bottomLayerTexture;

  out vec4 FragColor;

  void main() {
    // Sample colors from both textures at the same UV coordinate.
    vec4 topColor = texture(u_topLayerTexture, frag_uv);
    vec4 bottomColor = texture(u_bottomLayerTexture, frag_uv);

    // Mix the colors based on their alpha values.
    FragColor = mix(bottomColor, topColor, topColor.a);
  }`

  private brushShader: any
  private static brushShaderSource = `#version 300 es
  precision mediump float;
  in vec2 frag_uv;
  uniform vec2 u_size;
  uniform sampler2D u_layerTexture;
  uniform sampler2D u_strokeLayerTexture;
  uniform vec2 u_brushOrigin;

  out vec4 FragColor;

  void main() {
    // Calculate the distance between the current pixel and the brush origin
    float distance = length(frag_uv - u_brushOrigin);

    // Check if the distance is within the specified radius
    if (distance <= 0.01) {
      FragColor = vec4(0.0, 0.5, 0.0, 1.0);
    } else{
      FragColor = texture(u_strokeLayerTexture, frag_uv);
    }
    
  }`

  private vertexShader: any
  private static vertexShaderSource = `#version 300 es
  precision mediump float;
  in vec2 position;
  in vec2 uv;
  out vec2 frag_uv;
  
  void main() {
    gl_Position = vec4(position, 0, 1);
    frag_uv = uv;
  }`

  public domself: HTMLDivElement
  public domtranslate: HTMLDivElement
  public domzoom: HTMLDivElement
  public domcanvas: HTMLCanvasElement

  public layers: Layer[] = []
  public strokeLayer: Layer | null = null
  private swapLayer: Layer

  public gl: WebGL2RenderingContext | WebGLRenderingContext

  private _transform: { x: number, y: number } = { x: 0, y: 0 }
  get transform(): { x: number, y: number } {
    return this._transform
  }
  setTransform(x: number, y: number) {
    this._transform.x = x
    this._transform.y = y
    this.domtranslate.style.transform = `translate(${x}px, ${y}px)`
  }
  translate(x: number, y: number) {
    this.setTransform(this._transform.x + x, this._transform.y + y)
  }

  private _scale: number = 1
  get scale(): number {
    return this._scale
  }
  set scale(n) {
    this._scale = n
    this.domzoom.style.transform = `scale(${n})`
  }

  private _canvasSize: { x: number, y: number } = { x: 0, y: 0 }
  get canvasSize(): { x: number, y: number } {
    return this._canvasSize
  }
  setCanvasSize(x: number, y: number) {
    this.canvasSize.x = x
    this.canvasSize.y = y
    this.domcanvas.width = x
    this.domcanvas.height = y
  }

  constructor(div: HTMLDivElement, sizeX: number = 400, sizeY: number = 400) {
    // Create the dom stuff
    this.domself = div
    this.domtranslate = document.createElement('div')
    this.domtranslate.id = "translate"
    this.domzoom = document.createElement('div')
    this.domzoom.id = "zoom"
    this.domcanvas = document.createElement('canvas')
    this.domcanvas.id = "canvas"

    // Assuming you want to append the created elements as children of _domself
    this.domself.appendChild(this.domtranslate)
    this.domtranslate.appendChild(this.domzoom)
    this.domzoom.appendChild(this.domcanvas)

    // Set the canvas properties
    this.setCanvasSize(sizeX, sizeY)

    // Setup webgl stuff
    this.gl = this.domcanvas.getContext("webgl2")!
    this.initGLCanvas()

    // Setup initial layer
    this.layers.push(new Layer(this.gl))
    this.swapLayer = new Layer(this.gl)
  }

  center(): void {
    let x = this.domself.getBoundingClientRect().width
    let y = this.domself.getBoundingClientRect().height
    this.setTransform(x / 2 - this.domcanvas.width / 2, y / 2 - this.domcanvas.height / 2)
  }

  initGLCanvas() {
    let gl = this.gl

    // Compile shaders
    this.vertexShader = createShader(gl, gl.VERTEX_SHADER, Viewport.vertexShaderSource)
    this.fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, Viewport.fragmentShaderSource)
    this.brushShader = createShader(gl, gl.FRAGMENT_SHADER, Viewport.brushShaderSource)
    this.normalBlendShader = createShader(gl, gl.FRAGMENT_SHADER, Viewport.normalBlendShaderSource)
  }

  drawOn(x: number, y: number) {
    let gl = this.gl

    if (!this.strokeLayer) {
      this.strokeLayer = new Layer(gl)
    }

    // Create the program
    const program = createProgram(gl, this.vertexShader, this.brushShader)!// TODO make sure this doesnt get made every time
    gl.useProgram(program)

    // Set the layer's texture sampler
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.layers[0].texture)
    const layerTextureUniformLoc = gl.getUniformLocation(program, "u_layerTexture")
    gl.uniform1i(layerTextureUniformLoc, 0)

    // Set the brush layer's texture sampler
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.strokeLayer.texture)
    const brushLayerTexture = gl.getUniformLocation(program, "u_strokeLayerTexture")
    gl.uniform1i(brushLayerTexture, 1)

    // Set the brush position
    const uniformLocation = gl.getUniformLocation(program, "u_brushOrigin");
    gl.uniform2f(uniformLocation, x, y)

    // Bind the output to the swap layer
    this.swapLayer.bindToFramebuffer(gl)

    // Render
    this.render(program)

    // Swap the swap swap swap
    let tempLayer = this.strokeLayer
    this.strokeLayer = this.swapLayer
    this.swapLayer = tempLayer

    // Cleanup
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, null)
    gl.getError()

    // Update canvas
    this.updateCanvas()
  }

  stopDrawing() {
    if (this.strokeLayer) {
      this.mergeLayers(this.strokeLayer, this.layers[0], this.swapLayer)

      // Swap the swapwapwap
      let tempLayer = this.layers[0]
      this.layers[0] = this.swapLayer
      this.swapLayer = tempLayer

      this.strokeLayer = null //FIX memory leak TODO probably just clear it instead of setting it to null

      // Update canvas
      this.updateCanvas()
    }
  }


  updateCanvas() {
    const gl = this.gl
    let accumulationLayer = new Layer(gl)
    if (this.layers.length === 1) {
      if (this.strokeLayer) {
        this.mergeLayers(this.strokeLayer, this.layers[0], accumulationLayer)
      } else {
        accumulationLayer = this.layers[0]
      }
    } else {
      for (let i = 0; i < this.layers.length - 1; i++) {
        this.mergeLayers(this.layers[i + 1], this.layers[i], accumulationLayer)
      }
      if (this.strokeLayer) {
        this.mergeLayers(this.strokeLayer, accumulationLayer, accumulationLayer)// TODO fix this
      }
    }
    this.drawToCanvas(accumulationLayer.texture)
  }

  /**
  * Draws a texture to the canvas
  * @param {WebGLTexture} texture Texture to draw
  */
  drawToCanvas(texture: WebGLTexture) {
    let gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)

    // Step 2: Set the viewport to match the canvas size.
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)

    // Draw to full screen quad
    let program = createProgram(gl, this.vertexShader, this.fragmentShader)!
    gl.useProgram(program)

    // Set the layer's texture sampler
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    const textureUniformLoc = gl.getUniformLocation(program, "u_layerTexture")
    gl.uniform1i(textureUniformLoc, 0)

    this.render(program)

    // Cleanup
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, null)
    gl.getError()
  }

  /**
  * Merges 2 layers onto a target or into the bottom layer
  * @param {Layer} topLayer - Top layer
  * @param {Layer} bottomLayer - Bottom layer that will be merged on
  * @param {Layer} target - The layer it will be outputted onto
  */
  mergeLayers(topLayer: Layer, bottomLayer: Layer, target: Layer) {// TODO use the right blend shader
    let gl = this.gl

    // Create the program
    const program = createProgram(gl, this.vertexShader, this.normalBlendShader)!// TODO make sure this doesnt get made every time
    gl.useProgram(program)

    // Set the layer's texture sampler
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, topLayer.texture)
    const topTextureUniformLoc = gl.getUniformLocation(program, "u_topLayerTexture")
    gl.uniform1i(topTextureUniformLoc, 0)

    // Set the layer's texture sampler
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, bottomLayer.texture)
    const bottomTextureUniformLoc = gl.getUniformLocation(program, "u_bottomLayerTexture")
    gl.uniform1i(bottomTextureUniformLoc, 1)

    // Bind the output to either the target or the bottom layer
    target.bindToFramebuffer(gl)

    // Render
    this.render(program)

    // Cleanup
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, null)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, null)
    gl.getError()
  }

  /**
  * Setsup the canvas model and uvs then renders
  * @param {WebGLProgram} program The program to use
  */
  render(program: WebGLProgram) {
    const gl = this.gl

    const vertices = [
      -1, -1,
      1, -1,
      -1, 1,
      -1, 1,
      1, -1,
      1, 1,
    ]
    const vertexBuffer = gl.createBuffer()// TODO make sure this doesnt get recreated every time
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW)
    const positionLocation = gl.getAttribLocation(program, "position")
    gl.enableVertexAttribArray(positionLocation)
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)

    // Setup uvs
    const uvs = [
      0.0, 0.0,
      1.0, 0.0,
      0.0, 1.0,
      0.0, 1.0,
      1.0, 0.0,
      1.0, 1.0,
    ]
    const uvBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvs), gl.STATIC_DRAW)
    const uvLocation = gl.getAttribLocation(program, "uv")
    gl.enableVertexAttribArray(uvLocation)
    gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 0, 0)

    // Setup width and height
    const sizeLocation = gl.getUniformLocation(program, "u_size")
    gl.uniform2fv(sizeLocation, [this.domcanvas.width, this.domcanvas.height])

    // Render
    gl.drawArrays(gl.TRIANGLES, 0, 6)

    // Cleanup 
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    gl.getError()
  }

  debug(program: WebGLProgram) {
    const gl = this.gl
    const numAttribs = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES)
    for (let ii = 0; ii < numAttribs; ++ii) {
      const attribInfo = gl.getActiveAttrib(program, ii)!
      const index = gl.getAttribLocation(program, attribInfo.name)
      console.log(index, attribInfo.name);
    }

    const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let ii = 0; ii < numUniforms; ++ii) {
      const uniformInfo = gl.getActiveUniform(program, ii)!;
      const index = gl.getUniformLocation(program, uniformInfo.name);
      console.log(`Uniform - index: ${index}, name: ${uniformInfo.name}, size: ${uniformInfo.size}, type: ${uniformInfo.type}`);
    }

  }
}

// Initiate the canvas thingy
let viewport = new Viewport(viewportdom)
viewport.center()

// Event listeners for mouse events
document.addEventListener('mousedown', () => {
  isDrawing = true
})

document.addEventListener('mouseup', () => {
  isDrawing = false

  viewport.stopDrawing()
})

document.addEventListener('keydown', (event) => {
  // Check if the pressed key is the spacebar (keyCode 32 or key " ")
  if (event.key === " ") {
    spaceDown = true
  }
})

document.addEventListener('keyup', (event) => {
  // Check if the pressed key is the spacebar (keyCode 32 or key " ")
  if (event.key === " ") {
    spaceDown = false
  }
})

viewport.domself.addEventListener('mousemove', (e) => {
  requestAnimationFrame(() => {
    const currentX = e.clientX
    const currentY = e.clientY
    if (spaceDown) {
      viewport.translate(currentX - lastX, currentY - lastY)
    }
    lastX = currentX
    lastY = currentY
  })
})

viewport.domcanvas.addEventListener('mousemove', (e) => {
  requestAnimationFrame(() => {
    const canvasRect = viewport.domcanvas.getBoundingClientRect()
    const currentX = (e.clientX - canvasRect.left) / canvasRect.width;
    const currentY = (e.clientY - canvasRect.top) / canvasRect.height;
    if (isDrawing) {
      viewport.drawOn(currentX, 1 - currentY)
    }
    lastCanvasX = currentX
    lastCanvasY = currentY
  })
})

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
function createShader(gl: WebGL2RenderingContext | WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compilation error:', gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }
  return shader;
}

// Helper function to create a program and link shaders
function createProgram(gl: WebGL2RenderingContext | WebGLRenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader) {
  const program = gl.createProgram()!
  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program linking error:', gl.getProgramInfoLog(program))
    gl.deleteProgram(program)
    return null
  }
  return program
}
// Get the canvas element from the HTML file
const viewportdom = document.getElementById('viewport') as HTMLDivElement

// Variables to store the mouse state
let isDrawing = false
let lastX: number = 0
let lastY: number = 0
let canvasLastX: number | null = 0
let canvasLastY: number | null = 0
// Variable to store key states
let spaceDown = false

class Viewport {
  public domself: HTMLDivElement
  public domtranslate: HTMLDivElement
  public domzoom: HTMLDivElement
  public canvas: HTMLCanvasElement


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
    this.canvas.width = x
    this.canvas.height = y
  }

  constructor(div: HTMLDivElement, sizeX: number = 400, sizeY: number = 400) {
    this.domself = div
    this.domtranslate = document.createElement('div')
    this.domtranslate.id = "translate"
    this.domzoom = document.createElement('div')
    this.domzoom.id = "zoom"
    this.canvas = document.createElement('canvas')
    this.canvas.id = "canvas"

    // Assuming you want to append the created elements as children of _domself
    this.domself.appendChild(this.domtranslate)
    this.domtranslate.appendChild(this.domzoom)
    this.domzoom.appendChild(this.canvas)

    // Set the canvas properties
    this.setCanvasSize(sizeX, sizeY)
  }

  center(): void {
    let x = this.domself.getBoundingClientRect().width
    let y = this.domself.getBoundingClientRect().height
    this.setTransform(x / 2 - this.canvas.width / 2, y / 2 - this.canvas.height / 2)
  }
}

// Initiate the canvas thingy
let viewport = new Viewport(viewportdom)
viewport.center()
const ctx = viewport.canvas.getContext('2d')!
ctx.translate(0.5, 0.5)
ctx.imageSmoothingEnabled = false
ctx.filter = "none"

// Function to draw a line
function drawLine(x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  ctx.closePath()
  console.log(x1, x2, y1, y2)
}

// Event listeners for mouse events
document.addEventListener('mousedown', () => {
  isDrawing = true
})

document.addEventListener('mouseup', () => {
  isDrawing = false
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
  const currentX = e.clientX
  const currentY = e.clientY
  if (spaceDown) {
    if (lastX && lastY)
      viewport.translate(currentX - lastX, currentY - lastY)
  }
  lastX = currentX
  lastY = currentY
})

viewport.canvas.addEventListener('mousemove', (e) => {
  const currentX = e.offsetX
  const currentY = e.offsetY
  if (isDrawing) {
    if (canvasLastX && canvasLastY)
      drawLine(canvasLastX, canvasLastY, currentX, currentY)
  }
  canvasLastX = currentX
  canvasLastY = currentY
})